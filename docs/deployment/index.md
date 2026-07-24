# Testnet deployment

::: danger Deployment scripts not yet written
The production contracts are not deployed. `scripts/deploy.sh` and
`scripts/verify_flows.sh` are specified but do not exist in the workspace yet.
This page documents the reproducible build, which works today, and the
deployment procedure those scripts will automate. See [Status](/status).
:::

## Reproducible builds

```bash
stellar contract build --optimize --out-dir wasm
```

This works today and produces:

| Artifact                      | Size                  |
| ----------------------------- | --------------------- |
| `wasm/sta_policy_engine.wasm` | 7,595 bytes optimized |

The WASM hash is printed by the build. Publishing it is what lets a third party
rebuild from source and confirm they get the same bytes that were deployed.

Reproducibility depends on pinning:

| Component            | Version |
| -------------------- | ------- |
| Rust                 | 1.95.0  |
| `soroban-sdk`        | 26.1.1  |
| OpenZeppelin Stellar | 0.7.2   |
| Stellar CLI          | 27.0.0  |

`soroban-sdk` is held on the 26.x line deliberately: OpenZeppelin 0.7.2
requires `^26.1.0`, which excludes 27.x. Bumping the SDK without a matching
OpenZeppelin release would mean dropping the audited primitives.

## Planned deployment procedure

The deployment script takes the network and source identity as arguments, so
nothing about the target is baked into the script:

```bash
./scripts/deploy.sh testnet sta-testnet-deployer
```

It builds with `--optimize`, deploys each contract, initializes them —
PolicyEngine with its admin, SmartAccount with its admin and the PolicyEngine
address — and prints the contract IDs alongside the WASM hashes so the
deployment record is reproducible.

## Planned verification procedure

```bash
./scripts/verify_flows.sh testnet sta-testnet-deployer
```

This scripts the acceptance flows end to end: configure an asset rule and a
recipient, execute an approved payment, then run the two rejection cases — a
payment pinned to a stale policy version, and a replayed nonce. Every
transaction hash is printed.

It exits non-zero if a rejection case unexpectedly **succeeds**. A verification
script that passes when the security property is broken is worse than no script
at all.

## Storage TTLs

Soroban entries expire. A treasury deployment that must stay reachable across a
long review period needs its instance and storage TTLs extended after
deployment.

The PolicyEngine already extends persistent-entry TTLs on every read and write
(30-day threshold, 90-day extension), so live policy state maintains itself
under normal use. Entries that are never touched still need an explicit bump.

::: warning Testnet resets
Stellar testnet state may be reset by network operators. A testnet deployment
is not a durable artifact — treat published testnet contract IDs as valid until
the next reset, and rebuild the deployment record afterwards.
:::

## Existing PoC deployment

Four proof-of-concept contracts are deployed on testnet from an earlier
milestone. They demonstrate patterns and **do not execute real Stellar Asset
Contract transfers**. Their contract IDs are recorded in the contract
repository's deployment document.

They are not the production contracts, and the record for them predates the
current toolchain — the recorded WASM hashes no longer match a rebuild from
current source. Rebuild and redeploy before citing those artifacts as current.
