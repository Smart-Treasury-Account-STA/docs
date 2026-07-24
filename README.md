# Smart Treasury Account — Documentation

Public technical documentation for the Smart Treasury Account Soroban
contracts: architecture, entrypoints, security model, test suite, and
deployment.

Built with [VitePress](https://vitepress.dev).

## Purpose

This site is the documentation deliverable for Milestone 1, Deliverable 2
(smart contract test suite and documentation). It covers what the contracts
do, what guarantees they make, how to run the tests that prove those
guarantees, and how to deploy to testnet.

It documents only what exists. Modules that are specified but not yet
implemented are marked as such on every page and tracked on `/status`.

## Prerequisites

- Node.js 24
- pnpm 11+

## Installation

```bash
pnpm install
```

`esbuild` is the only dependency permitted to run install scripts, declared in
`pnpm-workspace.yaml`. Vite — and therefore VitePress — needs its
platform-specific binary to build.

## Local development

```bash
pnpm dev
```

Open `http://localhost:5173`.

## Validation

```bash
pnpm format:check
pnpm build
```

Both run in CI on pull requests and on `main`.

## Content structure

```text
docs/
  index.md                 Home
  status.md                What is implemented today
  contracts/               Architecture and per-contract reference
  security/                Guarantees, policy-version pinning, replay protection
  testing/                 Test command and the coverage matrix
  deployment/              Reproducible builds and testnet deployment
  .vitepress/config.ts     Site config, nav, sidebar
```

## Writing rules

The documentation is read by SCF reviewers, integrators, and treasury
operators. Three rules follow from that:

1. **Never document unimplemented code as though it shipped.** Use a
   `::: danger` callout naming the status, and link to `/status`.
2. **Never claim the contracts are audited.** OpenZeppelin's libraries are
   audited; the STA contracts are not. Both facts are stated wherever the
   subject comes up.
3. **Claim a guarantee only where a passing test backs it.** The
   [coverage matrix](docs/testing/coverage.md) maps each requirement to its
   test, and marks the rest pending.

## Deployment

Deploy to Vercel. Build command `pnpm build`, output directory
`docs/.vitepress/dist`.
