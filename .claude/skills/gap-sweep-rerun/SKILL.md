---
name: gap-sweep-rerun
description: Re-run the competitive coverage gap sweep (benchmark the leading design systems & UI libraries, find what Web Everything is missing) and report the delta against the prior run — idempotently. Use when the user wants to "re-run the gap analysis", "refresh the design-system benchmark", "check for new gaps", "update the coverage sweep", or run epic #315's analysis again. For the original one-off build, that was epic #315; this skill is the recurring re-run.
---

# Gap-sweep re-run — refresh the competitive coverage analysis, report only what changed

This skill is self-contained — the method is here. It re-runs the analysis built by epic #315 and decided
repeatable in #349. The sweep's state is three data files under `src/_data/` (each a dated revision, keyed by
stable ids so runs diff cleanly):

| File | Phase / item | What it holds |
|---|---|---|
| `benchmarkCorpus.json` | 1 · #316 | the design-system + UI-library corpus + selection criteria |
| `benchmarkCapabilities.json` | 2 · #346 | the normalized capability matrix (component/pattern/token/standard) |
| `benchmarkCoverage.json` | 3 · #347 | each capability → WE entity, covered/partial/missing, gaps + dedup |

Exposed at `/research/benchmark-corpus`, `/research/benchmark-capabilities`, `/research/benchmark-coverage`.

The contract (from #349): each run is a new dated revision (never overwrite history); the sweep is a client
of #192's freshness model, not a parallel engine; and it is idempotent — a re-run over an unchanged landscape
must produce a no-op delta and open 0 new backlog items. `scripts/gap-sweep-status.mjs` makes that auditable.

## The loop

1. **Snapshot** the baseline. `node scripts/gap-sweep-status.mjs --snapshot` writes
   `reports/gap-sweep-snapshots/<lastSwept>.json` — the revision you'll diff against. (Run the bare
   `node scripts/gap-sweep-status.mjs` first to see today's state + confirm invariants are green.)

2. **Refresh the corpus** (phase 1). Re-apply the corpus's own `selectionCriteria` + `inclusionRule` to
   `benchmarkCorpus.json`: add genuinely-new leading systems, drop abandoned ones, re-categorise as needed,
   bump each touched source's `lastChecked`. Keep `references.json` "Reference Design Systems" as the curated
   subset (`inReferences`). The criteria are the contract — don't add a source by taste.

3. **Re-extract** (phase 2). For new/changed sources, update `benchmarkCapabilities.json`: add capabilities
   they introduced, deduped into existing stable ids (synonyms merge — snackbar=toast, sheet=drawer). Set
   `nativeAnchorHint` on new rows (this is what keeps gap detection native-first).

4. **Re-map** (phase 3). Update `benchmarkCoverage.json`: re-label coverage (covered / native-covered /
   partial / missing) against the current WE inventory (`blocks/intents/plugs/protocols/projects.json` —
   query one entry at a time). Re-run dedup against the live backlog (open *and* parked) — a gap may have been
   filled or newly tracked since last run; move those into `alreadyTracked` with the `#NNN`. Keep
   `summary.fileableGaps`/`alreadyTracked` counts in sync (the gate checks them).
   Verify-first against the entity *specs*, not just their existence: before a row stays a fileable gap, read
   the nearest WE block/intent's spec body (njk + `designDecisions`), not only its id — the capability may
   already be covered by a dimension or variant the coarse map missed (range-slider was already in the slider
   block's dual-thumb range variant), or be a mere *configuration* of an existing entity (drawer = the Modal
   Intent's `placement=start|end`). Demote such rows to covered/already-tracked. This fill-time verification
   is a self-correction pass on par with the backlog dedup.

5. **Delta + gate.** `node scripts/gap-sweep-status.mjs --baseline=reports/gap-sweep-snapshots/<that-date>.json`
   prints what changed (corpus ±, capabilities ±, re-kinded, fileable-gaps ±, newly-tracked) and fails on any
   invariant violation (unknown capability ids, count mismatches, missing triage). A no-op delta is the
   success case for an unchanged landscape — stop here, nothing to file.

6. **Gap → backlog** (phase 4), NEW gaps only. For each *newly-appeared* fileable gap (in the delta's
   `fileable gaps +[…]`, not already tracked), file a candidate story under epic #315 in the gap-# shape
   (`node scripts/backlog.mjs scaffold --parent=315 …`). Do not re-file gaps that already exist — that's the
   idempotency guarantee. Surface them ranked for triage; don't claim/build them.

7. **Stamp** the revision. Bump `version` + `lastSwept` on the three data files (the snapshot from step 1 is
   the preserved prior revision = history). Run `npm run check:standards` (green) — `gen:inventory` only if a
   research topic was added.

## Notes

- Manual-first by design (#349): the first few re-runs want a human reading the delta — did the corpus
  criteria still hold? did a *new axis* appear the schema doesn't model (a new token kind, a new a11y
  standard)? Automating to a scheduled sweep is #367, gated on #192.
- Scope of a "re-run": corpus + extraction + mapping refresh. Per-source exhaustive presence is the separate
  #352 deepening, not part of the routine sweep.
- The helper never edits the data — it reports + validates. Re-deriving the three files is the agent's job;
  the helper proves the result is consistent and idempotent.
