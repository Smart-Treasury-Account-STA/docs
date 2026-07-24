# Running the tests

## Prerequisites

| Tool                   | Version                                      |
| ---------------------- | -------------------------------------------- |
| Rust                   | 1.95.0                                       |
| `wasm32v1-none` target | `rustup target add wasm32v1-none`            |
| Stellar CLI            | 27.0.0 (only needed to build WASM or deploy) |

## The test command

From the root of the contract workspace:

```bash
cargo test --workspace
```

That is the whole command. There is no test-only feature flag, no environment
variable, and no fixture server to start.

### Expected output

```
running 16 tests
test test::initializes_with_version_one ... ok
test test::rejects_double_initialize ... ok
test test::accepts_an_allowed_transfer ... ok
test test::rejects_an_unknown_asset ... ok
test test::rejects_a_disabled_asset ... ok
test test::rejects_an_unknown_recipient ... ok
test test::rejects_a_revoked_recipient ... ok
test test::rejects_an_amount_above_the_cap ... ok
test test::accepts_an_amount_exactly_at_the_cap ... ok
test test::rejects_a_non_positive_amount ... ok
test test::rejects_a_stale_expected_version_after_a_bump ... ok
test test::rejects_a_non_monotonic_version_bump ... ok
test test::rejects_an_unsupported_operation ... ok
test test::reads_back_configured_rules ... ok
test test::rejects_admin_calls_from_a_non_admin ... ok
test test::rejects_validation_before_initialization ... ok

test result: ok. 16 passed; 0 failed
```

Across the whole workspace — the production PolicyEngine plus the four PoC
crates — **38 tests pass and 0 fail**, verified 2026-07-24.

### One crate at a time

```bash
cargo test -p sta-policy-engine
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
deprecation in soroban-sdk 26 and forced a deliberate decision about it rather
than an accumulating pile of warnings.

## How the tests are written

Tests use `soroban_sdk::Env` with the `testutils` feature, register the
contract in a fresh environment, and drive it through the generated client:

```rust
fn setup() -> Fixture<'static> {
    let env = Env::default();
    env.mock_all_auths();
    let contract_id = env.register(PolicyEngine, ());
    let client = PolicyEngineClient::new(&env, &contract_id);
    let admin = Address::generate(&env);
    client.initialize(&admin);
    // ...
}
```

Rejection paths assert the **exact** error, not merely that something failed:

```rust
assert_eq!(
    f.client.try_validate_policy(&check(&f, 11, 1)),
    Err(Ok(PolicyEngineError::AmountAboveLimit))
);
```

`try_*` returns the typed error instead of panicking. Asserting the specific
variant is what stops a test from passing because the contract failed for an
unrelated reason — the most common way a security test quietly stops testing
anything.

## Testing philosophy

The suite deliberately does **not** re-test OpenZeppelin's access-control and
pause primitives. Those are covered by their upstream test suite and audit, and
duplicating them here would add maintenance cost while proving nothing new.

What the suite does test is the boundary STA owns: that the account **calls**
those primitives correctly (`rejects_admin_calls_from_a_non_admin`), and the
guarantees that are STA's own — policy-version mismatch, replay rejection, and
signer-weight threshold edges.

See the [coverage matrix](/testing/coverage) for the requirement-by-requirement
mapping.
