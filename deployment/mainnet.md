# Mainnet deployment

The Smart Treasury Account contracts are live on Stellar mainnet (Public
Network). This page is the operator-facing summary; the authoritative record —
every address, WASM hash, and transaction hash with explorer links — is
[`docs/MAINNET_DEPLOYMENT.md`](https://github.com/Smart-Treasury-Account-STA/smart-contracts/blob/main/docs/MAINNET_DEPLOYMENT.md)
in the `smart-contracts` repository, with the full transaction log in
[`docs/MAINNET_TESTING_TRANSACTIONS.md`](https://github.com/Smart-Treasury-Account-STA/smart-contracts/blob/main/docs/MAINNET_TESTING_TRANSACTIONS.md)
and integration notes in
[`docs/MAINNET_DAPP_DEVELOPER_GUIDE.md`](https://github.com/Smart-Treasury-Account-STA/smart-contracts/blob/main/docs/MAINNET_DAPP_DEVELOPER_GUIDE.md).
When this page and the record disagree, the record is right.

## Network

| Item               | Value                                                                                                                                                                                                                    |
| ------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Network passphrase | `Public Global Stellar Network ; September 2015`                                                                                                                                                                         |
| RPC                | No free SDF-hosted mainnet Soroban RPC exists. Pick a provider from the [Stellar RPC provider list](https://developers.stellar.org/docs/data/apis/rpc/providers); the production dApp uses a public gateway.fm endpoint. |
| Explorer           | `https://stellar.expert/explorer/public`                                                                                                                                                                                 |
| Production dApp    | [`https://smarttreasury.io/app`](https://smarttreasury.io/app) — see the [Operator guide](/operators/)                                                                                                                   |

## Contract addresses

The deployment model is one shared `account_factory` plus one full treasury
(six contracts) per `deploy_account` call. The example treasury below is the
first one the factory created. Its owner key is documented as exposed — use it
for integration tests, never to hold value. Anyone can deploy their own
treasury from the dApp or the SDK.

| Contract                   | Address                                                    |
| -------------------------- | ---------------------------------------------------------- |
| `account_factory` (shared) | `CCFIPN4TIF5XOJ7SZCQNET7YSXUXS7ERLJHX3JHNVZPTJTFI4HTKQAAV` |
| Example `smart_account`    | `CDTE6DBMGFPTLBLPS7O32FMZGEKUM6KAW7GPACSI6RPY73DDFJIBVL7W` |
| Example `policy_engine`    | `CAMM3LIYYW57HU2YF3FEQS5ARYN7ZILF4ETFHTBYHUBNU4SF6MHIOORM` |
| Example `intent_registry`  | `CDCTQSJEGOVTD63M34VSUYKIX6KMZL53P646G4QCER75Q4V4EKWRL3F6` |
| Example `recovery_manager` | `CB6SOTBREWNAYNUYKIXTNTAYDKBOBIH4MUDRU36X326NVYQDBCMIKIBP` |
| Example `transfer_adapter` | `CAJYFE76XIRQVEUPI6O3JMH2LZCS3VXHYEF3VO3L5FID4ACNPBK4HVOC` |
| Example `split_adapter`    | `CDZMKHLBRLEHES62KSQE6UJBHV4H2VHJ6K2D6I6K66NJBMROSRLPOLC7` |

Assets the example treasury's policy allows (network-wide Stellar Asset
Contract ids, not STA contracts):

| Asset         | Contract                                                   | Cap per transfer |
| ------------- | ---------------------------------------------------------- | ---------------- |
| XLM (native)  | `CAS3J7GYLGXMF6TDJBBYYSE3HQ6BBSMLNUQ34T6TZMYMW2EVH34XOWMA` | 50 XLM           |
| USDC (Circle) | `CCW67TSZV3SSS2HXMBQ5JFGCKJNXKZM7UQUWUZPUTHXSTZLEO7SJMI75` | 1 USDC           |

## WASM hashes

Uploaded once, referenced by hash from `account_factory`. The six treasury
contracts are also committed as test fixtures in
`contracts/account_factory/src/wasm_fixtures/`, and their SHA-256 equals the
recorded hash.

| Contract           | WASM hash (SHA-256)                                                | Size         |
| ------------------ | ------------------------------------------------------------------ | ------------ |
| `policy_engine`    | `f05348d6cbe90796c2b89296697f340d2fba6a1b070f3830f17edf32c2cb8eb8` | 7 792 bytes  |
| `intent_registry`  | `43567e68bc87211cbdcd08a13e8a6de094ed978261b59b07d942a831ce527b70` | 10 742 bytes |
| `recovery_manager` | `0eb4038ea129be586d5b324c62c672c8203547b61146f17452693e587a9f92d8` | 20 561 bytes |
| `transfer_adapter` | `785870924ad04930512a5494cbf442b159c912a1f233491d1b0f696fe19f4dae` | 3 695 bytes  |
| `split_adapter`    | `e32ad0c7bf83d265848adc2ee4874aa0b3d27fb9b97558c4f8753b40a0ba329b` | 4 042 bytes  |
| `smart_account`    | `886bcd312f3cf973a8a037479ebf9febe57139e63f109947acce20bd835f3a76` | 68 336 bytes |
| `account_factory`  | `15f635356ddf3497788d4f6aab7f6e93cd2fbdaab36ecbe77d0c5521e403a3dd` | 8 838 bytes  |

`webauthn_verifier` is not deployed on mainnet: it is stateless and only needed
when a treasury registers a passkey (`Signer::External`) signer. The
`governance_account` (N-of-M owner) is implemented but not deployed; the
example treasury's owner is a single key.

## Reproducible build

Stellar's WASM hash is the SHA-256 of the uploaded file, so "reproducible"
means: build from the recorded commit and get the same bytes. Three things
pin that:

| Component   | Version                                                                                                                      |
| ----------- | ---------------------------------------------------------------------------------------------------------------------------- |
| Rust        | 1.94.1 (pinned by the repository toolchain file)                                                                             |
| Stellar CLI | 26.0.0 exactly — the CLI writes its version into the `cliver` contract-meta entry, so any other version changes the artifact |
| Host        | Linux x86_64 (the GitHub Actions `ubuntu-latest` recipe in `.github/workflows/ci.yml`)                                       |

```bash
stellar contract build --optimize
```

Measured on 2026-09-09 (details in the record's §3.1): the CI recipe
reproduces the six committed fixtures byte for byte; the same pinned Rust and
CLI on macOS arm64 reproduce five of seven (`recovery_manager` and
`smart_account` differ inside the code section, same size, same metadata);
a Linux arm64 container reproduces two. The host matters, not how the CLI was
installed — a release binary and a source build agree on one host and
disagree across hosts. `scripts/verify_build.sh` automates the comparison
against the record (`--fixtures-only`, `--wasm-dir`, `--container`).

::: warning Verification script
At the time of writing, `scripts/verify_build.sh` and the §3.1 notes are on the
`verify-build` branch of `smart-contracts`, pending merge into `main`. Until
then, compare hashes by hand: build with the pinned toolchain and
`sha256sum` each `.wasm` against the table above.
:::

## Deploying a treasury

`account_factory.deploy_account` creates and wires a complete treasury in one
transaction: `smart_account`, `policy_engine`, `intent_registry`,
`recovery_manager`, `transfer_adapter`, `split_adapter`, adapters bound,
`intent_registry` bootstrapped with `smart_account` as its admin.

| Parameter            | Example treasury value            | Meaning                                                             |
| -------------------- | --------------------------------- | ------------------------------------------------------------------- |
| `owner`              | the deployer key                  | Owner of `smart_account`: pause/unpause, timelocked adapter changes |
| `initial_signers`    | `[Delegated(owner)]`              | Registered under context rule `0` (`Default`, no policy attached)   |
| `initial_policies`   | `{}`                              | Policy rules are configured after deployment, by the policy admin   |
| `guardian_threshold` | `1`                               | Guardian quorum for `recovery_manager`                              |
| `executor`           | the relayer's public key          | The only address `intent_registry` lets execute scheduled payments  |
| Policy version       | `1` after the first configuration | What every approval pins                                            |

`policy_engine`'s admin is the deploying wallet, not `smart_account`: policy
writes are plain wallet signatures. The dApp does all of this from the "Deploy
new treasury" button (six authorization prompts, one transaction) and the
"Policy rules" section — see the [Operator guide](/operators/).

**Cost.** Uploading contract code to mainnet is expensive today (Soroban
state rent, [CAP-0066](https://github.com/stellar/stellar-protocol/blob/master/core/cap-0066.md)):
the seven uploads for this deployment cost 104.43 XLM in total. Creating a
treasury from the already-uploaded code is cheap, ≈0.02–0.4 XLM per
`deploy_account`, and every ordinary transaction is well under 0.1 XLM.

**Funding.** A treasury holds Stellar Asset Contract balances. Fund it with a
SAC `transfer` to the `smart_account` address; XLM needs no trustline, USDC
needs the _recipient_ of a payment to hold a USDC trustline.

## What has been exercised on mainnet

Every item has a real transaction in the record:

- Direct payments (`execute_transfer_payment`) in XLM and USDC.
- Split payments to several recipients in one call.
- Scheduled payments: create, execute by the relayer role, cancel.
- `pause` / `unpause`.
- Permissionless TTL maintenance (`extend_instance_ttl`).
- Signer management (`add_signer`, `remove_signer`) — including a live
  demonstration that a policy-less rule with two signers requires both
  (`#3002 UnvalidatedContext`), and the two-signer recovery from it.
- Context rule creation (`add_context_rule`).

Not exercised on mainnet: guardian freeze/recovery and adapter
reconfiguration. Both carry real ~24 h (17 280-ledger) timelocks on this
deployment, so a same-day proof is impossible. On testnet, adapter
reconfiguration was proven under the real delay on the original manual
deployment (`docs/TESTNET_DEPLOYMENT.md` §5), and guardian freeze plus a full
recovery were exercised end to end on a throwaway build with the four delay
constants reduced to 5 ledgers, deployed under its own WASM hashes and never
used by any real treasury (`docs/TESTNET_FACTORY_DEPLOYMENT.md` §14). The
mainnet contracts run the unmodified source at the recorded hashes.

## Storage TTLs

Soroban entries expire. `smart_account` and `policy_engine` extend their
persistent entries on every read and write that touches them (≈29-day
threshold, ≈30-day extension), so an active treasury maintains itself.
Entries that are never touched still need an explicit bump: `smart_account`
and `intent_registry` expose permissionless `extend_instance_ttl` /
`extend_intent_ttl` entrypoints, callable by anyone, because extending TTL
creates no authority. A treasury that goes quiet for weeks should schedule
one such call before the threshold — see the [Operator guide](/operators/).

## Production dApp and relayer

The production dApp (`https://smarttreasury.io/app`, deployed from the
`dApp` repository's `main` branch) is configured for this deployment. Its
scheduled-payment relayer keeps its job queue in Postgres (Neon), executes
only inside an intent's ledger window, and checks
`intent_registry.is_child_executed` before every submission, so two instances
cannot execute the same child sequence twice. The relayer role's authority is
bounded by the contracts — see [what the relayer cannot do](/security/).

::: tip Scheduled trigger
A QStash schedule calls the relayer's run endpoint on a cron in production,
with a signature the endpoint verifies; QStash retries a failed run and
reports it to its failure callback. `pnpm relayer:run` is the manual
fallback. See [Status](/status).
:::
