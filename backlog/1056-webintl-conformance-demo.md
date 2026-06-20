---
kind: story
size: 3
parent: "1020"
status: resolved
blockedBy: ["1054"]
dateOpened: "2026-06-19"
dateResolved: "2026-06-19"
graduatedTo: "we:demos/webintl-conformance-demo.html"
tags: []
---

# webintl conformance demo

Slice C of webintl impl epic #1020 (blockedBy slice A contract). Runtime conformance demo exercising the Intl.* provider (collation/date/number/relative-time across locales) in a real browser, proving the contract+provider satisfy the standard. Wired into the demo registry.

## Progress

Shipped the webintl conformance demo: `we:demos/webintl-conformance-demo.html` + `.ts` + `.css`, registered in
`we:src/_data/demos.json` (project `webintl`). The CustomIntlProvider contract (#1054) is type-only; the runtime
impl + swap registry live in FUI, so the demo supplies its **own** in-demo implementation to prove the
contract is realizable. Runtime-conformance section asserts **6 invariants** live. **Verified in a real
browser** (Playwright on Vite :3000): `playgroundReady=true`, **6/6 invariants hold**, no console errors.
WE `check:standards` 0 errors.
