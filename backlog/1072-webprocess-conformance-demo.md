---
type: idea
workItem: story
size: 3
parent: "1026"
status: resolved
blockedBy: ["1070", "1071"]
dateOpened: "2026-06-19"
dateStarted: "2026-06-20"
dateResolved: "2026-06-20"
graduatedTo: "we:demos/webprocess-conformance-demo.ts"
tags: []
---

# webprocess conformance demo

Slice C of webprocess impl epic #1026 (blockedBy slice A contract). Runtime conformance demo exercising the self-driven artefact contract+runtime in a real browser, proving they satisfy the standard. Wired into the demo registry.

## Resolution (batch-2026-06-19) — runtime #1071 landed in WE, so the demo is buildable

The earlier blocked-in-fact note's premise was wrong: #1071 did NOT build the runtime in FUI/plateau-app — it graduated to `we:process/provider.ts`, and `we:process/` now ships the full runtime (`contract.ts` + `provider.ts` + `registry.ts` + `driver.ts` + `index.ts`). Both `blockedBy` edges (#1070/#1071) are resolved. So a WE-side browser demo exercising the runtime is exactly the right slice C.

Built `we:demos/webprocess-conformance-demo.{ts,html,css}` + the `we:src/_data/demos/webprocess-conformance-demo.json` registry entry (mirroring the sibling `analytics-conformance-demo`). The demo imports the runtime as a plain library (unplugged) and asserts **10 contract invariants live**: the default seam ships the `L0–L5` ladder + the `webprocess/default` recipe; `assertStep`/`assertProcessRecipe` enforce the shape at the seam; `indexSteps` throws `BrokenStepGraphError` on a dangling edge; `runnableSteps` yields the dependency frontier; `isRunComplete` needs a completed final step; `effectiveCeiling` throttles the autonomy ceiling DOWN per low-tolerance dimension (never grants, floored at `L0`), with recipe ceiling overrides applied before the throttle; and the autonomy ladder is OPEN to new rungs.

Verified live on the running dev server (Playwright, `http://localhost:3000/demos/webprocess-conformance-demo.html`): **10/10 invariants hold**. (The 7 unrelated `blocks/parsers/*` 500s in the console are a concurrent session's in-flight files — the known-good `analytics-conformance-demo` shows the identical set; not caused by this demo, which imports only `we:process/`.) AGENTS.md inventory regenerated.
