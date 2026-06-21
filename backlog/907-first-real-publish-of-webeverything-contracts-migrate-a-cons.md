---
kind: story
size: 3
parent: "872"
status: parked
parkedReason: deferred
dateOpened: "2026-06-18"
dateStarted: "2026-06-18"
tags: []
---

# First real publish of @webeverything/contracts + migrate a consumer from dev path-mapping to the pinned published dep

The #872 endgame step that #877's CI pipeline enables but does not perform: actually bump @webeverything/contracts off the placeholder 0.0.0, publish it (via the #877 contracts-v* tag workflow), and migrate a consumer (FUI and/or plateau-app) from the #878 dev-time path-mapping (../webeverything/contracts source) to a PINNED @webeverything/contracts dependency in we:package.json. Until this lands, no consumer pins a version and the contract can't skew — which is why the #876 version-skew drift gate has nothing to check (verified batch-2026-06-17: neither FUI nor plateau-app declares a @webeverything/contracts dep; version is 0.0.0). This creates the version-skew surface #876 guards. Separately-prioritized (#804 2b, 'no hurry').

## Parked — blocked-in-fact on external publish infrastructure (batch-2026-06-18)

This item's core deliverable is an **actual npm publish of `@webeverything/contracts`** plus migrating a
consumer to a **pinned published** dependency. Verified the publish path is not agent-executable:

- **Registry/org absent** — `npm view @webeverything/contracts version` → `E404 Not Found`; the
  `@webeverything` org is not published. `npm whoami` → `E401 Unauthorized` (no publish credentials in
  this environment).
- **Publish is a human/CI tag-push step** — the #877 pipeline (`we:.github/workflows/publish-contracts.yml`)
  fires on a hand-created `contracts-v*` tag push and runs `npm publish --provenance` with
  `secrets.NPM_TOKEN`. An agent never pushes (and has no token), so the publish cannot be triggered here.
- **The consumer migration cascades from the publish** — FUI consumes the contract via vite alias +
  tsconfig path-mapping to the source (`../webeverything/contracts/*.ts`,
  `frontierui/vite.config.mts:222`, `fui:frontierui/tsconfig.json:51`). Pinning it to
  `"@webeverything/contracts": "^0.x"` before the version exists on the registry would **break FUI's
  `npm install`**. So the migration can't land independently of the publish.

**Unparks when** a human runs the publish ceremony: `npm version <x>` in `contracts/` → push the
`contracts-v*` tag → CI publishes → registry has the version. Then the consumer-pinning half is a small,
agent-doable follow-up (swap FUI's alias/path-map for a pinned `dependencies` entry). No agent-doable slice
remains until then; bumping the version locally without a publish would only arm the workflow and mislead
the tree (a `0.x` in-tree with nothing on the registry). Left at `0.0.0` deliberately.
