# Running the tests

## Prerequisites

| Tool                   | Version                                                                                 |
| ---------------------- | --------------------------------------------------------------------------------------- |
| Rust                   | `stable`                                                                                |
| `wasm32v1-none` target | `rustup target add wasm32v1-none`                                                       |
| Stellar CLI            | 26.0.0+ (only needed to build WASM or deploy — the live testnet deployment used 26.0.0) |

## The test command

From the root of the contract workspace:

```bash
cargo test --workspace
```

That is the whole command. There is no test-only feature flag, no environment
variable, and no fixture server to start.

### Expected output

```
running 120 tests
...
test result: ok. 120 passed; 0 failed
```

Across the seven production contracts — `sta-webauthn-verifier` (9),
`sta-policy-engine` (12), `sta-intent-registry` (14),
`sta-recovery-manager` (35), `sta-transfer-adapter` (5),
`sta-split-adapter` (8), `sta-smart-account` (37) — **120 tests pass and 0
fail**, verified 2026-08-18. The four earlier PoC crates are excluded from
the workspace (see [Status](/status)) and are not part of this count.

### One crate at a time

```bash
cargo test -p sta-policy-engine
```

```
running 12 tests
test tests::bump_version_rejects_non_increasing_version ... ok
test tests::calling_before_initialize_rejects_not_initialized ... ok
test tests::contract_name_reports_expected_symbol ... ok
test tests::disabling_operation_after_the_fact_blocks_further_validation ... ok
test tests::fails_closed_for_unknown_operation_asset_or_recipient ... ok
test tests::permissionless_extend_ttl_refreshes_named_entries ... ok
test tests::rejects_stale_policy_version_and_amount_above_limit ... ok
test tests::set_asset_rule_rejects_enabled_rule_with_non_positive_cap ... ok
test tests::validate_policy_rejects_explicitly_disabled_asset ... ok
test tests::validate_policy_rejects_non_positive_amount ... ok
test tests::validates_allowed_payment_policy ... ok
test tests::writes_and_reads_extend_persistent_entry_ttl ... ok

test result: ok. 12 passed; 0 failed
```

## The full verification gate

Tests alone are not the bar. All four of these must pass before any change is
considered done, and CI runs the same four:

```bash
cargo fmt --all --check
cargo clippy --workspace --all-targets -- -D warnings
cargo test --workspace
stellar contract build --optimize --out-dir wasm
```

`-D warnings` is not decoration. It is what caught the `Events::publish`
deprecation in soroban-sdk 26 and forced a deliberate decision about it —
every event across all seven contracts is now a typed `#[contractevent]`
struct, not a raw tuple.

## How the tests are written

Tests use `soroban_sdk::Env` with the `testutils` feature, register the
contract in a fresh environment, and drive it through the generated client:

```rust
fn setup() -> (Env, PolicyEngineClient<'static>) {
    let env = Env::default();
    env.mock_all_auths();
    let contract_id = env.register(PolicyEngine, ());
    let client = PolicyEngineClient::new(&env, &contract_id);
    client.initialize(&Address::generate(&env));
    (env, client)
}
```

Rejection paths assert the **exact** error, not merely that something failed:

```rust
let err = client.try_validate_policy(&PolicyCheck { /* amount above cap */ });
assert_eq!(err, Err(Ok(PolicyEngineError::AmountAboveLimit)));
```

`try_*` returns the typed error instead of panicking. Asserting the specific
variant is what stops a test from passing because the contract failed for an
unrelated reason — the most common way a security test quietly stops testing
anything.

Several tests go further and assert **state**, not just an error code — e.g.
confirming a persistent entry's TTL was actually refreshed by a write or a
read (`writes_and_reads_extend_persistent_entry_ttl`), or that a rejected
payment left the treasury's on-chain balance unchanged.

## Testing philosophy

The suite deliberately does **not** re-test OpenZeppelin's access-control and
pause primitives. Those are covered by their upstream test suite and audit, and
duplicating them here would add maintenance cost while proving nothing new.

What the suite does test is the boundary STA owns: replay protection, policy-
version pinning, fail-closed policy evaluation, timelocked adapter
reconfiguration, scheduled-payment intent pinning, and recovery/guardian-pull
flows — the guarantees documented in [Security](/security/).

See the [coverage matrix](/testing/coverage) for the requirement-by-requirement
mapping.
