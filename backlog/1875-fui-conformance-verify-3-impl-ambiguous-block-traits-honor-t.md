---
kind: story
size: 3
status: open
dateOpened: "2026-06-27"
tags: []
---

# FUI-conformance: verify 3 impl-ambiguous block traits honor the #1795 a11y non-destructiveness rule

From the #1835 audit (we:reports/2026-06-27-block-a11y-composition-compliance-audit.md): 3 traits whose #1795 composition-compliance cannot be decided from the WE block interface alone — it depends on the FUI impl (DOM reorder vs CSS order; whether base aria-disabled/focus exclusion is retained), which #1795 assigns to FUI/Plateau conformance. Verify, and constrain the impl where needed: (1) action-button withPlatformOrdering ('Reorders action groups by OS convention') — must be CSS order only, not a DOM reorder that changes focus/tab order, else model as a distinct block; (2) tabs withReorderableTabs ('drag-to-reorder tab triggers') — confirm the reorder is user-initiated and the base tablist focus model is not otherwise mutated; (3) workflow withNonLinearProgression ('steps visited in any order') — confirm it does not subtractively strip base step aria-disabled/focus exclusion. Interface-level audit found the WE block interfaces otherwise compliant (the one role-changing trait, data-grid withHierarchyProjection, is the ratified #1411 treegrid-projection exception, not a violation). Locus: FUI.
