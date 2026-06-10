---
type: idea
workItem: story
size: 2
status: resolved
dateOpened: "2026-06-09"
dateStarted: "2026-06-09"
dateResolved: "2026-06-09"
graduatedTo: "Runtime `<name>-active` re-evaluation in frontierui CustomAttributeRegistry (#observe filter widened with the `-active` suffix; #onActiveChanged + #isActiveOverride; 3 inert-suite unit tests)"
tags: [webtraits, webbehaviors, activation-lifecycle, inert, dead-zone, mutationobserver]
relatedReport: reports/2026-06-02-lazy-traits-loading.md
relatedProject: webtraits
---

# Re-evaluate `<trait>-active` when the override attribute itself changes at runtime

The `inert` dead-zone implemented in
[#223](/backlog/223-inert-dead-zone-implementation/) reads the per-usage re-enable
`<trait>-active` at two moments: when the trait is first applied (`#addAttribute`), and whenever an
`inert` attribute flips (the registry's inert `MutationObserver` branch → `#onInertChanged`). It does
**not** re-evaluate when the `<trait>-active` attribute *itself* is added or removed at runtime while
the surrounding `inert` state is unchanged.

So `el.setAttribute('sortable-active', '')` on an element already inside an inert region does not
re-activate the dormant trait until the next `inert` flip. The common cases work (override present at
upgrade; region flips live/inert), but dynamically toggling the override alone is a gap.

**Scope (when picked up — Frontier UI `plugs/webbehaviors/CustomAttributeRegistry.ts`):**

- The per-root observer's `attributeFilter` is fixed at `upgrade()` time to `[...trait names, 'inert']`.
  A `<name>-active` suffix is dynamic per registered trait — either add each registered name's
  `-active` suffix to the filter at observe time, or drop the `attributeFilter` for a broader watch
  and branch in the callback on a `-active` suffix.
- On a `<name>-active` add/remove, recompute that one element+trait's activated state via the existing
  `#shouldBeActivated` / `#setActivated` (already factored out for the inert path) — no new lifecycle.
- Unit test: add/remove `sortable-active` on an element inside `inert` and assert
  `activatedCallback`/`deactivatedCallback` fire without an `inert` flip.

A small, bounded follow-up to #223 — the activation machinery and the `#shouldBeActivated` predicate
already exist; this only widens *when* they re-run. Harvested from the #223 close-out (2026-06-09).

## Progress

**Status:** resolved (2026-06-09) — Frontier UI `plugs/webbehaviors/CustomAttributeRegistry.ts`.

**Done:**
- Observer `attributeFilter` (`#observe`) now unions each registered + lazy name's `<name>-active`
  suffix alongside the bare names and `inert` (new `ACTIVE_SUFFIX` const).
- Observer callback (`#createObserver`) branches on the `-active` suffix → new `#onActiveChanged`,
  which recomputes that one element+trait's activation via the existing
  `#shouldBeActivated`/`#setActivated` — no new lifecycle.
- New `#isActiveOverride` guard: only routes a `-active` attr to the override path when its base
  resolves to a defined trait; a trait whose own name ends in `-active` falls through to `#update`.
- 3 new unit tests in `CustomAttributeRegistry.inert.test.ts`: add `toggle-active` inside `inert`
  → activates; remove it → deactivates (both with no `inert` flip); toggle outside `inert` is an
  idempotent no-op (no callback re-fire).

**Verified:** 96/96 webbehaviors unit tests pass; `tsc --noEmit` clean for the file;
`check:standards` 0 errors.
