# Implementation status

Last verified: 2026-09-10.

This page states what exists today across the contracts, the production dApp
and relayer, the TypeScript SDK, and this documentation. Every other page
documents shipped code — nothing here describes planned code as though it
were live.

## Contracts

All seven production contracts are implemented and tested. All seven are
deployed on Stellar testnet; six are deployed on Stellar mainnet through
`account_factory` (`sta-webauthn-verifier` is only needed for passkey signers
and is not deployed there yet).

| Contract                | Status          | Notes                                                                                                                                                 |
| ----------------------- | --------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------- |
| `sta-smart-account`     | **Implemented** | Root treasury authority, custom account, 37 tests passing. [Reference](/contracts/smart-account)                                                      |
| `sta-policy-engine`     | **Implemented** | Asset/recipient/operation allowlists, amount caps, policy versioning, fail-closed validation. 12 tests passing. [Reference](/contracts/policy-engine) |
| `sta-intent-registry`   | **Implemented** | Scheduled-payment lifecycle, execution windows, exactly-once child execution. 14 tests passing.                                                       |
| `sta-recovery-manager`  | **Implemented** | Guardian quorum, timelocked guardian administration, guardian-pulled freeze, finalized recovery record. 35 tests passing.                             |
| `sta-transfer-adapter`  | **Implemented** | Narrow, preauthorized single-recipient SAC transfer. 5 tests passing.                                                                                 |
| `sta-split-adapter`     | **Implemented** | Narrow, preauthorized one-to-many SAC transfer. 8 tests passing.                                                                                      |
| `sta-webauthn-verifier` | **Implemented** | Real secp256r1/passkey signature verification backing `Signer::External`. 9 tests passing.                                                            |

120 tests total, `cargo test --workspace`, 0 failures.

## Proof-of-concept contracts

Four earlier PoC crates — `smart_account_poc`, `policy_registry_poc`,
`intent_registry_poc`, `recovery_guard_poc` — still exist on disk in the
`smart-contracts` repository's `contracts/` directory but are **not** members
of the Cargo workspace and are not built, tested, or deployed by anything
current. They predate the OpenZeppelin-composed V1 rewrite, use a different
`soroban-sdk` version, and do not execute real Stellar Asset Contract
transfers. Their earlier testnet deployment record is archived separately —
not part of what to review.

## Toolchain

| Component                                | Version         | Why                                                                                                                                                                                                                                     |
| ---------------------------------------- | --------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `soroban-sdk`                            | 26.1.0          | Pinned to the 26.x line: OpenZeppelin Stellar 0.7.2 requires `^26.1.0`, which excludes 27.x                                                                                                                                             |
| OpenZeppelin Stellar                     | 0.7.2           | `stellar-accounts`, `stellar-access`, `stellar-contract-utils`                                                                                                                                                                          |
| Stellar CLI (build and deployment)       | 26.0.0 exactly  | The CLI stamps its version into every artifact's `cliver` metadata, so the deployed WASM hashes only reproduce with this version — see [Mainnet deployment](/deployment/mainnet)                                                        |
| Rust (contract builds)                   | 1.94.1 (pinned) | Pinned by the repository's toolchain file; the reference build host is the Linux x86_64 CI runner                                                                                                                                       |
| Rust (CI, stellar-cli install step only) | 1.96.0 (pinned) | `cargo install --locked stellar-cli` pulls a lockfile-pinned `ethnum` version incompatible with Rust ≥1.97 ([rust-lang/rust#157363](https://github.com/rust-lang/rust/issues/157363)); this one CI step is pinned below that regression |

## Testnet deployment

All seven contracts are deployed and live on Stellar testnet, with published
contract addresses, WASM hashes, and transaction references for every
deploy/init/wiring step — see
[`docs/TESTNET_DEPLOYMENT.md`](https://github.com/Smart-Treasury-Account-STA/smart-contracts/blob/main/docs/TESTNET_DEPLOYMENT.md)
in the `smart-contracts` repository. That record includes a real
signer-authorized SAC payment executed on-chain, live-reproducible policy
rejections (stale version, disallowed recipient, amount above cap), and a
second independently-registered signer under a second context rule
confirming the authorization model isn't specific to the founding deployer
key.

## Mainnet deployment

`account_factory` and a first example treasury are live on Stellar mainnet:
addresses, WASM hashes, initialization parameters, and every transaction of
the setup and testing sessions are in
[`docs/MAINNET_DEPLOYMENT.md`](https://github.com/Smart-Treasury-Account-STA/smart-contracts/blob/main/docs/MAINNET_DEPLOYMENT.md)
and
[`docs/MAINNET_TESTING_TRANSACTIONS.md`](https://github.com/Smart-Treasury-Account-STA/smart-contracts/blob/main/docs/MAINNET_TESTING_TRANSACTIONS.md);
summarized on [Mainnet deployment](/deployment/mainnet). Exercised there with
real transactions: XLM and USDC transfers, split payments, scheduled payment
create/execute/cancel, pause/unpause, TTL maintenance, signer and context-rule
management. Not exercised on mainnet because of their real ~24 h timelocks:
guardian freeze/recovery and adapter reconfiguration. On testnet the adapter
change was proven under the real delay, and freeze/recovery on a reduced-delay
throwaway build — see the [Testing support guide](/operators/testing-guide).

## Production dApp, relayer, and SDK

| Component                  | Status                                                                                                                                                                                                                                                                                                                                                                  |
| -------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Production dApp            | **Live** at [`smarttreasury.io/app`](https://smarttreasury.io/app) on mainnet (repository [`dApp`](https://github.com/Smart-Treasury-Account-STA/dApp), branch `main`). Deploys treasuries through the factory, reads state live, manages signers, rules, policy, one-shot, split, and scheduled payments. See the [Operator guide](/operators/).                       |
| Testnet dApp               | Deployed from branch `testnet` as a Vercel preview; not publicly reachable. Run it locally against testnet instead (see the [Testing support guide](/operators/testing-guide)).                                                                                                                                                                                         |
| Relayer                    | **Live** inside the dApp: durable job queue in Postgres, idempotent execution (on-chain `is_child_executed` check plus optimistic locking), operator console in the dApp. **Not yet**: a scheduled trigger and alerting — due jobs run on operator action today (the console's "Run due jobs" or `pnpm relayer:run`), and there is no fallback runbook beyond that CLI. |
| Recovery in the dApp       | **Not built**: guardians can be added and checked from the dApp; freeze, recovery proposal, approval, and finalization have no screen and are operated through the SDK or CLI.                                                                                                                                                                                          |
| TypeScript SDK (`sta-sdk`) | Published on npm. `0.1.x` targets testnet only; `0.2.0` adds the mainnet configuration and examples and was being published at the time of writing — check `npm view sta-sdk version`. See [TypeScript SDK](/sdk/).                                                                                                                                                     |
| dApp ↔ SDK                 | The dApp uses the SDK's typed event parsing; its transaction preparation and SmartAccount authorization encoding are still its own code, not the SDK's `prepare*` helpers.                                                                                                                                                                                              |

## What's deliberately not built

- **`ConditionVerifier`** (optional proof-gated execution using signed
  external attestations) — explicitly out of scope, not part of the
  reviewed concerns.
- **Scoped session keys** — a bounded-delegation signer model (per-action
  scope, cumulative amount caps, expiry, single-use auto-revoke) is
  specified in the architecture but not implemented; treated as a separate,
  larger feature rather than folded in under time pressure.
- **Multisig admin/owner role** — the owner/admin role that proposes
  governance changes is still a single key, not itself a multisig. Design
  notes for distributing it exist but nothing is implemented.
- **Third-party security audit** — an internal/independent review pass
  found and fixed real defects across three rounds, but the contracts have
  not been through a professional external audit. Do not represent them as
  audited.
- **Any-one-of-N signer rules** — a context rule with several signers and no
  policy attached requires _all_ of them to co-sign. "Any one of N" needs a
  threshold policy contract that is implemented (`threshold_policy`) but not
  deployed. The dApp warns before a write that would make a rule unanimous.

These are not gaps in a plan running behind schedule — they're named
boundaries of the current scope. See `docs/V1_SCOPE.md` in the
`smart-contracts` repository for the full detail on each.
