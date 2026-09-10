# Reporting issues

Two channels, chosen by what the report could enable. If in doubt, treat it
as a security report.

## Security vulnerabilities: privately

Anything that could move funds outside the configured policy, sign on behalf
of a signer who did not sign, replay a consumed nonce or child sequence, skip
a timelock, or reach a treasury from a relayer or dApp component that should
not, is a security report. Do **not** open a public issue for it, and do not
post transaction hashes that demonstrate it; the contracts on mainnet hold
real value.

Report it privately to the maintainers listed on the
[Smart-Treasury-Account-STA](https://github.com/Smart-Treasury-Account-STA)
GitHub organization, as the [security model](/security/) page also asks.

::: warning No dedicated security mailbox yet
There is no `SECURITY.md` or published security address in the repositories
today, and GitHub's private vulnerability reporting is not enabled on them.
Contact a maintainer of the organization directly. This page will be updated
when a dedicated channel exists.
:::

Include:

| Item                 | Why it matters                                                                                         |
| -------------------- | ------------------------------------------------------------------------------------------------------ |
| Network              | mainnet or testnet — the same source runs on both, but the state differs                               |
| Contract ids         | the `smart_account` involved, plus the `policy_engine` / `intent_registry` if the report is about them |
| Transaction hash     | if you already submitted something; an explorer link is enough                                         |
| Steps                | exact entrypoint or dApp action, arguments, and the signer that authorized it                          |
| Expected vs observed | what the [security guarantees](/security/) say should happen, and what happened                        |
| Wallet and version   | Freighter or other, with its version, if the dApp is involved                                          |
| Browser              | name and version, if the dApp is involved                                                              |

What to expect: a maintainer acknowledges the report, reproduces it, and
coordinates a fix and disclosure with you. No response time is promised: this
is a small team without an on-call rotation, and saying otherwise here would
be a claim the project cannot back.

## Bugs and questions: GitHub issues

Everything else goes to the issue tracker of the repository it concerns:

| Repository                                                                                | Report here when                                                                  |
| ----------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------- |
| [`smart-contracts`](https://github.com/Smart-Treasury-Account-STA/smart-contracts/issues) | a contract entrypoint, error, event, deployment script, or the deployment records |
| [`sdk`](https://github.com/Smart-Treasury-Account-STA/sdk/issues)                         | `sta-sdk`: configuration, transaction preparation, event parsing, examples        |
| [`dApp`](https://github.com/Smart-Treasury-Account-STA/dApp/issues)                       | the console at `smarttreasury.io/app`, the relayer, the treasury registry         |
| [`docs`](https://github.com/Smart-Treasury-Account-STA/docs/issues)                       | this site: a wrong statement, a broken link, a missing page                       |

A useful issue fits this template:

```md
**Network:** mainnet | testnet
**Component:** contract `<name>` | sdk `<module>` | dApp `<section>` | docs `<page>`
**Contract / treasury id:** C…
**Transaction hash (if any):** …

**Steps**

1. …
2. …

**Expected**
…

**Observed**
… (paste the exact error text or contract error code, e.g. `Error(Contract, #2005)`)

**Environment:** wallet + version, browser + version, sta-sdk version, stellar-cli version
```

Rejections that are part of the design — `2004 RecipientNotAllowed`, `2005
AmountAboveLimit`, `2006 VersionMismatch`, `8005 NonceAlreadyUsed`, `#3002
UnvalidatedContext` after a second signer joined a policy-less rule — are
documented in the [testing support guide](/operators/testing-guide); check
there before filing, and file if the documented expectation and the observed
behavior differ.

## Documentation corrections

A wrong statement on this site is a bug in the `docs` repository. Every page
has an "Edit this page" link at the bottom that opens the source file on
GitHub; a pull request there is welcome.
