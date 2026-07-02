---
kind: story
size: 5
status: resolved
dateOpened: "2026-07-02"
dateStarted: "2026-07-02"
dateResolved: "2026-07-02"
graduatedTo: none
tags: [ci, fui, cross-repo, build, pr-flow]
relatedTo: ["2158", "2138", "2153"]
---

# CI test job red single-repo: WE vitest suite fails on @frontierui sibling-alias imports (no published package, no sibling on CI)

The CI `test` job (`npm ci && npm run test:coverage`) is **red on origin/main** — after #2160 fixed the `relatedReport`-existence test, the remaining failures are **~15 test files that import `@frontierui/*`** (e.g. `@frontierui/plugs/webbehaviors/CustomAttribute` in `we:blocks/__tests__/unit/trusted-html/TrustedHtmlBehavior.test.ts`, `@frontierui/webtheme` in `we:reproduction-parity/__tests__/shadcn.test.ts`) with `Failed to resolve import … Does the file exist?`. Root cause: `@frontierui/*` is a **vite `resolve.alias` to the sibling `../frontierui`** tree (`we:vite.config.mts` — dev/test-time; "release builds use the published `@frontierui/plugs` package"), and single-repo CI has **neither the sibling nor a published package** installed (`@frontierui/*` isn't in `we:package.json` at all). Same WE↔FUI single-repo-coupling family as **#2158** (which scopes only `build:docs`/component-render), a **distinct surface**: the vitest suite. Options: consume `@frontierui/*` as published deps (the contract-distribution end-state), OR a CI FUI checkout (like the #1137 deploy workaround), OR gate the sibling-dependent tests behind a `WE_HAS_FUI_SIBLING` guard so single-repo CI runs the WE-only suite. **Blocks #2153** (the self-approved-PR flow's required `test` check can never pass while CI is red) and is why origin CI stayed red after #2160.

## Progress

**Resolved 2026-07-02** by **PR #4** (`6b643fa9` — landed via the self-approved-PR flow itself, the first real #2138 merge). Took the **CI-FUI-checkout** option: `we:.github/workflows/ci.yml` now checks WE out under `web-everything/` and the `chalbert/frontierui` sibling under `frontierui/` (via `FUI_READ_TOKEN`), runs `npm ci` + `build:tools` in FUI first, then WE's steps — so the `@frontierui/*` vite/vitest alias resolves. Also regenerated the stale `we:AGENTS.md` inventory block the health gate flagged. **Verified green:** CI run `28616794255` on `6b643fa9` succeeded (unit suite + `check:standards` both pass). This unblocks #2153.

**Residual → #2158.** This is the **sibling-checkout workaround** (the #1137 deploy pattern: a second private-repo checkout + a `FUI_READ_TOKEN` PAT), NOT the true single-repo independence the title gestures at. Consuming `@frontierui/*` as published packages so single-repo CI needs no sibling stays the end-state owned by **#2158** — this item is closed at "CI green so the PR flow's required check can pass," its blocking purpose for #2153.
