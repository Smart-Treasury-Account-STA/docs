# Policy-version pinning

**Status: implemented and tested**, in both the PolicyEngine and SmartAccount,
live on Stellar testnet.

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
    pub operation: Symbol,
    pub asset: Address,
    pub destination: Address,
    pub amount: i128,
    pub expected_version: u32,  // pinned at approval time
}
```

The engine compares `expected_version` against the live version and rejects a
mismatch with `VersionMismatch` (2006) — checked second, right after
confirming the engine is initialized, before any asset/recipient/amount rule
is evaluated.

The version is **strictly monotonic**. `bump_version` rejects any value not
greater than the current one (`InvalidVersion`, 2007), so a version cannot be
replayed to resurrect an old approval. An approval that was rejected once
stays rejected.

[SmartAccount](/contracts/smart-account) carries this pin all the way
through: `execute_transfer_payment`/`execute_split_payment` take a caller-
supplied `expected_policy_version` and pass it straight to
`policy_engine.validate_policy` before touching the adapter. Scheduled
payments pin it even earlier — `create_scheduled_payment` overwrites the
caller-supplied value with the _live_ policy version at creation time, so a
schedule is bound to what was actually in effect when the signer approved it,
not whatever version happens to be live when it executes later.

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
4. The engine rejects it — `VersionMismatch`. The 900 payment does not
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

Every bump emits `PolicyVersionBumped { next_version }`. This is the event
that explains why a previously valid approval started being rejected. Index
it.

## Tests

| Test                                                  | Asserts                                                                                                                                       |
| ----------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------- |
| `rejects_stale_policy_version_and_amount_above_limit` | A payment pinned to a version below the current one is rejected `VersionMismatch`; an amount above the new cap is rejected `AmountAboveLimit` |
| `bump_version_rejects_non_increasing_version`         | Bumping to the current version, or lower, is rejected `InvalidVersion`                                                                        |
| `validates_allowed_payment_policy`                    | A payment pinned to the current live version, within all rules, is accepted                                                                   |

Run them with `cargo test -p sta-policy-engine`. See [SmartAccount](/contracts/smart-account)
for the tests covering the pin being carried through `execute_transfer_payment`
and `create_scheduled_payment`, and `docs/TESTNET_DEPLOYMENT.md` in the
`smart-contracts` repository for a live, reproducible stale-version rejection
against the deployed contract.
