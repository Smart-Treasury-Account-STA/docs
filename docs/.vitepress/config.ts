import { defineConfig } from "vitepress";

export default defineConfig({
  title: "Smart Treasury Account",
  description:
    "Technical documentation for the Smart Treasury Account Soroban contracts: architecture, entrypoints, security model, test suite, and deployment.",
  lang: "en-US",
  cleanUrls: true,
  lastUpdated: true,

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
