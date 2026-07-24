# Replay protection

::: danger Not yet implemented
Replay protection lives in the SmartAccount, which
[does not exist in the workspace yet](/status). This page documents the
specified mechanism. No test currently proves it.
:::

## The problem

An authorized payment is a signed artifact. If nothing consumes it, anyone
holding a copy can submit it again. The signatures are valid every time; the
treasury pays every time.

## Two mechanisms, two lifetimes

STA distinguishes interactive payments from scheduled ones, because they have
different execution models.

### Interactive payments: nonces

Every interactive action carries a `u64` nonce. The account records consumed
nonces and rejects reuse.

The ordering is the part that matters:

```rust
// ...checks passed...
storage::consume_nonce(e, nonce);                    // 5. consume first
TokenClient::new(e, &asset).transfer(/* ... */);     // 6. then transfer
```

The nonce is consumed **before** the transfer, not after. A Stellar Asset
Contract is well-behaved, but the treasury should not depend on that: if a
token could call back into the account mid-transfer, a nonce consumed
afterwards would still be unconsumed during the re-entrant call, and the same
authorization would spend twice.

Clients can preflight with `is_nonce_used(nonce)` and reject a reused nonce
before requesting any wallet signature, so the user is never asked to sign
something that cannot succeed.

### Scheduled payments: child execution IDs

A scheduled intent is not one payment but a series. Each execution is
identified by a child sequence number bound to a ledger window, and the
registry records which child sequences have been consumed.

An execution is attempted only when the current ledger is inside the window,
the execution count is below the maximum, the intent is not cancelled, and the
child sequence is not already executed. The submitter cannot widen the window
or reuse a sequence, because execution reads canonical intent state from the
chain rather than trusting what was submitted.

This lands in a later tranche alongside `IntentRegistry`.

## Why this is not the host's nonce

Soroban's host tracks nonces for authorization entries. STA keeps its own
explicit nonce on the payment entrypoint anyway, for two reasons: the treasury
needs to expose replay state to clients for preflight (`is_nonce_used`), and
the guarantee should be legible in the contract that makes it rather than
inherited implicitly from the host.

## Tests

Specified in the implementation plan, not yet written:

| Test                                                  | Will assert                                                      |
| ----------------------------------------------------- | ---------------------------------------------------------------- |
| `executes_an_approved_payment_and_consumes_the_nonce` | The balance moves and the nonce is marked used                   |
| `rejects_a_replayed_nonce_without_moving_funds`       | A second submission is rejected **and the balance is unchanged** |

Every rejection test asserts the balance is unchanged. A rejection that still
moved funds is the failure mode that matters, and only a balance assertion
catches it.
