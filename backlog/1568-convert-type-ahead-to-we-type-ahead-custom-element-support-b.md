---
kind: story
size: 3
parent: "1442"
status: resolved
dateOpened: "2026-06-22"
dateStarted: "2026-06-22"
dateResolved: "2026-06-22"
graduatedTo: "fui:blocks/type-ahead/TypeAheadElement.ts"
locus: frontierui
relatedProject: webcomponents
relatedReport: reports/2026-06-22-1442-slice-wave-3.md
tags: [packaging, custom-elements, block-model, conversion, type-ahead, frontierui]
---

# Convert type-ahead to we-type-ahead custom element (support-both, persistent B)

Add a we-type-ahead element facade over the existing fui:blocks/type-ahead/TypeAheadBehavior.ts kernel via the support-both, persistent light-DOM (B) mechanism ruled by #1457, mirroring the shipping fui:blocks/stepper/StepperElement.ts reference. Wave-3 slice of the #1442 block-model burndown; flat application, no fork.

**Unblocked 2026-06-22 (#1570 resolved).** `TypeAheadBehavior` is a light-DOM-scan `CustomAttribute` (reads existing `[role="option"]` markup), so the `StepperElement` mirror holds verbatim — there is no data-source fork here. The "shared trio fork" premise that put `blockedBy: 1570` on this card was factually wrong for type-ahead.

## Progress

- **2026-06-22 — done.** Added `fui:blocks/type-ahead/TypeAheadElement.ts` — the `<we-type-ahead>` persistent light-DOM B-element over the existing `TypeAheadBehavior` `CustomAttribute` kernel. Mirrors `StepperElement` verbatim (light-DOM-scan, no data-source fork per #1570): the authored `[role="option"]`/`menuitem`/`treeitem` items stay light-DOM children and the kernel reads them in place. CEM surface = `matching` / `reset` / `wrap` observed attributes (passed as kernel options); `buffer` getter delegated through. Registration named `registerTypeAheadElement(tag='we-type-ahead')` to disambiguate from the existing `registerTypeAhead` behavior helper (CustomAttribute registry). Light-DOM FUI CSS injected once (#1349). Test `fui:blocks/__tests__/unit/type-ahead/TypeAheadElement.test.ts` (6 cases) green; FUI `check:standards` 0 errors; typechecks clean.
