---
kind: story
size: 3
parent: "1090"
status: resolved
dateOpened: "2026-06-19"
dateStarted: "2026-06-19"
dateResolved: "2026-06-19"
graduatedTo: "we:interaction-state/model.ts"
tags: []
---

# webvalidation: interaction-state model + L1 observable data-* reflection

New we:interaction-state/ model (InteractionState: dirty/touched/focused/submitted per spec we:src/_includes/project-webvalidation.njk:298-303) + reflect merged validity and interaction state as spec data-* attrs in we:plugs/webvalidation/ValidityMergeField.ts:183-191,62-65 (attr list we:src/_includes/project-webvalidation.njk:176-183). Demo: e2e asserts data-validity/dirty/touched/severity flip on input.

## Progress

Shipped the interaction-state model + L1 observable data-* reflection (webvalidation completion #1090):
- New `we:interaction-state/model.ts` — `InteractionState` (`dirty`/`touched`/`focused`/`submitted`,
  spec `we:src/_includes/project-webvalidation.njk`) + `InteractionStateTracker` deriving the flags from a
  control's native events (input→dirty-vs-baseline+touched, focus/blur→focused+touched, `markSubmitted`,
  `reset` re-baselines), framework-free + non-invasive, with subscribe/attach/detach. Index at
  `we:interaction-state/index.ts`; wired into the vitest include glob.
- `we:plugs/webvalidation/ValidityMergeField.ts` — reflects merged validity as `data-validity`
  (unknown|pending|valid|invalid) + `data-severity` (invalid→error, pending→info; coarse, since
  `ValidityMessage` has no severity field yet — `data-committed` is the separate commitment-policy facet
  #1112) and the tracker's interaction state as `data-dirty`/`data-touched`/`data-focused`.
- Tests: `we:interaction-state/__tests__/model.test.ts` (6) + `we:plugs/webvalidation/__tests__/ValidityMergeField.dataAttrs.test.ts`
  (5) — data-validity/dirty/touched/severity flip on input/focus/setSource; existing ValidityMergeField
  suite still 13 green (no regression). The spec's e2e is realized as the in-DOM (happy-dom) analogue
  since happy-dom can't model native `:user-invalid` styling.
