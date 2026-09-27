---
bornAs: xnfj1tp
kind: story
size: 8
parent: "4075"
status: open
blockedBy: ["4307"]
scope: ["we:scripts/conveyor/land-overlap-yield.mjs", "we:scripts/conveyor/__tests__/land-overlap-yield.test.mjs", "we:scripts/merge-ai-prs.mjs", "we:scripts/__tests__/merge-ai-prs-overlap-yield.test.mjs", "we:scripts/conveyor/soak/breaks/small-pr-lands-over-large-in-review.mjs", "we:scripts/conveyor/soak/breaks/small-pr-lands-over-large-in-review.soak.test.mjs", "we:scripts/conveyor/soak/breaks/index.mjs"]
dateOpened: "2026-09-27"
tags: []
---

# Drain lands a ready PR after, not before, a larger overlapping PR already in review (land-time complement of #4295)

PR 2821 (20 files) conflicted with main twice on 2026-09-27 because smaller PRs touching the same files (2826 in we:scripts/conveyor/review-status-tag.mjs; earlier 2819 in we:scripts/operations/ci-heal-pr-dispatch.mjs) landed while it was in review. Each conflict cost a fixer round, CI and a re-review. #4295 coordinates overlapping work at DISPATCH, through the daemons' claim stores; nothing looks at overlap at LAND time, and work outside those claim stores is never coordinated. This card adds a pure land-time planner to the drain (we:scripts/merge-ai-prs.mjs) that holds a ready PR for a bounded time while a larger overlapping PR is in final review.

**Blocked by decision 4307, which is filed but NOT prepared.** It chooses whether the drain holds a ready PR that overlaps a larger PR in review at all. This card is prepared for that decision's proposed default (Fork 1 A, bounded yield). If the ruling is different, this card is re-prepared, not built as written. An independent review rated it **not build-ready yet** (see the end); the design below already folds in that review's findings.

## Evidence

- #2821 (`lane/fix-procedure`): opened 18:26Z, 20 files, +1807/−118. Review bounces at 19:00Z and 20:00Z (findings). #2826 merged at 20:30Z touching `we:scripts/conveyor/review-status-tag.mjs`; #2821 was labelled `merge-status:conflicting` at 20:32Z; the conflict watch bounced it again at 20:52Z because the round-2 fixer (done 20:44Z) had not merged main. Conflict cleared at 21:16Z. Cost of that one overlap: 44 minutes, a fixer round (two sessions, see 4306), a full CI run and a fresh review round.
- Earlier the same day #2819 (merged 18:13Z) conflicted with it in `we:scripts/operations/ci-heal-pr-dispatch.mjs`.

## How this relates to existing machinery

- **#4295 (4295)** coordinates DISPATCH across build+build, fix+fix and build+fix, on DECLARED scope, for work that goes through the daemons' claim stores. **This card works at LAND time, on ACTUAL changed files, for every open PR the drain sees**, including orchestrator and human PRs, under-declared scope, and two PRs that are both already open. #2821 and #2826 were orchestrator-dispatched and never went through those claim stores. So this is the land-time complement, not a duplicate. Shared primitive only: `we:scripts/conveyor/build-dispatch-policy.mjs#pathsOverlap` (near line 69), with the repo compared separately.
- **`we:scripts/readiness/overlap-chain.mjs`** stacks items inside one serial batch against pushed frontiers. Not used: the drain faces two already-open PRs with independent bases.
- **The drain.** `we:scripts/merge-ai-prs.mjs#planLabelDrain` (near line 1901) builds `{ready, deferred}` from `blockedBy`/`stackParents`/couple waits (near line 1967–1996). The live cascade re-runs it through `replan` after every merge (near line 5050) and then applies the couple planner (`we:scripts/lib/couple-cascade.mjs`, near line 85). The open-PR context comes from the shared snapshot (`we:scripts/lib/pr-snapshot.mjs`, `SNAPSHOT_FIELDS` near line 38, which already has `files` with per-file counts and `isDraft`).

## Design (for the proposed default, Fork 1 A)

**The rule.** A ready PR X yields to an open PR Y when all of these hold:

1. Y is open, not a draft, targets the same base branch as X, and carries `review:pending` or `review:accepted` (not `review:changes`).
2. X and Y change at least one common file in the same repo, and both file lists are complete. A PR whose file list hit the listing's cap is "unknown", and unknown never yields.
3. Y outranks X in ONE global order: total changed lines (sum of the per-file counts), larger first, then lower PR number. This is a total order over all PRs, so yields cannot form a cycle. (An overlap-relative size can cycle: A>B on one file, B>C on another, C>A on a third.)
4. Y does not depend on X: Y is not `blockedBy` X's item, and Y is not a stack descendant of X. Otherwise X would wait on a PR that is itself waiting on X.
5. X is not exempt. X's item is not `priority: high` or `tier: pinned` (a blocker fix never waits). A missing or unreadable card means "not exempt". Sibling-repo candidates read their WE card by item id, the same way the drain already resolves item ids.
6. X is still inside its OWN yield budget: `now < readyAt(X) + windowMs`, where `readyAt(X)` is the time X's current `ready-to-merge` label was applied (from GitHub, so it survives drain restarts). This bounds X's total wait whatever happens to Y: new blockers, restarted review rounds, or a drain restart. After the budget X never yields again until its head changes and it is re-labelled.

**Where it plugs in.** Inside `planLabelDrain` itself, as one more `waitOn` source (`overlap-yield:#Y`), so the dry run and every live `replan` apply it the same way, and the couple planner then sees a yielded couple member like any other wait. `planLabelDrain` gets a new optional input: the open-PR context (with per-file counts, labels, base, draft flag, ready-label times) minus PRs already merged in this pass.

**Idle accounting.** A timed yield is NOT idle: polling does clear it (Y lands, or X's budget runs out). It stays an ordinary active deferral, unlike `heldCoupleOnly`. `--max-idle` and the batch exit must not end a watch that is only waiting on timed yields.

**Data.** No new top-level listing fields. Per-file `additions`/`deletions` already come in `files`, so the shared snapshot contract is unchanged and the cache sharing keeps working. The only new read is the `ready-to-merge` label time for a candidate that would actually yield, from the PR's timeline events. Cache it per `(PR, headSha)`, so a watch re-reads it only when the head changes.

**Window.** Starting value 45 minutes. That is a guess anchored on one incident (the #2821 conflict took 44 minutes end to end), not a measured optimum. Make it a flag, log every yield, and revisit it from the first week of yields.

**What it does and does not buy.** The same incompatible edits must be reconciled whichever PR lands second. Yielding does not shrink the conflict. What it changes is WHICH PR pays: the smaller PR X re-lands with a smaller re-review and CI scope than the 20-file PR would. That is a hypothesis this card measures (Proof plan), not a given.

## Interfaces

- New pure module `we:scripts/conveyor/land-overlap-yield.mjs`: `overlapYieldWaits({candidates, openPrs, nowMs, windowMs}) → Map<candidateNum, {yieldTo, files, untilMs}>`. No fs, no network, no clock. `candidates` and `openPrs` both use the snapshot row shape (`number`, `repo`, `baseRefName`, `isDraft`, `labels`, `files: [{path, additions, deletions}]`, plus `filesComplete`, `readyAtMs`, `item`, `exempt`, `dependsOn: Set`).
- `planLabelDrain(candidates, {..., overlapContext = null, nowMs})`: when `overlapContext` is null (every current caller and test), behaviour is unchanged.
- Drain CLI: `--no-overlap-yield`, `--overlap-yield-window=<minutes>`, and env `WE_DRAIN_OVERLAP_YIELD=0`.
- The deferred entry keeps today's shape and adds `overlapYield: {pr, repo, files, untilMs}`.

## Scope and consumers

`scope:` lists the WE edits; `we:scripts/conveyor/soak/breaks/index.mjs` is listed only defensively, since breaks are discovered automatically. Consumers:

- `we:scripts/pr-land.mjs` runs the fast drain with `--only` (near line 646). Test that a fast drain of X respects a yield, and that `--only=Y` is unaffected.
- **Cross-repo:** the resident drain daemon's projection in `plateau:tools/drain-daemon/lib.mjs` keeps `waitOn` but drops other deferred fields (near line 405), and its stall detector treats any deferral as explained non-progress (near line 648). The per-X budget stops a yield from being renewed forever, so the stall alarm cannot be muted indefinitely. Surfacing `overlapYield` there (target PR, files, release time) is a small plateau-app follow-up, filed when this lands.
- `we:scripts/lane-drain.mjs` and `we:scripts/progress-board.mjs` read drain output; the builder confirms they tolerate the extra field.

## Risks

- **Correctness of the order.** Covered by the global rank and the dependency exclusion (rules 3 and 4). Unit tests include the three-PR cycle and a `blockedBy` pair.
- **Starvation.** Bounded by the per-X budget (rule 6). A test chains blockers whose review rounds start 44 minutes apart and shows X is released at its budget.
- **Rate limit.** The label-time read is per yielding candidate and cached by head sha. Measure with warm and cold caches over a real watch session, not as one global delta while other daemons run.
- **Moved cost, not removed.** See "What it does and does not buy". If X's re-land turns out no cheaper than Y's would have been, the decision is revisited.
- **Open PRs:** none of #2821, #2827, #2828 touch `we:scripts/merge-ai-prs.mjs`, `we:scripts/lib/pr-snapshot.mjs` or the new module. #2821 edits `we:scripts/pr-land.mjs`, a consumer; re-test the fast drain once it lands. (#4295 itself overlaps #2821 through the fix-dispatch claim; not this card's concern.) The `lane/fix-procedure` overlay is still registered on the review-daemon clone (a conflict drop does not unregister it); the drain does not run from that clone, but record the adopted builds for the live proof.

## Test plan (each fails before the change)

1. `we:scripts/conveyor/__tests__/land-overlap-yield.test.mjs`: X yields to a larger in-review overlapping Y. X does not yield when Y is a draft, `review:changes`, on another base, smaller, non-overlapping, a dependant of X, or when either file list is incomplete, or when X is exempt, or past X's budget. The three-PR overlap cycle yields acyclically. A chain of blockers never holds X past its budget.
2. `we:scripts/__tests__/merge-ai-prs-overlap-yield.test.mjs`: through `planLabelDrain` and `replan`, a 2821/2826-shaped fixture defers 2826 with `overlap-yield:#2821`. A dependent freed by a merge in the same pass is still checked. A yielded couple member holds its whole couple. When Y merges mid-pass, X is released in the next replan. `--max-idle=1` does not exit on a yield-only pass. `overlapContext: null` changes nothing.
3. **Soak break `small-pr-lands-over-large-in-review`**, using the real drain pass daemon like `couple-split-by-unrelated-merge` does, in two scenarios. Both observe the computed `mergeable` state from the fake GitHub, not the label. (i) *L lands within the window.* Large PR L (in review) and small PR S (ready) share a file. **RED on main:** the drain lands S first and L becomes CONFLICTING (`large-pr-conflicted`). **GREEN:** S is deferred with `overlap-yield:#L`, L lands clean, then S is released; S's own resulting conflict is recorded, not forbidden. (ii) *Budget runs out.* L stays in review past S's budget. GREEN: S is released and lands at its deadline plus one tick; L becoming CONFLICTING afterwards is the documented cost and is allowed. A `scenario-ran` check requires both branches to have executed.

## Tasks

1. After 4307 is prepared and ratified: confirm the ruling matches this card; if not, stop and re-prepare.
2. Write the soak break. Show it RED on an `origin/main` baseline with only the break's own files applied: `node we:scripts/conveyor/soak/run.mjs break small-pr-lands-over-large-in-review` exits 1. Record the baseline sha in the break's header; `fixedBy` later names the change commit.
3. The pure module and its unit tests.
4. Wire it into `planLabelDrain`/`replan`, the CLI flags, the deferred field and the idle accounting, with test 2.
5. Measure the label-time read's cost (warm and cold); put the numbers in the PR body.
6. Gate with the `verify` operation; open the PR with `open-pr`. File the plateau-app projection follow-up.

## Delivery shape

One PR, landing on `main` with the yield on by default and the opt-out switch available. `overlapContext: null` keeps every existing caller and test unchanged, so it can land incrementally.

## Proof plan (live, before/after)

- **Before:** the #2821/#2826 timeline above (PR timeline labels and the conflict watch log).
- **After:** record which drain build is running. On the first live overlap, show the drain log's yield line (Y, files, release time), Y landing without going CONFLICTING, and X released at Y's land or at its own budget. Compare X's re-land cost (fixer minutes, CI minutes, review rounds) with #2821's 44 minutes. If no live case turns up within a week, run a staged pair on a scratch repo through the real drain CLI and post it, labelled as staged.

## Independent plan review (Codex, 2026-09-27, read-only)

Codex reviewed the first draft (confidence **Low**, not build-ready). Findings and handling:

1. [major] #4295 already covers fix+fix and build+fix through its claim stores, so "#4295 only covers builds" was wrong. **Accepted:** the boundary is now "daemon claim stores vs everything the drain sees".
2. [blocker] An overlap-relative size order can cycle (A>B>C>A), and a `blockedBy` pair can deadlock. **Accepted:** one global rank plus a dependency exclusion (rules 3 and 4).
3. [blocker] A window counted from Y's review round does not bound X's total wait. **Accepted:** a per-X budget from X's own ready label (rule 6).
4. [major] Timed yields must not count as idle, or `--max-idle` exits early. **Accepted.**
5. [blocker] Filtering "before the merge cascade" misses the live `replan` path and the couple planner. **Accepted:** the yield lives inside `planLabelDrain`.
6. [major] Adding top-level fields to the listing breaks the shared snapshot and falls back to a direct 500-row listing. **Accepted:** use per-file counts already in `files`; no new listing fields; incomplete file lists never yield.
7. [major] Data contracts (per-file counts, exemption source, missing cards, sibling repos, base branch, dependants) were incomplete. **Accepted:** rules 1–6 and Interfaces.
8. [major] The decision's fork was not exhaustive, "A now, B later" is sequencing, and "smaller conflict" is unproven. **Accepted:** the decision now has a status-quo option and an eligible-only option, B is its own axis, and this card claims a smaller re-land, to be measured.
9. [major] The resident drain daemon's projection (`plateau:tools/drain-daemon/lib.mjs`) drops the new field and treats deferrals as explained. **Accepted:** listed as a consumer with a follow-up. The per-X budget bounds the alarm-muting. The first draft's claim that `we:scripts/operations/operator-queue.mjs` and `we:scripts/operations/pr-status.mjs` render deferrals was wrong and is removed.
10. [major] The soak's GREEN contradicted itself (a timed-out release can make L conflict; label vs computed state). **Accepted:** two scenarios, computed state, `scenario-ran`.
11. [minor] The baseline must carry the new break, and the index needs no registration. **Accepted.**
12. [minor] Test the `--only` fast drain through `we:scripts/pr-land.mjs`, and the overlay is registered even when dropped. **Accepted.**

No second pass was run on this revision. Given the blocking decision is itself unprepared, this card should get one more light review after the decision is ratified and before it is stamped.

## Done when

1. **Executable** — `node we:scripts/conveyor/soak/run.mjs break small-pr-lands-over-large-in-review` exits 1 (RED) on the pre-change `origin/main` tree with the break's files applied, and 0 after, with both scenarios run. Unit tests 1–2 fail before and pass after.
2. Inside X's budget, the drain never lands a ready X over a larger, overlapping, same-base PR in final review that does not depend on X, unless X is exempt.
3. No PR waits past its own budget because of a yield, and no set of PRs ever yields in a cycle.
4. A watch that is waiting only on timed yields keeps polling (no `--max-idle` exit).
5. The label-time read's cost is measured and posted, and one live (or clearly labelled staged) before/after case is posted on the PR.
