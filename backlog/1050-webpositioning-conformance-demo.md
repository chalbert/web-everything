---
type: idea
workItem: story
size: 3
parent: "1018"
status: resolved
blockedBy: ["1048"]
dateOpened: "2026-06-19"
dateStarted: "2026-06-19"
dateResolved: "2026-06-19"
graduatedTo: "we:demos/webpositioning-conformance-demo.html"
tags: []
---

# webpositioning conformance demo

Slice C of webpositioning impl epic #1018 (blockedBy slice A contract). A runtime conformance demo exercising the anchor-positioning contract in a real browser (anchored/responsive placement), proving the contract+provider satisfy the standard. Wired into the demo registry per the new-demo pattern.

## Progress

Shipped the webpositioning conformance demo (slice C of #1018): `we:demos/webpositioning-conformance-demo.html`
+ `.ts` + `.css`, registered in `we:src/_data/demos.json` (`webpositioning-conformance-demo`, project
`webpositioning`). The `PositioningStrategy` contract is type-only (`we:positioning/contract.ts`); the demo
supplies its **own** in-demo JS placement strategy (honest browser stub — the native CSS-anchor strategy +
JS fallback + `customPositioning` registry are FUI impl) to prove the contract is realizable: a surface
declares a `Placement` + collision flags and the strategy realizes it, returning a reversible
`PositioningTeardown`.

Runtime-conformance section asserts 6 invariants live: `place()` returns a teardown, the strategy name
reflects on `data-positioning-strategy`, a bottom placement sits below its trigger, an overflowing side
flips, `shift` clamps within the viewport, and teardown is fully reversible. **Verified in a real browser**
(Playwright on Vite :3000): `playgroundReady=true`, **6/6 invariants hold**, no console errors. WE
`check:standards` 0 errors.
