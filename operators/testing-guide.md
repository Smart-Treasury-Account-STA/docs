# Testing support guide

A walkthrough for reviewers and operators who want to exercise a Smart
Treasury Account end to end and see the intended rejections with their own
wallet. Every step states what to do and what to expect, so a deviation is a
finding, not a guess.

Two things this guide does **not** do: it never asks you to move real value
through the documented example treasury (its owner key is published as
non-confidential in the deployment record), and it never describes a
rejection you cannot reproduce yourself.

## Two ways to test

| Environment              | Where                                                                                                                                                                                                  | Cost                                                                                | Use it for                                                                                  |
| ------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ----------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------- |
| Production dApp, mainnet | [`https://smarttreasury.io/app`](https://smarttreasury.io/app)                                                                                                                                         | Real XLM: well under 1 XLM for a full walkthrough on a treasury you deploy yourself | Verifying the shipped product against the live mainnet contracts                            |
| Local dApp, testnet      | `git clone` [`Smart-Treasury-Account-STA/dApp`](https://github.com/Smart-Treasury-Account-STA/dApp), `pnpm install`, copy `.env.example` to `.env.local`, `pnpm dev`, open `http://localhost:3000/app` | Free ([Friendbot](https://friendbot.stellar.org) funds testnet accounts)            | Repeating the same flow without spending XLM, or testing a change before it reaches mainnet |

The `.env.example` file ships with the testnet contract set (the
`account_factory`-deployed reference treasury), the testnet passphrase, and the
public SDF testnet RPC. A local run also needs a `DATABASE_URL` (the treasury
registry and the relayer job queue are Postgres tables; the README describes
the Neon setup and `pnpm db:migrate`), and the `RELAYER_*` variables if you
want to exercise the relayer section.

::: warning No public testnet site
The hosted testnet console is not publicly reachable. Test on mainnet with a
treasury you deploy, or run the dApp locally against testnet.
:::

## Setup checklist

- [ ] Freighter (or another Stellar Wallets Kit wallet) installed and switched to the network you are testing. The dApp reads its network from the configured passphrase and shows it in the header (`Stellar mainnet` / `Stellar testnet`); a wallet on the other network cannot produce a valid signature.
- [ ] The connected wallet holds XLM for fees: about 5 XLM is enough on mainnet for a deploy, a handful of policy writes, and two payments.
- [ ] A second, existing account to use as payment destination. It must exist on the network (a never-funded `G…` address makes the simulated transaction fail before any contract runs). On testnet, fund it with Friendbot.
- [ ] Amounts in every form are raw token units with 7 decimals: `10000000` = 1 XLM. Write down the numbers you intend to use before you start.
- [ ] For the relayer steps: the deployment's `RELAYER_ADMIN_TOKEN`, and an executor account that exists and is funded on the network (`NEXT_PUBLIC_RELAYER_EXECUTOR_ADDRESS` in the deployment's environment).

## Walkthrough

Each step lists what to do and what the dApp is expected to show. Contract
error codes are the ones the contracts raise; the dApp maps them to sentences
but the code is what to quote in a bug report.

### 1. Deploy a treasury

**Do:** open `/app/treasuries`, click **Connect wallet**, approve the wallet
prompt, then click **Deploy new treasury**. Approve the six authorization
prompts (one per contract the factory deploys and wires).

**Expect:** one transaction; a "Treasury deployed" toast; a redirect to
`/app/treasuries/<smart_account>`; the new treasury listed under "My
Treasuries" for this wallet on the next visit. On mainnet the instance deploy
costs a fraction of an XLM (the expensive WASM uploads were paid once, at
deployment of the factory — see [Mainnet deployment](/deployment/mainnet)).

### 2. Read the treasury state

**Do:** look at the "Treasury state" panel of the console.

**Expect:**

| Tile             | Fresh treasury                       |
| ---------------- | ------------------------------------ |
| `Smart account`  | `Initialized`                        |
| `Spend guard`    | `Active` (neither paused nor frozen) |
| `Policy version` | `1`                                  |
| `Latest ledger`  | the current ledger, advancing        |

Below it, "Approval plan" lists `Rule 0` with `1 signer · 0 policy
attachments` (the deploying wallet), and "Signers and rules" names the
treasury's weakest rule: `1 signature (Rule 0 · root)`.

### 3. A fresh treasury refuses to pay: fail closed

**Do:** in "SAC payment", leave the prefilled asset and destination, enter
an amount, click **Policy check**.

**Expect:** a rejection with `2008 OperationNotAllowed`, and no wallet prompt.
Nothing is allowed until an operator allows it; `validate_policy` checks the
operation first, then the asset rule, then the cap, then the destination
(see [PolicyEngine](/contracts/policy-engine)).

### 4. Configure the policy

**Do:** in "Policy rules", one wallet signature per write (these go through
the policy engine's admin key, which is the deploying wallet under a factory
deploy):

1. **Enable operation** with operation `transfer`.
2. **Enable asset** with the asset contract you will pay in (for native XLM, the network's XLM Stellar Asset Contract) and a `Single-transfer cap`, for example `50000000` (5 XLM).
3. **Allow destination** with your second account.

**Expect:** a toast per confirmed write, and **Check this combination**
(asset, amount under the cap, allowed destination) now passes with
`allowed` and shows the cap it found.

### 5. Rejections at "Policy check", before any signature

Every case below is rejected by the contract in simulation. The wallet never
opens, and no transaction hash exists — a call designed to fail never reaches
submission.

| Case                        | Do                                                                                                                                          | Expect                                                                                                                                                                                               |
| --------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Amount above the cap        | Amount `60000000` (6 XLM) against a 5 XLM cap, **Policy check**                                                                             | `2005 AmountAboveLimit`                                                                                                                                                                              |
| Destination not allowlisted | Any existing account you did not allow, **Policy check**                                                                                    | `2004 RecipientNotAllowed`                                                                                                                                                                           |
| Stale pinned policy version | In "Policy rules", **Bump policy version** (one signature). Back in "SAC payment", keep `Policy version` at the old value, **Policy check** | `2006 VersionMismatch`. Set the field to the new version and it passes again: an approval carries the version it was approved under (see [Policy-version pinning](/security/policy-version-pinning)) |
| Reused nonce                | After the valid payment of step 6, re-enter its nonce and click **Nonce check** (or **Approve & submit** with it)                           | "Nonce has already been used." (`8005 NonceAlreadyUsed` on `smart_account`); see [Replay protection](/security/replay-protection)                                                                    |

### 6. A valid payment, end to end

**Do:** amount under the cap (for example `10000000`, 1 XLM), the allowed
destination, the current policy version, **Generate nonce**. Click **Policy
check**, then **Simulate**, then **Approve & submit**. The wallet opens
twice: first for the SmartAccount authorization entry, then for the
transaction envelope. Approve both.

**Expect:** a success toast carrying the transaction hash and an explorer
link; the destination's balance increased by the amount; the "Latest ledger"
tile moved past the inclusion ledger. A submission that neither confirms nor
fails inside the polling window (about three minutes) is reported as
**pending** rather than as a failure; check the explorer link before
retrying.

### 7. Scheduled payment and relayer

**Do:**

1. In "Scheduled payment": asset, destination, **Generate intent ID**, amount, `Max executions` `1`, the suggested `Interval ledgers`, and an `Execution window` whose start is at least 12 ledgers ahead of the current one (about 70 s on mainnet, about 60 s on testnet; the form refuses a shorter lead) and whose end is comfortably later.
2. **Simulate schedule**, then **Approve & create** (two wallet prompts, as for a payment).
3. The intent appears in the list with status `pending`. Click **Queue relayer**.
4. In "Scheduled payment relayer", paste the admin token, **Unlock session**. The job card shows the intent id, `child_sequence 0`, its status, and `ledgers <start> - <end>`.
5. Once "Latest ledger" is past the window's start, click **Run due jobs**.

**Expect:** the card flips to `executed` and its note carries the transaction
hash; the destination received the amount. The card's **Execute** button is
now disabled with the tooltip "This job is executed and will not run
again." The guard that matters is on chain: `intent_registry` records each
child sequence as executed, so a second relayer instance, or anyone else
calling `execute_scheduled_payment` for the same child, is rejected by the
contract. The relayer cannot alter the amount, destination, asset, policy
version, or window either — it submits an intent id and a child sequence,
and the contract reads everything else from its own record.

**Cancel before the window:** create a second intent the same way, then use
"Cancel an existing scheduled payment" (or **Load into cancel form** on the
row) and **Cancel scheduled payment** (one wallet prompt). The row shows
`cancelled`; a queued job for it never executes, and **Run due jobs** reports
nothing due for it once its window opens.

::: tip Session cookie, not a stored token
The admin token is exchanged once for an httpOnly session cookie. The token
itself is never kept in browser state or storage.
:::

### 8. Signer lockout guard

**Do:** in "Signers and rules", stage **Add signer** on `Rule 0` with any
second address. Read the confirmation dialog. Cancel.

**Expect:** the dialog warns before the wallet opens:

> This rule has no threshold policy: adding this signer means every signer on
> the rule — including this new one — must co-sign every future action under
> it, including removals. Set a threshold first if you want N-of-M instead of
> all-of-N.

That is the contracts' real behavior for a policy-less rule, demonstrated
live on mainnet in the transaction record below (transaction #13, rejected
with `#3002 UnvalidatedContext`). The dApp catches it before a signature; if
you proceed anyway, only a transaction co-signed by both signers can undo it.

### 9. Guardians

**Do:** in "Guardians", enter an address under **Guardian address** and
click **Add guardian** (signed by the recovery admin, the deploying wallet
under a factory deploy), then enter the same address under **Check an
address** and click **Check is_guardian**.

**Expect:** the check answers `true` immediately — `is_guardian` reports
registration only. Activation takes `GUARDIAN_ACTIVATION_DELAY_LEDGERS` =
17 280 ledgers, about a day at 5-second ledgers, and is enforced where it
matters: a freeze request or a recovery approval from a guardian younger
than that is rejected by `recovery_manager`, even though the check already
said `true`.

## What cannot be tested in one sitting on mainnet

Guardian freeze and recovery, guardian threshold changes, and adapter
reconfiguration each carry a hard-coded ~17 280-ledger (~1 day) delay on the
deployed contracts:

| Flow                                                               | Delay constant                      |
| ------------------------------------------------------------------ | ----------------------------------- |
| Guardian activation                                                | `GUARDIAN_ACTIVATION_DELAY_LEDGERS` |
| Recovery finalization                                              | `MIN_RECOVERY_DELAY_LEDGERS`        |
| Guardian threshold change                                          | `GUARDIAN_CHANGE_DELAY_LEDGERS`     |
| Adapter change (`propose_adapter_change` → `apply_adapter_change`) | `ADAPTER_CHANGE_DELAY_LEDGERS`      |

They were exercised end to end on testnet: guardian freeze, full recovery
(owner and signers replaced), and a threshold change on a throwaway build
with the four constants reduced to 5 ledgers, deployed under its own WASM
hashes and never used by any real treasury — see
[`docs/TESTNET_FACTORY_DEPLOYMENT.md`](https://github.com/Smart-Treasury-Account-STA/smart-contracts/blob/main/docs/TESTNET_FACTORY_DEPLOYMENT.md)
§14 — and the adapter change under the real one-day delay on the original
manual deployment
([`docs/TESTNET_DEPLOYMENT.md`](https://github.com/Smart-Treasury-Account-STA/smart-contracts/blob/main/docs/TESTNET_DEPLOYMENT.md)
§5). The mainnet contracts run the same source at the recorded hashes.

::: warning Recovery has no dApp screen yet
Opening, approving, and finalizing a recovery are contract entrypoints (see
[SmartAccount](/contracts/smart-account)) without a screen in the current
dApp; the console covers guardian registration and lookup only. Exercise the
rest with the CLI or the SDK.
:::

## Reference record and reproducible probes

[`docs/MAINNET_TESTING_TRANSACTIONS.md`](https://github.com/Smart-Treasury-Account-STA/smart-contracts/blob/main/docs/MAINNET_TESTING_TRANSACTIONS.md)
in the contracts repository lists every mainnet transaction of the launch
testing session with explorer links: the WASM uploads, the factory deploy,
the first treasury deploy, funding, the seven policy-configuration writes,
and fifteen signer/payment transactions — XLM and USDC transfers, a split to
two recipients, a scheduled payment created, executed by the relayer role,
and a second one cancelled, `pause`/`unpause`, permissionless TTL
maintenance, `add_signer`/`remove_signer`, `add_context_rule`, and the live
`#3002 UnvalidatedContext` rejection that followed adding a second signer to
a policy-less rule.

The policy rejections are reproducible at any time without a wallet, because
`validate_policy` is a read-only simulation. Against the documented example
treasury's policy engine on mainnet:

```sh
stellar contract invoke \
  --rpc-url https://<your-mainnet-rpc> \
  --network-passphrase 'Public Global Stellar Network ; September 2015' \
  --source-account <any existing G… account> \
  --id CAMM3LIYYW57HU2YF3FEQS5ARYN7ZILF4ETFHTBYHUBNU4SF6MHIOORM -- \
  validate_policy --check '{
    "amount": "600000000",
    "asset": "CAS3J7GYLGXMF6TDJBBYYSE3HQ6BBSMLNUQ34T6TZMYMW2EVH34XOWMA",
    "destination": "GCOMBIYWZ3HIMAS7FLFERQMVZIDVIMFZAAV7A2KMCDV3RAKP5NL5R5BM",
    "expected_version": 1,
    "operation": "transfer"
  }'
```

Expected: `Error(Contract, #2005)` — 60 XLM is above that treasury's 50 XLM
cap. Change the destination to an address not on its allowlist for `#2004`,
or `expected_version` to `2` for `#2006`. The same command with the testnet
RPC, passphrase, and the `.env.example` policy engine id reproduces the
testnet rejections.

## Reporting what you find

Deviations from the expectations above go through
[Reporting issues](/operators/reporting-issues) — publicly for functional
bugs, privately for anything that looks like a way to move funds outside the
policy.
