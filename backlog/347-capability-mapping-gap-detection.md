---
type: idea
workItem: story
size: 5
status: resolved
parent: "315"
blockedBy: ["346"]
dateOpened: "2026-06-11"
dateStarted: "2026-06-12"
dateResolved: "2026-06-12"
graduatedTo: coverage matrix benchmarkCoverage.json + /research/benchmark-coverage topic (11 ranked gaps)
relatedReport: reports/2026-06-12-coverage-gap-detection.md
tags: [gap-analysis, competitive-analysis, coverage, capability-matrix, native-first, triage, research]
relatedProject: webdocs
crossRef: { url: /capabilities/, label: Capability matrix }
---

# Mapping & gap detection — join the extracted capabilities against the platform and label covered / partial / missing

Phase 3 of the [gap-analysis program](backlog/315-competitive-coverage-gap-analysis-program.md): take the normalized capability matrix from [#346](backlog/346-capability-extraction-normalization-schema.md) and **map each external capability onto Web Everything's existing entities** — block, intent, plug, protocol, project, or semantics term — then label its coverage **covered / partial / missing**, weighed **native-first**. The labelled matrix is the artifact that *answers the question the epic asks* ("what is the platform missing?"); turning each `missing`/`partial` row into a backlog item is phase 4 (the next child), not this story.

Blocked by #346 — there is nothing to map until the capability matrix is populated.

## Build

- **Join each capability to the live platform.** For every row, resolve whether a WE entity already covers it by querying the specs one entry at a time (`blocks`/`intents`/`plugs`/`protocols`/`projects`/`semantics.json`) — record the matching `entityType:id` (or none). Reuse the existing **capabilityMatrix / capability resolvers** rather than a parallel coverage store.
- **Coverage label per row:** `covered` (a WE entity fully provides it), `partial` (an entity addresses it but misses dimensions/states), `missing` (no entity). `partial` must say *what's missing* — that note is the future story's scope.
- **Native-first weighing is mandatory** — promote the `nativeAnchorHint` from #346 into a recorded **native anchor**: a capability that the web platform provides natively (`dialog`, `popover`, `<selectlist>`, anchor positioning, `Intl.*`) is **not automatically a platform gap** even if no WE entity wraps it. Mark these `native-covered` (or fold into `covered` with a `nativeAnchor` field) so the output respects the native-first default and doesn't manufacture gaps for things the browser already does.
- **Carry the gap-# triage fields** the earlier manual sweep used so the output is consistent with the existing gap items ([#006](backlog/006-gap-10-collection-ops-intent.md)…[#016](backlog/016-gap-9-webcommands-project.md)): per `missing`/`partial` row, score **Native-first · Gap · Effort** and a **Rank**, so phase 4 can prioritise which gaps become stories first.
- **Dedup against the live platform AND the backlog.** Before a row is called `missing`, reconcile it against existing `backlog/*.md` (open *and* parked) — many gaps may already be tracked (the gap-# items, parked builds). Mark a row `already-tracked: #NNN` so phase 4 doesn't re-open settled work. This is the review-before-adding/dedup rule made part of the matrix.
- **Surface the result on the website** — extend the capability matrix render (or a `/research/` coverage view) backed by the labelled data file, dated as a #192 revision; session `reports/{date}-coverage-gap-detection.md` linked via `relatedReport`.

## Acceptance

- Every capability row carries a coverage label (`covered` / `partial` / `missing` / `native-covered`) and, where mapped, the `entityType:id` it resolves to.
- `partial` rows state the missing dimensions; `missing`/`partial` rows carry the **Native-first · Gap · Effort · Rank** triage and a recorded **native anchor**.
- Rows already tracked in the backlog are flagged `already-tracked: #NNN` (deduped against open + parked items).
- The labelled matrix is exposed on the website (capability matrix or `/research/` view), diffable; `npm run check:standards` green.
- Stops at "gaps are labelled and ranked" — it does **not** open the gap-fill backlog items (that is phase 4).
