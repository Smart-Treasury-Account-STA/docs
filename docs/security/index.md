# Security guarantees

This section states what the Smart Treasury Account guarantees, why, and which
test proves each claim. A guarantee with no passing test behind it is marked as
pending rather than asserted.

::: warning Audit status
The Smart Treasury Account contracts have **not** been independently audited.
The OpenZeppelin Stellar libraries they build on have been. Both statements
matter; do not collapse them into "audited".
:::

## The two guarantees unique to STA

Most of what a treasury wallet does — multisig thresholds, an emergency pause,
role-based admin — is well-trodden. Two things distinguish STA, and they are
the ones worth scrutinizing:

1. **[Policy-version pinning](/security/policy-version-pinning)** — a policy
   change cannot silently reinterpret an approval made under an earlier policy.
2. **[Replay protection](/security/replay-protection)** — an approved action
   executes exactly once.

This is also why the test suite is weighted the way it is. STA does not
re-test OpenZeppelin's access control and pause primitives; those are covered
by their upstream suite and audit. The tests concentrate on the STA-specific
guarantees. See the [coverage matrix](/testing/coverage).

## Fail-closed by default

Every policy decision denies unless something explicitly permits:

| Situation                          | Result                             |
| ---------------------------------- | ---------------------------------- |
| No rule stored for the asset       | Rejected — `AssetNotAllowed`       |
| Rule stored but `enabled: false`   | Rejected — `AssetNotAllowed`       |
| Recipient never allowlisted        | Rejected — `RecipientNotAllowed`   |
| Recipient allowlisted then revoked | Rejected — `RecipientNotAllowed`   |
| Amount above the configured cap    | Rejected — `AmountAboveLimit`      |
| Amount zero or negative            | Rejected — `InvalidAmount`         |
| Operation other than `transfer`    | Rejected — `OperationNotSupported` |
| Engine never initialized           | Rejected — `NotInitialized`        |

Absence is a denial. `is_recipient_allowed` returns `false` for an address it
has never seen, and `get_asset_rule` returns `None`. There is no code path
where a missing record is read as permission.

Status: **verified** — all eight rows are covered by passing tests.

## System invariants

| Invariant                                                           | Status                                 |
| ------------------------------------------------------------------- | -------------------------------------- |
| Unsupported assets fail closed                                      | Verified                               |
| Unsupported recipients fail closed                                  | Verified                               |
| Amounts above the cap fail closed                                   | Verified                               |
| A stale pinned policy version fails closed                          | Verified                               |
| Policy versions are strictly monotonic                              | Verified                               |
| Treasury assets move only through SmartAccount-authorized execution | Pending — requires `sta-smart-account` |
| Invalid or reused nonces fail closed                                | Pending — requires `sta-smart-account` |
| Paused or frozen accounts reject execution                          | Pending — requires `sta-smart-account` |
| Thresholds cannot be configured into an unusable state              | Pending — requires `sta-smart-account` |

"Verified" means a test asserts it and that test passes. "Pending" means the
contract that would enforce it is not implemented yet — see
[Status](/status).

## What the relayer cannot do

Scheduled execution is delivered in a later tranche, but the boundary is part
of the design and worth stating early: a relayer submits transactions. It never
custodies treasury assets, and it cannot change the asset, destination, amount,
policy version, or execution window of a scheduled payment, because execution
reads canonical intent state from the chain rather than trusting the submitter.

## Reporting an issue

Report suspected vulnerabilities privately to the maintainers rather than
opening a public issue.
