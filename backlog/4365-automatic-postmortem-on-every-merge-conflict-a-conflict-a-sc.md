---
bornAs: x9my7an
kind: story
size: 8
status: open
scope: ["we:scripts/conveyor/conflict-postmortem-store.mjs", "we:scripts/conveyor/conflict-postmortem-record.mjs", "we:scripts/conveyor/conflict-postmortem-rollup.mjs", "we:scripts/conveyor/__tests__/conflict-postmortem-store.test.mjs", "we:scripts/conveyor/__tests__/conflict-postmortem-record.test.mjs", "we:scripts/conveyor/__tests__/conflict-postmortem-rollup.test.mjs", "we:scripts/conveyor/parked-pr-conflict-watch.mjs", "we:scripts/conveyor/__tests__/parked-pr-conflict-watch.test.mjs", "we:scripts/conveyor/reconcile-core.mjs", "we:scripts/conveyor/conflict-fix-mark.mjs", "we:scripts/conveyor/__tests__/conflict-fix-mark.test.mjs", "we:scripts/conveyor/rearm-review.mjs", "we:scripts/conveyor/conflict-fix-round-count.mjs", "we:scripts/progress-board.mjs"]
dateOpened: "2026-09-28"
tags: []
---

# Automatic postmortem on every merge conflict (a conflict = a scoping failure)

Every merge conflict on an open PR is handled as an unrelated one-off — we:scripts/conveyor/parked-pr-conflict-watch.mjs alerts and dispatches a fix, we:scripts/conveyor/reconcile-core.mjs's STACKED-BASE CONFLICT branch repairs a rebase, we:scripts/conveyor/conflict-fix-mark.mjs posts the durable marker — but nothing classifies WHY it happened, tallies its cost, or rolls the pattern up. #4301 (4301)'s could-this-have-been-prevented question and #4308's land-time yield both assume this data exists; it doesn't. This item records one classified postmortem per resolved conflict plus a weekly roll-up.

## Evidence

- **#2821** (`lane/fix-procedure`) conflicted twice on 2026-09-27: with **#2819** in `we:scripts/operations/ci-heal-pr-dispatch.mjs` (merged 18:13Z, ahead of #2821), then with **#2826** in `we:scripts/conveyor/review-status-tag.mjs` (merged 20:30Z while #2821 sat in review). Each conflict cost a fixer round, a full CI run, and a fresh review round — #4308's own evidence section times the second one at 44 minutes end to end (label at 20:32Z, cleared 21:16Z).
- Nobody classified either collision: was `we:review-status-tag.mjs`/`we:ci-heal-pr-dispatch.mjs` in #2821's OR #2826/#2819's declared `scope:`? Did both cards claim the same file concurrently (the exact gap #4295 is built to close at DISPATCH time), or did one side lack a card entirely? Nobody knows, because nothing recorded it — this item is the read that answers that question for every future conflict, not just this one.
- **#4301** (`4301`, parent #4075) asks "could this have been prevented" for every `review:changes` bounce and flags a recurring cause class for a system fix. It never fires for a conflict: `we:parked-pr-conflict-watch.mjs`'s bounce is `merge-status:conflicting`, a DIFFERENT population from the ordinary reviewer-finding bounce #4301 classifies. This item is #4301's conflict-shaped sibling, not a duplicate — sharing its "recurring class → system fix" spirit, never its store or its cause-class enum (a conflict's causes are structurally different: scoping/overlap/process, not review-quality).
- **#4308** (prepared 2026-09-27, `preparedAgainstSha: f1c0fee1d`) adds a LAND-TIME yield so a smaller ready PR waits out a larger in-review overlap instead of forcing it to conflict. Its own "What it does and does not buy" section says plainly: yielding does not shrink the conflict, it only moves which PR pays. This item is the read that tells #4308's operator whether the yield actually reduced total conflict cost, and — via the weekly roll-up below — whether #4308's own dispatch-time sibling #4295 is actually closing the `concurrent-overlap` class or not.

## Design

**Classification is decided by one pure function, `classifyConflict`, over an EXHAUSTIVE input set — never a menu of possible causes the builder picks live.** `hot-file` is orthogonal (a flag, never a primary class — see below); the primary return is a strict, exhaustive 4-way enum, checked in this precedence order (each check only fires when its own inputs are actually known — an unknown input never silently falls through to a wrong class):

1. **`no-card`** — either side of the collision has no resolvable backlog item (an orchestrator/hand-authored PR, or a card that no longer parses; `prACardExists`/`prBCardExists` false). Checked FIRST: a class that needs a card to reason about scope cannot apply when there is no card.
2. **`under-declared-scope`** — `losingSide` is known (the side redoing work is identifiable) AND that side's own `scope:` does NOT declare the colliding file. A prepare-time miss, not a dispatch-time race. Checked before `concurrent-overlap` because a losing side that never declared the file is the more actionable, more specific finding (fix the card), independent of whatever the winner's dispatch timing was.
3. **`concurrent-overlap`** — BOTH sides' cards declare the colliding file in their own `scope:` AND `dispatchWindowsOverlapped === true` (both were `dateStarted`/in-flight at the same time). This is exactly the population #4295 targets closing at dispatch time; a conflict landing in this class after #4295 ships is that card's own regression signal.
4. **`declared-no-overlap`** — BOTH sides declared the file in `scope:` (so neither `under-declared-scope` nor `no-card` applies) AND `dispatchWindowsOverlapped === false` (confirmed non-overlapping, not merely unknown). This is the case the first pass left uncovered entirely: both cards did everything right at prepare time and their dispatch windows genuinely never overlapped, yet they still collided — evidence of a missing cross-item `blockedBy`/sequencing edge rather than a scoping or dispatch-race failure, and a structurally different fix than either of the classes above. Never conflated with `concurrent-overlap` (#4295 regression-checks only that class, and a `declared-no-overlap` row landing there would be a false regression signal for it).
5. **`unclassified`** — the fallback when neither `losingSide` nor `dispatchWindowsOverlapped` can be determined (both cards had cards and scope, but the episode's captured evidence — see "Capturing evidence at detection" below — could not establish which side loses or whether the windows overlapped). An honest "don't know" value, never a guessed class; a row landing here every time signals the evidence-capture side needs strengthening, not a classifier bug.

`hot-file` is checked LAST, over the four values above, and is **always** an orthogonal flag (`hotFile: true`) — never a fifth enum value, resolving the first pass's own enum-vs-flag contradiction (a hot file can co-occur with any of the five classes, most usefully with `under-declared-scope` or `declared-no-overlap`): the colliding file already appears at or above a threshold (default 3) in the roll-up's own lookback window — see "Shared window" below (the classifier no longer hardcodes a separate 30-day constant; it takes the SAME `windowMs` the rollup accepts, defaulted once).

**`classifyConflict` decides ONE FILE at a time (restoring the per-file granularity its own precedence rules
need — `under-declared-scope`/`concurrent-overlap`/`declared-no-overlap` all turn on whether a SPECIFIC file was
declared, which cannot be answered for an episode carrying several colliding files without first answering it
per file), widened to actually carry the two inputs the first pass's design assumed but never declared. An
episode with N colliding files calls it N times; `recordResolvedConflict` reduces the N results to ONE class
for the row via a fixed precedence (never an average or "last file wins"): `no-card` beats everything (if either
side has no card at all, nothing else is answerable) > `under-declared-scope` (the most actionable finding) >
`concurrent-overlap` > `declared-no-overlap` > `unclassified` (only when every file reduces to it). The per-file
detail is not lost — it rides alongside on the row as `perFileClasses: Record<file, class>` for transparency,
while `class` itself stays the single reduced value Done-when's fixtures assert against:**
```
classifyConflict({
  file, prAScope, prBScope, prACardExists, prBCardExists,
  dispatchWindowsOverlapped,   // boolean|null — null = unknown, never guessed
  losingSide,                  // 'A'|'B'|null — null = unknown (e.g. no rebase/redo detectable)
  hotFileCount, threshold = 3,
}) → { class: 'no-card'|'under-declared-scope'|'concurrent-overlap'|'declared-no-overlap'|'unclassified', hotFile: boolean }
```
**Known accepted limitation, stated rather than hidden**: `prAScope`/`prBScope`/`prACardExists`/`prBCardExists`
are read from each opposing PR's linked backlog item's CURRENT state at classification time, not a historical
snapshot of what the card declared at dispatch time — a card edited between dispatch and resolution could shift
the classification. Acceptable for v1 (a real signal beats no signal); revisit with a historical-scope capture
only if live data shows it misclassifying in practice.

**No new state to detect TIMING (corrected: both timestamps are LOCALLY MINTED, never read off the GitHub
timeline — see "Episode id is minted locally" just below for why the timeline read does not work for
`detectedAtMs`).** Per the #2612 "no parallel state store" invariant this repo already holds to (cited in
`we:parked-pr-conflict-watch.mjs`'s own header): `detectedAtMs` is the sweep's own `now` at the moment it
composes the alert comment / dispatches the stacked-base repair (the SAME `nowMs` the episode id below embeds,
so the two can never disagree). `resolvedAtMs` is likewise the sweep's own `now` at the moment the self-heal
branch (right before it calls `postRearm`/removes the label, `:2064-2078`) or the stacked-rebase repair's
`we:conflict-fix-mark.mjs` completion fires — both already-existing call sites, no new marker file, no new
GitHub read.

**Capturing evidence at detection (resolves the "resolution-time evidence" gap the first pass's design got
wrong, and the SECOND pass's own first attempt got wrong too — see the corrected mechanism below).** The first
pass assumed the colliding file list and the opposing PR were "known at detection" and durably re-derivable at
resolution; they are not — `we:parked-pr-conflict-watch.mjs`'s own completion hooks (the self-heal branch
around line 2064-2078, and `we:conflict-fix-mark.mjs`'s comment) are handed neither the opposing PR nor the
pre-repair shas, and after a rebase/repair `main` may carry contributions from several PRs, so "prB" is not one
automatically identifiable opponent.

**Episode id is minted locally, at post time — never re-derived from the GitHub timeline afterward (corrects
this pass's own first draft).** The watch deliberately posts its alert comment and routes the repair BEFORE
applying `CONFLICT_LABEL` (the #4118 crash-safety ordering: "apply the label LAST, only once the alert comment
and the dispatch have both either just succeeded or were already found" — `we:parked-pr-conflict-watch.mjs`'s
own header, "WHICH MARKERS COUNT" section), so the `labeled` timeline event `defaultConflictLabelAgeMs` reads
(`:244`) does not exist yet at the moment the alert comment is composed — and on a REPEAT episode on the same
PR, it can return the PREVIOUS episode's `labeled` timestamp instead, silently colliding two different
episodes' ids. The fix needs no GitHub read at all: `episodeId = ${prNumber}:${nowMs}` and `detectedAtMs = nowMs`
use the SAME local wall-clock `watchParkedPrConflicts({ now = Date.now() })` already carries as an injected
param — minted once, embedded directly in the trailer at the moment the alert comment is composed, never
re-queried from the timeline. A completion hook reads `detectedAtMs`/`episodeId` straight off the trailer text,
not off any GitHub timeline event — durability comes from the comment persisting (same as a label), not from
re-deriving anything.
- **Colliding file paths**: `we:parked-pr-conflict-watch.mjs#defaultConflictingFilePaths` (line 379) is already called from this same detection path today for the statute-tier check — its `git merge-tree` result is reused, not re-derived, for the postmortem snapshot.
- **Opposing PR(s)**: `git log <mergeBaseSha>..origin/main -- <collidingPaths>` (the merge-base is already resolved by the SAME `git merge-tree` probe) lists every commit landed to `main` touching a colliding path since this PR's base moved; each sha is mapped to its originating PR via `gh api repos/{repo}/commits/{sha}/pulls` — collected as `opposingPrNumbers: number[]`, NEVER assumed to be exactly one (the first pass's "prB" singular was the bug).
- This snapshot is embedded as a trailer on the alert comment `we:parked-pr-conflict-watch.mjs#buildConflictComment` already posts at detection, mirroring the EXACT pattern `we:scripts/conveyor/rearm-review.mjs#conflictFixTargetTrailer` (line 120) / `we:scripts/conveyor/conflict-fix-round-count.mjs#CONFLICT_FIX_TARGET_TRAILER_RE` (line 90) already use to embed structured, machine-parseable data in a durable GH comment — read back by a new regex parser of the identical shape, not a new store. When the git probe fails at detection (rare — a transient fetch error), the trailer is embedded with `files=[]`/`opposing=[]` and the eventual row carries `evidenceComplete: false` rather than a fabricated file list or opponent — the store's own existing "`null` when unavailable, never fabricated" discipline (see Cost fields below), extended to evidence.

**The stacked-rebase path has NO precursor alert comment to embed a trailer into — a real gap this pass closes
directly, not by reusing the main-base mechanism.** `we:parked-pr-conflict-watch.mjs`'s own stacked-base branch
(`:1673-1692`, "STACKED PR … deferred here … This file posts no comment and touches no label for this
population") explicitly posts NOTHING; `we:reconcile-core.mjs`'s STACKED-BASE CONFLICT branch dispatches the
mechanical rebase directly, with no watch-side detection step at all. So for THIS path, `we:reconcile-core.mjs`'s
own dispatch point (the ONE moment this population is ever observed) IS the detection moment: it computes the
same evidence snapshot (colliding paths via the same merge-tree probe, `opposingPrNumbers` against the PR's own
base rather than `main`) and passes it straight through to the fix agent's dispatch payload — never through a
comment trailer that does not exist. `we:conflict-fix-mark.mjs`'s CLI gains new flags (`--episode-id=`,
`--colliding-files=`, `--opposing-prs=`) so `buildConflictFixMarkComment` embeds the snapshot in ITS OWN
completion comment (extending the trailer shape `conflictFixTargetTrailer` already adds there) — the ONLY
comment this path ever posts, so it is the ONLY place the snapshot can land, and `recordResolvedConflict` reads
it from there directly rather than from any precursor.

**One row per RESOLVED CONFLICT EPISODE (keyed by `episodeId`, holding every colliding file for that episode — never "one row per file"), written once, at resolution** — never a provisional row at detection updated later, which would fight the append-only, never-rewritten discipline `we:scripts/conveyor/run-scorecard-store.mjs` already established for exactly this reason (a historical row is never mutated once a rubric/class changes). Classification needs both sides' scope (captured at detection per the snapshot above) and full cost (known only at resolution), so the write waits for resolution and carries `detectedAtMs`/`episodeId` alongside it. This also resolves the first pass's "one row per resolved conflict" (Done when #1) vs. "one row per file" (Interfaces) contradiction: a single episode can name several colliding files in its own `files` array, and `rollupConflictPostmortems`'s `totalConflicts` counts episodes (rows), never files — no double-count.

**Append is at-least-once by construction, made SAFE by reconciling on `episodeId` at every read — never claimed
as strict exactly-once from the store alone (correcting this pass's own first draft, which over-claimed what a
best-effort lock can guarantee).** `recordResolvedConflict` first calls `readConflictPostmortems` and checks
whether a row with this episode's `episodeId` already exists, skipping the append when one does — this closes
the COMMON case (a retry after a crash, or the SAME writer observing its own completion twice) cheaply. Under
genuine concurrent unlocked writers (`we:scripts/conveyor/infra-blocked.mjs#withInfraLock` proceeding unlocked
after contention is an accepted, explicitly-documented possibility, not something this card can close), two
processes racing the SAME read-then-append window could still both write a row for one `episodeId` — accepted as
a rare, bounded cost (a duplicate row, never lost data, never a wrong row) rather than a claim this design cannot
back: `rollupConflictPostmortems` groups by `episodeId` and counts each id ONCE regardless of how many rows carry
it (first-by-`detectedAtMs` wins for any field that must pick one), so a rare race produces redundant storage,
never a corrupted aggregate. This covers both real double-write risks the first pass named: (a) the watch's
self-heal branch appends at the SAME point it already rearms — right where `we:parked-pr-conflict-watch.mjs`
line ~2064-2078 already documents "rearm FIRST, remove the label LAST"; (b) the stacked-rebase path
(`we:conflict-fix-mark.mjs`) posting its own completion comment, so if the ordinary watch ALSO later observes
the same episode resolved, the second writer's dedupe-on-read makes it a no-op in the common case and a
harmless duplicate in the rare race.

**A failed append is surfaced, never silently swallowed.** `recordResolvedConflict` never throws past its own
boundary (a postmortem bug must never turn a successful conflict resolution into a reported failure — unchanged
from the first pass), but when `appendConflictPostmortem` itself fails, the caller (the watch's self-heal
branch) posts a single reconcile-notes entry mirroring the EXISTING pattern this same file already uses for a
different exhausted-cap case (`we:parked-pr-conflict-watch.mjs`'s `postNoteComment`/`notifyDesktopChecked` call
for `round-cap-exhausted`, `:1536-1545`) — "postmortem write failed for PR #N's episode `<id>` — the conflict
itself resolved correctly, only its record is missing" — so a missed row is visible to an operator rather than
disappearing with no trace, while the label removal / rearm the failure sits beside still proceeds unblocked.

**Shared window.** The classifier's hot-file lookback and the rollup's own trailing window are the SAME parameter, never two independently-hardcoded constants: `classifyConflict`'s `hotFileCount` is computed by the caller against `rollupConflictPostmortems`'s own `windowMs` (default 7 days, below) — the first pass's "30-day classifier window vs. 7-day rollup window" were never reconciled in one call path; this pass reconciles them by having exactly one default, threaded through both.

**Storage mirrors `we:run-scorecard-store.mjs`'s own shape and locus, not a new convention**: `we:scripts/conveyor/conflict-postmortem-store.mjs`, append-only JSON named `we:conflict-postmortems.json` under the state root `we:scripts/lib/daemon-rebuild.mjs#daemonConveyorStateRoot` resolves (its `.conveyor/` directory — the identical root the scorecard store resolves against), locked the same way (`we:scripts/conveyor/infra-blocked.mjs#withInfraLock`), atomic rename on write. This is the "run rating/scorebook" home the card's own ask names — a sibling store next to `we:run-scorecards.json`, not a merge into its schema (a conflict postmortem and a scored dispatch are different subjects; `we:scripts/conveyor/run-quality-record.mjs`'s header is explicit that Fork 5's subject-class gate exists precisely so different subjects never blend in one aggregate).

**Cost fields, each best-effort and `null` when unavailable — never a fabricated number (names and sources corrected against the actual code, per the first pass's own "cost sources are misdescribed" finding):**
- `fixRounds` — NOT a bare call to `we:scripts/conveyor/conflict-fix-round-count.mjs#countStaleConflictFixRounds` (line 71): that function counts rounds against the PR's CURRENT target ref/sha across its WHOLE comment thread, not scoped to one episode. This field instead filters the PR's fix-marker comments to those posted between `detectedAtMs` and `resolvedAtMs` (the episode's own window) before counting matches against `CONFLICT_FIX_COMMENT_MARKER` — an explicit episode filter, not the whole-history call.
- `pushesSinceDetected` (renamed from the first pass's `ciRuns`, which claimed an equivalence the code cannot support) — count of commits pushed to the PR's head after `detectedAtMs`. Honestly named as a push-count proxy: commits pushed ≠ CI runs ≠ push timestamps, and this field is documented as exactly what it counts, never claimed to equal an actual CI run count.
- `reReviews` — count of `review:changes`→`review:pending` re-arms (`we:scripts/conveyor/rearm-review.mjs`) after `detectedAtMs`.
- `tokensUsd` — the first pass's "join by PR number" is unsupported: `we:scripts/conveyor/run-scorecard-store.mjs`'s `Row` (line 320) keys on `item`/`handle`, never a PR number. This pass's OWN first attempt ("the dispatching call, `we:reconcile-core.mjs`'s conflict-fix branch, already carries that dispatch's own handle") is also wrong: `we:reconcile-core.mjs` is a PURE PLANNER (`dispatch.push({kind: 'fix', ...})`) that mints no handle at all — the handle is minted downstream, by `we:scripts/conveyor/reconcile-fix-dispatch.mjs` (the execution layer that actually launches/resumes the fix agent, e.g. its `stop({handle: printedId})` at `:778`). Honest corrected design: `recordResolvedConflict`'s `handle` param is populated ONLY when the caller can actually supply it — for `we:conflict-fix-mark.mjs` (the stacked-rebase path), its own CLI is invoked BY the dispatched fix agent, so a `--handle=` flag threaded through from its own dispatch is real and available; for the main-base self-heal path (`we:parked-pr-conflict-watch.mjs`), the watch observes a label disappearing with NO visibility into which process caused it (a human push and an agent push look identical from here) — `handle` stays `null` there UNLESS `we:reconcile-fix-dispatch.mjs` is later changed to embed its own handle in a durable comment the watch could read back (a real future extension, not built by this card). `tokensUsd` is joined from the scorecard store by `handle` when one exists; `null` otherwise — never fabricated, never guessed from a PR number the store cannot look up by.

## Interfaces

- `we:scripts/conveyor/conflict-postmortem-store.mjs`
  - `appendConflictPostmortem(row, {storePath, readJson, writeJson, lock} = {})` → `{written: true, row}` | `{written: false, row: existing}` when `row.episodeId` already exists in the store (the exactly-once dedupe-on-read, never a throw for this case) | throws on a scrub-failing `evidence` field (same "deny on a hit, never redact" discipline as `we:run-scorecard-store.mjs#appendScorecard`).
  - `readConflictPostmortems({storePath, readJson} = {})` → `Row[]`.
  - `Row = {episodeId, repo, prA, prB: prB|null, opposingPrNumbers: number[], files: string[], evidenceComplete: boolean, class: 'no-card'|'under-declared-scope'|'concurrent-overlap'|'declared-no-overlap'|'unclassified', hotFile: boolean, detectedAtMs, resolvedAtMs, mode: 'main-base'|'stacked-rebase', handle: string|null, cost: {fixRounds: number|null, pushesSinceDetected: number|null, reReviews: number|null, tokensUsd: number|null}}`. `episodeId = ${prA}:${detectedAtMs}` (see Design's "Capturing evidence at detection"); `files` holds every colliding path for the WHOLE episode (never split across multiple rows).
- `we:scripts/conveyor/conflict-postmortem-record.mjs` — the ONE seam every call site goes through (mirrors `we:scripts/conveyor/run-quality-record.mjs`'s own "built once, called everywhere" composition, never duplicated per caller):
  - `classifyConflict({prAScope, prBScope, prACardExists, prBCardExists, dispatchWindowsOverlapped, losingSide, hotFileCount, threshold = 3})` → PURE, returns `{class, hotFile}` per the Design section's exhaustive precedence (5-way enum + orthogonal flag).
  - `recordResolvedConflict({repo, prA, prB, opposingPrNumbers, files, mode, handle, detectedAtMs, resolvedAtMs, evidenceComplete, scopeReader, costReader})` → derives `episodeId`, composes `classifyConflict` ONCE per episode (never per file — the first pass's "one row per file" is retracted) + the cost readers above + `appendConflictPostmortem`'s own dedupe. NEVER THROWS past its own boundary — same discipline as `we:run-quality-record.mjs`: a postmortem-recording bug must never turn a successful conflict resolution into a reported failure. Returns the stored row or `null` on any internal failure.
- Call sites (consumers, no new dispatch path):
  - `we:scripts/conveyor/parked-pr-conflict-watch.mjs` — the detection half (absent→present transition) captures and embeds the evidence trailer per Design; the resolution half, at the SAME point the file already documents "rearm FIRST, remove the label LAST" (line ~2064-2078), parses the trailer back and calls `recordResolvedConflict({mode: 'main-base', ...})` before the label removal.
  - `we:scripts/conveyor/conflict-fix-mark.mjs` — right after `buildConflictFixMarkComment` posts, parses the SAME detection-time trailer off the PR's alert comment and calls `recordResolvedConflict({mode: 'stacked-rebase', ...})` (this is `we:reconcile-core.mjs`'s STACKED-BASE CONFLICT branch's own hand-back point, so no new hook into that file's dispatch logic is needed — only its existing completion call).
- `we:scripts/conveyor/conflict-postmortem-rollup.mjs` — PURE, no fs/clock: `rollupConflictPostmortems(rows, {windowMs = 7 * 24 * 3600_000, hotFileThreshold = 3, nowMs})` → `{hotFileCandidates: [{file, count}], recurringUnderDeclaredScope: [{file, count}], totalConflicts, byClass: Record<class, number>}`, scoped to `mode !== 'ci-red-on-open'` rows so a future sibling `mode` (xdm775e's own `mode: 'ci-red-on-open'` rows, once that card lands) never blends into this store's conflict-shaped aggregates — the exact cross-subject blending `we:scripts/conveyor/run-quality-record.mjs`'s own header says must never happen. Report-only, same "disarmed for v1" discipline `we:scripts/conveyor/run-quality-route.mjs` already applies to its own auto-apply router. **Landing spot** (the first pass's own gap): read by `we:scripts/progress-board.mjs`'s existing derived-section pattern — the SAME consumer xdm775e wires its own `redOnOpenRate` derived line into — rather than a separate CLI; a human/operator reads the board and acts, per the hookable-vs-judgment split (rule 51).

## Tasks

1. `we:scripts/conveyor/conflict-postmortem-store.mjs` + its unit tests (append/read, scrub refusal, lock contention), mirroring `we:run-scorecard-store.mjs`'s own test shapes.
2. `we:scripts/conveyor/conflict-postmortem-record.mjs`: `classifyConflict` (pure, unit-tested against all five classes — including `declared-no-overlap` and `unclassified` — + the hot-file flag combining with each) and `recordResolvedConflict` (the never-throws, episode-deduping composition).
3. Wire the two call sites (`we:parked-pr-conflict-watch.mjs`, `we:conflict-fix-mark.mjs`), each with its own fixture-driven test proving a row is written on resolution with the right `mode`.
4. `we:scripts/conveyor/conflict-postmortem-rollup.mjs` + tests (hot-file repeat detection, recurring-class detection, an empty window, a window with no conflicts).
5. Re-verify against live conflict history: run the rollup against `#2821`'s two real collisions (reconstructed from PR timeline/label events) as a fixture, confirming the tool would have classified both correctly by hand before trusting it on the next live case.

## Delivery shape

One PR, landing incrementally: the store and record module land first (`recordResolvedConflict` inert until wired), then the two call-site wirings, then the rollup reader — each step keeps `main` green and every existing test passing, so no branch/flag is needed to hide half-built state (same incremental-behind-`main` shape #4308 uses for its own `overlapContext: null` default).

## MVP cut

Per the operator's prepare-rule ruling (full design stays above; only the MVP builds now): **the MVP is a
one-line classified record per conflict, from declared-scope comparison** — the MAIN-BASE path only.

**Must (MVP):**
- Task 1 (`we:scripts/conveyor/conflict-postmortem-store.mjs` + tests) — unchanged, the MVP needs the store.
- Task 2 (`we:scripts/conveyor/conflict-postmortem-record.mjs`), narrowed to a STATED aggregation rule for
  multiple opponents (this session's own re-review found "single aggregate comparison" too vague to build from
  — corrected here): `classifyConflict`'s full 5-way exhaustive enum
  (`no-card`/`under-declared-scope`/`concurrent-overlap`/`declared-no-overlap`/`unclassified`) + the `hotFile`
  flag, computed per-opponent then reduced by the MOST CONSERVATIVE (most-actionable) rule, never a guess:
  `prBCardExists` is true only if EVERY opponent in `opposingPrNumbers` resolves to a card (`no-card` fires if
  ANY does not); `prBScope`'s declared-file check is the UNION of every opponent's own `scope:` (so
  `under-declared-scope` fires only when the colliding file is absent from EVERY opponent's `scope:` — the
  direction that never falsely accuses a card of a scope gap it doesn't have); `losingSide` and
  `dispatchWindowsOverlapped` are each `null` (unknown) unless EVERY opponent agrees on the same value, in which
  case that shared value is used — any disagreement across opponents falls through to `unclassified` rather than
  picking one opponent's answer arbitrarily. `hotFileCount` is a direct, INLINE count of the colliding file's
  occurrences across the store's own already-written rows within the shared window (a few lines inside
  `recordResolvedConflict` itself — reading `readConflictPostmortems` and counting matching `files` entries newer
  than `nowMs - windowMs`), never the standalone `rollupConflictPostmortems` reader (Could, below): the MVP's
  5-way enum + `hotFile` flag output shape stays intact and honestly computable without the reporting module.
  This aggregation rule, and the deferred per-(file, opponent) precision, are BOTH stated explicitly in
  `we:scripts/conveyor/conflict-postmortem-record.mjs`'s own docstring — an honest MVP limitation, never a
  silently-dropped requirement.
- Task 3, MAIN-BASE call site only: `we:scripts/conveyor/parked-pr-conflict-watch.mjs`'s self-heal branch wired
  to `recordResolvedConflict({mode: 'main-base', ...})`. The `we:scripts/conveyor/conflict-fix-mark.mjs`
  (stacked-rebase) call site is CUT from the MVP — see Blocker 1 below.
- Task 5, narrowed to the main-base half of #2821's own evidence (both of #2821's real 2026-09-27 collisions
  were main-base conflicts per the Evidence section above, so the MVP's own proof case is unaffected).

**Could (follow-up, already designed above — not built now):**
- The stacked-rebase call site (`we:conflict-fix-mark.mjs`) and its evidence-transport fix (Blocker 1 below).
- The per-(file, opponent) evidence shape (Blocker 2 below).
- Task 4, `we:scripts/conveyor/conflict-postmortem-rollup.mjs` + the `we:scripts/progress-board.mjs` KPI line —
  the roll-up/reporting layer is genuinely useful but not what "one classified record per conflict" requires;
  it reads the SAME store the MVP already writes, so it is pure upside added later, never a rework.
- Hardening the append's concurrency bound (compare-and-swap or one-row-per-file-append) past the honest bound
  Blocker 3 below states.

**Size:** the MVP is 2 of the original 5 modules/call-sites (store + record, main-base wiring only) — roughly
2–3 on the same Fibonacci scale this card's own size-8 basis used for all five; well under the ~1.5× budget
this rule sets, no further split needed.

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

**Handling:** items 1–6 above are resolved in the second design pass folded into Design/Interfaces/Tasks/`scope:`
above (2026-09-28, ahead of this item's own scheduled combined Codex re-review with 4364/4366):
1. resolved — `classifyConflict` is now a strict 5-way exhaustive enum (`no-card` / `under-declared-scope` /
   `concurrent-overlap` / `declared-no-overlap` / `unclassified`) with `hot-file` demoted to a permanent
   orthogonal flag, and the signature carries `dispatchWindowsOverlapped` + `losingSide`.
2. resolved — an episode-id-keyed detection-time snapshot (colliding paths + `opposingPrNumbers` + shas),
   embedded as a comment trailer mirroring `we:scripts/conveyor/rearm-review.mjs#conflictFixTargetTrailer`,
   read back at resolution; no new store.
3. resolved — `appendConflictPostmortem` dedupes on `episodeId` (read-before-write), covering both the
   crash-before-label-removal case and the stacked-rebase double-observation case.
4. resolved — `fixRounds` is now an episode-windowed filter (not `countStaleConflictFixRounds`'s whole-thread
   read); `tokensUsd` joins by `handle`, not PR number; `ciRuns` renamed `pushesSinceDetected` with an honest
   description.
5. resolved — `episodeId` makes "one row per episode" unambiguous (no per-file split, no double-count); the
   classifier and rollup share one `windowMs`; the rollup's landing spot is `we:scripts/progress-board.mjs`,
   the same consumer xdm775e wires its sibling KPI into, and the rollup's own `mode`-scoped filter keeps a
   future `mode: 'ci-red-on-open'` row (xdm775e) from blending into this store's conflict aggregates.
6. resolved — `scope:` now includes both call-site test files (`we:scripts/conveyor/__tests__/parked-pr-conflict-watch.test.mjs`,
   `we:scripts/conveyor/__tests__/conflict-fix-mark.test.mjs`) and `we:scripts/progress-board.mjs`; size-8 basis:
   five modules/call-sites (store, record, rollup, two wirings) each carrying real design + tests, consistent
   with this repo's own size-8 stories elsewhere in this batch (4364, 4366).

This card is now presented for the ONE combined read-only Codex re-review this session runs across 4364/4365/4366
together; see "Independent plan review — second pass" below for that outcome.

## Done when

1. **Executable** — a fixture reconstructing #2821's two 2026-09-27 conflicts against `we:scripts/conveyor/conflict-postmortem-record.mjs` produces two episode rows (distinct `episodeId`s): one classified from the #2819/#2821 collision, one from the #2826/#2821 collision, each with a non-null `class` and a `cost.fixRounds` matching the episode-windowed marker-comment count on the real PRs.
2. Every conflict `we:parked-pr-conflict-watch.mjs` resolves (self-heal) and every stacked-rebase repair `we:conflict-fix-mark.mjs` completes writes exactly one row to `we:scripts/conveyor/conflict-postmortem-store.mjs`'s store — proven by a fixture-driven test at each call site, not by inspection.
3. `rollupConflictPostmortems` over a trailing week correctly surfaces a file appearing ≥3 times as a hot-file candidate and a class appearing repeatedly as a "feed the prepare checklist" note, both unit-tested against a synthetic multi-row fixture.
4. No existing conflict-handling DECISION changes: `we:parked-pr-conflict-watch.mjs`'s label/rearm decisions and `we:reconcile-core.mjs`'s STACKED-BASE CONFLICT branch dispatch decision are unchanged — corrected from the first pass's "byte-for-byte unchanged" (which contradicted this card's own capture design): the alert comment DOES gain a new machine-readable trailer (detection-time evidence) and `we:conflict-fix-mark.mjs`'s completion comment DOES gain new trailer fields, both additive to existing comment bodies, never a changed decision about what gets labelled/commented/dispatched or when.

## Independent plan review — re-review (Codex, read-only, 2026-09-28)

Confidence **High**, build-ready **No** — **3 blockers remain**, found against the second-pass fixes above:

1. **[blocker, OPEN]** The stacked-rebase evidence handoff has no actual transport: `we:reconcile-core.mjs`'s
   dispatch composes a `planned` object through `planFixesFromReconcile`, and `we:scripts/conveyor/reconcile-fix-dispatch.mjs`'s
   `dispatchFix` (`:367`, `:909`) forwards only its existing brief tokens — neither carries the new evidence
   snapshot (colliding files/opposing PRs/episode id) through to `we:conflict-fix-mark.mjs`'s CLI. The Design
   section's own Evidence line still tells the completion hook to read a "precursor alert" this same pass
   already established does not exist for this path. **Open — needs a real transport change through
   `we:scripts/conveyor/reconcile-fix-dispatch.mjs` (not in `scope:` today), not just a card-level assertion
   that dispatch "passes it through."**
2. **[blocker, OPEN]** Multiple opposing PRs are now collected (`opposingPrNumbers: number[]`), but
   `classifyConflict` still accepts a single `prBScope`/`prBCardExists` — nothing maps a specific colliding FILE
   to WHICH opposing PR touched it, so the per-file reduction this pass added resolves multiple FILES, never
   multiple OPPONENTS. **Open — needs a per-(file, opponent) evidence shape, not just per-file.**
3. **[blocker, OPEN]** "Never lost data" is over-claimed: the store's read-replace-whole-document append pattern
   (mirroring `we:scripts/conveyor/run-scorecard-store.mjs`, whose own header documents the same risk at `:216`/`:336`)
   means two concurrent unlocked writers can overwrite different episodes' rows entirely, not merely duplicate
   one — the rollup's episode-id dedupe cannot recover a row that was never persisted in the first place.
   **Open — the claim needs correcting to "duplicate, never silently corrupted, but a genuine concurrent write
   CAN lose a row" (an honest bound), or a real fix (compare-and-swap / one-row-per-file-append rather than
   whole-document replace) — not solved further in this session.**

MAJOR (also open): Interfaces still describes `classifyConflict` as called "once per episode" in
`recordResolvedConflict`'s own prose (this pass's per-file correction lives in the Design section only) —
reconcile the two before this is re-read.

## MVP-blocking classification (per the operator's prepare-rule ruling)

Per this repo's new prepare rule (full design stays above; a plan-review finding blocks the stamp ONLY when it
breaks an MVP Must or names real harm — data loss/security/gate break — everything else is SCOPE-GROWTH, an
already-designed follow-up, never silently dropped):

1. **Stacked-rebase evidence transport — FOLLOW-UP, not MVP-blocking.** The MVP cut above excludes the
   stacked-rebase call site entirely (`we:conflict-fix-mark.mjs` is not wired this pass); this finding applies
   only to that excluded path. Filed as a follow-up slice (wire `we:scripts/conveyor/reconcile-fix-dispatch.mjs`'s
   dispatch payload to carry the evidence snapshot through to `we:conflict-fix-mark.mjs`'s CLI).
2. **Multi-opponent-per-file evidence — FOLLOW-UP, not MVP-blocking.** The MVP cut above states the single
   aggregate `opposingPrNumbers`/`prBScope` comparison as an explicit, honest limitation, not a claim of
   per-(file, opponent) precision. Filed as a follow-up slice (a per-(file, opponent) evidence shape).
3. **[BLOCKER, OPEN after this session's round cap] Concurrent-write data loss on the whole-document store.**
   Per this rule's own "harm: data loss" bar, this is MVP-blocking regardless of precedent (round 1's own
   correction). Round 1's proposed fix — a 30s store-specific `timeoutMs` on
   `we:scripts/conveyor/infra-blocked.mjs#withInfraLock` — does NOT actually establish the claimed bound: round
   2's own re-review verified the real function (`we:scripts/conveyor/infra-blocked.mjs:389`) has TWO other
   unlocked-proceed paths a longer `timeoutMs` never touches — its 15s STALE-lock rule can steal a still-running
   writer's lock out from under it, and a non-`EEXIST` fs error proceeds unlocked immediately, both regardless of
   `timeoutMs`. Confirmed live against the actual function, not merely argued from its docstring. **Not resolved
   this session** (both this session's permitted rounds are spent) — a real fix (compare-and-swap, one-row-
   per-file-append, or a NEW lock primitive without the stale-steal/error-passthrough escape hatches) is owed
   before this specific MVP-Must is met; naming a longer timeout is not that fix.

## Independent plan review — MVP re-review, round 1 (Codex, read-only, 2026-09-28)

This session's first re-review round, confined to the MVP cut + classification above. **2 blockers found:**

1. **[blocker]** The MVP's classification contract was not actually defined by declared scope alone (it also
   needs losing-side identity, dispatch-window overlap, and hot-file history, all retained in the 5-way enum),
   and "single aggregate comparison" for multiple opponents named no concrete rule. **Resolved**: the MVP cut's
   Task 2 bullet now states the exact aggregation (AND-of-card-existence, UNION-of-scope,
   agree-or-`unclassified` for losing-side/overlap) and an inline hot-file count against the store's own rows
   (no separate rollup reader needed for the flag itself). Confirmed resolved in round 2, below.
2. **[blocker]** Classifying the concurrent-write risk as NOT-AN-ISSUE via precedent was rejected — the rule's
   own "harm: data loss" bar blocks regardless of an existing store accepting the same risk. Proposed fix: a 30s
   store-specific lock timeout. **Round 2 found this fix does NOT actually work** — see the classification
   above and round 2 below; STILL OPEN.
3. **[scope-growth, confirmed correct]** The stacked-rebase exclusion (old Blocker 1) needed no further change —
   the MVP genuinely never touches that path.

## Independent plan review — MVP re-review, round 2 (Codex, read-only, 2026-09-28 — this session's cap)

Confirmation-only pass against round 1's own fixes. **Finding 1 confirmed resolved. Finding 2 confirmed
UNRESOLVED**: verified live against the real `we:scripts/conveyor/infra-blocked.mjs#withInfraLock` that a longer
`timeoutMs` does not close the gap — its 15s stale-lock-steal path and its non-`EEXIST`-error-proceeds-unlocked
path both bypass `timeoutMs` entirely. Folded into the classification above as OPEN.

**This session's two permitted review rounds are both spent. One real MVP-blocker remains** (the concurrent-write
data-loss gap on the shared store) — **this card's MVP is NOT stamped.** Per this session's own new prepare
rule (point 6: "after [the round cap], if no MVP-Must blocker remains, stamp... and file the rest as
follow-ups" — the converse holding here: a real MVP-Must blocker DOES remain, so the card stays `status: open`,
`preparedDate` withheld, exactly as the rule intends), a follow-up prep pass is owed: a real store-level fix
(compare-and-swap, one-row-per-file-append, or a lock primitive with no stale-steal/error-passthrough escape
hatch) before this MVP is build-ready. Everything else above (the MVP cut itself, the aggregation rule, Blocker
1's classification) stands as prepared and does not need re-doing next pass.
