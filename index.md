---
layout: home

hero:
  name: Smart Treasury Account
  text: Programmable treasury contracts on Stellar
  tagline: Policy-enforced payments, approvals, and recovery — enforced onchain by Soroban contracts instead of manual wallet operations.
  actions:
    - theme: brand
      text: Contract architecture
      link: /contracts/
    - theme: alt
      text: Run the test suite
      link: /testing/
    - theme: alt
      text: Security model
      link: /security/

features:
  - title: Policy-version pinning
    details: Every approved action carries the policy version it was approved under. A later policy change invalidates that approval instead of silently reinterpreting it.
    link: /security/policy-version-pinning
  - title: Nonce replay protection
    details: Each interactive action carries a nonce that is consumed exactly once, before any value moves. A replayed nonce fails closed.
    link: /security/replay-protection
  - title: Fail-closed policy
    details: An unknown asset, an unknown recipient, a missing rule, or an unrecognized operation is a rejection — never a default-allow.
    link: /contracts/policy-engine
  - title: Audited primitives
    details: Access control and pause are OpenZeppelin's audited Stellar libraries. STA writes the treasury logic on top, not its own crypto or access control.
    link: /contracts/
---

## What this documents

The Smart Treasury Account (STA) is a programmable treasury wallet built on
Stellar and Soroban. It holds Stellar Asset Contract balances and enforces
policy on payments, approvals, automation, and recovery through smart
contracts.

This site is the technical documentation for the contracts: what each module
does, what every entrypoint expects, what the errors and events mean, which
guarantees the system makes, how to run the test suite that proves them, and
how to deploy to testnet.

It is written for developers integrating with the contracts, reviewers
verifying the guarantees, and operators running a treasury.

## Where to start

| If you want to                            | Read                                               |
| ----------------------------------------- | -------------------------------------------------- |
| Understand how the contracts fit together | [Contract architecture](/contracts/)               |
| Call the policy layer                     | [PolicyEngine reference](/contracts/policy-engine) |
| Verify the security claims                | [Security guarantees](/security/)                  |
| Run the tests yourself                    | [Running the tests](/testing/)                     |
| See exactly what is implemented today     | [Status](/status)                                  |

## Implementation status

The contract core is being delivered in tranches. Not every module documented
in the architecture exists yet, and this site marks clearly which is which
rather than describing planned code as though it shipped. See
[Status](/status) for the current picture.
