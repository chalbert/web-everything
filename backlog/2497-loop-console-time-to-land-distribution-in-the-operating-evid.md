---
bornAs: xk09na1
kind: story
size: 2
parent: "2445"
status: resolved
dateOpened: "2026-07-14"
dateResolved: "2026-07-14"
graduatedTo: none
tags: [plateau-loop, console, observability]
---

# Loop console — time-to-land distribution in the operating-evidence view (delivers #2495's deferred piece)

Delivers the precise per-PR time-to-land that #2495 (the CLI `summarizeEvidence` / `evidence` view) and
#2484 both explicitly DEFERRED as out-of-scope — a piece owed to the slice-B per-pass PR-id data
(#2496/#2488), which shipped `consideredPrs` / `mergedPrs` on each pass and made it computable. A pure
`timeToLand` block added to `summarizeEvidence` in `plateau:tools/drain-daemon/lib.mjs` walks each merged PR
from first-seen (the earliest pass whose `consideredPrs` held it) to merged-at (the pass whose `mergedPrs`
held it); the delta is its time-to-land, and a merged PR with no prior sighting is "unmeasured". It reports
`{measured, unmeasured, p50/p95/min/maxMs, p50/p95/maxHours}`, printed as one added line in the
`plateau:tools/drain-daemon/cli.mjs` `evidence` output. Impl lives in plateau-app (this card is the tracker;
WE holds zero impl) — landed as plateau-app PR #39 (merged 2026-07-14), reviewed by a fresh-context
correctness + robustness panel (both PASS), with new unit tests and the whole suite green. Live in the
running daemon's evidence view.
