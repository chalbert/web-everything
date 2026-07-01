---
kind: story
size: 2
status: resolved
dateOpened: "2026-07-01"
dateStarted: "2026-07-01"
dateResolved: "2026-07-01"
tags: []
---

# FUI: un-exclude value on transient toggle controls (#1961 b-narrow) so identity survives un-renamed

Ratified in #1961 Fork 1 (b)-narrow: stop excluding the identity attribute on the two transient toggle controls (FilterChipElement value; ButtonTransientElement identity) so the base copies it verbatim onto the survivor and consumers read the same attribute name pre- and post-upgrade. Keep selected-to-aria-pressed as the one forced a11y state rename. Add the we:block-standard.md:271 carve-out cross-ref recording that single exception. Free, no sync burden, statute-honoring.

**#1962 context (2026-07-01, wrapper-first):** button and filter-chip are moving off transient to persistent light-DOM under the FUI transient→wrapper migration. Once those two blocks migrate, there is no transient survivor to preserve identity across, so this fix becomes **moot for them**. It stands as a near-term mitigation only until the migration lands; if the migration ships first, close this as superseded.

## Progress (batch-2026-07-01, serial)

Done. The ratified change lands **on `FilterChipElement` only** — `value` dropped from `excludedAttributes`
(`fui:blocks/filter-chip/FilterChipElement.ts`), so `TransientElement` copies `value` verbatim onto the
survivor `<button value="…">` and the `value`→`data-value` mapping in `decorate` is removed. The unit test
(`fui:blocks/__tests__/unit/filter-chip/FilterChipElement.test.ts`) now asserts `getAttribute('value')`
survives and no `data-value` is set. `selected`→`aria-pressed` kept as the sole a11y-forced rename.

**`ButtonTransientElement` needed no change** — its `excludedAttributes` are `[variant, icon, label,
pressed, controls]`; `value` is *not* excluded, so a `we-button` already copies `value` verbatim. Its
`pressed`→`aria-pressed` and `controls`→`aria-controls`/`aria-expanded` are a11y-forced (state/relationship),
not a gratuitous *identity* rename, so nothing to un-exclude. #2009's title generalized "identity" to both
controls; per the #1961 ruling only filter-chip's `value` was the gratuitous rename.

**WE carve-out cross-ref already present** — `we:docs/agent/block-standard.md:326-332` records the
identity-phase-stable rule + the single `selected`→`aria-pressed` exception (added at #1961 ratification), so
no `we:block-standard.md:271` edit was required. FUI `check:standards` green (0 errors).
