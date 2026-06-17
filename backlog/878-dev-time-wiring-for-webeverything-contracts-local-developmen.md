---
type: issue
workItem: story
size: 2
parent: "872"
status: resolved
blockedBy: ["874"]
dateOpened: "2026-06-17"
dateStarted: "2026-06-17"
dateResolved: "2026-06-17"
graduatedTo: "frontierui/tsconfig.json + frontierui/vite.config.mts (9 @webeverything/contracts/* dev-time path/alias entries, #804-2a sibling-alias)"
tags: []
---

# Dev-time wiring for @webeverything/contracts (local development without republish)

Let contracts be developed across repos without a publish on every change (per the #834 discussion: 'during development we could use npm link or similar'). Wire a dev-time path — prefer TS project references / a file: or workspace dependency over npm link (which is flaky on relink/resolution; type-only dodges the dual-runtime bug but path-mapping is cleaner). Release builds still use the published version (#877). Risk-mitigation story for the #872 epic addressing dev-loop friction.

## Progress

Done — chose **path-mapping** (the bold default; cleaner than npm link, no relink flakiness), reusing FUI's **already-proven #804-2a sibling-alias mechanism** rather than inventing one: FUI's `tsconfig.json` `paths` + `vite.config.mts` `alias` already resolve the publish-ready scoped specifiers for `@webeverything/capability-manifest`, `@webeverything/validation-generation/*`, and `@webeverything/webcases/*` into `../webeverything/<…>` source (no registry publish). I added the same for the #874 contract package — all nine per-protocol subpaths, mirroring `contracts/package.json` exports exactly:

- `frontierui/tsconfig.json` — 9 `@webeverything/contracts/*` → `../webeverything/contracts/*.ts` path entries.
- `frontierui/vite.config.mts` — the same 9 as Vite aliases (`join(weRoot, 'contracts/*.ts')`).

Release builds still resolve the published package (#877's CI). Verified: a throwaway probe importing `@webeverything/contracts/{guard,selection,tree-select}` resolves clean under FUI's real project `tsc -p tsconfig.json --noEmit` (no "Cannot find module"); FUI `check:standards` 0 err/0 warn. This is the resolution #875 relies on to migrate FUI's byte-copied contracts to package imports.
