# PolicyEngine

**Crate:** `sta-policy-engine` · **Status:** implemented, 16 tests passing

The PolicyEngine answers one question: _is this treasury action allowed?_ It
validates the asset, the recipient, the amount, and the policy version the
caller pinned its approval to.

Every rejection path fails closed. An unknown asset, an unknown recipient, a
missing rule, or an unrecognized operation is a rejection, never a
default-allow.

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
    pub asset: Address,
    pub destination: Address,
    pub amount: i128,
    pub expected_version: u32,
    pub operation: Symbol,
}
```

`expected_version` is the policy version the caller approved under. The engine
compares it against the live version and rejects a mismatch. See
[policy-version pinning](/security/policy-version-pinning).

`operation` is currently `transfer` only. Any other symbol is rejected with
`OperationNotSupported` rather than falling through to the asset checks.

## Entrypoints

### `initialize(admin: Address)`

Sets the admin through OpenZeppelin access control and starts the policy at
version 1. Callable once — a second call returns `AlreadyInitialized`.

Requires the admin's authorization.

### `version() -> u32`

The live policy version. Callers read this and pin it into their approvals.

Returns `0` before initialization, which is how every other entrypoint detects
an uninitialized engine.

### `validate_policy(check: PolicyCheck) -> Result<(), PolicyEngineError>`

The authorization decision. **Read-only — it writes nothing**, so a client can
simulate the exact call it is about to authorize and get the same answer the
chain will give.

Checks run in this order, so the error a caller sees names the actual reason:

1. Engine initialized → else `NotInitialized`
2. `operation` is `transfer` → else `OperationNotSupported`
3. `expected_version` equals the live version → else `PolicyVersionMismatch`
4. `amount > 0` → else `InvalidAmount`
5. An `AssetRule` exists and is enabled → else `AssetNotAllowed`
6. `amount <= max_single_transfer` → else `AmountAboveLimit`
7. The recipient is allowlisted → else `RecipientNotAllowed`

### `set_asset_rule(asset: Address, rule: AssetRule)`

Admin only. Rejects `InvalidAmount` when a rule is enabled with a
`max_single_transfer` that is not positive — an enabled rule that can never
authorize anything is a configuration mistake, not a valid state.

### `set_recipient_allowed(recipient: Address, allowed: bool)`

Admin only. Adds or revokes a recipient.

### `bump_version(next_version: u32)`

Admin only. Advances the policy version. **Strictly monotonic**: `next_version`
must be greater than the current version, else `InvalidPolicyVersion`. A
version can never be replayed, so an approval that was rejected once stays
rejected.

### `get_asset_rule(asset: Address) -> Option<AssetRule>`

Returns `None` for an asset with no rule. Read-only, never fails.

### `is_recipient_allowed(recipient: Address) -> bool`

Returns `false` for an unknown recipient. **Absence is a denial**, not a
default. Read-only, never fails.

## Errors

| Code | Variant                 | Raised when                                                             |
| ---- | ----------------------- | ----------------------------------------------------------------------- |
| 2000 | `NotInitialized`        | Any entrypoint is called before `initialize`                            |
| 2001 | `AlreadyInitialized`    | `initialize` is called a second time                                    |
| 2003 | `AssetNotAllowed`       | No rule for the asset, or the rule is disabled                          |
| 2004 | `RecipientNotAllowed`   | The recipient is not allowlisted, or was revoked                        |
| 2005 | `InvalidAmount`         | Amount is zero or negative; or an enabled rule has a non-positive cap   |
| 2006 | `AmountAboveLimit`      | Amount exceeds `max_single_transfer`                                    |
| 2007 | `PolicyVersionMismatch` | `expected_version` does not equal the live version                      |
| 2008 | `InvalidPolicyVersion`  | `bump_version` was called with a value not greater than the current one |
| 2009 | `OperationNotSupported` | `operation` is not `transfer`                                           |

::: tip Why 2002 is missing
`2002` was reserved for an `Unauthorized` variant. It is unused: an admin
failure raises OpenZeppelin's own `AccessControlError`, so a duplicate STA
variant would be dead code that only ever diverged from the real one.
:::

## Events

All events use the `#[contractevent]` macro, so clients can generate typed
bindings for them.

| Event                   | Topics                                 | Data                             |
| ----------------------- | -------------------------------------- | -------------------------------- |
| `Initialized`           | `initialized`, `admin`                 | `version`                        |
| `AssetRuleSet`          | `asset_rule_set`, `asset`              | `enabled`, `max_single_transfer` |
| `RecipientAllowanceSet` | `recipient_allowance_set`, `recipient` | `allowed`                        |
| `VersionBumped`         | `version_bumped`                       | `previous`, `next`               |

`VersionBumped` is the audit signal that explains why a previously valid
approval started being rejected. Downstream systems should index it.

## Storage

| Key                  | Durability | Holds                                                 |
| -------------------- | ---------- | ----------------------------------------------------- |
| `Version`            | Instance   | The live policy version. `0` means never initialized. |
| `Asset(Address)`     | Persistent | The `AssetRule` for one asset                         |
| `Recipient(Address)` | Persistent | Whether one recipient is allowed                      |

Persistent entries have their TTL extended on every read and write, so a
long-lived treasury does not lose policy state:

| Constant                 | Ledgers   | Approx. |
| ------------------------ | --------- | ------- |
| `RULE_TTL_THRESHOLD`     | 518,400   | 30 days |
| `RULE_EXTEND_AMOUNT`     | 1,555,200 | 90 days |
| `INSTANCE_TTL_THRESHOLD` | 518,400   | 30 days |
| `INSTANCE_EXTEND_AMOUNT` | 1,555,200 | 90 days |

## Access control

`initialize` records the admin with `stellar_access::access_control::set_admin`.
Every administrative entrypoint calls `enforce_admin_auth`, the same audited
primitive. There is no hand-rolled admin check anywhere in the contract.

## Compiled artifact

```
wasm/sta_policy_engine.wasm — 7595 bytes optimized
```

Exports exactly eight functions: `initialize`, `version`, `set_asset_rule`,
`set_recipient_allowed`, `bump_version`, `get_asset_rule`,
`is_recipient_allowed`, `validate_policy`.
