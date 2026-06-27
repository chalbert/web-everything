---
kind: story
size: 3
status: resolved
dateOpened: "2026-06-27"
dateStarted: "2026-06-27"
dateResolved: "2026-06-27"
graduatedTo: frontierui/blocks/__tests__/unit/a11y-composition-conformance.test.ts
tags: []
---

# FUI-conformance: verify 3 impl-ambiguous block traits honor the #1795 a11y non-destructiveness rule

From the #1835 audit (we:reports/2026-06-27-block-a11y-composition-compliance-audit.md): 3 traits whose #1795 composition-compliance cannot be decided from the WE block interface alone — it depends on the FUI impl (DOM reorder vs CSS order; whether base aria-disabled/focus exclusion is retained), which #1795 assigns to FUI/Plateau conformance. Verify, and constrain the impl where needed: (1) action-button withPlatformOrdering ('Reorders action groups by OS convention') — must be CSS order only, not a DOM reorder that changes focus/tab order, else model as a distinct block; (2) tabs withReorderableTabs ('drag-to-reorder tab triggers') — confirm the reorder is user-initiated and the base tablist focus model is not otherwise mutated; (3) workflow withNonLinearProgression ('steps visited in any order') — confirm it does not subtractively strip base step aria-disabled/focus exclusion. Interface-level audit found the WE block interfaces otherwise compliant (the one role-changing trait, data-grid withHierarchyProjection, is the ratified #1411 treegrid-projection exception, not a violation). Locus: FUI.

## Verified (batch-2026-06-27-1843-1883)

No #1795 violation exists in the FUI tree — verdict per trait, locked by a new conformance suite
`fui:blocks/__tests__/unit/a11y-composition-conformance.test.ts` (14 tests):
1. **action-button `withPlatformOrdering`** — *no FUI impl exists* (declared only in `we:src/_data/blocks/action-button.json`). Test pins the constraint a future impl MUST satisfy: CSS `order` only, DOM child order + `tabindex` unchanged (a DOM reorder of focusables would violate #1795). Not a distinct-block case — CSS-order-only is feasible.
2. **tabs `withReorderableTabs`** — *no FUI impl exists* (base `fui:blocks/tabs/TabsElement.ts` present; the drag-reorder trait isn't built). Test pins: after any user-initiated DOM reorder, the base roving-tabindex invariant (exactly one `tabindex="0"`) + `role="tablist"`/`aria-orientation` must be re-established.
3. **workflow `withNonLinearProgression`** — **compliant.** Realised as `fui:blocks/stepper/StepperBehavior.ts` `progression:'free'`: `ind.toggleAttribute('aria-disabled', !reachable(i))` *removes* the attribute when reachable (never sets `"false"`), so free mode adds reachability without destructively stripping the base contract; switching back to locked re-applies it.

Net: 1 compliant, 2 not-yet-implemented (forward-locked). tsc clean; 14 new + existing tabs/stepper tests green. No impl changes needed.
