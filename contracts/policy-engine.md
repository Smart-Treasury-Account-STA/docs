# PolicyEngine

**Crate:** `sta-policy-engine` · **Status:** implemented, 12 tests passing, deployed on Stellar testnet

The PolicyEngine answers one question: _is this treasury action allowed?_ It
validates the operation, the asset, the amount, the recipient, and the policy
version the caller pinned its approval to.

This is deliberately independent of signer authentication. By the time a call
reaches `validate_policy`, [SmartAccount](/contracts/smart-account) has
already established _who_ is authorized to act. PolicyEngine answers a
different question: even a fully authorized signer set cannot move funds to
an asset, recipient, or operation that hasn't been explicitly allowed, above
an amount cap, or under a stale policy version.

Every rejection path fails closed. An unknown asset, an unknown recipient, a
disabled operation, or a missing rule is a rejection, never a default-allow.

## Types

### `AssetRule`

```rust
pub struct AssetRule {
    pub enabled: bool,
    pub max_single_transfer: i128,
}
```

`enabled: false` is an **explicit denial** and is deliberately distinct from
"no rule stored". Revoking an asset does not require deleting its history.

### `PolicyCheck`

```rust
pub struct PolicyCheck {
    pub operation: Symbol,
    pub asset: Address,
    pub destination: Address,
    pub amount: i128,
    pub expected_version: u32,
}
```

`expected_version` is the policy version the caller approved under. The engine
compares it against the live version and rejects a mismatch. See
[policy-version pinning](/security/policy-version-pinning).

`operation` gates against an explicit per-operation allowlist (see
`set_operation_allowed` below) — an operation that was never enabled is
rejected with `OperationNotAllowed` rather than falling through to the asset
checks.

## Entrypoints

### `contract_name() -> Symbol`

Returns `sta_pol`. Read-only, no auth.

### `initialize(admin: Address)`

Sets the admin (a plain stored `Address`, checked with `require_auth()` — no
OpenZeppelin access-control composition here, unlike `smart_account`) and
starts the policy at version 1. Callable once — a second call returns
`AlreadyInitialized`.

Requires the admin's authorization.

### `version() -> u32`

The live policy version. Callers read this and pin it into their approvals.
Fails with `NotInitialized` before `initialize` has run.

### `validate_policy(check: PolicyCheck) -> Result<(), PolicyEngineError>`

The authorization decision. **Read-only — it writes nothing but TTL
bookkeeping**, so a client can simulate the exact call it is about to
authorize and get the same answer the chain will give.

Checks run in this order, so the error a caller sees names the actual reason:

1. Engine initialized → else `NotInitialized`
2. `expected_version` equals the live version → else `VersionMismatch`
3. `amount > 0` → else `InvalidAmount`
4. `operation` is enabled → else `OperationNotAllowed`
5. An `AssetRule` exists for `asset` and is enabled → else `AssetNotAllowed`
6. `amount <= max_single_transfer` → else `AmountAboveLimit`
7. The recipient is allowlisted → else `RecipientNotAllowed`

On success, publishes `PolicyValidated` and refreshes the TTL of the
operation/asset/recipient entries it just read.

### `set_asset_rule(asset: Address, rule: AssetRule)`

Admin only. Rejects `InvalidAmount` when a rule is enabled with a
`max_single_transfer` that is not positive — an enabled rule that can never
authorize anything is a configuration mistake, not a valid state.

### `set_recipient_allowed(recipient: Address, allowed: bool)`

Admin only. Adds or revokes a recipient.

### `set_operation_allowed(operation: Symbol, allowed: bool)`

Admin only. Enables or disables an adapter-level operation (e.g. `transfer`,
`split`). An operation not explicitly enabled fails closed, so deploying a
new adapter never silently grants it spend authority — this is what the live
deployment's `set_operation_allowed(transfer)` / `set_operation_allowed(split)`
calls did before either adapter could be used.

### `bump_version(next_version: u32)`

Admin only. Advances the policy version. **Strictly monotonic**: `next_version`
must be greater than the current version, else `InvalidVersion`. A version can
never be replayed, so an approval that was rejected once stays rejected.

### `extend_ttl(assets: Vec<Address>, recipients: Vec<Address>, operations: Vec<Symbol>)`

**Permissionless.** Refreshes the TTL of the instance keys plus whichever
named asset/recipient/operation entries are passed in. Extending TTL does not
create authority or alter execution semantics, so this is intentionally open
to any caller — an off-chain monitor can refresh entries it knows are still
active without needing admin keys. `validate_policy` already refreshes the
TTL of whatever it reads on the hot path; this entrypoint covers entries that
aren't being actively validated but still need to survive.

## Errors

| Code | Variant               | Raised when                                                             |
| ---- | --------------------- | ----------------------------------------------------------------------- |
| 2000 | `AlreadyInitialized`  | `initialize` is called a second time                                    |
| 2001 | `NotInitialized`      | Any entrypoint is called before `initialize`                            |
| 2002 | `InvalidAmount`       | Amount is zero or negative; or an enabled rule has a non-positive cap   |
| 2003 | `AssetNotAllowed`     | No rule for the asset, or the rule is disabled                          |
| 2004 | `RecipientNotAllowed` | The recipient is not allowlisted, or was revoked                        |
| 2005 | `AmountAboveLimit`    | Amount exceeds `max_single_transfer`                                    |
| 2006 | `VersionMismatch`     | `expected_version` does not equal the live version                      |
| 2007 | `InvalidVersion`      | `bump_version` was called with a value not greater than the current one |
| 2008 | `OperationNotAllowed` | `operation` was not enabled via `set_operation_allowed`                 |

These codes are live and verifiable on testnet right now — see
[`docs/TESTNET_DEPLOYMENT.md`](https://github.com/Smart-Treasury-Account-STA/smart-contracts/blob/v1-full-implementation/docs/TESTNET_DEPLOYMENT.md)
§6.1 and §6.5 for reproducible `stellar contract invoke` commands that
trigger `RecipientNotAllowed` (2004), `AmountAboveLimit` (2005), and
`VersionMismatch` (2006) against the live deployed contract.

## Events

All events use the `#[contractevent]` macro, so clients can generate typed
bindings for them.

| Event                     | Topics   | Fields                                                                    |
| ------------------------- | -------- | ------------------------------------------------------------------------- |
| `Initialized`             | `init`   | `admin` (topic)                                                           |
| `AssetRuleUpdated`        | `asset`  | `asset` (topic)                                                           |
| `RecipientAllowedUpdated` | `rcpt`   | `recipient` (topic), `allowed`                                            |
| `OperationAllowedUpdated` | `op`     | `operation` (topic), `allowed`                                            |
| `PolicyVersionBumped`     | `policy` | `next_version`                                                            |
| `PolicyValidated`         | `pol_ok` | `operation` (topic), `asset`, `destination`, `amount`, `expected_version` |

`PolicyVersionBumped` is the audit signal that explains why a previously
valid approval started being rejected. Downstream systems should index it.
`PolicyValidated` is what a client actually sees on a successful live
`validate_policy` call or a successful payment that passed through it — see
the live event dumps in `docs/TESTNET_DEPLOYMENT.md` §6.1.

## Storage

| Key                  | Durability | Holds                                              |
| -------------------- | ---------- | -------------------------------------------------- |
| `Initialized`        | Persistent | Whether `initialize` has run                       |
| `Admin`              | Persistent | The admin `Address`                                |
| `Version`            | Persistent | The live policy version                            |
| `Asset(Address)`     | Persistent | The `AssetRule` for one asset                      |
| `Recipient(Address)` | Persistent | Whether one recipient is allowed                   |
| `Operation(Symbol)`  | Persistent | Whether one operation (e.g. `transfer`) is enabled |

All entries — instance-level (`Initialized`/`Admin`/`Version`) and per-entry
(`Asset`/`Recipient`/`Operation`) alike — share one TTL policy, refreshed by
every write and by every `validate_policy` read that touches them:

| Constant                | Ledgers | Approx.  |
| ----------------------- | ------- | -------- |
| `TTL_THRESHOLD_LEDGERS` | 501,120 | ~29 days |
| `TTL_EXTEND_TO_LEDGERS` | 518,400 | ~30 days |

## Access control

`initialize` stores the admin as a plain `Address` and every administrative
entrypoint calls a local `ensure_admin` helper (`require_auth()` on the
stored admin). Unlike [SmartAccount](/contracts/smart-account), this contract
does **not** compose OpenZeppelin's `stellar-access` crate — there is no
owner/role hierarchy here, just one admin address with no rotation
entrypoint. See [SmartAccount](/contracts/smart-account) for where the
project does use the composed OZ access-control model.

## Compiled artifact

```
wasm/sta_policy_engine.wasm — 7,466 bytes optimized
```

Exports exactly nine functions: `version`, `extend_ttl`, `initialize`,
`bump_version`, `contract_name`, `set_asset_rule`, `validate_policy`,
`set_operation_allowed`, `set_recipient_allowed`.

Live deployed WASM hash and testnet contract ID: see
[`docs/TESTNET_DEPLOYMENT.md`](https://github.com/Smart-Treasury-Account-STA/smart-contracts/blob/v1-full-implementation/docs/TESTNET_DEPLOYMENT.md).
