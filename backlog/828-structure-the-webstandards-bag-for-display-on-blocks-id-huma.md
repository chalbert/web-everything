---
type: idea
workItem: story
size: 3
status: resolved
dateOpened: "2026-06-17"
dateStarted: "2026-06-17"
dateResolved: "2026-06-17"
graduatedTo: src/block-pages.njk (webStandards panel display) + .eleventy.js (webStandardsRows filter)
tags: []
---

# Structure the webStandards bag for display on /blocks/{id}/ (humanize concern, group/order)

The block-pages.njk Accessibility & Web Standards panel (#826) renders block.webStandards as-authored: the raw camelCase concern key in a code cell, rows in object order. Refine the DISPLAY only — humanize the concern label (ariaCurrentStep → 'aria-current step'), order/group concerns, optionally link the concern to a standards-panel/term page — without changing the flexible {concern:{usage,reference}} field-shape, which #803 keeps as the realization SoT. Pure presentation polish on a working panel; not blocking anything.

## Progress

Resolved 2026-06-16. Pure presentation polish on the working #826 panel — no field-shape change.
- Added the `webStandardsRows` Nunjucks filter (`.eleventy.js`): humanizes the camelCase concern key (`ariaCurrentStep` → "aria-current step"; aria-/apg- prefixes hyphenate to the attribute spelling; API/CSS/HTML/DOM/etc. acronyms preserved), buckets concerns into a fixed category order (ARIA & accessibility patterns → CSS → Platform APIs & DOM, the last a catch-all so nothing is miscategorized), and sorts by label within each group.
- `src/block-pages.njk` panel renders the grouped/ordered rows with a category subheader row, the humanized label in `<code>`, and the raw key preserved as a hover `title` for traceability.
- Verified via a scratch 11ty build (`resource-loader` block): groups render in order, rows sorted, acronyms cased. The flexible `{concern:{usage,reference}}` SoT shape (#803) is untouched.
