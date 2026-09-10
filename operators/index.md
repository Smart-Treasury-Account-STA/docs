# Operator guide

How to run a Smart Treasury Account from the production dApp at
[`smarttreasury.io/app`](https://smarttreasury.io/app), on Stellar mainnet. It
covers the treasury lifecycle in the order an operator meets it: deploy, read,
signers, policy, payments, scheduled payments and the relayer, then pause,
freeze and recovery.

The dApp is an operator console over the contracts documented on this site. It
holds no keys and moves no funds by itself: every state change is a transaction
your wallet signs, and every rule is enforced by the contracts, not by the
interface. Where the interface does not yet cover a contract feature, this page
says so.

::: warning Not independently audited
The STA contracts have not had a third-party security audit. The OpenZeppelin
Stellar libraries they build on have. Treat a mainnet treasury as beta software
and keep balances proportionate. See [Security guarantees](/security/).
:::

## What you need

| Item                   | Detail                                                                                                                                                                                                       |
| ---------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| A Stellar wallet       | Freighter is the wallet the flows below were verified with. The dApp connects through Stellar Wallets Kit, so other kit-supported wallets such as xBull also work.                                           |
| The wallet on mainnet  | The dApp derives its network from the passphrase it is deployed with and shows it in the console header as `Stellar mainnet`; the status pill in "Treasury state" reads `Live mainnet` when the RPC answers. |
| XLM in the wallet      | For transaction fees and, when you deploy, for the new contracts' instance rent. A few XLM is enough for everything on this page.                                                                            |
| XLM or USDC to pay out | The treasury itself needs a balance in the asset it pays. Funding is a plain Stellar Asset Contract transfer to the treasury's contract address (see below).                                                 |

Amounts everywhere in the dApp are raw token units with seven decimals:
`10000000` is 1 XLM or 1 USDC.

## Deploy a treasury

1. Open [`/app/treasuries`](https://smarttreasury.io/app/treasuries) and click
   **Connect wallet**.
2. Click **Deploy new treasury**. The wallet asks for six authorization prompts
   — one for the factory call and one per sub-contract it initializes — and
   the dApp submits them as **one** `account_factory.deploy_account`
   transaction.
3. When it confirms, the dApp registers the new treasury and opens its console.
   The card also appears under "My Treasuries" for the wallet that deployed it.

What one call creates and wires: a `smart_account` plus its own
`policy_engine`, `intent_registry`, `recovery_manager`, `transfer_adapter` and
`split_adapter`. Roles are assigned as follows.

| Role                                | Set to                                              | Changeable later?                                                    |
| ----------------------------------- | --------------------------------------------------- | -------------------------------------------------------------------- |
| Owner of `smart_account`            | The connected wallet                                | Yes, two-step `transfer_ownership` / `accept_ownership`              |
| Sole signer of context rule `0`     | The connected wallet, as a `Delegated` signer       | Yes, from the "Signers and rules" section                            |
| Policy admin (`policy_engine`)      | The connected wallet                                | **No.** Fixed at `initialize`; there is no entrypoint to change it   |
| Recovery admin (`recovery_manager`) | The connected wallet                                | **No.** Same                                                         |
| Guardian threshold                  | `1`, with zero guardians registered                 | Guardians are added afterwards (see below)                           |
| Executor of `intent_registry`       | The shared relayer's address configured in the dApp | Only through a custom-authorized `intent_registry.set_executor` call |

Because the policy and recovery admin keys are permanent, deploy from the key
you intend to keep those roles on.

Cost: creating instances from already-uploaded code is cheap, roughly 0.02 to
0.4 XLM per deployment on mainnet at the time of writing. Uploading new
contract code is what costs more, and a deploy through the factory does not do
that. The factory and the reference treasury it deployed are listed in
[Mainnet deployment](/deployment/mainnet).

**Fund the treasury.** The treasury is a contract address (`C…`). Send it the
asset it will pay out with a Stellar Asset Contract `transfer`, for example
from the Stellar CLI:

```sh
stellar contract invoke \
  --rpc-url <your mainnet RPC> \
  --network-passphrase 'Public Global Stellar Network ; September 2015' \
  --source-account <funding identity> \
  --id CAS3J7GYLGXMF6TDJBBYYSE3HQ6BBSMLNUQ34T6TZMYMW2EVH34XOWMA -- \
  transfer --from <funding G address> --to <treasury C address> --amount 100000000
```

That contract id is mainnet XLM; USDC is
`CCW67TSZV3SSS2HXMBQ5JFGCKJNXKZM7UQUWUZPUTHXSTZLEO7SJMI75`. A freshly deployed
treasury holds nothing and its policy allows nothing — both are deliberate.

## Read the treasury

The console reads every value live from the contracts on each refresh; nothing
is cached from a database.

**Treasury state** shows four tiles:

| Tile             | Source                                                                   |
| ---------------- | ------------------------------------------------------------------------ |
| `Smart account`  | `smart_account.status().initialized`                                     |
| `Spend guard`    | `Active` unless the account is paused or frozen, then `Locked`           |
| `Policy version` | `policy_engine.version()`, the value new approvals are pinned to         |
| `Latest ledger`  | The RPC's latest ledger, the clock every scheduled window is measured in |

**Approval plan** lists the account's context rules (`Rule 0`, its type, how
many signers and policy attachments it has) and then the exact steps a payment
from the connected wallet will go through: which rule it satisfies, and that
the wallet will be asked to sign a SmartAccount authorization entry rather than
a plain transaction.

If the status pill reads `RPC degraded`, the RPC did not answer; nothing on the
page is stale on purpose, it is simply unread until the next refresh.

## Signers and context rules

Section **Signers and rules**. A context rule is the "who" gate on
`smart_account`: an action is authorized when any one rule is fully satisfied.
Rules are listed with their signers; the wallet can only change rules it is
itself registered on.

| Action                            | Control                                                                                                           |
| --------------------------------- | ----------------------------------------------------------------------------------------------------------------- |
| Add a co-signer to a rule         | **Add signer to an existing rule**: pick the rule, enter the address, click **Add signer**                        |
| Create a separate path to control | **Create a new, independent rule**: rule name plus first signer, click **Create rule**                            |
| Revoke a signer                   | **Revoke** next to the signer, then **Confirm revoke** (or **Remove my own key** when it is the connected wallet) |
| Remove a whole rule               | **Remove this rule**                                                                                              |

Each write opens a **Confirm this change** dialog before the wallet prompt.
The dialog lists every consequence the dApp can foresee and, when one of them
would lock the treasury, requires an explicit acknowledgement.

Two rules of the authorization model decide whether a change is safe:

1. **Any satisfied rule authorizes anything.** A new rule is not a limited
   role; its signers get the same power as every other rule's signers. The
   section shows this as **Weakest path to full control** with the smallest
   number of signatures any rule currently needs.
2. **A rule with no policy attached is unanimous.** `smart_account` composes
   OpenZeppelin's account logic, under which a policy-less rule requires
   _every_ registered signer to co-sign. Adding a second signer to rule `0`
   therefore turns "one signature" into "both signatures" for every action that
   rule gates, including signer management itself. This was demonstrated live
   on mainnet: the first call after such an addition failed with
   `Error(Contract, #3002)` (`UnvalidatedContext`) until both keys co-signed a
   removal. The rule row shows `ALL n signers required (no threshold set)` in
   that state, and the confirm dialog blocks the write until you acknowledge it.

The dApp collects one wallet signature per write. A rule that needs several
co-signatures cannot be operated from the interface today; a co-signed
authorization has to be built with the [SDK](/sdk/) or the CLI.

## Policy rules

Section **Policy rules**. `policy_engine` is the "what" gate: it has no
getters, so the dApp reads it by probing `validate_policy` with the values
typed into the **Asset contract**, **Destination** and **Operation** fields and
classifying the rejection code. **Check this combination** reports `allowed` or
the reason, and when the asset is enabled it also finds the single-transfer cap
by bisection (`cap: …`).

Writes are signed by the connected wallet as an ordinary transaction source
(the policy admin is a plain key, not the smart account), and each one is a
separate contract call:

| Write                 | Fields and buttons                                                                            | Contract call           |
| --------------------- | --------------------------------------------------------------------------------------------- | ----------------------- |
| Asset rule            | **Asset contract**, **Single-transfer cap** (raw units); **Enable asset** / **Disable asset** | `set_asset_rule`        |
| Destination allowlist | **Destination**; **Allow destination** / **Remove destination**                               | `set_recipient_allowed` |
| Operation allowlist   | **Operation** (`transfer` or `split`); **Enable operation** / **Disable operation**           | `set_operation_allowed` |
| Version bump          | **Next policy version**; **Bump policy version**                                              | `bump_version`          |

A fresh treasury rejects every payment until all three allowlists have an
entry: the engine is fail-closed. Validation runs in this order and stops at
the first failure, which is the code the probe reports:

| Order | Check                                 | Error                      |
| ----- | ------------------------------------- | -------------------------- |
| 1     | pinned version equals the current one | `2006 VersionMismatch`     |
| 2     | amount is positive                    | `2002 InvalidAmount`       |
| 3     | operation allowlisted                 | `2008 OperationNotAllowed` |
| 4     | asset has an enabled rule             | `2003 AssetNotAllowed`     |
| 5     | amount within the asset's cap         | `2005 AmountAboveLimit`    |
| 6     | destination allowlisted               | `2004 RecipientNotAllowed` |

So a fresh treasury's first rejection is `2008`, and a probe that reaches
`2004` proves the operation, the asset rule and the cap already pass. Bumping the version invalidates every approval pinned to
the old one, including scheduled payments already created; the confirm dialog
warns when queued relayer jobs would be stranded. See
[Policy-version pinning](/security/policy-version-pinning) and the
[PolicyEngine reference](/contracts/policy-engine).

## Payments

Section **SAC payment** for a single destination, **Split payment** for one
asset to several destinations in one call (each destination is validated
against the policy on its own; a whole-payment rejection such as the asset or
operation is reported once, not per line).

1. Fill **Asset contract**, **Destination**, **Amount** and **Policy version**
   (prefilled from the live read) and click **Generate nonce**.
2. **Policy check** runs `validate_policy` in simulation. A rejected payment
   stops here, before any wallet prompt, with the reason from the table above.
3. **Simulate** builds the real transaction in recording mode, which is how
   the dApp discovers the exact authorization tree the smart account needs.
4. **Approve & submit** asks the wallet twice: first for the SmartAccount
   authorization entry (the approval the contracts check), then for the
   transaction envelope. The toast then shows the hash with an explorer link.

Every interactive payment carries a `u64` nonce that `smart_account` consumes
before any value moves, and the policy version it was approved under. Reusing
a nonce is rejected on chain (`NonceAlreadyUsed`); see
[Replay protection](/security/replay-protection).

A transaction that is neither confirmed nor rejected within the dApp's polling
window (about three minutes; mainnet inclusion has taken longer than two under
load) is reported as **pending** with its hash, as a warning rather than a
success or a failure. Follow the hash on the explorer; do not resubmit.

## Scheduled payments

Section **Scheduled payment**. A scheduled payment is an _intent_ recorded in
`intent_registry`: asset, destination, amount, a maximum number of executions,
an interval in ledgers between them, and a ledger window. The relayer can
execute it inside that window and nowhere else.

1. Fill **Asset contract**, **Destination**, **Amount**, **Max executions** and
   **Interval ledgers**, and click **Generate intent ID** (32 random bytes).
2. Set the **Execution window** with the **Opens at** and **Closes at** fields.
   They are wall-clock times that the dApp projects onto ledgers at about five
   seconds each. The window must open at least `12` ledgers after the current
   one when you sign, roughly 70 seconds, so that creating and then queueing
   the job is realistic; a window that has already closed is refused.
3. **Simulate schedule**, then **Approve & create**: the same two wallet
   prompts as a payment. The policy version is pinned at creation.
4. The intent appears in the list below with a status, read from the
   contract each time:

| Status      | Meaning                                |
| ----------- | -------------------------------------- |
| `pending`   | Created; the window has not opened     |
| `active`    | Inside the window with executions left |
| `expired`   | The window closed with executions left |
| `exhausted` | `Max executions` reached               |
| `cancelled` | Cancelled by a signer                  |

5. Click **Queue relayer** on the intent so the relayer picks it up. Creating
   the intent and queueing it are separate steps on purpose: an intent that is
   never queued is never executed by this relayer, and the list says so.

To cancel, click **Load into cancel form** on the intent (or paste its id into
**Intent ID to cancel**) and click **Cancel scheduled payment**: one
SmartAccount authorization prompt. A cancelled intent cannot be executed even
if its window is open.

## Relayer

Section **Scheduled payment relayer**. The relayer is the dApp's server-side
executor: it holds the executor key configured in each treasury's
`intent_registry` and submits `execute_scheduled_payment` for queued jobs
whose window is open. What it can and cannot do is enforced by the contracts,
not by this page: it cannot change the asset, destination, amount, policy
version or window of an intent, cannot execute outside the window, and cannot
execute the same child sequence twice. See
[what the relayer cannot do](/security/).

1. Paste the operator token into **Relayer admin token** and click **Unlock
   session**. The token is exchanged once for an httpOnly session cookie and
   is never kept in the browser; **Lock session** ends it.
2. Each queued job is a card with the intent id, `child_sequence`, its status,
   a note (the last thing the relayer did with it, including the transaction
   hash once executed) and `ledgers <start> - <end>`.
3. **Run due jobs** executes every queued job whose window is open. **Execute**
   on one card runs that job alone. Both are disabled on terminal jobs — the
   button's tooltip reads `This job is executed and will not run again.`

Before submitting, the relayer re-reads the canonical intent and checks
`is_child_executed` on chain; its own job store is bookkeeping, the contract is
the authority. Jobs are stored in Postgres with optimistic versioning, so two
relayer instances cannot both claim the same job.

::: warning No scheduled trigger or alerting yet
Nothing calls the relayer on a timer today. Due jobs run when an operator
clicks **Run due jobs** or when the `pnpm relayer:run` CLI from the dApp
repository posts to `/api/relayer/run`. There is no alerting on failed or
missed executions. Until a scheduled trigger and alerts are deployed, treat
the relayer as an operator-driven tool and check the job cards yourself.
:::

## Pause, freeze and recovery

`smart_account` has two locks and one recovery path; see
[SmartAccount](/contracts/smart-account) for the entrypoints.

- **Pause** (`pause` / `unpause`) is an owner call and reversible. Both were
  exercised on mainnet with the Stellar CLI. While paused the console's
  `Spend guard` tile reads `Locked` and payments are rejected.
- **Freeze** is one-way from the owner's side: there is no `unfreeze()`. The
  only way out is guardian-approved recovery, which overwrites ownership.
- **Guardians** live in `recovery_manager`. Section **Guardians** in the
  console: enter a **Guardian address** and click **Add guardian** (an admin
  call signed by the recovery admin, which under a factory deploy is the
  deploying wallet). A newly added guardian counts toward the threshold only
  after `GUARDIAN_ACTIVATION_DELAY_LEDGERS`, 17 280 ledgers or about one day;
  **Check is_guardian** answers whether an address is _registered_, not
  whether that delay has passed. A fresh treasury has zero guardians, so
  recovery is unusable until at least one has been added and activated.

::: warning Freeze and recovery have no dApp screen yet
The console can register guardians and read the freeze state, nothing more.
`freeze`, `request_guardian_freeze` / `apply_guardian_freeze`, and the
recovery request, approval and finalization calls are operated with the
[SDK](/sdk/) or the Stellar CLI against `recovery_manager` and
`smart_account`. The 17 280-ledger delays are real on mainnet, so plan a
recovery as a multi-day procedure. The model is described in
[Recovery is pulled, never pushed](/contracts/smart-account#recovery-is-pulled-never-pushed).
:::

## TTL maintenance

Soroban state expires. Entries the treasury touches are extended automatically
on every read and write, but a treasury that sits idle for weeks needs an
explicit bump: `smart_account.extend_instance_ttl`, `policy_engine.extend_ttl`
and `intent_registry.extend_intent_ttl` are permissionless and cost only the
fee, because extending a TTL grants no authority. The mainnet record includes
one such call. Details and thresholds are in [Deployment](/deployment/).
