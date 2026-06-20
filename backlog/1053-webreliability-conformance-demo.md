---
kind: story
size: 3
parent: "1019"
status: resolved
blockedBy: ["1051"]
dateOpened: "2026-06-19"
dateStarted: "2026-06-19"
dateResolved: "2026-06-19"
graduatedTo: "we:demos/webreliability-conformance-demo.html"
tags: []
---

# webreliability conformance demo

Slice C of webreliability impl epic #1019 (blockedBy slice A contract). Runtime conformance demo exercising the recovery-handler registry (offline-retry / resumable transfer) in a real browser, proving the contract+provider satisfy the standard. Wired into the demo registry.

## Progress

Shipped the webreliability conformance demo: `we:demos/webreliability-conformance-demo.html` + `.ts` + `.css`, registered in
`we:src/_data/demos.json` (project `webreliability`). The CustomRecoveryHandler contract (#1051) is type-only; the runtime
impl + swap registry live in FUI, so the demo supplies its **own** in-demo implementation to prove the
contract is realizable. Runtime-conformance section asserts **6 invariants** live. **Verified in a real
browser** (Playwright on Vite :3000): `playgroundReady=true`, **6/6 invariants hold**, no console errors.
WE `check:standards` 0 errors.
