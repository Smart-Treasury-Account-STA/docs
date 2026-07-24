# SmartAccount

**Crate:** `sta-smart-account` · **Status: not implemented**

::: danger Specified, not shipped
This page documents the **specified** interface. The crate does not exist in
the workspace yet. Do not integrate against it, and do not treat anything below
as a description of running code. [Status](/status) tracks what is actually
implemented.
:::

The SmartAccount is the root treasury authority. It is a Soroban custom
account: it holds the treasury's Stellar Asset Contract balances and authorizes
its own outgoing calls through `__check_auth`.

## Responsibilities

- Treasury initialization
- Signer records, roles, and weights
- Threshold validation
- Custom account authorization via `__check_auth`
- Policy-version binding
- Nonce replay protection
- Pause and freeze
- Execution coordination with the [PolicyEngine](/contracts/policy-engine)

## Built on OpenZeppelin's smart account

The signer model, context rules, and authorization payload come from
`stellar_accounts::smart_account` rather than being reinvented:

```rust
pub enum Signer {
    Delegated(Address),
    External(Address, Bytes),
}

pub struct ContextRule {
    pub id: u32,
    pub context_type: ContextRuleType,
    pub name: String,
    pub signers: Vec<Signer>,
    pub signer_ids: Vec<u32>,
    pub policies: Vec<Address>,
    pub policy_ids: Vec<u32>,
    pub valid_until: Option<u32>,
}

pub struct AuthPayload {
    pub signers: Map<Signer, Bytes>,
    pub context_rule_ids: Vec<u32>,
}
```

`__check_auth` delegates to `stellar_accounts::smart_account::do_check_auth`.
Signature verification — including WebAuthn and passkeys via
`stellar_accounts::verifiers` — is the toolkit's job, not STA's. There is no
hand-rolled verifier.

Signer weights and thresholds come from
`stellar_accounts::policies::weighted_threshold`.

## Planned entrypoints

| Entrypoint                                                                                                | Purpose                                         |
| --------------------------------------------------------------------------------------------------------- | ----------------------------------------------- |
| `initialize(admin, policy_engine)`                                                                        | Set the admin and bind the PolicyEngine address |
| `get_context_rules_count() -> u32`                                                                        | OpenZeppelin default                            |
| `get_context_rule(id) -> ContextRule`                                                                     | OpenZeppelin default                            |
| `add_context_rule(...)`, `add_signer(...)`, `remove_signer(...)`, `add_policy(...)`, `remove_policy(...)` | OpenZeppelin defaults                           |
| `__check_auth(payload, auth_payload, auth_contexts)`                                                      | Custom account authorization                    |
| `execute_transfer_payment(asset, destination, amount, nonce, expected_policy_version)`                    | Policy-checked SAC transfer                     |
| `is_nonce_used(nonce) -> bool`                                                                            | Replay preflight for clients                    |
| `pause()`, `unpause()`, `freeze()`                                                                        | Emergency controls                              |
| `status() -> AccountStatus`                                                                               | Initialized, paused, frozen, policy version     |

## Two deliberate design decisions

### There is no `unfreeze()`

Pause is reversible; **freeze is not**. Unfreezing is the outcome of a
completed recovery — a guardian threshold plus a timelock — not a second
admin-gated toggle that would let a potentially compromised admin undo an
emergency freeze.

::: warning Operational consequence
`RecoveryManager` lands in a later tranche. Until it does, **a freeze is
terminal for that deployment.** Anyone operating a treasury needs to know this
before touching the control, not after.
:::

### A threshold that cannot be reached is rejected

Before accepting a threshold change, the account sums the weights of active
signers on the context rule and rejects a threshold that exceeds it. A treasury
cannot be configured into a state where no achievable set of signatures can
authorize anything.

## Payment execution order

```rust
// 1. Require the account's own authorization for exactly these arguments,
//    so __check_auth runs the context rule, signers, and policies.
// 2. Guards: not paused, not frozen.
// 3. Replay: reject a consumed nonce.
// 4. Policy: cross-contract validate_policy, pinned to the caller's version.
// 5. Consume the nonce — before the transfer.
// 6. Execute the real SAC transfer from this contract's balance.
// 7. Emit the typed payment event.
```

Steps 5 and 6 are in that order on purpose: a token with a callback cannot
re-enter and spend the same nonce twice. Step 4 delegates rather than
duplicating the version comparison, so there is one authority on what a policy
version means.
