---
kind: story
size: 8
status: resolved
dateOpened: "2026-06-27"
dateStarted: "2026-06-27"
dateResolved: "2026-06-27"
graduatedTo: "blocks/renderers/composition/__fixtures__/composition-seam-cases.ts"
tags: []
---

# HTML-first composition strategy seams (slots, decoration, scoped-replace, abstract-split)

Build the four sanctioned add-only composition seams ratified in #1795: slots (`<component>` shadow `<slot>` + `HTMLSlotElement.assign`), behavior/decoration (`CustomAttribute` child-decorator, the `route:link` pattern), sub-component replacement (scoped registry + IDREF per #component-dc — runtime BLOCKED on the webregistries FUI re-home), and abstract-piece-split (userland convention, no WE primitive). Each seam preserves the base a11y contract add-only. Rule: we:docs/agent/platform-decisions.md#composition-preserves-a11y-contract.

## Build (2026-06-27)

WE owns the **seam catalog** — a build-agnostic single source of the four sanctioned authoring forms, mirroring how `we:blocks/renderers/component/__fixtures__/component-cases.ts` is the single source for the `<component>` seam. Per [we-zero-standard-implementation] WE ships **no runtime** for these strategies (the `<component>` lowering, the `CustomAttribute` registry, and the scoped custom-element registry all live in FUI); whether a *composed* variant honors the add-only contract is a FUI/Plateau conformance-run concern (composed tuples are not expressible in `we:conformance-vectors/schema.ts`).

Delivered:

- `we:blocks/renderers/composition/__fixtures__/composition-seam-cases.ts` — one a11y-complete base (`<nav-item>`, single-sourced) re-skinned the four sanctioned ways; each case names its in-tree seam, runtime status, and its non-destructive effect on the base a11y surface. Carries the Fork-1 **rejected** `as="menubar"` contrast example (trips the actual a11y-contract-ownership fork).
  - **slots** — first-class, available (shadow named/default `<slot>` + `HTMLSlotElement.assign`).
  - **behavior/decoration** — first-class, available; rides `we:blocks/router/behaviors/RouteLinkBehavior.ts` (`route:link` adds `aria-current`, add-only).
  - **sub-component replacement** — first-class, runtime `blocked-on-webregistries-rehome` (#854 contract adopted, `#component-dc`; #901 registry runtime not yet in FUI — `we:backlog/1483-…`, `we:backlog/1545-…`).
  - **abstract-piece split** — userland convention, no WE primitive (distinct tags #023 + tree-shakable traits #715).
- `we:blocks/__tests__/unit/renderers/composition-seam-cases.test.ts` — structural lock: the support-all set is exactly the four strategies, the base single-sources the `<a>`, scoped-replace stays marked blocked, every first-class seam is non-destructive (add/preserve), and the rejected contrast example is retained.

Scoped-replace's *runtime* remains blocked on the webregistries FUI re-home (per #1795); its authoring form + contract are now seamed and locked. Sibling slices: #1832 (contract statement), #1833 (`nav-list` a11y vector corpus the base needs).
