# Release checklist

One checklist per deliverable. A release is the contracts, the SDK, the dApp
and relayer, and this documentation moving together: a contract address that
is not in the SDK's deployment table, or an environment variable that is not
in Vercel, is a release that is not finished.

The commands below are the ones the repositories' CI workflows run; a green
local run is necessary, not sufficient — the CI run on the release commit is
the record.

## Contracts (`smart-contracts`)

- [ ] Toolchain pinned and matching the record: Rust `1.94.1` (`rust-toolchain.toml`, and `dtolnay/rust-toolchain@1.94.1` in CI) and stellar-cli `26.0.0` (CI builds it with `cargo +1.96.0 install --locked stellar-cli --version 26.0.0`). The CLI version is stamped into every artifact's `cliver` meta entry, so a different CLI changes the hash.
- [ ] `cargo fmt --all -- --check`, `cargo clippy --workspace --all-targets -- -D warnings`, `cargo test --workspace` green on the release commit.
- [ ] `stellar contract build --optimize --out-dir wasm` produced the artifacts to deploy, and CI's fixture check passed (`contracts/account_factory/src/wasm_fixtures/*.wasm` byte-identical to the fresh build — a stale fixture is a false green in the factory's tests).
- [ ] Hashes reproduced: `scripts/verify_build.sh` compares a rebuild against the table in `docs/MAINNET_DEPLOYMENT.md` §3 (`--fixtures-only` for the six committed fixtures, `--container` for the reference linux/amd64 recipe). Until it is merged into `main` the script lives on branch `verify-build`; the reference environment is the CI runner, and only a Linux x86_64 build is expected to match all seven hashes byte for byte (see [Mainnet deployment](/deployment/mainnet)).
- [ ] Deployment record updated: contract ids, WASM hashes, upload/deploy/initialize transaction hashes with explorer links, initialization parameters (owner, initial signers, guardian threshold, executor, policies), in `docs/MAINNET_DEPLOYMENT.md` — the single source of truth for addresses.
- [ ] Instance and persistent TTLs extended on every long-lived contract (`extend_instance_ttl` / `extend_ttl` / `extend_intent_ttl` are permissionless), and a calendar reminder set before the next expiry.
- [ ] `account_factory` admin key handled: it alone can repoint `set_wasm_hashes`, so it stays offline between releases; any key whose seed phrase was ever shared (the documented example treasury's owner is one) is treated as compromised and holds no value.

## SDK (`sdk`, published as `sta-sdk`)

- [ ] `pnpm lint`, `pnpm typecheck`, `pnpm test`, `pnpm build` green.
- [ ] Version bumped with `npm version <patch|minor|major>`; the README's "Versioning against a deployment" table names the contract set this version targets (`smart_account` and `account_factory` ids per network) and links the deployment record with a `blob/main/` URL.
- [ ] `MAINNET_CONTRACTS`, `MAINNET_ASSETS`, and `TESTNET` in `src/config.ts` equal the deployment records.
- [ ] Examples run against the target network: `STA_NETWORK=mainnet STA_MAINNET_RPC_URL=<provider> npx tsx examples/read-treasury.ts` returns the recorded owner, policy version, and factory WASM hashes; the signing examples were run at least once on testnet.
- [ ] `git push --follow-tags`: the `v*` tag triggers `.github/workflows/publish.yml`, which reruns lint/typecheck/test/build, refuses a tag that does not equal `package.json`'s version, and publishes through npm OIDC trusted publishing. No `NPM_TOKEN`, `registry-url`, or `NODE_AUTH_TOKEN` is added to that workflow — either one silently switches npm back to token auth and the publish fails.
- [ ] `npm view sta-sdk version` shows the new version. The dApp pins the exact version (`"sta-sdk": "0.2.1"` in its `package.json`) so that an SDK release never changes the dApp's chain code silently: bump it there, run `pnpm install`, and rerun the dApp checks below.

## dApp and relayer (`dApp`)

- [ ] `pnpm format:check`, `pnpm lint`, `pnpm typecheck`, `pnpm test`, `pnpm build` green locally and in CI (`.github/workflows/ci.yml` runs them in that order, then pulls the environment from Vercel and builds).
- [ ] Branches and environments: `main` is Production (mainnet), `testnet` is Preview. CI pulls the matching Vercel environment, which needs the `VERCEL_TOKEN` (team-scoped, "All projects"), `VERCEL_ORG_ID`, and `VERCEL_PROJECT_ID` repository secrets.
- [ ] Vercel environment set per environment, values from the deployment record:
  - `NEXT_PUBLIC_STELLAR_RPC_URL`, `NEXT_PUBLIC_STELLAR_NETWORK_PASSPHRASE`, `NEXT_PUBLIC_STELLAR_EXPLORER_URL`
  - `NEXT_PUBLIC_SMART_ACCOUNT_ID`, `NEXT_PUBLIC_POLICY_ENGINE_ID`, `NEXT_PUBLIC_INTENT_REGISTRY_ID`, `NEXT_PUBLIC_RECOVERY_MANAGER_ID`, `NEXT_PUBLIC_TRANSFER_ADAPTER_ID`, `NEXT_PUBLIC_SPLIT_ADAPTER_ID`
  - `NEXT_PUBLIC_DEFAULT_ASSET_CONTRACT_ID` (the XLM Stellar Asset Contract on mainnet), `NEXT_PUBLIC_DEFAULT_DESTINATION` (an existing, allowlisted account)
  - `NEXT_PUBLIC_ACCOUNT_FACTORY_ID`, `NEXT_PUBLIC_RELAYER_EXECUTOR_ADDRESS`
  - server-only, never `NEXT_PUBLIC_`: `RELAYER_EXECUTOR_SECRET`, `RELAYER_ADMIN_TOKEN`, `RELAYER_APP_URL`, `DATABASE_URL`, and for the scheduled trigger `QSTASH_CURRENT_SIGNING_KEY`, `QSTASH_NEXT_SIGNING_KEY`, `QSTASH_RELAYER_RUN_URL`
- [ ] The network is derived from the passphrase: the header of the deployed site reads `Stellar mainnet` (or `Stellar testnet`) and the contract list in the console matches the record.
- [ ] Executor account (`NEXT_PUBLIC_RELAYER_EXECUTOR_ADDRESS`, the public key of `RELAYER_EXECUTOR_SECRET`) exists and is funded on the target network. A treasury deployed through the dApp registers this address as its `intent_registry` executor; an unfunded executor only fails at execution time.
- [ ] `pnpm db:migrate` run against the environment's `DATABASE_URL` (one Neon branch per environment; the migrations in `src/lib/db/migrations` are committed).
- [ ] Smoke test on the deployed site with a disposable treasury: connect, read state, one **Policy check** rejection, one payment confirmed with an explorer link.
- [ ] Relayer: one scheduled payment created in the console, queued (the wallet signs the session challenge), executed — by the schedule, or by **Execute** on its card — to `executed` with a transaction hash, and its **Execute** button disabled afterwards.
- [ ] Scheduled trigger: the QStash schedule is registered against the exact URL in `QSTASH_RELAYER_RUN_URL`, the signing keys are set in the same Vercel environment (Production has them; a Preview has no schedule unless one is registered for it), a run shows `{"trigger":"qstash",...}` in the QStash logs, and the failure callback reaches an operator.
- [ ] `pnpm audit` reviewed; anything critical in a runtime dependency resolved or explicitly accepted in the release notes.

::: warning The schedule is per environment
`POST /api/relayer/run` accepts a QStash delivery only where the signing
keys are configured, and only for the pinned URL. A new environment — a
preview, a second deployment — has no schedule until one is registered for
it; until then its due jobs run only through `pnpm relayer:run` or the
console's **Execute**.
:::

## Documentation (`docs`, this site)

- [ ] [Status](/status) says what is deployed today, with the "Last verified" date of this release.
- [ ] [Mainnet deployment](/deployment/mainnet) matches `docs/MAINNET_DEPLOYMENT.md` (addresses, hashes, toolchain).
- [ ] Every GitHub link resolves: no `blob/mainnet/` (the branch does not exist; the record lives on `main`) and no link to a branch that has since been merged or deleted.
- [ ] [Testing support guide](/operators/testing-guide) expectations re-run against the release.
- [ ] `pnpm format:check` and `pnpm build` green; the rendered pages checked, not only the build output.

## Post-release

- [ ] Addresses announced from the deployment record, not retyped.
- [ ] Any key shared during the release (deploy scripts, chat, CI logs) rotated; the treasury it owned drained.
- [ ] `docs/MAINNET_DEPLOYMENT.md` stays the single source of truth: the SDK table, the dApp environment, and this site link to it rather than restating it.
- [ ] Open a tracking issue for anything ticked as "accepted" rather than "done".

Feedback on this checklist and anything it missed goes through
[Reporting issues](/operators/reporting-issues).
