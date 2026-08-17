# Security guarantees

This section states what the Smart Treasury Account guarantees, why, and which
test proves each claim. A guarantee with no passing test behind it is marked as
pending rather than asserted.

::: warning Audit status
The Smart Treasury Account contracts have **not** been independently audited
by a third party. An internal/independent review pass found and fixed real
defects across three rounds (see `docs/SMART_CONTRACT_AUDIT_REPORT.md` in
the `smart-contracts` repository), but that is not the same thing. The
OpenZeppelin Stellar libraries they build on have been professionally
audited. Do not collapse these into "audited".
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

| Situation                          | Result                           |
| ---------------------------------- | -------------------------------- |
| No rule stored for the asset       | Rejected — `AssetNotAllowed`     |
| Rule stored but `enabled: false`   | Rejected — `AssetNotAllowed`     |
| Recipient never allowlisted        | Rejected — `RecipientNotAllowed` |
| Recipient allowlisted then revoked | Rejected — `RecipientNotAllowed` |
| Amount above the configured cap    | Rejected — `AmountAboveLimit`    |
| Amount zero or negative            | Rejected — `InvalidAmount`       |
| Operation not explicitly enabled   | Rejected — `OperationNotAllowed` |
| Engine never initialized           | Rejected — `NotInitialized`      |

Absence is a denial. An unknown recipient or operation reads as `false`
against its allowlist. There is no code path where a missing record is read
as permission.

Status: **verified** — every row is covered by a passing test, and the
version-mismatch and asset/recipient/amount rejections are additionally
reproducible live on testnet — see `docs/TESTNET_DEPLOYMENT.md` in the
`smart-contracts` repository.

## System invariants

| Invariant                                                                                                                   | Status   |
| --------------------------------------------------------------------------------------------------------------------------- | -------- |
| Unsupported assets fail closed                                                                                              | Verified |
| Unsupported recipients fail closed                                                                                          | Verified |
| Amounts above the cap fail closed                                                                                           | Verified |
| A stale pinned policy version fails closed                                                                                  | Verified |
| Policy versions are strictly monotonic                                                                                      | Verified |
| Treasury assets move only through SmartAccount-authorized execution                                                         | Verified |
| Invalid or reused nonces fail closed                                                                                        | Verified |
| Paused or frozen accounts reject execution                                                                                  | Verified |
| A split payment cannot move funds to a disallowed recipient by hiding it inside an approved total                           | Verified |
| A scheduled payment executes the exact asset/destination/amount/adapter approved at creation, never a caller-supplied value | Verified |

"Verified" means a test asserts it and that test passes — see the
[coverage matrix](/testing/coverage) and [SmartAccount](/contracts/smart-account)
for the specific tests behind each row.

::: warning Not a guaranteed invariant: threshold-vs-signer-set consistency
Earlier drafts of this page implied thresholds can't be misconfigured into
an unusable state. That's not accurate. If a `weighted_threshold` (or
`simple_threshold`) policy is attached to a context rule, its stored
threshold is **not** automatically revalidated when signers are added to or
removed from that rule — an explicitly documented upstream characteristic of
the composed OpenZeppelin crate, not something this project adds or removes.
This is an operational risk to manage (review weights/threshold before
changing a signer set), not a protection the contracts enforce. See
[SmartAccount](/contracts/smart-account) for detail.
:::

## What the relayer cannot do

The scheduled-payment relayer (in the separate `dApp` repository, out of
this site's contract-only scope) submits transactions. It never custodies
treasury assets, and it cannot change the asset, destination, amount, policy
version, or execution window of a scheduled payment: `execute_scheduled_payment`
takes only an intent ID and child sequence from its caller, and reads every
other value back from `intent_registry`'s canonical record rather than
trusting whatever the submitter supplies. This is enforced by the contracts
documented here, independent of which relayer implementation calls them.

## Reporting an issue

Report suspected vulnerabilities privately to the maintainers rather than
opening a public issue.
