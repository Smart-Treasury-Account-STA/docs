# Implementation status

Last verified: 2026-07-24.

This page states what exists in the contract workspace today. Every other page
documents either shipped code (marked as such) or a specified interface that is
not yet implemented (also marked as such). Nothing here describes planned code
as though it were live.

## Contracts

| Contract            | Status          | Notes                                                                                                                                             |
| ------------------- | --------------- | ------------------------------------------------------------------------------------------------------------------------------------------------- |
| `sta-policy-engine` | **Implemented** | Asset rules, recipient allowlist, amount caps, policy versioning, fail-closed validation. 16 tests passing. [Reference](/contracts/policy-engine) |
| `sta-smart-account` | **Not started** | Signer model, thresholds, `__check_auth`, pause/freeze, SAC payment execution. [Specified interface](/contracts/smart-account)                    |

## Proof-of-concept contracts

Four earlier PoC crates — `smart_account_poc`, `policy_registry_poc`,
`intent_registry_poc`, `recovery_guard_poc` — remain in the workspace and are
deployed on testnet. They demonstrate patterns; they are **not** the production
contracts and do not execute real Stellar Asset Contract transfers.

They stay in the tree until the production contracts are deployed and the
testnet deployment record is rewritten against them.

## Toolchain

| Component            | Version | Why                                                                                         |
| -------------------- | ------- | ------------------------------------------------------------------------------------------- |
| `soroban-sdk`        | 26.1.1  | Pinned to the 26.x line: OpenZeppelin Stellar 0.7.2 requires `^26.1.0`, which excludes 27.x |
| OpenZeppelin Stellar | 0.7.2   | `stellar-accounts`, `stellar-access`, `stellar-contract-utils`, `stellar-macros`            |
| Stellar CLI          | 27.0.0  | Build and deploy                                                                            |
| Rust                 | 1.95.0  | Pinned in CI                                                                                |

## Deliverable 2 readiness

Milestone 1, Deliverable 2 asks for a test suite plus full technical
documentation and testnet deployment scripts. Against that bar:

| Requirement                                     | State                                                                                          |
| ----------------------------------------------- | ---------------------------------------------------------------------------------------------- |
| Documented test command producing passing tests | **Met** — `cargo test --workspace`, 38 passing. [Details](/testing/)                           |
| Tests for policy checks                         | **Met** — see the [coverage matrix](/testing/coverage)                                         |
| Tests for policy-version-mismatch rejection     | **Met**                                                                                        |
| Tests for signer rules and threshold edge cases | **Pending** — requires `sta-smart-account`                                                     |
| Tests for SAC payment execution                 | **Pending** — requires `sta-smart-account`                                                     |
| Tests for nonce replay rejection                | **Pending** — requires `sta-smart-account`                                                     |
| Tests for pause/freeze behaviour                | **Pending** — requires `sta-smart-account`                                                     |
| Full technical documentation                    | **In progress** — this site; PolicyEngine complete, SmartAccount specified but not implemented |
| Testnet deployment scripts                      | **Pending**                                                                                    |

The pending rows are not gaps in the plan; they are the tasks that follow the
one just completed. What is claimed as met above is claimed because it was run,
not because the code exists.
