# Testnet deployment

All seven production contracts are deployed and live on Stellar testnet. The
full record — contract addresses, WASM hashes, and every deploy/init/wiring
transaction with explorer links — lives in
[`docs/TESTNET_DEPLOYMENT.md`](https://github.com/Smart-Treasury-Account-STA/smart-contracts/blob/v1-full-implementation/docs/TESTNET_DEPLOYMENT.md)
in the `smart-contracts` repository. This page covers the reproducible build
and the general deployment/verification procedure; treat the linked record
as the authoritative, currently-live addresses.

## Reproducible builds

```bash
stellar contract build --optimize --out-dir wasm
```

This produces one optimized `.wasm` per contract plus a printed hash for
each. Publishing the hash is what lets a third party rebuild from source and
confirm they get the same bytes that were deployed.

Reproducibility depends on pinning:

| Component                | Version                                                                 |
| ------------------------ | ----------------------------------------------------------------------- |
| Rust                     | `stable` (CI pins 1.96.0 for one specific step — see [Status](/status)) |
| `soroban-sdk`            | 26.1.0                                                                  |
| OpenZeppelin Stellar     | 0.7.2                                                                   |
| Stellar CLI (deployment) | 26.0.0                                                                  |

`soroban-sdk` is held on the 26.x line deliberately: OpenZeppelin 0.7.2
requires `^26.1.0`, which excludes 27.x. Bumping the SDK without a matching
OpenZeppelin release would mean dropping the audited primitives.

## Deployment procedure

```bash
./scripts/deploy_testnet.sh
```

Idempotent-ish: re-running `initialize` against an already-initialized
contract fails with `AlreadyInitialized` (expected), and the test-asset
deploy step looks up the existing deterministic SAC address instead of
failing if it's already been deployed by the same issuer. It builds with
`--optimize`, uploads and creates each of the seven contracts, initializes
them (PolicyEngine and RecoveryManager with their admin, SmartAccount with
its owner plus the PolicyEngine/IntentRegistry/RecoveryManager addresses),
wires the transfer and split adapters through the timelocked
`propose_adapter_change`/`apply_adapter_change` path, configures a test
asset rule and recipient allowlist entry, and mints test `STA` balance to
the treasury — printing every contract ID and transaction hash along the
way. See `docs/TESTNET_DEPLOYMENT.md` §4–§5 for the exact command sequence
this script runs.

## Verification

The live deployment record demonstrates every acceptance flow end to end,
with real transaction hashes and explorer links, not simulated ones:

- Treasury inspection (`status`, `is_guardian`, `version`) read back live
  state correctly.
- A real signer-authorized `execute_transfer_payment` moved treasury `STA`
  balance and consumed a nonce, on-chain.
- Invalid actions are rejected: `RecipientNotAllowed`, `AmountAboveLimit`,
  a stale pinned policy version (`VersionMismatch`), and a replayed nonce
  (`NonceAlreadyUsed`) — reproducible any time with a `stellar contract
invoke ... --send=no` call against the live contract, since these are
  read-only policy simulations (see `docs/TESTNET_DEPLOYMENT.md` §6.1 and
  §6.5 for the exact commands and current output).

A submitted, signed transaction that gets rejected on-chain for these last
two cases specifically carries no transaction hash of its own — Soroban's
`simulateTransaction`/`prepareTransaction` computes a transaction's resource
footprint by simulating the call, and a call that will fail never gets one,
so it's impossible to reach `send_transaction` for a call designed to be
rejected. This is a Soroban platform characteristic, not a gap in what was
demonstrated; the rejection itself is real and independently reproducible.

## Storage TTLs

Soroban entries expire. A treasury deployment that must stay reachable
across a long review period needs its instance and persistent-entry TTLs
extended after deployment.

[PolicyEngine](/contracts/policy-engine) and
[SmartAccount](/contracts/smart-account) both extend their persistent
entries' TTL on every read and write that touches them (~29-day threshold,
~30-day extension), so actively used state maintains itself. Entries that
are never touched still need an explicit bump — both contracts expose a
permissionless `extend_ttl`/`extend_instance_ttl` entrypoint for exactly
that, callable by anyone, since extending TTL creates no authority.

::: warning Testnet resets
Stellar testnet state may be reset by network operators. A testnet
deployment is not a durable artifact — treat published testnet contract IDs
as valid until the next reset, and rebuild the deployment record afterwards.
:::

## Prior PoC deployment

An earlier, partial proof-of-concept revision (`smart_account_poc`,
`policy_registry_poc`, `intent_registry_poc`, `recovery_guard_poc`, on an
older `soroban-sdk` version, no OpenZeppelin composition) was deployed
separately and predates the current production deployment above. It is
archived in `docs/archive/POC_TESTNET_DEPLOYMENT.md` in the
`smart-contracts` repository for historical traceability only — it is not
part of what to review.
