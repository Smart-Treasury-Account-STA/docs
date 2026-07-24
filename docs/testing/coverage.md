# Coverage matrix

Every test-coverage requirement for the MVP contracts, mapped to the test that
covers it. A requirement with no test is marked **pending**, not glossed over.

Verified 2026-07-24 against `cargo test --workspace` — 38 passing, 0 failing.

## Policy

| Requirement                        | Test                                   | State |
| ---------------------------------- | -------------------------------------- | ----- |
| Allowed payment accepted           | `accepts_an_allowed_transfer`          | ✅    |
| Disallowed asset rejected          | `rejects_an_unknown_asset`             | ✅    |
| Explicitly disabled asset rejected | `rejects_a_disabled_asset`             | ✅    |
| Disallowed recipient rejected      | `rejects_an_unknown_recipient`         | ✅    |
| Revoked recipient rejected         | `rejects_a_revoked_recipient`          | ✅    |
| Amount cap exceeded rejected       | `rejects_an_amount_above_the_cap`      | ✅    |
| Amount exactly at the cap accepted | `accepts_an_amount_exactly_at_the_cap` | ✅    |
| Non-positive amount rejected       | `rejects_a_non_positive_amount`        | ✅    |
| Unsupported operation rejected     | `rejects_an_unsupported_operation`     | ✅    |

The boundary case matters: `accepts_an_amount_exactly_at_the_cap` is what
distinguishes `>` from `>=` in the cap check. Without it, an off-by-one that
rejects every payment at exactly the limit passes every other test.

## Policy versioning

| Requirement                                            | Test                                            | State |
| ------------------------------------------------------ | ----------------------------------------------- | ----- |
| Stale `expected_version` rejected after a bump         | `rejects_a_stale_expected_version_after_a_bump` | ✅    |
| The same payment pinned to the new version is accepted | `rejects_a_stale_expected_version_after_a_bump` | ✅    |
| Non-monotonic version bump rejected                    | `rejects_a_non_monotonic_version_bump`          | ✅    |

## Initialization and access control

| Requirement                                 | Test                                       | State |
| ------------------------------------------- | ------------------------------------------ | ----- |
| Initializes once, version starts at 1       | `initializes_with_version_one`             | ✅    |
| Double-initialize rejected                  | `rejects_double_initialize`                | ✅    |
| Validation before initialization rejected   | `rejects_validation_before_initialization` | ✅    |
| Configured rules read back correctly        | `reads_back_configured_rules`              | ✅    |
| Admin entrypoints reject a non-admin caller | `rejects_admin_calls_from_a_non_admin`     | ✅    |

`rejects_admin_calls_from_a_non_admin` tests that STA **wires up**
OpenZeppelin's access control, not that OpenZeppelin's access control works.
That distinction is the whole testing philosophy in one test.

## Signers and thresholds

Requires `sta-smart-account`. See [Status](/status).

| Requirement                                           | State   |
| ----------------------------------------------------- | ------- |
| Add, revoke, and re-weight a signer                   | Pending |
| Revoked signer rejected as an approver                | Pending |
| Duplicate approver entry rejected, not double-counted | Pending |
| Below-threshold rejection                             | Pending |
| Exact-threshold acceptance                            | Pending |
| Multi-signer threshold acceptance                     | Pending |
| Unusable-threshold configuration rejected             | Pending |

## Replay protection

Requires `sta-smart-account`.

| Requirement                                | State   |
| ------------------------------------------ | ------- |
| Nonce consumed exactly once                | Pending |
| Replayed nonce rejected, balance unchanged | Pending |

## SAC execution

Requires `sta-smart-account`.

| Requirement                                      | State   |
| ------------------------------------------------ | ------- |
| Balance moves on success                         | Pending |
| Balance unchanged on **every** rejection path    | Pending |
| Typed payment event emitted                      | Pending |
| Execution without account authorization rejected | Pending |

## Pause and freeze

Requires `sta-smart-account`.

| Requirement                            | State   |
| -------------------------------------- | ------- |
| Paused account rejects execution       | Pending |
| Unpause restores execution             | Pending |
| Frozen account rejects execution       | Pending |
| Unpause does not clear the frozen flag | Pending |

## Authorization

Requires `sta-smart-account`.

| Requirement                                  | State   |
| -------------------------------------------- | ------- |
| `__check_auth` accepts a valid signature set | Pending |
| `__check_auth` rejects a wrong signer        | Pending |
| `__check_auth` rejects a tampered payload    | Pending |

## Summary

| Area                              | Covered | Pending |
| --------------------------------- | ------- | ------- |
| Policy                            | 9       | 0       |
| Policy versioning                 | 3       | 0       |
| Initialization and access control | 5       | 0       |
| Signers and thresholds            | 0       | 7       |
| Replay protection                 | 0       | 2       |
| SAC execution                     | 0       | 4       |
| Pause and freeze                  | 0       | 4       |
| Authorization                     | 0       | 3       |

The pending rows all depend on one crate. They are the next task in sequence,
not an open question about how to test them — each has a named test and an
assertion already specified in the implementation plan.
