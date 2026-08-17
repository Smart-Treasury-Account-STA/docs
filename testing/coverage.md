# Coverage matrix

Every test-coverage requirement, mapped to the test that covers it. A
requirement with no test is marked **pending**, not glossed over.

Verified 2026-08-18 against `cargo test --workspace` — 120 passing, 0 failing,
across all seven production contracts.

## Policy (`sta-policy-engine`, 12 tests)

| Requirement                                                                  | Test                                                           | State |
| ---------------------------------------------------------------------------- | -------------------------------------------------------------- | ----- |
| Allowed payment accepted                                                     | `validates_allowed_payment_policy`                             | ✅    |
| Operation not enabled, unknown asset, unknown recipient rejected in sequence | `fails_closed_for_unknown_operation_asset_or_recipient`        | ✅    |
| Explicitly disabled asset rejected                                           | `validate_policy_rejects_explicitly_disabled_asset`            | ✅    |
| Amount cap exceeded, stale version rejected                                  | `rejects_stale_policy_version_and_amount_above_limit`          | ✅    |
| Non-positive amount rejected                                                 | `validate_policy_rejects_non_positive_amount`                  | ✅    |
| Operation disabled after being enabled blocks further validation             | `disabling_operation_after_the_fact_blocks_further_validation` | ✅    |
| Non-monotonic version bump rejected                                          | `bump_version_rejects_non_increasing_version`                  | ✅    |
| Enabled rule with non-positive cap rejected                                  | `set_asset_rule_rejects_enabled_rule_with_non_positive_cap`    | ✅    |
| Call before `initialize` rejected                                            | `calling_before_initialize_rejects_not_initialized`            | ✅    |
| Persistent entry TTL refreshed on write and read                             | `writes_and_reads_extend_persistent_entry_ttl`                 | ✅    |
| Permissionless `extend_ttl` refreshes named entries                          | `permissionless_extend_ttl_refreshes_named_entries`            | ✅    |
| `contract_name()` reports the expected symbol                                | `contract_name_reports_expected_symbol`                        | ✅    |

## SmartAccount (`sta-smart-account`, 37 tests)

### Payment execution

| Requirement                                                      | Test                                                                    | State |
| ---------------------------------------------------------------- | ----------------------------------------------------------------------- | ----- |
| End-to-end transfer through policy and adapter                   | `executes_transfer_payment_end_to_end_through_policy_and_adapter`       | ✅    |
| Fails closed when the policy engine disallows the asset          | `payment_fails_closed_when_asset_not_allowed_by_policy_engine`          | ✅    |
| Split fans out and policy-checks each recipient independently    | `split_payment_fans_out_and_policy_checks_each_recipient_independently` | ✅    |
| Split fails closed if any one recipient is disallowed            | `split_payment_fails_closed_if_any_single_recipient_is_not_allowed`     | ✅    |
| Split fails closed if any one recipient's amount exceeds the cap | `split_payment_fails_closed_when_one_recipient_amount_exceeds_the_cap`  | ✅    |
| Split rejects a duplicated recipient address                     | `split_payment_rejects_duplicate_recipient`                             | ✅    |
| Execution without SmartAccount authorization fails               | `execute_transfer_payment_without_any_authorization_fails`              | ✅    |

### Replay protection

| Requirement                                                    | Test                                                                     | State |
| -------------------------------------------------------------- | ------------------------------------------------------------------------ | ----- |
| Replayed nonce rejected                                        | `rejects_replayed_nonce`                                                 | ✅    |
| Nonce replay guard shared across transfer and split operations | `nonce_replay_protection_is_shared_across_transfer_and_split_operations` | ✅    |
| Nonce entry's TTL refreshed on consumption                     | `own_instance_and_nonce_ttl_is_extended_on_use`                          | ✅    |

### Pause, freeze, and guardian pull

| Requirement                                                 | Test                                                                                                 | State |
| ----------------------------------------------------------- | ---------------------------------------------------------------------------------------------------- | ----- |
| Paused treasury rejects payment                             | `paused_treasury_rejects_payment`                                                                    | ✅    |
| Frozen treasury rejects payment, no direct `unfreeze()`     | `frozen_treasury_rejects_payment_and_has_no_direct_unfreeze`                                         | ✅    |
| `pause`/`unpause` reject a caller that isn't the owner      | `pause_rejects_caller_that_does_not_match_owner`, `unpause_rejects_caller_that_does_not_match_owner` | ✅    |
| A guardian can independently freeze the treasury            | `guardian_can_independently_freeze_the_treasury`                                                     | ✅    |
| Guardian freeze applied with no request pending is rejected | `apply_guardian_freeze_without_a_request_is_rejected`                                                | ✅    |
| Freezing blocks scheduled execution too                     | `frozen_treasury_blocks_scheduled_execution`                                                         | ✅    |

### Recovery

| Requirement                                            | Test                                                          | State |
| ------------------------------------------------------ | ------------------------------------------------------------- | ----- |
| Recovery replaces owner and lifts freeze, exactly once | `apply_recovery_replaces_owner_and_lifts_freeze_exactly_once` | ✅    |
| Recovery rejected before the request is finalized      | `apply_recovery_before_finalization_is_rejected`              | ✅    |

### Scheduled payments

| Requirement                                                             | Test                                                                                | State |
| ----------------------------------------------------------------------- | ----------------------------------------------------------------------------------- | ----- |
| Creation, then relayer-triggered execution, end to end                  | `scheduled_payment_creation_and_relayer_triggered_execution`                        | ✅    |
| Execution uses only canonical intent data, never caller-supplied values | `execute_scheduled_payment_only_ever_uses_the_canonical_intent_data`                | ✅    |
| A policy-version bump between scheduling and execution blocks execution | `policy_version_bump_after_intent_creation_blocks_execution`                        | ✅    |
| A cancelled schedule cannot execute end to end                          | `cancelled_scheduled_payment_cannot_execute_end_to_end`                             | ✅    |
| The adapter pinned at approval survives a later reconfiguration         | `scheduled_payment_uses_the_adapter_pinned_at_approval_not_a_later_reconfiguration` | ✅    |
| Creating a schedule before any adapter is configured fails fast         | `creating_a_scheduled_payment_before_an_adapter_is_configured_is_rejected`          | ✅    |

### Adapter timelock

| Requirement                                                         | Test                                                        | State |
| ------------------------------------------------------------------- | ----------------------------------------------------------- | ----- |
| Cannot apply before the delay elapses                               | `adapter_change_cannot_be_applied_before_the_delay_elapses` | ✅    |
| Can be cancelled before it takes effect                             | `adapter_change_can_be_cancelled_before_it_takes_effect`    | ✅    |
| Cancelling with nothing pending is rejected                         | `cancel_adapter_change_rejects_when_nothing_is_pending`     | ✅    |
| Applying a change needs no authorization (permissionless by design) | `applying_an_adapter_change_needs_no_authorization`         | ✅    |
| Propose/apply extend the instance TTL                               | `propose_and_apply_adapter_change_extend_the_instance_ttl`  | ✅    |

### Initialization, ownership, and OZ composition

| Requirement                                                     | Test                                                                | State |
| --------------------------------------------------------------- | ------------------------------------------------------------------- | ----- |
| Initializes and reports correct status                          | `initializes_and_reports_status`                                    | ✅    |
| `contract_name()` reports the expected symbol                   | `contract_name_reports_expected_symbol`                             | ✅    |
| `extend_instance_ttl` is permissionless and refreshes TTL       | `extend_instance_ttl_is_permissionless_and_refreshes_ttl`           | ✅    |
| `get_owner` reflects the configured owner                       | `get_owner_reflects_the_configured_owner`                           | ✅    |
| Ownership transfers through the two-step flow                   | `ownership_transfers_through_the_two_step_flow`                     | ✅    |
| A context rule and signer persist through the composed registry | `add_context_rule_and_signer_persist_through_the_composed_registry` | ✅    |
| `ExecutionEntryPoint::execute` dispatches to a target contract  | `execution_entry_point_dispatches_to_a_target_contract`             | ✅    |

## Signers and thresholds: what's intentionally not re-tested

The composed OZ `stellar-accounts`/`stellar-access` primitives — signer
add/revoke/re-weight semantics, threshold-counting math, duplicate-approver
handling — are **not** re-tested in this workspace. That's a deliberate
choice, not a gap: those primitives are covered by OpenZeppelin's own
upstream suite and audit, and duplicating them here would add maintenance
cost while proving nothing new (see [Security](/security/) → "The two
guarantees unique to STA"). What _is_ tested is that STA wires those
primitives up correctly — `add_context_rule_and_signer_persist_through_the_composed_registry`
above — not that OZ's threshold math is itself correct.

One related, explicitly documented **non-guarantee**: a context rule's
stored threshold is not automatically revalidated when its signer set
changes. See [SmartAccount](/contracts/smart-account) and
[Security](/security/) for the full detail — this is an operational risk to
manage, not something a test could assert away.

## IntentRegistry (`sta-intent-registry`, 14 tests), RecoveryManager (`sta-recovery-manager`, 35 tests), WebAuthnVerifier (`sta-webauthn-verifier`, 9 tests), TransferAdapter (`sta-transfer-adapter`, 5 tests), SplitAdapter (`sta-split-adapter`, 8 tests)

Covered by their own per-crate test suites — window/cancellation/cumulative-
usage enforcement, guardian quorum and timelocks, real secp256r1/Ed25519
signature verification, and narrow preauthorized transfer execution
respectively. Run `cargo test -p <crate-name>` for any of them individually;
see [Replay protection](/security/replay-protection) for the IntentRegistry
tests specifically relevant to that guarantee.

## Summary

| Area                                                | Tests                                    |
| --------------------------------------------------- | ---------------------------------------- |
| Policy (`sta-policy-engine`)                        | 12                                       |
| Payment execution (`sta-smart-account`)             | 7                                        |
| Replay protection (`sta-smart-account`)             | 3                                        |
| Pause, freeze, guardian pull (`sta-smart-account`)  | 6 (7 test functions, one row covers two) |
| Recovery (`sta-smart-account`)                      | 2                                        |
| Scheduled payments (`sta-smart-account`)            | 6                                        |
| Adapter timelock (`sta-smart-account`)              | 5                                        |
| Init/ownership/OZ composition (`sta-smart-account`) | 7                                        |
| `sta-intent-registry`                               | 14                                       |
| `sta-recovery-manager`                              | 35                                       |
| `sta-webauthn-verifier`                             | 9                                        |
| `sta-transfer-adapter`                              | 5                                        |
| `sta-split-adapter`                                 | 8                                        |
| **Total**                                           | **120**                                  |

No pending rows remain against this list — everything above has a named,
passing test. The scheduled-payment relayer itself (in the separate `dApp`
repository, out of this site's scope) has its own test suite, including
dedicated replay-protection tests for the executor — see that repository's
`REVIEW.md`.
