---
type: idea
workItem: story
size: 3
parent: "1022"
status: resolved
blockedBy: ["1060"]
dateOpened: "2026-06-19"
dateResolved: "2026-06-19"
graduatedTo: "we:demos/webidentity-conformance-demo.html"
tags: []
---

# webidentity conformance demo

Slice C of webidentity impl epic #1022 (blockedBy slice A contract). Runtime conformance demo exercising the credential-management contract+provider in a real browser, proving they satisfy the standard. Wired into the demo registry.

## Progress

Shipped the webidentity conformance demo: `we:demos/webidentity-conformance-demo.html` + `.ts` + `.css`, registered in
`we:src/_data/demos.json` (project `webidentity`). The CustomCredentialProvider contract (#1060) is type-only; the runtime
impl + swap registry live in FUI, so the demo supplies its **own** in-demo implementation to prove the
contract is realizable. Runtime-conformance section asserts **6 invariants** live. **Verified in a real
browser** (Playwright on Vite :3000): `playgroundReady=true`, **6/6 invariants hold**, no console errors.
WE `check:standards` 0 errors.
