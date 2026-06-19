---
type: issue
workItem: story
size: 3
status: resolved
dateOpened: "2026-06-18"
dateStarted: "2026-06-19"
dateResolved: "2026-06-19"
graduatedTo: frontierui/tools/gen-wrapper/surfaceContract.mjs
tags: []
---

# Surface-contract conformance tier — deterministic generated-wrapper-vs-CEM check + workbench badge

Graded-conformance surface tier ratified by #913. Build a DETERMINISTIC (no live sandbox) check that the genWrapper-emitted React/Vue wrapper exposes exactly the props/events/slots/generated-HTML the CEM contract declares — a semantic surface-vs-contract verdict, NOT a byte-for-byte source golden (that is mere regression). Surface it as a workbench badge labelled precisely 'surface-contract' (honesty rule: never a bare 'conformance' label). Ownership per #899/constellation-placement: surface vectors/schema → WE, the runner → FUI (locus), badge = FUI-workbench consumer. Catches 'generator dropped an event' before #912's sandbox exists — a different failure class than the behavioral tier (#967).

## Progress — resolved (batch-2026-06-18)

Built along the #899 ownership cut:

- **WE (vectors + schema)** — `we:blocks/renderers/module-service/conformance/surfaceVectors.ts`: the
  verdict schema (`SurfaceMember`/`SurfaceVector`/`SurfaceContractVerdict`) + `SURFACE_VECTORS` spanning
  every surface dimension (mixed `combo-box`, attributes-only, events-only). Surface members are
  **target-neutral** (an `event` is "must forward this DOM event"); the runner maps each to its per-target
  manifestation, so WE never legislates framework specifics.
- **FUI (runner)** — `fui:tools/gen-wrapper/surfaceContract.mjs` (+ `.d.ts`):
  `extractWrapperSurface` (pure source parse, no eval → deterministic) + `checkSurfaceContract(vector,
  target)` producing the verdict (`missing` = generator dropped a declared member; `extra` = invented a
  prop/event; slots excluded from `extra` as a benign superset). Generic, so it runs the WE vectors.
- **FUI (badge)** — `fui:workbench/surfaceContractBadge.ts`: builds + renders a workbench badge
  with the label fixed to the string `surface-contract` (the #913 honesty rule), pass iff every target's
  verdict is ok, with a per-target gap detail.

The runner test **consumes the WE vectors across the boundary** (relative import = the byte-replication
interim seam, #700/#239; published-package end-state) and proves the drop class is caught (a contract that
declares an un-emitted event → `ok:false`, `missing:[event]`). 11/11 tests + `check:standards` green in
both repos. (Generated-HTML equivalence beyond the rendered tag is left to the behavioral tier #967 — the
surface tier asserts the *tag is rendered consume-mode*, not full DOM output, which needs evaluation.)
