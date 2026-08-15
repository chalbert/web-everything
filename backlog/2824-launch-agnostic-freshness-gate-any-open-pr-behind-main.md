---
bornAs: xe2wryr
kind: story
size: 3
parent: "2527"
status: open
dateOpened: "2026-08-01"
tags: [drain, conveyor, review, merge, rebase, freshness, gate]
scope:
  - we:scripts/merge-ai-prs.mjs
  - we:scripts/__tests__/merge-ai-prs.test.mjs
---

# Launch-agnostic freshness gate — any open PR too far behind main is auto-rebased or blocked from merge, regardless of how it was launched

Staleness prevention exists (#2666) but only for **conveyor-launched** PRs. A PR that stales any other way — a human-opened PR, or a review-parked draft that sits while `main` advances — is uncovered. Make the freshness check a property of the PR, not of how it was launched.

## The finding

**Symptom.** WE PR #957 was a review-parked **draft** that sat across several `main` advances. Each replay onto newer `main` re-staled its rebase-sensitive claims (an inventory count, a "not yet filed" line), and nothing auto-refreshed it — because it was never conveyor-launched, so #2666's heal path never watched it.

**Root cause — the freshness heal is keyed on launch origin, not on the PR.** #2666 auto-heals a **conveyor-launched** PR gone BEHIND / red-CI by reconstituting its delivery agent and rebasing onto current `main`. Its triggers (`isCiHealTarget` / `isBehind`, `we:scripts/conveyor/tick-core.mjs`) only fire for PRs the conveyor itself launched and is still watching. A human-opened PR, or a review-parked draft whose delivery agent has long exited, is outside that watch entirely. So "how far behind `main` is this PR" — a property of the PR — is enforced only for one launch channel.

**Why it matters.** Being N-behind `main` is exactly when rebase-fragile content drifts: counts move, cited items land, `we:path:line` loci shift. A PR that is allowed to sit far behind accumulates stale claims and merges a diff that was never re-validated against the `main` it lands on. #2666 proved the heal mechanism works; the gap is only its scope.

## Grounded findings (2026-08-15 prep — three premises in the card above are corrected here)

**1. "Behind main" has no numeric form anywhere in this codebase — it is a boolean, and the design must be too.**
Every "is this PR behind main" check that exists — `isBehind` (`we:scripts/conveyor/tick-core.mjs:179-180`,
`String(prRow?.mergeStateStatus ?? prRow?.behind ?? '').toUpperCase() === 'BEHIND'`) and `classifyPr`'s
`landableState` (`we:scripts/merge-ai-prs.mjs:555-557`, `state === 'CLEAN' || state === 'UNSTABLE'`) — reads
GitHub's own `mergeStateStatus` enum verbatim. There is no `git rev-list --count` or any other commit-counting
code anywhere in `we:scripts/`. "Exceeds a threshold **N** (commits or main-advances behind)" in the original
card describes a predicate that does not exist and would require new git plumbing to build (a
`merge-base`/`rev-list` walk) for a distinction GitHub's own signal does not make — `mergeStateStatus` is
BEHIND the instant the tip is not a descendant of `origin/main`, whether by 1 commit or 100. **Decided: the
predicate is boolean (`mergeStateStatus === 'BEHIND'`), matching the one signal that already exists and is
already tested**, not a tunable N. If a magnitude-based bar is ever wanted, that is new scope, not this card's.

**2. Acceptance criterion 3 ("cannot be merged … even if ready-to-merge is present") is ALREADY TRUE today, for every open PR, launch-agnostically — this needs a regression test, not new code.**
`classifyPr` (`we:scripts/merge-ai-prs.mjs:541-595`) is a pure function over a bare PR object — it has no
launch-origin awareness at all. Its `landableState` clause (line 583) already skips ANY PR whose
`mergeStateStatus` is not `CLEAN`/`UNSTABLE`, `BEHIND` included, **before** the `ready-to-merge`/review-hold
logic even runs. This is exercised directly: `we:scripts/__tests__/merge-ai-prs.test.mjs:71-73`,
*"SKIPS a BEHIND PR (needs rebase — never force-updated by the sweep)"*. The drain's candidate list
(`we:scripts/merge-ai-prs.mjs:2830-2836`, `gh pr list --state open ... mergeStateStatus ...`) is populated the
same way regardless of who opened the PR — there is no conveyor-only branch in this file at all. **What's
missing is not the block; it's a fixture proving the block holds for a review-parked, non-conveyor PR shape**
(Task 4 below), which is exactly what the card's own acceptance criterion 4 (reproduce #957) should be pointed
at, not at new merge-gate code.

**3. The reusable "already-launch-agnostic auto-refresh" mechanism is #2198's rebase-drop, not #2666's CI-heal — and reusing #2666's mechanism as literally shipped would be unsafe.**
`isRebaseDropCandidate` (`we:scripts/merge-ai-prs.mjs:606-613`) — `decision==='skip' && certified && testGreen &&
(mergeable==='CONFLICTING' || state==='BEHIND' || state==='DIRTY')` — has **no launch-origin check**: it runs
over every candidate the sweep classifies, conveyor-launched or not. Its rebuild, `rebaseDropManifest`
(`we:scripts/lib/rebase-drop-manifest.mjs:115-198`), is pure git plumbing — `merge-tree` → temp-index rebuild →
`commit-tree <tree> -p <base> -p <mergeRef>` → `push` to `refs/heads/<laneRef>` — **no checkout, no agent
spawn, no `git rebase`**. This is the actual "reset + cherry-pick-shaped, not a merge commit" transport the
original card asks for (`commit-tree` mints one new commit two-parented onto `base` and the pushed tip; it
never runs `git merge` or `git rebase`). By contrast, #2666's CI-heal brief
(`we:skills-src/conveyor/fix-agent-ci-brief.md`, step 2) has the spawned agent run literally `git rebase
origin/main` inside a lane clone whose local branch is named `main` (`we:scripts/lane-pool.mjs` checks out
`-B main <baseRef>` on acquire) — the exact footgun `we:docs/agent/backlog-workflow.md:895` warns against
("`git rebase origin/main` there resets HEAD to `origin/main` and silently drops your commit — observed
2026-07-04"). **Decided: extend #2198's rebase-drop, not #2666's CI-heal.** It is already launch-agnostic,
already tested, already the established plumbing, and avoids inheriting a documented footgun into new scope.
The CI-heal agent path stays exactly as scoped (#2666, conveyor-launched, judgment-repair of a genuine red
check) — this card does not touch it.

**4. The real, still-live gap: rebase-drop never SEES a review-held PR under the default drain, because it is never in that pass's listing.** The default `/drain` invocation lists `gh pr list --label ready-to-merge`
server-side (`we:scripts/merge-ai-prs.mjs:2834`). A review-held PR (`review:human`/`review:pending`/`review:changes`
without `review:accepted`) never carries `ready-to-merge`: `labelOnGreenVerdict` refuses to (re-)stamp it while
a hold is unsatisfied (`we:scripts/merge-ai-prs.mjs:1644-1648`, #2832), and applying a hold label strips any
`ready-to-merge` already present (`we:scripts/merge-ai-prs.mjs:3111-3126`, `stripReadyOnPark`, #2832/#984 F2).
So a review-parked PR is invisible to the label-scoped listing that feeds `classifyPr`/`isRebaseDropCandidate`
— it is never even classified, let alone rebase-dropped. The only listing that WOULD see it — the bare,
unlabelled `node we:scripts/merge-ai-prs.mjs` sweep (the `/merge` skill) — is on-demand, not standing. This is
**exactly** the #957 scenario: nothing periodic ever looks at a review-parked BEHIND PR. That is the one real
gap this card closes.

**5. #2820's code is fully shipped (`classifyPr` HOLD-INTEGRITY, `labelOnGreenVerdict`'s no-re-add, `stripReadyOnPark`'s strip-on-park — all cited above, all tested at `we:scripts/__tests__/merge-ai-prs.test.mjs:155-250`) even though its backlog card frontmatter still reads `status: active`.** Treat it as landed prior art to mirror (the card's own "AND-not-OR" shape is real code, not aspirational), but do not block this item on that card's status field being flipped — that is a bookkeeping gap in #2820, not a dependency of #2824.

**6. #2822 is not a real integration point.** It is `status: open`, `kind: epic`, explicitly "stays unsliced," and
a repo-wide grep for `2822` and for `2436` (the introspection step it names) outside its own backlog file
returns nothing. **Decided: drop the "register it there" line — there is no standing self-monitor to register
with yet.** If #2822 ever builds one, wiring this gate's output into it is a trivial follow-up, not a
prerequisite.

**7. The literal PR #957 cannot be the regression case — it already merged.** `gh pr view 957` shows
`state: MERGED`, carrying `review:accepted` + `ready-to-merge`. The regression coverage this card owes is a
**test fixture reproducing #957's shape** (review-held + BEHIND, `ready-to-merge` absent), not the literal PR.

**8. I traced one adjacent risk and ruled it out — noted so it isn't re-litigated.** Because `classifyPr`'s
`landableState` check runs *before* its review-hold check (line 583 before 593), a BEHIND + review-held PR is
classified `reviewHeld: false` (the BEHIND reason wins, masking the hold) — raising the question of whether
`isRebaseDropCandidate`, which doesn't check `reviewHeld` either, could let the *existing* rebase-drop+merge
cascade rebuild and land a review-held PR that slips into an unlabelled sweep. It cannot: the `!REVIEW_ESCALATION`
backstop (`we:scripts/merge-ai-prs.mjs:3090-3101`, #2366) re-checks `hasUnclearedReviewLabel` against every
`decision === 'merge'` verdict — including one rebase-drop just flipped — and downgrades it back to `skip`
before `toMerge` is built. Confirmed by reading the full pass order, not just the two functions in isolation.
Not this card's problem; recorded so the next reader doesn't have to re-derive it.

## Decided design

**One new pass in `we:scripts/merge-ai-prs.mjs`'s `sweepOnce`: a standing, launch-agnostic "freshness refresh" that finds review-held + BEHIND PRs via their own unlabelled listing and rebase-drops them — never merges, never touches a review label.** It runs on the same cadence as the drain daemon (`--watch --interval=…`), so it is standing/periodic exactly where the card's "regardless of how it was launched" requirement needs it to be — not gated on the conveyor being up, not gated on a human running `/merge` by hand.

**Fork named and decided — new pass vs. widen the existing candidate listing.** Two ways to make rebase-drop
reach review-held PRs: (a) drop the server-side `--label` filter on the main listing so review-held PRs are
already present in `verdicts`, or (b) add a second, separate, unlabelled listing scoped to review-held PRs only,
feeding a new pass that never joins the merge cascade. **(b), decided.** (a) would change the cost and shape of
the *existing*, heavily-hardened classify→escalate→merge pipeline for every drain invocation (including the
single-PR `--only=N` fast-drain path `/pr`/`/finish` shell to and depend on staying cheap) — the blast radius of
touching that pipeline's input set is exactly what the #2820/#2366/#2832 review-fix history (cited above) shows
costs multiple rounds to get right. (b) is additive: a small, separately-testable function and pass that reads
PR state and calls the same two already-tested rebuild functions (`rebaseDropManifest`/`rebaseDropContent`),
touching zero existing control flow.

**Fork named and decided — reuse `rebaseDropManifest`/`rebaseDropContent` as-is vs. write a new refresh-only
rebuild.** Reuse as-is. Both functions already return a result object (`action: 'current'|'rebased'|'skip'|'error'`)
and never touch labels or `decision` themselves — that mutation happens in the *caller* (the existing merge-drop
loop sets `v.decision = 'merge'` after a `'rebased'` result; this card's new pass simply never does that). No
function-level change to either file is needed — only a new caller that stops after the rebuild.

**Fork named and decided — what happens when rebase-drop reports `'skip'` (a real, non-mechanically-resolvable conflict)?** Left as a `skip`, logged, no escalation to an agent. Genuinely broken-diff conflict repair is
judgment work already scoped to a human via `/finish` (mirrors the existing rebase-drop skip path,
`we:scripts/merge-ai-prs.mjs:3070`, `"left skipped: ${r.reason}"`). Spawning a fix agent for this case would be
re-introducing #2666's CI-heal mechanism (and its footgun) for a case outside this card's scope (staleness, not
a broken check) — rejected per finding 3 above.

**Fork named and decided — should the freshness-refresh pass run under the single-PR fast-drain path
(`--only=<N>`)?** No. `--only`/`--couple`/`--pr` narrow the sweep to one target PR for latency
(`we:scripts/merge-ai-prs.mjs:2403`, the instant path `/pr`+`/finish` shell to) — adding a second,
whole-constellation unlabelled `gh pr list` there would tax exactly the path built to stay fast, for a feature
(catching *other* PRs' staleness) that path was never meant to serve. The pass runs on every full/unscoped
sweep (bare `/merge`, full `--label=ready-to-merge` `/drain`, and `--watch`) and is skipped whenever `onlyPr` is set.

## Interfaces & protocol

```js
// we:scripts/merge-ai-prs.mjs — NEW, placed beside isRebaseDropCandidate (both are `classifyPr`-adjacent gates)
/**
 * Is this open PR a FRESHNESS-REFRESH target — review-held (an uncleared review:pending/review:human/
 * review:changes) AND BEHIND `origin/main`? Pure. Reuses the SAME canonical hold predicate `classifyPr` uses
 * (`hasUnclearedReviewLabel`, already imported from `./lib/review-escalation.mjs`), not a re-declared local
 * check — this is the launch-agnostic analogue of tick-core.mjs's `isReviewParked && isBehind` (#2666), applied
 * to a bare `{mergeStateStatus, labels}` PR shape with no conveyor/launch context.
 * @param {{mergeStateStatus?:string, labels?:Array}} pr
 * @returns {boolean}
 */
export function isFreshnessRefreshTarget(pr) {
  const state = String(pr?.mergeStateStatus || '').toUpperCase();
  if (state !== 'BEHIND') return false;
  return hasUnclearedReviewLabel(pr?.labels, { allowPending: false }); // review:pending counts as held here — #957 WAS review:pending-shaped
}
```

- **Receives:** the same bare `{mergeStateStatus, labels}` shape `classifyPr`/`isRebaseDropCandidate` already
  take — no new field, no I/O.
- **Returns:** boolean. `false` for CLEAN/UNSTABLE regardless of labels; `false` for BEHIND with no review-hold
  label or with `review:accepted` present; `true` only for BEHIND + an uncleared hold.
- **New pass** (`sweepOnce`, `we:scripts/merge-ai-prs.mjs`, adjacent to the existing `REBASE_DROP` block at line
  ~2996): gated by `const FRESHNESS_REFRESH = flags['no-freshness-refresh'] ? false : true;` (mirrors
  `REBASE_DROP`'s own flag exactly, `we:scripts/merge-ai-prs.mjs:2443`), and by `!onlyPr` (decided above). Skipped
  entirely when either is false — no listing call is made, zero added cost to a single-PR fast drain.
- **Listing:** one extra `gh pr list --state open --json number,headRefName,mergeStateStatus,labels` per repo in
  `REPOS`, run with the SAME `mapWithConcurrency`/`repoFlag` helpers the existing `listOne` uses
  (`we:scripts/merge-ai-prs.mjs:2830-2838`) — no `--label` flag (must see review-held PRs the label-scoped
  listing excludes by construction, finding 4 above). A narrower `--json` than the main listing: this pass never
  classifies for merge, so it needs no `body`/`mergeable`/`statusCheckRollup`.
- **Per hit** (`isFreshnessRefreshTarget(pr)` true): resolve `cloneDir` exactly as the existing rebase-drop loop
  does (`isLocalRepo(repo) ? undefined : siblingCloneDir(repo)`, `we:scripts/merge-ai-prs.mjs:3022`; skip with a
  `left for its author` note when remote and no sibling clone, same as today). Call
  `rebaseDropManifest({ laneRef: pr.headRefName, base: 'origin/main', healCollision: false, run: gitRunner, cwd: cloneDir })`;
  on `action==='skip'` matching `/^real conflict beyond /`, retry with
  `rebaseDropContent({ laneRef: pr.headRefName, base: 'origin/main', run: gitRunner, cwd: cloneDir })` when
  `CONTENT_REBASE_DROP` is on (same existing flag, reused). `healCollision: false` — decided: an id-collision
  renumber mutates the PR's own item id mid-review; out of scope for a refresh whose only job is advancing the
  base (a collision on a review-held PR is left to the existing pre-check heal path, which already runs
  independently over the label-scoped listing).
- **On `action==='rebased'`:** log one line (`↻ ${repoTag(repo)}${num} freshness-refreshed onto main (was
  review-held + BEHIND) → ${newCommit.slice(0,9)}`); **never** sets any `decision` field (there is no verdict
  object for this pass — it never joins `verdicts`/`toMerge`), **never** calls `gh pr edit --add-label` /
  `--remove-label` on any label. Under `DRY_RUN`, annotate only (`would freshness-refresh PR #N`), no push —
  mirrors the existing rebase-drop `DRY_RUN` branch (`we:scripts/merge-ai-prs.mjs:3027-3030`).
- **On `action==='current'`:** no-op (already on `main`, e.g. re-run mid-interval) — same idempotency
  short-circuit `rebaseDropManifest` already gives every other caller (`we:scripts/lib/rebase-drop-manifest.mjs:168-186`).
- **On `action==='skip'`/`'error'`:** logged, left for `/finish` — no escalation (decided above).
- **Not touched:** `classifyPr`, `isRebaseDropCandidate`, the existing `REBASE_DROP` merge-cascade loop, any
  `verdicts`/`toMerge` computation, `we:scripts/conveyor/tick-core.mjs` (CI-heal stays conveyor-scoped, out of
  this card's scope per finding 3).

## Tasks

1. Add `isFreshnessRefreshTarget(pr)` to `we:scripts/merge-ai-prs.mjs`, beside `isRebaseDropCandidate`. Unit
   tests: BEHIND + `review:human` → true; BEHIND + `review:pending` → true; BEHIND + `review:changes` → true;
   BEHIND + `review:accepted` (no other hold label) → false; BEHIND + no review label → false; CLEAN/UNSTABLE +
   `review:human` → false; DIRTY/CONFLICTING (not BEHIND) + `review:human` → false (mirrors `isRebaseDropCandidate`'s
   own BEHIND-only scoping for the refresh case — DIRTY/CONFLICTING held PRs are a real-conflict case, not a
   pure-staleness one, and stay left to `/finish`).
2. Add the `FRESHNESS_REFRESH` flag (`flags['no-freshness-refresh']`) and the new unlabelled listing + pass to
   `sweepOnce`, gated by `FRESHNESS_REFRESH && !onlyPr`, per the Interfaces section above. Reuse
   `rebaseDropManifest`/`rebaseDropContent`/`gitRunner`/`siblingCloneDir`/`isLocalRepo`/`repoFlag`/
   `mapWithConcurrency` — add no new git plumbing.
3. `DRY_RUN` annotation branch (would-refresh line, no push) and the `↻ ... freshness-refreshed` live log line.
4. **Regression fixture reproducing #957's shape** (finding 7): a PR object with `mergeStateStatus: 'BEHIND'`,
   `labels: ['review:human']` (or `review:pending`, matching #957's actual state at the time), no
   `ready-to-merge`. Assert: (a) `isFreshnessRefreshTarget` is true on it; (b) it is ABSENT from the main
   `--label ready-to-merge` listing's classify pass (proving finding 4's "invisible to the default drain" claim
   as a live assertion, not just prose); (c) the new pass calls `rebaseDropManifest` with its `headRefName` and,
   on a mocked `'rebased'` result, posts the log line and does NOT set any `decision` or call any label-edit
   `gh` invocation (mock `execFileP`/`run` and assert the call list).
5. **Regression fixture for acceptance criterion 3** (finding 2): a `classifyPr` unit test asserting a BEHIND PR
   with `ready-to-merge` present still gets `decision: 'skip'` — this test likely already exists in spirit at
   `we:scripts/__tests__/merge-ai-prs.test.mjs:71-73`; extend it (or add a sibling case) so it explicitly
   constructs the PR WITH `ready-to-merge` present, closing the literal wording of the card's own acceptance
   criterion rather than relying on the pre-existing, slightly narrower case.
6. Update the `/merge`/`/drain` skill docs (`we:.claude/skills/merge/SKILL.md` if the freshness pass changes
   observable sweep output; check whether it needs a line) and the `--no-freshness-refresh` flag's CLI usage
   comment block (mirrors the existing `--no-rebase-drop` documentation, `we:scripts/merge-ai-prs.mjs:60-83`).
7. `npm run check:standards` (0 errors) and the full `vitest` suite, clean.

## Done when

1. `isFreshnessRefreshTarget(pr)` returns `true` iff `pr.mergeStateStatus === 'BEHIND'` AND
   `hasUnclearedReviewLabel(pr.labels, {allowPending:false})` is true; all seven branches in Task 1 are unit-tested.
2. A fixture reproducing #957's shape (review-held + BEHIND, no `ready-to-merge`) is invisible to the default
   `--label ready-to-merge` listing/classify pass, AND is picked up by the new unlabelled freshness listing —
   both asserted, not just one.
3. On that fixture, with `gitRunner`/`rebaseDropManifest` mocked to return `{action:'rebased', newCommit:'abc123…'}`,
   the new pass calls `rebaseDropManifest` with `{laneRef: pr.headRefName, base:'origin/main', ...}` and the
   resulting call trace contains **zero** `decision` mutations and **zero** `gh pr edit --add-label`/
   `--remove-label` calls touching any `review:*` label.
4. `--no-freshness-refresh` suppresses both the new listing call and the pass entirely (asserted: zero `gh pr
   list` calls attributable to it) when passed; the pass runs by default when omitted.
5. Passing `--only=<N>` (or `--couple`/`--pr`) suppresses the new listing call entirely — asserted as a negative
   case (fast-drain path adds zero extra `gh` calls).
6. `--dry-run` on a freshness-refresh target logs the "would freshness-refresh" annotation and makes no `git
   push` / no `gh` mutation call.
7. A `classifyPr` test explicitly constructs a BEHIND PR carrying `ready-to-merge` and asserts `decision ===
   'skip'` (Task 5) — closing acceptance criterion 3's literal wording with a fixture, not inference from an
   adjacent test.
8. `npm run check:standards` is 0 errors; the full `vitest` suite is green.

## Delivery shape

**One piece.** The new predicate and the new pass are additive — no existing function signature changes, no
existing control flow in `classifyPr`/`isRebaseDropCandidate`/the merge cascade is touched (Decided design,
fork 1). There is no incremental slice smaller than "predicate + pass + its own tests" that is independently
meaningful: the predicate alone does nothing without the pass wired to act on it, and the pass without the
predicate has nothing to filter on. Ships behind `--no-freshness-refresh` (on by default, mirroring every other
rebase-drop-family flag in this file) as the rollback lever if the standing daemon needs it disabled without a
code revert — not a phased rollout, just a cheap kill switch consistent with the file's existing convention.

## Filed separately

Findings 5 and 8 above surfaced conditions worth a light, independent follow-up but are explicitly NOT this
card's scope: #2820's backlog card frontmatter (`status: active`) is stale against its own already-shipped,
tested code — a bookkeeping-only correction, not a design item, not filed here (a one-line `resolve` candidate
for whoever owns backlog hygiene). Finding 8 (the `!REVIEW_ESCALATION` backstop) was traced to a safe
conclusion and needs no filing at all — noted in-card only so a future reader doesn't re-derive it from scratch.
