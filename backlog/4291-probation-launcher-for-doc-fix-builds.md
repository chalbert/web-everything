---
bornAs: xhok7dn
kind: story
size: 3
status: resolved
scope: ["we:scripts/lib/probation-launcher.mjs", "we:scripts/operations/dispatch-providers/probation-worker.mjs"]
dateOpened: "2026-09-27"
dateStarted: "2026-09-28"
dateResolved: "2026-09-28"
preparedDate: "2026-09-28"
preparedAgainstSha: "7653faa8cb56432c04228ae554bd20c1ef5d12bd"
tags: []
---

# Probation launcher for doc-fix builds

PR #2819 opened the model-probation gate for doc-fix and ci-heal picks. ci-heal already has a real launcher (we:scripts/lib/probation-launcher.mjs, we:scripts/operations/probation-heal-run.mjs) that runs the picked worker synchronously via we:scripts/codex-direct-task.mjs / we:scripts/gemini-direct-task.mjs and posts a scorecard row with the #2815 executor field. doc-fix picks are only recorded today -- Claude still runs every doc-fix build regardless of the pick. Build the doc-fix launcher so a non-critical doc-fix build actually dispatches to its picked provider (Antigravity-Claude or Codex): extend we:scripts/lib/probation-launcher.mjs and add a doc-fix worker under we:scripts/operations/dispatch-providers/probation-worker.mjs, synchronous via we:scripts/codex-direct-task.mjs / we:scripts/gemini-direct-task.mjs, with the same size cap and executor field the ci-heal launcher already writes. Builds on PR #2819. Why: the operator wants other models to earn more of the real work over time as trial data supports it; promotion out of probation stays an explicit human decision, never automatic.

## Plan (fast-lane prepare, agy-launcher-probation)

**Scope.** `we:scripts/lib/probation-launcher.mjs` (two new pure helpers for a doc-fix BUILD —
`buildDocFixTask`/`buildDocFixCommitMessage` — mirroring the landed ci-heal pair) +
`we:scripts/operations/dispatch-providers/probation-worker.mjs` (a `build`+`doc-fix` row in a new
kind→taskType/runScript table, taskType-gated `probationLaunchDecision`, kind-branching argv). A third file is
required to make either of those do anything: `we:scripts/operations/probation-build-run.mjs`, the doc-fix
sibling of the already-landed `we:scripts/operations/probation-heal-run.mjs` — not in this item's predicted
`scope:` (auto-prepare could not have guessed a not-yet-existing sibling script's name), added the same way
`we:scripts/operations/probation-heal-run.mjs` itself was added under its own item.

**Design.** A `build` launch whose router-picked `probationWorker.taskType === 'doc-fix'` is claimed, built via
the worker's own synchronous launcher (`we:scripts/codex-direct-task.mjs`/`we:scripts/gemini-direct-task.mjs`,
exactly as ci-heal already uses), bounded to `PROVEN_TASK_ENVELOPES['doc-fix']` (2 files/100 LOC — already
defined, reused verbatim, passed explicitly rather than relying on the ci-heal default), resolved + committed
in ONE commit, gated with `we:scripts/verify-lane.mjs`'s marker-writing mode (needed for
`open-pr --requireVerified=true`), then opened PARKED `review:pending` — never `ready-to-merge` — because a
probation launch always "owes a run rating" (`selectProbationWorker`'s own docblock): promotion out of
probation is an explicit human decision, never automatic.

**Risks (a read-only Codex plan review surfaced #2 and #3 below; folded in before building):**
1. *An unreviewed probation PR lands unattended.* Solved by always parking `review:pending`.
2. *Releasing a claim after a `git reset --hard` already reverted its status trips the `release`-only-from-
   `active`/`preparing` guard* (and, separately, calling `release` against a file that is already `resolved`
   inside a just-made commit trips it too). FIX: never call `we:scripts/backlog.mjs release` at all. Nothing
   is ever pushed on a failure path, so a plain `git reset --hard` back to the pre-claim HEAD undoes the claim
   along with everything after it (including an already-made commit) in one step — the canonical item was
   never anything but `open` throughout a failed attempt, because nothing left the lane.
3. *The claim's own frontmatter edit inflates the worker's measured diff/envelope, or duplicates a commit
   path.* FIX: the item's own file is excluded from every diff measurement (`healDiffWithinEnvelope`'s input),
   on top of the pre-existing-untracked exclusion ci-heal already uses, and added to the final commit
   explicitly and separately, exactly once.
4. *An unexpected thrown error (not an explicit `ok:false`) strands a claim.* FIX: every post-claim step runs
   inside one `try`/`catch` that resets the lane on any exception, not only the explicit failure checks.
5. *Scope creep into the full `deliverItem`/Claude-delivery pipeline.* Deliberately NOT reused — this uses the
   SAME two one-shot synchronous launchers ci-heal uses, kept to the small, mechanical arc
   `we:scripts/operations/probation-heal-run.mjs` already models.

**Test plan.** Unit tests only (no real model, no real git/gh) — mirrors
`we:scripts/operations/__tests__/probation-heal-run.test.mjs`'s fake-io style: the two new pure helpers + the
doc-fix envelope/scorecard-row shape (`we:scripts/lib/__tests__/probation-launcher.test.mjs`); the
`build`+`doc-fix` branch of `probationLaunchDecision`/`probationWorkerDetachedProvider` (extends
`we:scripts/operations/__tests__/probation-heal-run.test.mjs`); the whole build arc over a fake `io`
(`we:scripts/operations/__tests__/probation-build-run.test.mjs`, new) — happy path plus every failure branch
(no lane, no item file, claim refused, no diff, envelope exceeded, resolve refused, gate red, PR-open failure
both infra and otherwise, an unexpected thrown error), asserting exactly which of `discardChanges`/
`appendScorecard` each one triggers.

**Tasks.** (1) extend `we:scripts/lib/probation-launcher.mjs`; (2) add
`we:scripts/operations/probation-build-run.mjs` + its `realIo`; (3) extend
`we:scripts/operations/dispatch-providers/probation-worker.mjs`; (4) tests for all three; (5) gate green,
`/converge`, PR parked `review:pending`.

**Proof plan.** Live proof in the PR body: a before/after of
`probationLaunchDecision({launchKind:'build', repo:'we', probationWorker:{..., taskType:'doc-fix'}}, 'on').launch`
— `false` on `main` (no `build` row exists yet) and `true` after this change — plus the new
`we:scripts/operations/__tests__/probation-build-run.test.mjs` suite (0 → N passing) as the executable
Done-when proof.

**Convergence history (`/converge`, 7 rounds).** A read-only Codex plan review (fast-lane prepare, above) plus
seven `/converge` rounds fixed real gaps beyond the plan: excluding the item's own claim/resolve frontmatter
edit from the worker's measured diff (not just the commit list); a live self-check that `claim` never commits
or writes an unexpected frontmatter field (`frontmatterTamperedBeyondClaim`), refusing before any worker runs
if it ever does; a `run.ok` check so a crashed/timed-out worker is never treated as a clean build; a single
try/catch spanning the WHOLE post-claim arc (not just part of it) so an unexpected error always resets the
lane and attributes its scorecard row correctly; and — after two rounds of trying to DENYLIST specific
dangerous paths (statute docs, then `we:CLAUDE.md`/`we:AGENTS.md`, then `we:GEMINI.md`) — replacing the
denylist with an ALLOWLIST: the worker may touch only the item's own declared `scope:`, and an item with no
declared scope is refused outright before any worker runs. Two follow-ups were filed rather than half-done in
this item: `we:backlog/4402-*.md` (wire or drop the two run scripts' dead `--dry-run` flag) and
`we:backlog/4404-*.md` (share their duplicated git-helper io). A third,
`we:backlog/4401-*.md` (harden both run scripts against a worker planting a git hook or gitignored
config), is a real, pre-existing risk the ALREADY-LANDED ci-heal launcher shares identically — accepted for
ci-heal on 2026-09-27, not introduced or worsened by this item, and not fixable by a doc-fix-only patch.

## Done when

1. **Executable** — `probationLaunchDecision({ launchKind: 'build', repo: 'we', probationWorker: { id: 'codex', provider: 'codex', model: 'x', executor: 'codex', taskType: 'doc-fix' } }, 'on').launch` is `false` before this item lands (no `build` row exists) and `true` after.
2. A `build` launch whose `probationWorker.taskType` is `doc-fix` spawns `we:scripts/operations/probation-build-run.mjs`, keyed to the item number (`--num=`), never a PR.
3. `we:scripts/operations/probation-build-run.mjs`'s arc refuses outright if the item declares no `scope:`; otherwise it claims the item, runs the picked worker synchronously via its own launcher, verifies every path it touched is both a documentation path AND within the item's own declared scope, and that the item's own card is untouched (body and frontmatter alike, beyond the claim's own stamp), bounds the diff to `PROVEN_TASK_ENVELOPES['doc-fix']`, resolves + commits in one commit, gates the final HEAD, and opens the PR parked `review:pending`. Every PRE-open-PR failure undoes everything (claim included) via a lane reset, so nothing is left stranded `active`; a failure AFTER the gate is green (PR-open itself fails) deliberately leaves the built, gate-green commit in the lane instead, for a human to pick up.
4. A `ci-heal`-taskType worker offered under a `build` request (or vice versa) is never launched, only recorded.
