import { defineConfig } from "vitepress";

// The site is served from https://smarttreasury.io/docs/. The Next.js app owns
// the apex domain and proxies /docs/* to this project's own Vercel deployment,
// so the docs share the marketing site's origin for SEO.
const SITE_URL = process.env.SITE_URL ?? "https://smarttreasury.io";

// Kept in one place: VitePress applies `base` to asset and link URLs, but not
// to sitemap entries. Building the sitemap hostname from the same constant is
// what stops the sitemap advertising URLs that do not exist.
const BASE = "/docs/";

export default defineConfig({
  title: "Smart Treasury Account",
  description:
    "Technical documentation for the Smart Treasury Account Soroban contracts: architecture, entrypoints, security model, test suite, and deployment.",
  lang: "en-US",
  base: BASE,
  cleanUrls: true,
  lastUpdated: true,
  srcExclude: ["README.md"],

  sitemap: {
    hostname: `${SITE_URL}${BASE}`,
  },

  head: [
    ["meta", { name: "theme-color", content: "#2563eb" }],
    ["meta", { property: "og:type", content: "website" }],
    ["meta", { property: "og:title", content: "Smart Treasury Account" }],
    [
      "meta",
      {
        property: "og:description",
        content:
          "Programmable treasury contracts on Stellar and Soroban: policy-enforced payments, approvals, and recovery.",
      },
    ],
  ],

  themeConfig: {
    nav: [
      { text: "Contracts", link: "/contracts/", activeMatch: "/contracts/" },
      { text: "Security", link: "/security/", activeMatch: "/security/" },
      { text: "Testing", link: "/testing/", activeMatch: "/testing/" },
      { text: "Deployment", link: "/deployment/", activeMatch: "/deployment/" },
    ],

    sidebar: [
      {
        text: "Introduction",
        items: [
          { text: "Overview", link: "/" },
          { text: "Status", link: "/status" },
        ],
      },
      {
        text: "Contracts",
        items: [
          { text: "Architecture", link: "/contracts/" },
          { text: "PolicyEngine", link: "/contracts/policy-engine" },
          { text: "SmartAccount", link: "/contracts/smart-account" },
        ],
      },
      {
        text: "Security model",
        items: [
          { text: "Guarantees", link: "/security/" },
          { text: "Policy-version pinning", link: "/security/policy-version-pinning" },
          { text: "Replay protection", link: "/security/replay-protection" },
        ],
      },
      {
        text: "Testing",
        items: [
          { text: "Running the tests", link: "/testing/" },
          { text: "Coverage matrix", link: "/testing/coverage" },
        ],
      },
      {
        text: "Deployment",
        items: [{ text: "Testnet", link: "/deployment/" }],
      },
    ],

    search: { provider: "local" },

    outline: { level: [2, 3] },

    editLink: {
      pattern: "https://github.com/smart-treasury/docs/edit/main/docs/:path",
      text: "Edit this page",
    },

    footer: {
      message:
        "The Smart Treasury Account contracts have not been independently audited. OpenZeppelin's Stellar libraries, which they build on, have been.",
      copyright: "Smart Treasury Account",
    },
  },
});
