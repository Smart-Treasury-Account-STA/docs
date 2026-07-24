# Policy-version pinning

**Status: implemented and tested** in the PolicyEngine.

## The problem

A treasury approves a payment under one set of rules. Time passes — an approval
sits waiting for a second signer, a scheduled payment waits for its window.
Meanwhile an admin changes policy: raises a cap, allowlists a recipient,
disables an asset.

In a naive design, the pending payment is then evaluated against whatever the
policy happens to say at execution time. The approvers authorized one thing;
the chain executes another. Nobody lied, nobody was compromised, and the
semantics still changed underneath the approval.

Standard multisig does not address this. It answers _who signed_, not _what
they were agreeing to_.

## The mechanism

Every policy-checked action carries the version it was approved under:

```rust
pub struct PolicyCheck {
    pub asset: Address,
    pub destination: Address,
    pub amount: i128,
    pub expected_version: u32,  // pinned at approval time
    pub operation: Symbol,
}
```

The engine compares `expected_version` against the live version and rejects a
mismatch with `PolicyVersionMismatch` (2007) before evaluating any rule.

The version is **strictly monotonic**. `bump_version` rejects any value not
greater than the current one, so a version cannot be replayed to resurrect an
old approval. An approval that was rejected once stays rejected.

## What this buys

A policy change **invalidates** outstanding approvals rather than
reinterpreting them. The failure mode becomes a visible rejection that forces
re-approval, instead of a silent change in meaning.

That is a deliberate trade: STA chooses a rejected payment over a payment that
executed under rules nobody approved.

## Worked example

A treasury allows USDC transfers to a vendor, capped at 1,000.

1. Policy is at version 4. Alice prepares a 900 USDC payment and pins
   `expected_version: 4`. It waits for Bob's signature.
2. An admin lowers the cap to 500 and calls `bump_version(5)`.
3. Bob signs. The payment is submitted with `expected_version: 4`.
4. The engine rejects it — `PolicyVersionMismatch`. The 900 payment does not
   execute against a policy that now caps transfers at 500.
5. Alice re-prepares under version 5. The engine now rejects it as
   `AmountAboveLimit` — the honest answer.

Without pinning, step 4 would have evaluated the 900 payment against the new
cap and rejected it for the right reason by luck. Reverse the change — an admin
_raising_ a cap — and the naive design silently lets through a payment larger
than anyone approved.

## Operator consequence

Bumping the policy version invalidates every prepared-but-unexecuted approval
pinned to the old version. Client applications should say so before submitting
a bump; this is a user-visible consequence, not an implementation detail.

## Audit signal

Every bump emits `VersionBumped { previous, next }`. This is the event that
explains why a previously valid approval started being rejected. Index it.

## Tests

| Test                                            | Asserts                                                                                                  |
| ----------------------------------------------- | -------------------------------------------------------------------------------------------------------- |
| `rejects_a_stale_expected_version_after_a_bump` | A payment valid at version 1 is rejected after a bump to 2, and the same payment pinned to 2 is accepted |
| `rejects_a_non_monotonic_version_bump`          | Bumping to the current version or lower is rejected                                                      |
| `initializes_with_version_one`                  | A fresh engine starts at version 1                                                                       |

Run them with `cargo test -p sta-policy-engine`.

The SmartAccount side — passing `expected_policy_version` through
`execute_transfer_payment` to the engine before moving funds — is
[specified but not implemented](/contracts/smart-account).
