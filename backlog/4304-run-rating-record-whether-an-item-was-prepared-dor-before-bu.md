---
bornAs: xasdfvs
kind: story
size: 3
parent: "4075"
status: resolved
scope: ["we:scripts/conveyor/run-rating.mjs", "we:scripts/conveyor/run-scorecard-store.mjs", "we:scripts/conveyor/__tests__/run-rating.test.mjs"]
dateOpened: "2026-09-27"
dateStarted: "2026-09-29"
dateResolved: "2026-09-29"
tags: []
---

# Run rating: record whether an item was prepared (DoR) before build, and compare

Tag each run-rating row (we:scripts/conveyor/run-rating.mjs) with whether its item was prepared before dispatch — filed and prepared with scope, risks, a test plan, tasks and a reviewed plan before any code, vs. dispatched from a bespoke ad-hoc prompt — and add a prepared-vs-unprepared comparison (time, tokens per demand, rework rounds, grade) to the report, stored via we:scripts/conveyor/run-scorecard-store.mjs. Builds on run rating (PR #2811, #4075).

## Done when

1. **Executable** — `npx vitest run we:scripts/conveyor/__tests__/run-rating.test.mjs` passes new cases: a
   scorecard row derived from a dispatched item whose backlog card carries `preparedDate` (set + reviewed
   per the "fixes need a prepared card" agent memory / the story-preparation-checklist) is tagged `prepared: true` in the
   row written by we:scripts/conveyor/run-scorecard-store.mjs; one dispatched from a bespoke ad-hoc prompt
   with no `preparedDate` is tagged `prepared: false`; and `node we:scripts/conveyor/run-rating.mjs report`
   prints a prepared-vs-unprepared table (count, avg wall time, tokens per demand, rework-round count, and
   grade distribution) split on that flag.
2. **Design** — decide how "prepared" is detected for a run that has no directly-readable backlog card at
   score time (e.g. read the item's frontmatter via the existing backlog-read helper at score time, or stamp
   the flag onto the dispatch record when the item is claimed) — name the approach in this card before build.

## Design (decided before build)

**Chosen: read the item's frontmatter via the existing backlog-read helper, at score time** — a new
`preparedForItem(itemOrPr, { repoRoot })` in `we:scripts/conveyor/run-rating.mjs`, a direct sibling of the
already-existing `backlogSizeForItem` (same file), reusing the same `readField` frontmatter reader against
`backlog/<num>-*.md`. It returns `true` only when a card is found and its `preparedDate` is a non-empty
string; it returns `false` — never `null` — for every other case (no `item`, a hash-only id the numeric glob
can't match, no card found, or a card with no `preparedDate`), because "prepared" is an affirmative claim and
the absence of evidence is never treated as evidence of readiness.

Rejected: stamping the flag onto the dispatch record at claim time. That would require touching the claim
path (`we:scripts/backlog.mjs` / `we:scripts/operations/claim.mjs`), which is outside this item's declared
`scope:` and duplicates information the backlog card already carries durably — the frontmatter read is a
strict subset of what `backlogSizeForItem` already does for `size`, so it needs no new IO surface, no new
field threaded through the claim/dispatch pipeline, and cannot go stale relative to the card (a claim-time
stamp would freeze the card's prepared-ness as of claim, even if `preparedDate` were corrected afterward).

`toScorecardRow` takes an injectable `preparedForItem` resolver (defaulting to the real one, same shape as
`rollupByDemand`'s injectable `sizeForItem`) so both the real FS read and a fake resolver are covered by
tests.
