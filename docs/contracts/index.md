# Contract architecture

The Smart Treasury Account is a set of Soroban contracts. The treasury itself
is a Soroban **custom account**: it holds Stellar Asset Contract balances and
authorizes its own outgoing calls through `__check_auth`, rather than being a
wallet that an admin key drains.

## Modules

| Module                | Responsibility                                                                                                                                                                            | Status                                  |
| --------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------- |
| **SmartAccount**      | Root treasury authority. Signer records, roles, weights, threshold validation, `__check_auth`, policy-version binding, nonce replay protection, pause and freeze, execution coordination. | Not implemented                         |
| **PolicyEngine**      | Asset allowlists, recipient allowlists, amount caps, policy version checks, fail-closed validation.                                                                                       | [Implemented](/contracts/policy-engine) |
| **Payment execution** | Validates and performs the Stellar Asset Contract transfer for an approved payment, and emits the payment event.                                                                          | Not implemented                         |
| **IntentRegistry**    | Scheduled payment intents, execution windows, child execution IDs, replay protection for scheduled execution.                                                                             | Later tranche                           |
| **RecoveryManager**   | Guardian-driven recovery, delayed signer replacement, restoring a frozen treasury to service.                                                                                             | Later tranche                           |
| **ConditionVerifier** | Optional proof-gated execution using signed external attestations.                                                                                                                        | Later tranche                           |

See [Status](/status) for what that means in practice today.

## Built on OpenZeppelin

STA does not write its own access control, pause primitive, signature
verification, or smart-account plumbing. It builds on OpenZeppelin's Stellar
libraries (0.7.2):

| Library                  | Used for                                                                                                   |
| ------------------------ | ---------------------------------------------------------------------------------------------------------- |
| `stellar-access`         | Admin and role-based access control on administrative entrypoints                                          |
| `stellar-contract-utils` | The audited `Pausable` primitive                                                                           |
| `stellar-accounts`       | The `SmartAccount` trait — context rules, signers, `AuthPayload`, `do_check_auth` — and the `Policy` trait |
| `stellar-macros`         | Access-control and pause attribute macros                                                                  |

Signature verification, including WebAuthn and passkeys, is delegated to
`stellar_accounts::verifiers`. STA writes treasury logic, not cryptography.

::: warning Audit status
OpenZeppelin's libraries are audited. **The Smart Treasury Account contracts
themselves have not been independently audited.** Do not represent them as
audited.
:::

## How an approved payment flows

This is the target flow for the production contracts. The PolicyEngine half is
live; the SmartAccount half is specified and not yet implemented.

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

| #   | Actor                         | Step                                                                                   | On failure              |
| --- | ----------------------------- | -------------------------------------------------------------------------------------- | ----------------------- |
| 4   | Client → SmartAccount         | `execute_transfer_payment(asset, destination, amount, nonce, expected_policy_version)` | —                       |
| 5   | SmartAccount                  | `__check_auth`: context rule, signers, weights, thresholds                             | Rejected, nothing moves |
| 6   | SmartAccount                  | Reject if paused or frozen                                                             | Rejected, nothing moves |
| 7   | SmartAccount                  | Reject if the nonce was already consumed                                               | Rejected, nothing moves |
| 8   | SmartAccount → PolicyEngine   | `validate_policy(check)` cross-contract                                                | Rejected, nothing moves |
| 9   | SmartAccount                  | **Consume the nonce**                                                                  | —                       |
| 10  | SmartAccount → Asset Contract | `transfer(smart_account, destination, amount)`                                         | —                       |
| 11  | SmartAccount                  | Emit the typed payment event                                                           | —                       |

Two orderings in that sequence are load-bearing rather than incidental:

- **The nonce is consumed before the transfer.** A token with a callback cannot
  re-enter and spend the same nonce twice.
- **The policy version is passed through to the engine**, not compared inside
  the account. There is exactly one authority on what a version means.

## Separation of concerns

The account decides _who_ may act. The engine decides _what_ may be done. They
are separate contracts so a policy change is an ordinary transaction against
the engine, and so the engine can be simulated on its own — which is what lets
a client preflight a payment and get the same answer the chain will give.

The engine also implements OpenZeppelin's `Policy` trait, so it can be attached
directly to a context rule and enforced as part of `__check_auth`.
