# Implementation status

Last verified: 2026-08-18.

This page states what exists in the contract workspace today. Every other
page documents shipped code — nothing here describes planned code as though
it were live.

## Contracts

All seven production contracts are implemented, tested, and deployed live on
Stellar testnet.

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

| Component                                | Version         | Why                                                                                                                                                                                                                                                                                |
| ---------------------------------------- | --------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `soroban-sdk`                            | 26.1.0          | Pinned to the 26.x line: OpenZeppelin Stellar 0.7.2 requires `^26.1.0`, which excludes 27.x                                                                                                                                                                                        |
| OpenZeppelin Stellar                     | 0.7.2           | `stellar-accounts`, `stellar-access`, `stellar-contract-utils`                                                                                                                                                                                                                     |
| Stellar CLI (deployment)                 | 26.0.0          | Build and deploy — the version used for the live testnet deployment record                                                                                                                                                                                                         |
| Rust (CI, general)                       | latest `stable` | `cargo fmt`/`clippy`/`test`, and `stellar contract build` for the wasm artifacts                                                                                                                                                                                                   |
| Rust (CI, stellar-cli install step only) | 1.96.0 (pinned) | `cargo install --locked stellar-cli` pulls a lockfile-pinned `ethnum` version incompatible with Rust ≥1.97 ([rust-lang/rust#157363](https://github.com/rust-lang/rust/issues/157363)); this one CI step is pinned below that regression while everything else tracks latest stable |

## Testnet deployment

All seven contracts are deployed and live on Stellar testnet, with published
contract addresses, WASM hashes, and transaction references for every
deploy/init/wiring step — see
[`docs/TESTNET_DEPLOYMENT.md`](https://github.com/Smart-Treasury-Account-STA/smart-contracts/blob/v1-full-implementation/docs/TESTNET_DEPLOYMENT.md)
in the `smart-contracts` repository. That record includes a real
signer-authorized SAC payment executed on-chain, live-reproducible policy
rejections (stale version, disallowed recipient, amount above cap), and a
second independently-registered signer under a second context rule
confirming the authorization model isn't specific to the founding deployer
key.

## Downstream: dApp and relayer

A Next.js operator dApp and a scheduled-payment relayer, both targeting this
exact deployment, exist in a separate repository
([`dApp`](https://github.com/Smart-Treasury-Account-STA/dApp)) and are
outside what this documentation site covers — this site documents the
Soroban contracts themselves.

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

These are not gaps in a plan running behind schedule — they're named
boundaries of the current scope. See `docs/V1_SCOPE.md` in the
`smart-contracts` repository for the full detail on each.
