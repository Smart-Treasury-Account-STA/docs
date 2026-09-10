# TypeScript SDK

`sta-sdk` is the TypeScript client for the Smart Treasury Account contracts:
typed state reads, SmartAccount authorization-entry construction, transaction
preparation for every payment flow, and typed event parsing. This page covers
installation and network configuration; the package
[README](https://github.com/Smart-Treasury-Account-STA/sdk/blob/main/README.md)
is the full usage guide and is not duplicated here.

## Install

```sh
pnpm add sta-sdk @stellar/stellar-sdk
```

`@stellar/stellar-sdk` (`>=16.0.0`) is a peer dependency so that your
application controls its version and only one copy of its classes is loaded.
Node `>=20` is required: authorization nonces come from Web Crypto.

::: warning Check the published version
At the time of writing npm serves `sta-sdk@0.1.1`, whose mainnet configuration
is `undefined`; `0.2.0`, which adds mainnet support as described below, is in
the process of being published. Run `npm view sta-sdk version` before relying
on the mainnet helpers, and use the
[repository](https://github.com/Smart-Treasury-Account-STA/sdk) (branch
`main`, `examples/`) if the published version is still `0.1.x`.
:::

## Network configuration

Every function in the SDK takes one `NetworkConfig` as its first argument. You
build it once, when your application starts, and pass the same object to every
call: the network is chosen at that point and nowhere else.

```ts
interface NetworkConfig {
  network: "testnet" | "mainnet";
  rpcUrl: string;
  rpcHeaders?: Record<string, string>; // API key headers for mainnet providers
  networkPassphrase: string;
  contracts: ContractAddresses; // the treasury's six contracts plus the factory
}
```

| You want                                 | Use                                                                                                    |
| ---------------------------------------- | ------------------------------------------------------------------------------------------------------ |
| Testnet, the deployed reference treasury | `import { TESTNET } from "sta-sdk"` — a ready-made constant with SDF's public RPC                      |
| Mainnet, the documented example treasury | `mainnet(rpcUrl?, { headers? })` — returns a `NetworkConfig` for `MAINNET_CONTRACTS`                   |
| Mainnet, your own treasury               | `buildMainnetConfig(sixAddresses, rpcUrl?, { headers? })` with the addresses `deploy_account` returned |

There is deliberately no `MAINNET` constant to import. SDF hosts no free public
mainnet Soroban RPC, so a mainnet configuration cannot exist without you
choosing a provider. `mainnet()` and `buildMainnetConfig()` take the URL as an
argument or read it from the environment, and throw if neither is set:

| Variable                  | Meaning                                                                                     |
| ------------------------- | ------------------------------------------------------------------------------------------- |
| `STA_MAINNET_RPC_URL`     | Your mainnet RPC provider's URL                                                             |
| `STA_MAINNET_RPC_HEADERS` | Optional JSON object of headers, e.g. `{"x-api-key":"…"}`, for providers that key by header |

```ts
import {
  TESTNET,
  mainnet,
  buildMainnetConfig,
  MAINNET_ASSETS,
  readAccountStatus,
} from "sta-sdk";

// Testnet: nothing to configure.
const test = TESTNET;

// Mainnet, example treasury: explicit URL and headers…
const main = mainnet("https://<your-rpc-provider>", { headers: { "x-api-key": "…" } });
// …or `mainnet()` with STA_MAINNET_RPC_URL / STA_MAINNET_RPC_HEADERS set.

// Mainnet, your own treasury (addresses from account_factory.deploy_account).
const mine = buildMainnetConfig(
  {
    smartAccount: "C…",
    policyEngine: "C…",
    intentRegistry: "C…",
    recoveryManager: "C…",
    transferAdapter: "C…",
    splitAdapter: "C…",
    accountFactory: "CCFIPN4TIF5XOJ7SZCQNET7YSXUXS7ERLJHX3JHNVZPTJTFI4HTKQAAV",
  },
  "https://<your-rpc-provider>",
);

const status = await readAccountStatus(mine, "G…any existing mainnet account");
```

`serverFor(net)` is the SDK's single `rpc.Server` factory and applies
`rpcHeaders` to every request, so a provider API key set once in the config
reaches reads, simulations and submissions alike. `MAINNET_ASSETS` carries the
mainnet Stellar Asset Contract ids for XLM and USDC, the two assets the example
treasury's policy allows.

A `NetworkConfig` with `network: "mainnet"` and real signing keys submits real,
fee-paying, fund-moving transactions. Run the read-only example first.

## Examples

One runnable, documented example per flow lives in
[`examples/`](https://github.com/Smart-Treasury-Account-STA/sdk/blob/main/examples).
Each runs against testnet by default; add `STA_NETWORK=mainnet` and
`STA_MAINNET_RPC_URL=…` to run it against mainnet (`examples/network.ts` is the
shared selector they all import, not an example to run).

| Example                | Run                                                                                                                                                                  | Keys               |
| ---------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------ |
| `read-treasury.ts`     | `STA_NETWORK=mainnet STA_MAINNET_RPC_URL=https://<your-provider> npx tsx examples/read-treasury.ts` (testnet: `SOURCE_ADDRESS=G… npx tsx examples/read-treasury.ts`) | None               |
| `transfer.ts`          | `SIGNER_SECRET=S… FEE_SOURCE_SECRET=S… ASSET_CONTRACT_ID=C… npx tsx examples/transfer.ts`                                                                            | Signer, fee source |
| `split-payment.ts`     | `SIGNER_SECRET=S… FEE_SOURCE_SECRET=S… ASSET_CONTRACT_ID=C… npx tsx examples/split-payment.ts`                                                                       | Signer, fee source |
| `scheduled-payment.ts` | `SIGNER_SECRET=S… FEE_SOURCE_SECRET=S… ASSET_CONTRACT_ID=C… npx tsx examples/scheduled-payment.ts` (creates, then cancels)                                           | Signer, fee source |
| `parse-events.ts`      | `TX_HASH=… npx tsx examples/parse-events.ts`                                                                                                                         | None               |

`read-treasury.ts` prints the treasury's status, owner, policy version,
context-rule count and the WASM hashes the factory has registered on chain,
which you can compare with the [mainnet deployment record](/deployment/mainnet).

## Modules

| Module     | What it exports                                                                                                                                                                                         |
| ---------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `config`   | `NetworkConfig`, `TESTNET`, `MAINNET_CONTRACTS`, `MAINNET_ASSETS`, `mainnet`, `buildMainnetConfig`, `MAINNET_NETWORK_PASSPHRASE`                                                                        |
| `rpc`      | `serverFor`                                                                                                                                                                                             |
| `state`    | Typed reads: `readAccountStatus`, `readOwner`, `readContextRule(s)`, `isNonceUsed`, `readPolicyVersion`, `readScheduledIntent`, `isChildExecuted`, recovery and guardian reads, `readFactoryWasmHashes` |
| `payments` | `prepareTransferPayment`, `prepareSplitPayment`, `prepareScheduledPayment`, `prepareCancelScheduledPayment`, `prepareRelayerExecution`, `signAndSubmit`                                                 |
| `auth`     | `buildSmartAccountAuthEntries`, `buildExecutorAuthEntry` and the auth-entry helpers                                                                                                                     |
| `events`   | `parseContractEvent`, `parseContractEvents`, `findEvent`, one typed interface per contract event                                                                                                        |

## Versioning against a deployment

Each release states which contract deployment it targets. The WASM behind both
networks is the same source at the same hashes.

| `sta-sdk`     | Network | Deployment record                                                                                                                                   | `smart_account` | `account_factory` |
| ------------- | ------- | --------------------------------------------------------------------------------------------------------------------------------------------------- | --------------- | ----------------- |
| 0.2.0         | mainnet | [`MAINNET_DEPLOYMENT.md`](https://github.com/Smart-Treasury-Account-STA/smart-contracts/blob/main/docs/MAINNET_DEPLOYMENT.md) §4–§5                 | `CDTE6DBM…VL7W` | `CCFIPN4T…QAAV`   |
| 0.2.0 / 0.1.x | testnet | [`TESTNET_FACTORY_DEPLOYMENT.md`](https://github.com/Smart-Treasury-Account-STA/smart-contracts/blob/main/docs/TESTNET_FACTORY_DEPLOYMENT.md) §13.2 | `CD6GY4UU…ULMQ` | `CAQQTRRY…GUZO`   |

`0.2.0` replaced the `MAINNET` / `NETWORKS` placeholders of `0.1.x` (both were
`undefined` for mainnet) with `MAINNET_CONTRACTS` and `mainnet()`, added
`NetworkConfig.rpcHeaders`, and requires Node `>=20`.

## Known issue

`buildSmartAccountAuthEntries` builds the authorization entries for a single
required signer; a context rule that requires several co-signers is not
supported through it yet, so do not rely on multi-signer rules through the SDK
until the function's doc comment says otherwise.
