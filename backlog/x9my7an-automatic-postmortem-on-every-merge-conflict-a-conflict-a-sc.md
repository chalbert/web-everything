---
kind: story
size: 8
status: open
scope: ["we:scripts/conveyor/conflict-postmortem-store.mjs", "we:scripts/conveyor/conflict-postmortem-record.mjs", "we:scripts/conveyor/conflict-postmortem-rollup.mjs", "we:scripts/conveyor/__tests__/conflict-postmortem-store.test.mjs", "we:scripts/conveyor/__tests__/conflict-postmortem-record.test.mjs", "we:scripts/conveyor/__tests__/conflict-postmortem-rollup.test.mjs", "we:scripts/conveyor/parked-pr-conflict-watch.mjs", "we:scripts/conveyor/reconcile-core.mjs", "we:scripts/conveyor/conflict-fix-mark.mjs", "we:scripts/conveyor/rearm-review.mjs", "we:scripts/conveyor/conflict-fix-round-count.mjs"]
dateOpened: "2026-09-28"
tags: []
---

# Automatic postmortem on every merge conflict (a conflict = a scoping failure)

Every merge conflict on an open PR is handled as an unrelated one-off — we:scripts/conveyor/parked-pr-conflict-watch.mjs alerts and dispatches a fix, we:scripts/conveyor/reconcile-core.mjs's STACKED-BASE CONFLICT branch repairs a rebase, we:scripts/conveyor/conflict-fix-mark.mjs posts the durable marker — but nothing classifies WHY it happened, tallies its cost, or rolls the pattern up. #4301 (xggt9mp)'s could-this-have-been-prevented question and #4308's land-time yield both assume this data exists; it doesn't. This item records one classified postmortem per resolved conflict plus a weekly roll-up.

## Evidence

- **#2821** (`lane/fix-procedure`) conflicted twice on 2026-09-27: with **#2819** in `we:scripts/operations/ci-heal-pr-dispatch.mjs` (merged 18:13Z, ahead of #2821), then with **#2826** in `we:scripts/conveyor/review-status-tag.mjs` (merged 20:30Z while #2821 sat in review). Each conflict cost a fixer round, a full CI run, and a fresh review round — #4308's own evidence section times the second one at 44 minutes end to end (label at 20:32Z, cleared 21:16Z).
- Nobody classified either collision: was `we:review-status-tag.mjs`/`we:ci-heal-pr-dispatch.mjs` in #2821's OR #2826/#2819's declared `scope:`? Did both cards claim the same file concurrently (the exact gap #4295 is built to close at DISPATCH time), or did one side lack a card entirely? Nobody knows, because nothing recorded it — this item is the read that answers that question for every future conflict, not just this one.
- **#4301** (`xggt9mp`, parent #4075) asks "could this have been prevented" for every `review:changes` bounce and flags a recurring cause class for a system fix. It never fires for a conflict: `we:parked-pr-conflict-watch.mjs`'s bounce is `merge-status:conflicting`, a DIFFERENT population from the ordinary reviewer-finding bounce #4301 classifies. This item is #4301's conflict-shaped sibling, not a duplicate — sharing its "recurring class → system fix" spirit, never its store or its cause-class enum (a conflict's causes are structurally different: scoping/overlap/process, not review-quality).
- **#4308** (prepared 2026-09-27, `preparedAgainstSha: f1c0fee1d`) adds a LAND-TIME yield so a smaller ready PR waits out a larger in-review overlap instead of forcing it to conflict. Its own "What it does and does not buy" section says plainly: yielding does not shrink the conflict, it only moves which PR pays. This item is the read that tells #4308's operator whether the yield actually reduced total conflict cost, and — via the weekly roll-up below — whether #4308's own dispatch-time sibling #4295 is actually closing the `concurrent-overlap` class or not.

## Design

**Classification is decided by one pure function, `classifyConflict`, over four inputs — never a menu of possible causes the builder picks live:**

1. **`no-card`** — either side of the collision has no resolvable backlog item (an orchestrator/hand-authored PR, or a card that no longer parses). Checked FIRST: a class that needs a card to reason about scope cannot apply when there is no card.
2. **`concurrent-overlap`** — BOTH sides' cards declare the colliding file in their own `scope:`, and their dispatch windows overlapped (both were `dateStarted`/in-flight at the same time). This is exactly the population #4295 targets closing at dispatch time; a conflict landing in this class after #4295 ships is that card's own regression signal.
3. **`under-declared-scope`** — the colliding file was NOT declared in the losing side's `scope:` (the side that has to redo work). A prepare-time miss, not a dispatch-time race.
4. **`hot-file`** — checked LAST and orthogonal to the other three (a hot file can ALSO be `under-declared-scope`): the colliding file already appears at or above a threshold (default 3) in the trailing 30-day roll-up window (below). Tagged as an additional `hotFile: true` flag on the row, never as a fifth exclusive value, so `classifyConflict`'s primary return stays a strict 4-way enum matching the operator's ask while the roll-up can still surface it.

**No new state to detect timing.** Per the #2612 "no parallel state store" invariant this repo already holds to (cited in `we:parked-pr-conflict-watch.mjs`'s own header) and the identical technique #4308 already uses for `readyAt(X)`: `detectedAtMs` is read off the `merge-status:conflicting` label's own `labeled` timeline event (GitHub, so it survives a conveyor restart), never a new marker file. `resolvedAtMs` is the tick at which the watch's existing self-heal (label removed) or the stacked-rebase repair's durable comment (`we:conflict-fix-mark.mjs`) fires — both already-existing signals.

**One row per RESOLVED conflict, written once, at resolution** — never a provisional row at detection updated later, which would fight the append-only, never-rewritten discipline `we:scripts/conveyor/run-scorecard-store.mjs` already established for exactly this reason (a historical row is never mutated once a rubric/class changes). Classification needs both sides' scope (known at detection) and full cost (known only at resolution), so the write waits for resolution and carries `detectedAtMs` alongside it.

**Storage mirrors `we:run-scorecard-store.mjs`'s own shape and locus, not a new convention**: `we:scripts/conveyor/conflict-postmortem-store.mjs`, append-only JSON named `we:conflict-postmortems.json` under the state root `we:scripts/lib/daemon-rebuild.mjs#daemonConveyorStateRoot` resolves (its `.conveyor/` directory — the identical root the scorecard store resolves against), locked the same way (`we:scripts/conveyor/infra-blocked.mjs#withInfraLock`), atomic rename on write. This is the "run rating/scorebook" home the card's own ask names — a sibling store next to `we:run-scorecards.json`, not a merge into its schema (a conflict postmortem and a scored dispatch are different subjects; `we:scripts/conveyor/run-quality-record.mjs`'s header is explicit that Fork 5's subject-class gate exists precisely so different subjects never blend in one aggregate).

**Cost fields, each best-effort and `null` when unavailable — never a fabricated number:**
- `fixRounds` — `we:scripts/conveyor/conflict-fix-round-count.mjs#countStaleConflictFixRounds`'s own count against `CONFLICT_FIX_COMMENT_MARKER`, already the durable, restart-proof source `we:reconcile-core.mjs` itself reads.
- `ciRuns` — count of commits pushed to the PR's head after `detectedAtMs` (a cheap proxy: each push re-triggers required checks; exact CI run ids are not on hand without another API call this module does not need).
- `reReviews` — count of `review:changes`→`review:pending` re-arms (`we:scripts/conveyor/rearm-review.mjs`) after `detectedAtMs`.
- `tokensUsd` — joined from `we:scripts/conveyor/run-scorecard-store.mjs` by PR number where a scored dispatch repaired this exact conflict; `null` when the repair was a human push or the scorecard has no matching row (the store's own `null`-for-unmeasured discipline, reused rather than re-invented).

## Interfaces

- `we:scripts/conveyor/conflict-postmortem-store.mjs`
  - `appendConflictPostmortem(row, {storePath, readJson, writeJson, lock} = {})` → `{written: true, row}` | throws on a scrub-failing `evidence` field (same "deny on a hit, never redact" discipline as `we:run-scorecard-store.mjs#appendScorecard`).
  - `readConflictPostmortems({storePath, readJson} = {})` → `Row[]`.
  - `Row = {repo, prA, prB, files: string[], class: 'no-card'|'concurrent-overlap'|'under-declared-scope'|'hot-file', hotFile: boolean, detectedAtMs, resolvedAtMs, mode: 'main-base'|'stacked-rebase', cost: {fixRounds: number|null, ciRuns: number|null, reReviews: number|null, tokensUsd: number|null}}`.
- `we:scripts/conveyor/conflict-postmortem-record.mjs` — the ONE seam every call site goes through (mirrors `we:scripts/conveyor/run-quality-record.mjs`'s own "built once, called everywhere" composition, never duplicated per caller):
  - `classifyConflict({prAScope, prBScope, prACardExists, prBCardExists, file, hotFileCount, threshold = 3})` → PURE, returns `{class, hotFile}` per the Design section's precedence.
  - `recordResolvedConflict({repo, prA, prB, files, mode, detectedAtMs, resolvedAtMs, scopeReader, costReader})` → composes `classifyConflict` for every colliding file (one row per FILE when files disagree in class, deduped when they agree) + the cost readers above + `appendConflictPostmortem`. NEVER THROWS past its own boundary — same discipline as `we:run-quality-record.mjs`: a postmortem-recording bug must never turn a successful conflict resolution into a reported failure. Returns the stored row(s) or `null` per file on any internal failure.
- Call sites (consumers, no new dispatch path):
  - `we:scripts/conveyor/parked-pr-conflict-watch.mjs` — at the label's absent→present→absent full cycle (the watch's own existing self-heal transition), call `recordResolvedConflict({mode: 'main-base', ...})`.
  - `we:scripts/conveyor/conflict-fix-mark.mjs` — right after `buildConflictFixMarkComment` posts, call `recordResolvedConflict({mode: 'stacked-rebase', ...})` (this is `we:reconcile-core.mjs`'s STACKED-BASE CONFLICT branch's own hand-back point, so no new hook into that file's dispatch logic is needed — only its existing completion call).
- `we:scripts/conveyor/conflict-postmortem-rollup.mjs` — PURE, no fs/clock: `rollupConflictPostmortems(rows, {windowMs = 7 * 24 * 3600_000, hotFileThreshold = 3, nowMs})` → `{hotFileCandidates: [{file, count}], recurringUnderDeclaredScope: [{file, count}], totalConflicts, byClass: Record<class, number>}`. Report-only, same "disarmed for v1" discipline `we:scripts/conveyor/run-quality-route.mjs` already applies to its own auto-apply router — this item never auto-files a split card or auto-edits the prepare checklist; a human/operator reads the roll-up and acts, per the hookable-vs-judgment split (rule 51).

## Tasks

1. `we:scripts/conveyor/conflict-postmortem-store.mjs` + its unit tests (append/read, scrub refusal, lock contention), mirroring `we:run-scorecard-store.mjs`'s own test shapes.
2. `we:scripts/conveyor/conflict-postmortem-record.mjs`: `classifyConflict` (pure, unit-tested against all four classes + the hot-file flag combining with each) and `recordResolvedConflict` (the never-throws composition).
3. Wire the two call sites (`we:parked-pr-conflict-watch.mjs`, `we:conflict-fix-mark.mjs`), each with its own fixture-driven test proving a row is written on resolution with the right `mode`.
4. `we:scripts/conveyor/conflict-postmortem-rollup.mjs` + tests (hot-file repeat detection, recurring-class detection, an empty window, a window with no conflicts).
5. Re-verify against live conflict history: run the rollup against `#2821`'s two real collisions (reconstructed from PR timeline/label events) as a fixture, confirming the tool would have classified both correctly by hand before trusting it on the next live case.

## Delivery shape

One PR, landing incrementally: the store and record module land first (`recordResolvedConflict` inert until wired), then the two call-site wirings, then the rollup reader — each step keeps `main` green and every existing test passing, so no branch/flag is needed to hide half-built state (same incremental-behind-`main` shape #4308 uses for its own `overlapContext: null` default).

## Proof plan (live, before/after)

**Before:** #2821's two undocumented conflicts (Evidence above) — no record exists of either.
**After:** on the next live conflict this repo hits, record its classified postmortem and post the row (repo, files, class, cost) in this item's own update note. If none lands within a week, run the #2821 fixture reconstruction (Task 5) through the real classifier and rollup and post that, labelled as a reconstruction rather than a live case.

## Independent plan review (Codex, read-only, 2026-09-28)

Confidence **High**, build-ready **No**. Not stamped `preparedDate` — real design gaps remain, listed here so the
next pass (build or re-prep) starts from them rather than re-discovering them:

1. **[blocker] The classifier is contradictory and incomplete.** `hot-file` is both a primary enum member and an
   orthogonal flag; if only a flag, there are three primary classes, not four. Uncovered cases exist: both cards
   declared the file but their dispatch windows never overlapped, or only the LOSING side under-declared while
   the winner did not. `classifyConflict`'s signature has neither a dispatch-window input nor an explicit
   losing-side identifier. **Open — needs an exhaustive table + matching signature before build, not resolved
   here.**
2. **[blocker] Resolution-time evidence is not actually available when the design assumes it is.** The watch can
   see the colliding paths while the conflict is live; after repair those paths are not trivially recoverable
   from the resulting merge state, `main` may carry contributions from several PRs (so "prB" is not automatically
   one identifiable opponent), and neither completion hook (the watch's self-heal, `we:conflict-fix-mark.mjs`'s
   comment) is handed the opposing PR, historical scope, or the pre-repair head/base shas. "Known at detection"
   does not mean "durably available at resolution." **Open — the design's "write once, at resolution" choice
   needs a real capture-at-detection mechanism (store a minimal detection-time snapshot keyed by an episode id,
   read it back at resolution) before it is buildable, not the bare label-timeline read this card currently
   proposes.**
3. **[blocker] The append is not actually exactly-once as designed.** The watch removes the conflict label after
   rearming (`we:parked-pr-conflict-watch.mjs:2064`); appending after that point risks losing the record on a
   crash, appending before risks a duplicate on retry, and there is no episode id or dedupe. The stacked-rebase
   path can double-observe the same repair from both `we:conflict-fix-mark.mjs` and the watch. `withInfraLock` is
   best-effort (can proceed unlocked after contention), so citing it does not itself guarantee a lossless write.
   **Open — needs an episode id + idempotent append (or a dedupe-on-read reconciliation) named explicitly.**
4. **[major] The cost sources are misdescribed.** `countStaleConflictFixRounds` (`we:conflict-fix-round-count.mjs:149`)
   returns `{stale, total}` keyed by target ref/sha across ALL trusted markers — it does not scope to one
   conflict episode, so "fixRounds" needs an explicit episode filter, not a bare call. The scorecard store
   records scoring data keyed by item/handle, not a PR number, so the proposed direct PR-number join to
   `tokensUsd` is unsupported as written — either add a real join key or drop the field to always-null with an
   honest note. Commits pushed ≠ CI runs ≠ push timestamps; `ciRuns`/timing proxies need honest names.
5. **[major] Aggregation and the operator-facing consumer are undecided.** "One row per resolved conflict" (Done
   when #1) conflicts with "one row per file when files disagree in class" (Interfaces) — without a shared
   episode id, `rollupConflictPostmortems`'s `totalConflicts` and repeated cost fields can double-count a
   multi-file conflict split across rows. The classifier's hot-file threshold window (30 days) and the rollup's
   default window (7 days) are never explicitly reconciled in one call path. The rollup has no named CLI,
   scheduled caller, or operator-facing surface — "report-only" needs a landing spot, not just a pure function.
6. **[minor] `scope:` omits its own call-site test files** (a fixture-driven test at each of the two wiring
   points is promised in Tasks/Done-when but not listed in `scope:`) and both cards state size 8 with no basis
   sentence — add one at prep time.

**Handling:** none of the above is resolved in this pass — deliberately, since resolving 1–5 is a real second
design pass (an episode-id-keyed capture model, an exhaustive classification table, a named aggregation
consumer), not a fold-in edit. This card stays `status: open`, un-prepared (`preparedDate` withheld) until that
pass runs and a follow-up independent review confirms it. Item 6 is cheap and should be applied whenever this
card is next touched.

## Done when

1. **Executable** — a fixture reconstructing #2821's two 2026-09-27 conflicts against `we:scripts/conveyor/conflict-postmortem-record.mjs` produces two rows: one classified from the #2819/#2821 collision, one from the #2826/#2821 collision, each with a non-null `class` and a `cost.fixRounds` matching the marker-comment count on the real PRs.
2. Every conflict `we:parked-pr-conflict-watch.mjs` resolves (self-heal) and every stacked-rebase repair `we:conflict-fix-mark.mjs` completes writes exactly one row to `we:scripts/conveyor/conflict-postmortem-store.mjs`'s store — proven by a fixture-driven test at each call site, not by inspection.
3. `rollupConflictPostmortems` over a trailing week correctly surfaces a file appearing ≥3 times as a hot-file candidate and a class appearing repeatedly as a "feed the prepare checklist" note, both unit-tested against a synthetic multi-row fixture.
4. No existing conflict-handling behavior changes: `we:parked-pr-conflict-watch.mjs`'s labels/comments and `we:reconcile-core.mjs`'s STACKED-BASE CONFLICT branch dispatch are byte-for-byte unchanged except for the one new call at their existing completion points.
