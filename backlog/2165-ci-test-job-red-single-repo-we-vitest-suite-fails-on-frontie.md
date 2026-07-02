---
kind: story
size: 5
status: open
dateOpened: "2026-07-02"
tags: [ci, fui, cross-repo, build, pr-flow]
relatedTo: ["2158", "2138", "2153"]
---

# CI test job red single-repo: WE vitest suite fails on @frontierui sibling-alias imports (no published package, no sibling on CI)

The CI `test` job (`npm ci && npm run test:coverage`) is **red on origin/main** — after #2160 fixed the `relatedReport`-existence test, the remaining failures are **~15 test files that import `@frontierui/*`** (e.g. `@frontierui/plugs/webbehaviors/CustomAttribute` in `we:blocks/__tests__/unit/trusted-html/TrustedHtmlBehavior.test.ts`, `@frontierui/webtheme` in `we:reproduction-parity/__tests__/shadcn.test.ts`) with `Failed to resolve import … Does the file exist?`. Root cause: `@frontierui/*` is a **vite `resolve.alias` to the sibling `../frontierui`** tree (`we:vite.config.mts` — dev/test-time; "release builds use the published `@frontierui/plugs` package"), and single-repo CI has **neither the sibling nor a published package** installed (`@frontierui/*` isn't in `we:package.json` at all). Same WE↔FUI single-repo-coupling family as **#2158** (which scopes only `build:docs`/component-render), a **distinct surface**: the vitest suite. Options: consume `@frontierui/*` as published deps (the contract-distribution end-state), OR a CI FUI checkout (like the #1137 deploy workaround), OR gate the sibling-dependent tests behind a `WE_HAS_FUI_SIBLING` guard so single-repo CI runs the WE-only suite. **Blocks #2153** (the self-approved-PR flow's required `test` check can never pass while CI is red) and is why origin CI stayed red after #2160.
