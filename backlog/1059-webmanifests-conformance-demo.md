---
kind: story
size: 3
parent: "1021"
status: resolved
blockedBy: ["1057"]
dateOpened: "2026-06-19"
dateResolved: "2026-06-19"
graduatedTo: "we:demos/webmanifests-conformance-demo.html"
tags: []
---

# webmanifests conformance demo

Slice C of webmanifests impl epic #1021 (blockedBy slice A contract). Runtime conformance demo exercising the changelog-manifest contract+reader in a real browser, proving they satisfy the standard. Wired into the demo registry per the new-demo pattern.

## Progress

Shipped the webmanifests conformance demo: `we:demos/webmanifests-conformance-demo.html` + `.ts` + `.css`, registered in
`we:src/_data/demos.json` (project `webmanifests`). The changelog-manifest contract (#1057) is type-only; the runtime
impl + swap registry live in FUI, so the demo supplies its **own** in-demo implementation to prove the
contract is realizable. Runtime-conformance section asserts **6 invariants** live. **Verified in a real
browser** (Playwright on Vite :3000): `playgroundReady=true`, **6/6 invariants hold**, no console errors.
WE `check:standards` 0 errors.
