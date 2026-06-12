---
type: idea
workItem: task
status: resolved
dateOpened: "2026-06-11"
dateStarted: "2026-06-12"
dateResolved: "2026-06-12"
graduatedTo: src/_data/intents.json (windowed-collection Set-Size Semantics — indeterminate-total rule)
tags: [windowed-collection, a11y, aria, feed, pagination, async]
---

# Add aria-setsize=-1 + aria-busy progressive-load rule to the Windowed Collection spec

Add the progressive-load accessibility rule the Windowed Collection spec currently omits: while the total item count is unknown (cursor pagination, before the last page lands), every rendered option carries `aria-setsize="-1"` — the platform "size unknown" sentinel — switching to the real count once known, with `aria-busy="true"` during batch row insertion, flipped to `false` on completion. Ratified in #018 (Fork 4): the WAI-ARIA APG Feed pattern is the platform convention for indeterminate totals, a thin spec touch-up rather than fabricating an estimated total (which would misreport a count as fact).

## Progress

**Resolved 2026-06-12** → extended the Windowed Collection intent's **Set-Size Semantics** section in `src/_data/intents.json`. Added the *Indeterminate totals (progressive load)* paragraph: while the count is unknown (`infinite` data source / cursor pagination / before the last page lands) every rendered item carries `aria-setsize="-1"` (the platform size-unknown sentinel), switching to the real count once known; the container sets `aria-busy="true"` during batch row insertion, flipped to `false` on completion — following the WAI-ARIA APG Feed pattern rather than fabricating an estimated total. Thin spec touch-up as ratified (#018 Fork 4); `check:standards` green.
