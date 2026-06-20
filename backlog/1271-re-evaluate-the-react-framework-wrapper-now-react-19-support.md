---
kind: story
size: 3
parent: "1258"
status: resolved
dateOpened: "2026-06-20"
dateStarted: "2026-06-20"
dateResolved: "2026-06-20"
graduatedTo: wrapper-conformance/vectors.ts
tags: []
---

# Re-evaluate the React framework wrapper now React 19 supports custom elements natively

React 19 passes Custom Elements Everywhere (property/attribute heuristic plus custom event support), so the resolved React wrapper (#977) may now be largely unnecessary — native-first (#031) extended to frameworks. Re-evaluate the wrapper: demote it to thin or optional where React 19 native consumption suffices, keeping it only for genuine gaps. Surfaced by the 2026-06-20 framework-churn watch (#1258).

## Progress

Resolved 2026-06-20 — **front-A re-evaluation, finding recorded.**

**Finding:** React 19 passes Custom Elements Everywhere — it assigns rich values as DOM *properties* (the
prop/attribute heuristic) and bridges custom events to handler props. Those are precisely behaviours 3 + 4
of the WE wrapper contract (we:wrapper-conformance/vectors.ts) and were React's historical gaps. So a React
wrapper is now **largely optional** for React 19 consumers: native JSX consumption of the custom element
satisfies the contract directly. The wrapper should be **demoted to optional/thin**, kept only for genuine
residual gaps (e.g. SSR prop hydration, typed ref forwarding), not the default consumption path —
native-first (#031) extended to the framework boundary.

**WE-side action (done):** recorded the currency in we:wrapper-conformance/vectors.ts — the version-agnostic
contract header now notes React 19's native CEE pass and the wrapper's now-optional status. **FUI-side
action (separate locus, tracked under #1258):** the actual wrapper code is FUI-resident (#977 graduated to
`frontierui:tools/gen-wrapper/wrapperFormCatalog.mjs`); demoting/thinning it is a FUI change, downstream of
this WE-side conformance finding — not performed from this WE-locus item. Gate green.
