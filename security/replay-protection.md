# Replay protection

**Status: implemented and tested**, in both SmartAccount and IntentRegistry,
live on Stellar testnet.

## The problem

An authorized payment is a signed artifact. If nothing consumes it, anyone
holding a copy can submit it again. The signatures are valid every time; the
treasury pays every time.

## Two mechanisms, two lifetimes

STA distinguishes interactive payments from scheduled ones, because they have
different execution models.

### Interactive payments: nonces

Every interactive action (`execute_transfer_payment`, `execute_split_payment`)
carries a `u64` nonce. [SmartAccount](/contracts/smart-account) records
consumed nonces and rejects reuse with `NonceAlreadyUsed` (error code 8005).

The ordering is the part that matters — from `execute_transfer_payment`:

```rust
env.current_contract_address().require_auth();
ensure_active(&env)?;
consume_nonce(&env, nonce)?;   // reject-if-used, then mark used — before anything else

if amount <= 0 { /* ... */ }
PolicyEngineClient::new(&env, &policy_engine).validate_policy(/* ... */);
TransferAdapterClient::new(&env, &adapter).execute_transfer(&asset, &destination, &amount);
```

The nonce is consumed **before** the adapter call and the transfer, not
after. A Stellar Asset Contract is well-behaved, but the treasury should not
depend on that: if a token could call back into the account mid-transfer, a
nonce consumed afterwards would still be unconsumed during the re-entrant
call, and the same authorization would spend twice.

Clients can preflight with `is_nonce_used(nonce)` and reject a reused nonce
before requesting any wallet signature, so the user is never asked to sign
something that cannot succeed.

This was demonstrated live, not just in the local test suite: a real
signer-authorized `execute_transfer_payment` on testnet flipped
`is_nonce_used(1)` from `false` to `true` — see `docs/TESTNET_DEPLOYMENT.md`
§6.4 in the `smart-contracts` repository.

### Scheduled payments: child execution IDs

A scheduled intent is not one payment but a series, tracked in
`intent_registry`. Each execution is identified by a child sequence number
bound to a ledger window, and the registry records which child sequences
have been consumed (`is_child_executed`).

An execution is attempted only when the current ledger is inside the window,
the cumulative execution count is below the configured maximum, the intent
is not cancelled, and the child sequence is not already executed. The
submitter cannot widen the window or reuse a sequence, because
`execute_scheduled_payment` reads canonical intent state from the chain via
`intent_registry.mark_child_executed`/`get_intent` rather than trusting
whatever the caller supplies — see [SmartAccount](/contracts/smart-account)
for why `execute_scheduled_payment` deliberately takes only an intent ID and
child sequence as arguments.

## Why this is not the host's nonce

Soroban's host tracks nonces for authorization entries. STA keeps its own
explicit nonce on the payment entrypoint anyway, for two reasons: the treasury
needs to expose replay state to clients for preflight (`is_nonce_used`), and
the guarantee should be legible in the contract that makes it rather than
inherited implicitly from the host.

## Tests

| Test                                                                                      | Asserts                                                                                    |
| ----------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------ |
| `rejects_replayed_nonce`                                                                  | A second submission with the same nonce is rejected `NonceAlreadyUsed`                     |
| `nonce_replay_protection_is_shared_across_transfer_and_split_operations`                  | A nonce consumed by a transfer payment cannot be reused by a split payment, and vice versa |
| `own_instance_and_nonce_ttl_is_extended_on_use`                                           | The persistent nonce entry's TTL is refreshed on consumption, not left to decay            |
| `rejects_execution_outside_window` (`sta-intent-registry`)                                | A child execution outside the configured ledger window is rejected                         |
| `cancelled_intent_cannot_execute` (`sta-intent-registry`)                                 | A cancelled intent rejects further execution regardless of window/count                    |
| `cumulative_execution_limit_is_enforced_across_distinct_children` (`sta-intent-registry`) | Total executions across all children cannot exceed `max_executions`                        |
| `creates_intent_and_marks_child_execution_once` (`sta-intent-registry`)                   | A given child sequence can be marked executed exactly once                                 |

Run them with `cargo test -p sta-smart-account` and `cargo test -p sta-intent-registry`.
Every rejection test asserts the underlying balance/state is unchanged — a
rejection that still moved funds is the failure mode that matters, and only
a balance assertion catches it.
