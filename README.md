# Smart Treasury Account — Documentation

Public technical documentation for the Smart Treasury Account Soroban
contracts: architecture, entrypoints, security model, test suite, and
deployment.

Built with [VitePress](https://vitepress.dev).

## Purpose

This site is the living technical documentation for the Smart Treasury
Account contracts, originally delivered for Milestone 1, Deliverable 2
(smart contract test suite and documentation) and kept current since. It
covers what the contracts do, what guarantees they make, how to run the
tests that prove those guarantees, and how to deploy to testnet.

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

Open `http://localhost:5173/docs/`. The site is configured with `base: '/docs/'`,
so the server root returns 404 by design — content is served under the prefix
in development exactly as it is in production.

## Validation

```bash
pnpm format:check
pnpm build
```

Both run in CI on pull requests and on `main`.

## Content structure

Content lives at the repository root, so `outputDirectory` in `vercel.json`
resolves to `.vitepress/dist`.

```text
index.md                 Home
status.md                What is implemented today
contracts/               Architecture and per-contract reference
security/                Guarantees, policy-version pinning, replay protection
testing/                 Test command and the coverage matrix
deployment/              Reproducible builds and testnet deployment
.vitepress/config.ts     Site config, nav, sidebar
```

`README.md` is listed in `srcExclude` so it is not published as a page.

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

This is a **separate Vercel project** from the Next.js application, served to
users under `https://smarttreasury.io/docs/` so the documentation shares the
application's origin for SEO.

The routing has three parts, and all three must agree:

1. **This site** is built with `base: '/docs/'`, so every asset and internal
   link it emits already carries the prefix.
2. **The Next.js app** (`org/dApp/next.config.ts`) rewrites `/docs` and
   `/docs/:path*` to this project's deployment origin, stripping the prefix.
3. **`vercel.json`** here sets `outputDirectory` to `.vitepress/dist` and
   rewrites `/docs/:path*` back to `/:path*`, so the site also works when hit
   directly on its own Vercel domain.

Configure `DOCS_ORIGIN` on the Next.js project if this project's deployment URL
changes; `SITE_URL` here controls the sitemap hostname and defaults to
`https://smarttreasury.io`.

::: warning Sitemap and base
VitePress applies `base` to asset and link URLs but **not** to sitemap entries.
The config derives the sitemap hostname from the same `BASE` constant for that
reason — set them independently and the sitemap will advertise URLs that do not
exist.
:::
