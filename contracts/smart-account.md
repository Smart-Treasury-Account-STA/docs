# SmartAccount

**Crate:** `sta-smart-account` · **Status:** implemented, 37 tests passing, deployed on Stellar testnet

The SmartAccount is the root treasury authority. It is a Soroban custom
account: it holds the treasury's Stellar Asset Contract balances (indirectly,
via narrowly preauthorized adapters) and authorizes its own outgoing calls
through `__check_auth`.

## Responsibilities

- Treasury initialization, owner and subordinate-module wiring
- Signer records, context rules, and thresholds (via composed OpenZeppelin state)
- Custom account authorization via `__check_auth`
- Policy-version binding and nonce replay protection
- Pause, one-way freeze, and guardian-pulled recovery
- Timelocked adapter reconfiguration
- Scheduled payment creation, cancellation, and execution
- Execution coordination with [PolicyEngine](/contracts/policy-engine)

## Built on OpenZeppelin's smart account

The signer model, context rules, and authorization payload come from
`stellar_accounts::smart_account` rather than being reinvented:

```rust
pub enum Signer {
    Delegated(Address),
    External(Address, Bytes),
}

pub struct ContextRule {
    pub id: u32,
    pub context_type: ContextRuleType,
    pub name: String,
    pub signers: Vec<Signer>,
    pub signer_ids: Vec<u32>,
    pub policies: Vec<Address>,
    pub policy_ids: Vec<u32>,
    pub valid_until: Option<u32>,
}

pub struct AuthPayload {
    pub signers: Map<Signer, Bytes>,
    pub context_rule_ids: Vec<u32>,
}
```

`__check_auth` delegates entirely to `stellar_accounts::smart_account::do_check_auth`
— this contract does not implement custom-account authorization itself.
Signature verification — including WebAuthn/passkeys via
`stellar_accounts::verifiers` — is the toolkit's job, not STA's. There is no
hand-rolled verifier.

Every governance and payment entrypoint funnels through the same
`env.current_contract_address().require_auth()` call, so whether a given
signer is a wallet key ([`Signer::Delegated`](/contracts/smart-account)) or a
passkey (`Signer::External`, via
[`webauthn_verifier`](https://github.com/Smart-Treasury-Account-STA/smart-contracts))
is transparent to every piece of downstream treasury logic.

The composed OZ trait defaults also give this contract, unmodified:
`get_context_rules_count`, `get_context_rule`, `add_context_rule`,
`add_signer`, `remove_signer`, `add_policy`, `remove_policy`,
`update_context_rule_name`, `update_context_rule_valid_until`,
`remove_context_rule`, `get_signer_id`, `get_policy_id`, `get_owner`, two-step
`transfer_ownership`/`accept_ownership`/`renounce_ownership`, and
`ExecutionEntryPoint::execute` (dispatch to an arbitrary target contract,
gated the same way as everything else).

## Entrypoints written for this treasury

| Entrypoint                                                                                               | Auth                                                                                      | Purpose                                                                                                                                                             |
| -------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `initialize(owner, initial_signers, initial_policies, policy_engine, intent_registry, recovery_manager)` | Owner                                                                                     | Bootstraps the root `Default` context rule and pins the three subordinate module addresses. Callable once.                                                          |
| `status() -> AccountStatus`                                                                              | None                                                                                      | `{ initialized, paused, frozen, policy_version_hint }`. `policy_version_hint` is currently always `0` — read `policy_engine.version()` for the authoritative value. |
| `is_nonce_used(nonce) -> bool`                                                                           | None                                                                                      | Replay preflight for clients.                                                                                                                                       |
| `extend_instance_ttl()`                                                                                  | None (permissionless)                                                                     | TTL maintenance for this contract's own instance storage — extending TTL creates no authority.                                                                      |
| `propose_adapter_change(operation, adapter)`                                                             | Owner                                                                                     | Proposes rewiring which adapter handles an operation. Takes effect only after a ~1 day timelock (`ADAPTER_CHANGE_DELAY_LEDGERS`) — see below.                       |
| `cancel_adapter_change(operation)`                                                                       | Owner                                                                                     | Withdraws a pending proposal before it takes effect.                                                                                                                |
| `apply_adapter_change(operation)`                                                                        | None (permissionless once the delay has elapsed)                                          | Commits a proposed adapter change.                                                                                                                                  |
| `freeze()`                                                                                               | Owner                                                                                     | One-way emergency stop — see below.                                                                                                                                 |
| `apply_guardian_freeze()`                                                                                | None (permissionless)                                                                     | Pulls a guardian-raised freeze flag from `recovery_manager` and applies it, for when the owner key itself is the compromised one.                                   |
| `execute_transfer_payment(asset, destination, amount, nonce, expected_policy_version)`                   | This contract's own custom auth                                                           | Single-recipient SAC payment.                                                                                                                                       |
| `execute_split_payment(asset, recipients, amounts, nonce, expected_policy_version)`                      | This contract's own custom auth                                                           | One-to-many SAC payment, independently policy-checked per recipient.                                                                                                |
| `create_scheduled_payment(intent)`                                                                       | This contract's own custom auth                                                           | Registers a scheduled/recurring payment intent in `intent_registry`.                                                                                                |
| `cancel_scheduled_payment(intent_id)`                                                                    | This contract's own custom auth                                                           | Cancels a previously created schedule.                                                                                                                              |
| `execute_scheduled_payment(intent_id, child_sequence)`                                                   | None (permissionless — gated one level down by `intent_registry`'s configured `Executor`) | Executes an already-approved scheduled payment.                                                                                                                     |
| `apply_recovery(request_id) -> Address`                                                                  | None (permissionless once `recovery_manager` reports the request finalized)               | Force-overwrites ownership to the guardian-approved replacement and lifts the freeze.                                                                               |
| `pause(caller)` / `unpause(caller)`                                                                      | Owner, **and** `caller` must equal the owner                                              | OZ's `Pausable` default plus an extra caller-matches-owner check.                                                                                                   |
| `__check_auth(...)`                                                                                      | —                                                                                         | Custom account authorization, delegated to `do_check_auth`.                                                                                                         |

37 functions are exported in total; the remainder are the unmodified OZ
trait defaults listed above.

## Two deliberate design decisions

### There is no `unfreeze()`

Pause is reversible; **freeze is not**, by design. Unfreezing only ever
happens as a side effect of `apply_recovery` — a guardian threshold plus a
timelock in [`recovery_manager`](https://github.com/Smart-Treasury-Account-STA/smart-contracts),
which is implemented and deployed alongside this contract, not a later
tranche. This is not a hypothetical: `apply_guardian_freeze()` exists
specifically so guardians can stop spend authority even when the owner key
itself is the one compromised, without needing the owner's cooperation —
`freeze()` alone is owner-gated and wouldn't cover that case.

### Threshold-vs-signer-set consistency is _not_ automatically enforced

Earlier drafts of this page claimed the account "sums the weights of active
signers... and rejects a threshold that exceeds it." That protection does
not exist. If a `weighted_threshold` (or `simple_threshold`) policy is
attached to a context rule, its stored threshold is **not** automatically
revalidated when signers are added to or removed from that rule — this is an
explicitly documented upstream characteristic of the composed OZ crate, not
something this contract adds or removes. Removing a signer can push
available weight below the stored threshold; adding one without configuring
its weight silently changes the effective approval ratio. See
[`docs/V1_SCOPE.md`](https://github.com/Smart-Treasury-Account-STA/smart-contracts/blob/v1-full-implementation/docs/V1_SCOPE.md)
§ "Signer Set Divergence" for the full detail and the operational runbook
this implies.

## Payment execution order

```rust
// execute_transfer_payment / execute_split_payment:
// 1. Require this contract's own authorization for exactly these
//    arguments, so __check_auth runs the context rule, signers, and
//    policies (see AuthPayload above).
// 2. Guards: not paused, not frozen (ensure_active).
// 3. Replay: reject an already-consumed nonce, then mark it consumed.
// 4. amount > 0 (checked per recipient for a split).
// 5. Policy: cross-contract validate_policy, pinned to the caller's
//    expected_policy_version.
// 6. Execute the real SAC transfer via the narrow adapter.
// 7. Emit the typed payment event.
```

Nonce consumption happens _before_ the adapter call, on purpose: a token
with a transfer callback cannot re-enter and spend the same nonce twice.
Step 5 delegates to `policy_engine` rather than duplicating the version
comparison, so there is one authority on what a policy version means. A
split payment additionally rejects a duplicated recipient address up front
(`DuplicateRecipient`) and validates that `recipients`/`amounts` are the
same length (`RecipientAmountLengthMismatch`) before any policy check runs.

## Adapter reconfiguration is timelocked

`propose_adapter_change`/`apply_adapter_change`/`cancel_adapter_change`
exist because immediate, undelayed reconfiguration of _where funds are
routed_ was a finding from an independent security review
([`docs/SMART_CONTRACT_AUDIT_REPORT.md`](https://github.com/Smart-Treasury-Account-STA/smart-contracts/blob/v1-full-implementation/docs/SMART_CONTRACT_AUDIT_REPORT.md)
finding 3). A proposal only takes effect `ADAPTER_CHANGE_DELAY_LEDGERS`
(~1 day) after it's proposed — the same delay `recovery_manager` uses for
its own timelocks — giving anyone monitoring the account a window to react
(pause, or have guardians freeze) before a compromised owner's redirect
takes effect. `apply_adapter_change` is itself permissionless: the
authorization decision already happened at proposal time, so _when_ an
already-approved change lands needs no further gate.

## Scheduled payments pin what was approved, not what's current

`create_scheduled_payment` overwrites the caller-supplied `policy_version`
and `adapter` fields with the _live_ `policy_engine.version()` and
currently-configured `transfer_adapter` at creation time — a schedule is
pinned to what was actually in effect when the signer approved it.
`execute_scheduled_payment` takes only `intent_id` and `child_sequence` from
its caller (deliberately — this entrypoint is permissionless, so accepting
caller-supplied asset/destination/amount/policy-version would let anyone
able to satisfy `intent_registry`'s executor auth redirect an approved
payment); every other value is read back from the canonical
`ScheduledIntent` record after `intent_registry.mark_child_executed`
succeeds. The adapter dispatched to is the one pinned at approval time, not
whatever is currently configured — a later `apply_adapter_change` cannot
silently redirect an already-approved schedule.

## Recovery is pulled, never pushed

`apply_recovery` and `apply_guardian_freeze` both pull state from
`recovery_manager` on this contract's own terms — `recovery_manager` has no
knowledge of, or dependency on, this specific treasury contract. Both are
permissionless (the actual authorization — guardian quorum, timelock — has
already happened inside `recovery_manager`); this contract's only job is to
decide, once, whether to consume a finalized outcome (`AppliedRecovery`
replay guard on `apply_recovery`) or a raised freeze flag.

## Errors

| Code | Variant                         | Raised when                                                                     |
| ---- | ------------------------------- | ------------------------------------------------------------------------------- |
| 8000 | `AlreadyInitialized`            | `initialize` called a second time                                               |
| 8001 | `NotInitialized`                | Any gated entrypoint called before `initialize`                                 |
| 8002 | `Paused`                        | A payment/schedule entrypoint called while paused                               |
| 8003 | `Frozen`                        | A payment/schedule entrypoint called while frozen                               |
| 8004 | `AdapterNotConfigured`          | No adapter set (yet) for the requested operation                                |
| 8005 | `NonceAlreadyUsed`              | Replay: the supplied nonce was already consumed                                 |
| 8006 | `InvalidAmount`                 | Amount is zero or negative                                                      |
| 8007 | `RecipientAmountLengthMismatch` | Split payment: `recipients`/`amounts` length differs                            |
| 8008 | `EmptySplit`                    | Split payment: `recipients` is empty                                            |
| 8009 | `RecoveryNotFinalized`          | `apply_recovery` called before `recovery_manager` reports the request finalized |
| 8010 | `RecoveryAlreadyApplied`        | `apply_recovery` called a second time for the same `request_id`                 |
| 8011 | `Unauthorized`                  | Reserved for OZ's own access-control failures                                   |
| 8012 | `GuardianFreezeNotRequested`    | `apply_guardian_freeze` called with no guardian-raised flag pending             |
| 8013 | `DuplicateRecipient`            | Split payment: the same recipient address appears twice                         |
| 8014 | `NoPendingAdapterChange`        | `apply_adapter_change`/`cancel_adapter_change` with nothing proposed            |
| 8015 | `AdapterChangeDelayNotElapsed`  | `apply_adapter_change` called before its timelock elapsed                       |

`NonceAlreadyUsed` (8005) and a stale `expected_policy_version` rejected
inside `policy_engine` (`VersionMismatch`, 2006 — see
[PolicyEngine](/contracts/policy-engine)) are the two specific rejections
demonstrated live on testnet — see
[`docs/TESTNET_DEPLOYMENT.md`](https://github.com/Smart-Treasury-Account-STA/smart-contracts/blob/v1-full-implementation/docs/TESTNET_DEPLOYMENT.md)
§6.4–§6.5.

## Events

| Event                      | Topics     | Fields                                                                                                       |
| -------------------------- | ---------- | ------------------------------------------------------------------------------------------------------------ |
| `Initialized`              | `init`     | `owner` (topic)                                                                                              |
| `AdapterChangeProposed`    | `adapterp` | `operation` (topic), `adapter`, `effective_ledger`                                                           |
| `AdapterChangeCancelled`   | `adaptrc`  | `operation` (topic)                                                                                          |
| `AdapterChanged`           | `adapter`  | `operation` (topic), `adapter`                                                                               |
| `Frozen`                   | `frozen`   | `triggered_by_guardian` — distinguishes an owner `freeze()` from a guardian-pulled `apply_guardian_freeze()` |
| `TransferPaid`             | `pay_ok`   | `asset` (topic), `destination` (topic), `amount`, `nonce`                                                    |
| `SplitPaid`                | `splt_ok`  | `asset` (topic), `recipient_count`, `nonce`                                                                  |
| `ScheduledPaymentExecuted` | `auto_ok`  | `intent_id` (topic), `child_sequence`, `asset`, `destination`, `amount`                                      |
| `RecoveryApplied`          | `recover`  | `request_id` (topic), `replacement_owner`                                                                    |

`TransferPaid` is the event to look for confirming the live testnet demo
payment — see `docs/TESTNET_DEPLOYMENT.md` §6.4.

## Storage

Instance storage holds this contract's own config (`Initialized`, the three
subordinate module addresses, the frozen flag, the adapter map, and any
pending adapter changes) under one shared TTL, refreshed on every call that
reaches `ensure_initialized`. Persistent storage holds per-nonce
(`UsedNonce(u64)`) and per-recovery-request (`AppliedRecovery(BytesN<32>)`)
replay guards, refreshed on write. OZ's own composed signer/context-rule/
policy storage manages its TTL internally — this contract does not touch it.

| Constant                       | Ledgers | Approx.  |
| ------------------------------ | ------- | -------- |
| `TTL_THRESHOLD_LEDGERS`        | 501,120 | ~29 days |
| `TTL_EXTEND_TO_LEDGERS`        | 518,400 | ~30 days |
| `ADAPTER_CHANGE_DELAY_LEDGERS` | 17,280  | ~1 day   |

## Compiled artifact

```
wasm/sta_smart_account.wasm — 65,076 bytes optimized, 37 exported functions
```

Live deployed WASM hash and testnet contract ID: see
[`docs/TESTNET_DEPLOYMENT.md`](https://github.com/Smart-Treasury-Account-STA/smart-contracts/blob/v1-full-implementation/docs/TESTNET_DEPLOYMENT.md).
