---
bornAs: xqg3my2
kind: story
size: 5
parent: "2649"
status: resolved
blockedBy: []
scope: ["we:scripts/lib/"]
dateOpened: "2026-07-24"
dateStarted: "2026-07-25"
dateResolved: "2026-07-25"
tags: []
---

# Design-pixels + decision-prose subject adapters

design-pixels adapter (usability/visual/a11y/design-systems lens-set per #2576); decision-prose adapter (thin over the existing plan-handshake). design-pixels screenshot-vs-target grounding registered as a DEFERRED method until the visual-diff primitive lands — unblock: a ~size-2 follow-up wires it in then.

## Progress

- Added `we:scripts/lib/design-pixels-adapter.mjs` — the design-pixels subject adapter. Declares the #2576
  lens-set (usability / visual / a11y / design-systems), a grounding-method registry (`design-heuristic-review`,
  `axe-scan`, and the DEFERRED `screenshot-vs-target`), a touch-set classifier, and a contract-conforming
  `DESIGN_PIXELS_ADAPTER` that snaps into the #2656 `resolveAdapterRoster` seam. usability + a11y are the
  mandatory (grounded) lenses; visual is deferred-grounded so never mandatory.
- Added `we:scripts/lib/decision-prose-adapter.mjs` — the decision-prose subject adapter, THIN over the shipped
  plan-handshake (`buildPlanMandate` / `buildPlanCritiqueMandate` / `derivePlanOutcome`). Root-cause /
  completeness lens-set, `plan-critique` grounding method, buildMandate delegates to `buildPlanCritiqueMandate`,
  and the proposer↔critic loop is re-exported through the module.
- KNOWN GAP left open per the ratified record: the screenshot-vs-target grounding is registered as DEFERRED
  (`isDesignPixelMethodDeferred`) — recorded on the roster seat for provenance, not callable until the visual-diff
  primitive lands (the ~size-2 follow-up).
- Documented the mandatory-lens INVARIANT (both subjects' mandatory lenses ride the touch-set, present exactly
  when there is a real subject to review) and pinned it with tests.
- Tests: `we:scripts/lib/__tests__/design-pixels-adapter.test.mjs` + `we:scripts/lib/__tests__/decision-prose-adapter.test.mjs`.
  No edits to `we:scripts/lib/review-core.mjs` / `we:scripts/lib/jury-core.mjs` — both adapters are new modules that IMPORT the S4 seam.
