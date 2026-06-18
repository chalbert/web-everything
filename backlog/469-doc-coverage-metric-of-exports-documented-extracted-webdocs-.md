---
type: idea
workItem: story
size: 3
parent: "099"
status: resolved
dateOpened: "2026-06-13"
dateStarted: "2026-06-13"
dateResolved: "2026-06-13"
graduatedTo: none
tags: []
---

# Doc-coverage metric — % of exports documented/extracted (webdocs follow-on)

A 'doc coverage' tool measuring the fraction of code exports that are documented/extracted. Generation is covered by webdocs (#091, resolved); the coverage metric is the new bit. From #111 triage.

## Progress (2026-06-13) — resolved

New [fui:webdocs/coverage.ts](../webdocs/coverage.ts): `computeDocCoverage(site, expected?)` — a pure, dependency-free metric over the generated [`DocsSite`](../webdocs/generator.ts) (the complement of `generateDocsSite`). A block/standard is **documented** when its page carries ≥1 extracted case, **undocumented** when its page is empty or absent. Returns `DocCoverageReport { total, documented, coverage (0..1), undocumented[], totalCases }`.

The `expected?` surface is the key generalization that honours the "% of *exports*" framing: with no argument it measures the site's own pages (does every generated page actually carry cases?); pass an id list — every block a manifest *claims*, or a full export inventory — and the denominator widens so a claimed-but-undocumented id counts as a gap (sorted in `undocumented`). `totalCases` counts only the measured surface; an empty surface is vacuously complete (coverage 1, no divide-by-zero). 6 unit tests; gate green; typecheck clean.

(Interpretation note: webdocs documents *blocks/standards* via cases, so coverage is measured over that documented unit — the WE analogue of "an export"; passing an export-id list as `expected` measures against a finer surface without changing the metric.)
