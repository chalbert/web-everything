---
type: decision
workItem: story
size: 2
status: open
dateOpened: "2026-06-03"
tags: [terminology, gap-analysis, docs]
crossRef: { url: /research/collection-operations/, label: collection-operations research (local fix applied) }
---

# Decide whether to rename the "Native anchor" gap-analysis field repo-wide

The `**Native anchor**` triage field appears on all 13 `gap-*` backlog items and means "the native platform API the standard grounds in." The word collides with the positioning **Anchor Intent** (CSS anchor positioning), which can confuse a reader skimming a page that mentions both.

The collection-operations research page already avoids the term *locally* (renamed to "Native Grounding" / "native primitive", with a disambiguating note), but the shared field label on every gap item is untouched, for cross-gap uniformity.

**Decide:** rename the field repo-wide (e.g. `Native grounding` / `Platform primitive`) across all `gap-*` items and the gen/validator that reads it, or keep the established label and rely on local disambiguation. Low effort either way; the cost of renaming is touching all 13 gap files + any tooling that references the label.
