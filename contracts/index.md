# Contract architecture

The Smart Treasury Account is a set of Soroban contracts. The treasury itself
is a Soroban **custom account**: it holds Stellar Asset Contract balances and
authorizes its own outgoing calls through `__check_auth`, rather than being a
wallet that an admin key drains.

## Modules

Seven contracts are implemented and deployed on Stellar testnet:

| Module                                       | Responsibility                                                                                                                                                                                                                             | Status                                  |
| -------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | --------------------------------------- |
| **[SmartAccount](/contracts/smart-account)** | Root treasury authority. Custom account (`__check_auth`), context rules/signers/thresholds, policy-version binding, nonce replay protection, pause/freeze/recovery, adapter timelock, scheduled-payment lifecycle, execution coordination. | [Implemented](/contracts/smart-account) |
| **[PolicyEngine](/contracts/policy-engine)** | Operation/asset/recipient allowlists, amount caps, policy version checks, fail-closed validation.                                                                                                                                          | [Implemented](/contracts/policy-engine) |
| **TransferAdapter / SplitAdapter**           | Narrow, preauthorized Stellar Asset Contract execution — single-recipient and one-to-many. Only reachable through SmartAccount, never called directly by a client.                                                                         | Implemented                             |
| **IntentRegistry**                           | Canonical scheduled-payment state: execution windows, cumulative usage, executor-gated exactly-once child execution.                                                                                                                       | Implemented                             |
| **RecoveryManager**                          | Guardian quorum, timelocked guardian administration, guardian-pulled emergency freeze, finalized-recovery record that SmartAccount pulls from.                                                                                             | Implemented                             |
| **WebAuthnVerifier**                         | Passkey/secp256r1 signature verification backing `Signer::External`, wired for real cryptography — no dApp write path exercises it yet.                                                                                                    | Implemented                             |
| **ConditionVerifier**                        | Optional proof-gated execution using signed external attestations.                                                                                                                                                                         | Not yet included — explicitly deferred  |

See [Status](/status) and each module's own page for the live testnet
addresses, WASM hashes, and full entrypoint/error/event reference.

## Built on OpenZeppelin

STA does not write its own access control, pause primitive, signature
verification, or smart-account plumbing. It builds on OpenZeppelin's Stellar
libraries (0.7.2), used by [SmartAccount](/contracts/smart-account):

| Library                  | Used for                                                                                                      |
| ------------------------ | ------------------------------------------------------------------------------------------------------------- |
| `stellar-access`         | `Ownable` — owner storage, two-step `transfer_ownership`/`accept_ownership`                                   |
| `stellar-contract-utils` | The audited `Pausable` primitive                                                                              |
| `stellar-accounts`       | The `SmartAccount` trait — context rules, signers, `AuthPayload`, `do_check_auth` — used by SmartAccount only |

[PolicyEngine](/contracts/policy-engine) is deliberately **not** composed
into this authorization layer — it does not implement OZ's `Policy` trait
and is not attached to a context rule. It is a separate contract that
SmartAccount calls cross-contract, on purpose: by the time a call reaches
`validate_policy`, SmartAccount has already decided _who_ is authorized;
PolicyEngine decides a different question — whether the treasury's own risk
rules allow the action at all, independent of signer identity. See
"Separation of concerns" below.

Signature verification, including WebAuthn and passkeys, is delegated to
`stellar_accounts::verifiers`. STA writes treasury logic, not cryptography.

::: warning Audit status
OpenZeppelin's libraries are audited. **The Smart Treasury Account contracts
themselves have not been independently audited** by a third party — an
internal/independent review pass did find and fix eleven real defects across
three rounds (see `docs/SMART_CONTRACT_AUDIT_REPORT.md` in the
`smart-contracts` repo), but that is not the same as a professional external
audit. Do not represent them as audited.
:::

## How an approved payment flows

This is the live flow on the deployed testnet contracts, not a target —
both halves below are implemented and reproducible; see
[`docs/TESTNET_DEPLOYMENT.md`](https://github.com/Smart-Treasury-Account-STA/smart-contracts/blob/v1-full-implementation/docs/TESTNET_DEPLOYMENT.md)
in the `smart-contracts` repo for a real executed transaction.

### Preflight — off-chain, nothing committed

| #   | Caller → target       | Call                     | Purpose                                                                         |
| --- | --------------------- | ------------------------ | ------------------------------------------------------------------------------- |
| 1   | Client → PolicyEngine | `version()`              | Read the live version and **pin it** into the approval                          |
| 2   | Client → PolicyEngine | `validate_policy(check)` | Simulated. Same answer the chain will give, because the entrypoint is read-only |
| 3   | Client → SmartAccount | `is_nonce_used(nonce)`   | Reject a reused nonce **before** asking the wallet to sign                      |

Preflight exists so a user is never asked to approve something that cannot
succeed. It is an ergonomic layer, not a security boundary — the contract
checks below are the authority.

### Execution — on-chain

| #   | Actor                                           | Step                                                                                   | On failure              |
| --- | ----------------------------------------------- | -------------------------------------------------------------------------------------- | ----------------------- |
| 4   | Client → SmartAccount                           | `execute_transfer_payment(asset, destination, amount, nonce, expected_policy_version)` | —                       |
| 5   | SmartAccount                                    | `__check_auth`: context rule, signers, thresholds                                      | Rejected, nothing moves |
| 6   | SmartAccount                                    | Reject if paused or frozen                                                             | Rejected, nothing moves |
| 7   | SmartAccount                                    | Reject if the nonce was already consumed, **then consume it**                          | Rejected, nothing moves |
| 8   | SmartAccount                                    | Reject if `amount <= 0`                                                                | Rejected, nothing moves |
| 9   | SmartAccount → PolicyEngine                     | `validate_policy(check)` cross-contract, pinned to `expected_policy_version`           | Rejected, nothing moves |
| 10  | SmartAccount → TransferAdapter → Asset Contract | `transfer(smart_account, destination, amount)`                                         | —                       |
| 11  | SmartAccount                                    | Emit `TransferPaid`                                                                    | —                       |

Two orderings in that sequence are load-bearing rather than incidental:

- **The nonce is consumed before the transfer** (step 7, ahead of the policy
  check and the transfer itself). A token with a callback cannot re-enter and
  spend the same nonce twice.
- **The policy version is passed through to the engine**, not compared inside
  the account. There is exactly one authority on what a version means.

See [SmartAccount](/contracts/smart-account) for the split-payment variant
(independent per-recipient policy checks, duplicate-recipient rejection) and
the scheduled-payment path, which pins `expected_policy_version` and the
adapter at _creation_ time rather than at execution time.

## Separation of concerns

The account decides _who_ may act. The engine decides _what_ may be done. They
are separate contracts so a policy change is an ordinary transaction against
the engine, and so the engine can be simulated on its own — which is what lets
a client preflight a payment and get the same answer the chain will give.

The engine is **not** attached to a context rule and does not implement
OpenZeppelin's `Policy` trait — it is called cross-contract from inside
SmartAccount's own entrypoint logic instead, after `__check_auth` has
already run. This is a deliberate choice, not an oversight: it keeps the
question "is this signer set authorized" (SmartAccount + OZ's composed
context-rule model) fully independent from "does this action pass the
treasury's risk rules" (PolicyEngine) — an authorized signer set alone is
never sufficient to move funds.
