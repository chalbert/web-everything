---
type: idea
workItem: story
size: 3
status: resolved
parent: "315"
blockedBy: ["347"]
dateOpened: "2026-06-11"
dateStarted: "2026-06-12"
dateResolved: "2026-06-12"
graduatedTo: none
relatedReport: reports/2026-06-12-coverage-gap-detection.md
tags: [gap-analysis, competitive-analysis, coverage, backlog, pipeline, triage]
relatedProject: webdocs
crossRef: { url: /backlog/, label: Backlog index }
---

# Gap → backlog — turn the ranked missing/partial capabilities into deduped candidate stories

Phase 4 of the [gap-analysis program](/backlog/315-competitive-coverage-gap-analysis-program/): take the labelled, ranked matrix from [#347](/backlog/347-capability-mapping-gap-detection/) and turn each `missing`/`partial` capability that is **not already tracked** into a candidate backlog item in the **`gap-#` shape** the earlier manual sweep used ([#006](/backlog/006-gap-10-collection-ops-intent/)…[#016](/backlog/016-gap-9-webcommands-project/)). This is the "once the inventory is complete, we create stories to fill the gaps" step — it produces the gap-fill children of #315, but only as *candidates surfaced for triage*, never auto-claimed work.

Blocked by #347 — there are no gaps to file until the matrix is labelled and ranked.

## Build

- **One candidate item per un-tracked gap row.** Reuse the gap-# body shape: the capability, its native anchor, the **Native-first · Gap · Effort · Rank** triage from #347, the `partial` "what's missing" note, and a link back to the matrix row + the external sources (`sourceName`/`sourceUrl`). Type is usually `decision` (a fork — intent vs block vs project) or `idea` (a concrete build) — match #006–#016.
- **Dedup is the gate, not an afterthought.** #347 already flags `already-tracked: #NNN`; this phase **must not** re-open those. Reconcile once more against open *and* parked `backlog/*.md` before creating each item (the review-before-adding rule) — a re-run of the program must *not* duplicate items the last run created. This is the crux of making the sweep repeatable without backlog bloat.
- **Parent + blocker wiring.** Each new gap item gets `parent: "315"`; if a gap depends on a prior decision/build, set `blockedBy`. Keep the epic storied — the gap items carry the points, #315 stays sizeless.
- **Surface for triage, don't claim.** Output is a ranked list of newly-created candidate items presented to the user (highest Rank first), so the actual fix work is selected through normal `/next` / `/batch` flow — this phase opens items, it doesn't build them.

## Acceptance

- Every `missing`/`partial`, un-tracked, ranked capability from #347 has a corresponding `backlog/<NNN>.md` candidate (gap-# shape, `parent: "315"`), or a logged reason it was skipped.
- No item duplicates an existing open/parked backlog item (dedup verified against `already-tracked` + a fresh reconcile).
- A re-run over an unchanged matrix opens **zero** new items (idempotent) — the repeatability proof.
- New items registered (the `check:standards` backlog count rose by the number created); gate green.

## Outcome (2026-06-12)

Ran the pipeline against the phase-3 coverage matrix (`benchmarkCoverage.json`, #347). The 11 ranked
partial/missing rows were re-checked against the live backlog at file time — the dedup step that is this
phase's whole point — which **caught 4 already tracked** that the phase-3 pass missed: menu + context-menu
(#173 / #300), command-palette (#299 / #016), accordion (#008 disclosure intent). The coverage data was
corrected (fileableGaps 11 → 7, alreadyTracked 5 → 9) so a re-run stays idempotent.

The **7 genuinely-new gaps** were filed as candidate stories under #315 (surfaced for triage, not claimed):

- **#358** Toast / notification block (story·3)
- **#359** Date / time / range picker block (story·8)
- **#360** Drawer / sheet block (story·3)
- **#361** Two-thumb range slider — extend slider block (story·2)
- **#362** Breadcrumb block (story·2)
- **#363** Carousel block (story·3)
- **#364** Unified design-token / theming system (decision·8, cross-refs #010)

Idempotency: a re-run over the unchanged matrix now finds all 11 rows tracked → opens **0** new items.

**Graduated to** `none` — process item — filed 7 gap candidate items #358–#364 under epic #315.
