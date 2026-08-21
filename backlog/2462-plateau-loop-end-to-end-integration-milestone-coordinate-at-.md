---
bornAs: x05fzfp
kind: task
parent: "2445"
status: open
priority: low
dateOpened: "2026-07-12"
tags: []
---

# Plateau Loop: end-to-end integration milestone — coordinate at least two constellation projects

The DoD acceptance gate: a locally-running Loop instance drives backlog→lane→PR→review→drain end-to-end for at least two projects (build sessions spawned, reviews judged, drain sole writer). Emergent milestone over registry + runner + console.

## What this measures against — the pieces that already exist (verified 2026-08-21)

This is a **measurement task**, not a build. It has no code of its own; it observes whether the parts its
parent epic #2445 filed have converged. Each half of the DoD sentence already has a concrete home, and the
criteria below are written against those homes rather than against a hypothetical Loop:

- **"at least two projects"** — the repo registry is `IMPL_REPOS` in `plateau:vite.config.mts:627-630`, which
  today maps exactly two: `plateau-app` (`chalbert/plateau-app`) and `webeverything`
  (`chalbert/web-everything`). Two entries in a map is not two projects *coordinated*; the criteria must
  observe a real run per repo.
- **"build sessions spawned"** — `AgentRunner` (`plateau:src/build-runner/runner.ts`) plus `runBuildFlow`
  (`plateau:src/build-runner/build-action.ts`), driven by `POST /api/backlog/build`
  (`plateau:vite.config.mts:875+`) under a WIP=1 slot (`BuildRunStore.beginStart`).
- **the observable record of a run** — `BuildRunDTO` (`plateau:src/build-runner/build-action.ts:42-57`):
  `{ id, num, itemId, title, repo, status, pr?, error?, sessionId?, note? }`, readable at
  `GET /api/backlog/build/:runId`. `status: 'opened'` **with** a `pr` is the machine-readable "this run
  reached a PR" signal, and `repo` is the axis this milestone counts on.
- **"drain sole writer"** — the resident drain daemon at `plateau:tools/drain-daemon/`
  (`plateau:tools/drain-daemon/daemon.mjs`, `plateau:tools/drain-daemon/lib.mjs`,
  `plateau:tools/drain-daemon/cli.mjs`), contending on the machine-global serial-writer lock in
  `we:scripts/readiness/drain-lock.mjs`.

**Sequencing.** This card sits downstream of the epic's registry / runner / console children and is
`priority: low` by the same operator defer that governs the rest of the deferred Plateau Loop line. Do not
claim it as a build; claim it when a Loop instance is actually running and the observation can be made.

## Done when

- **No tier-1 criterion is possible, and the reason is structural.** This item's subject is a *live
  multi-run, multi-repo operating episode* — agents spawned, PRs opened, reviews judged, a drain landing as
  sole writer. There is no command whose green/red is that episode; a test that stubbed the runner and the
  drain would assert the stubs, not the milestone. The honest proof is a recorded observation over real run
  records, so the criteria below are tier-2 (state readable by one cheap request) and tier-3.

1. **Observable — two repos, two real runs.** For at least two distinct `repo` values in `IMPL_REPOS`, a
   build-run record exists with `status: 'opened'` and a populated `pr: { number, url }`. Read each via
   `GET /api/backlog/build/:runId` (or the run store's listing); one `curl` per run id answers it. A run that
   ended `failed` or `stopped` does not count, and two runs on the same `repo` do not count.
2. **Observable — the agent actually ran, it was not simulated.** Each of those two run records carries a
   `sessionId` (stamped from the runner's `system/init` event) and its PR exists on the corresponding
   `ghRepo`. `sessionId` absent means no agent session was observed, whatever the status says.
3. **Observable — the drain was the writer.** Each of the two PRs was merged by the drain path, not by a
   hand `gh pr merge`: the drain daemon's own run log records the land, and the merge commit is the drain's.
   Check the daemon log for the two PR numbers.
4. **Assertable — reviews were judged, not skipped.** Each of the two PRs carries a review verdict from the
   panel (a posted panel comment and a `review:*` label transition), rather than landing on an
   escalation-bypass valve such as `--no-review-escalation`. Read the two PRs' comment/label history.
5. **Assertable — the observation is recorded on the item, with dates and identifiers.** This card is closed
   by *writing down* what was observed — the two run ids, their repos, their PR urls, the daemon log window —
   not by a claim that it happened. A future reader must be able to re-open the same evidence. Without this,
   criteria 1–4 leave no trace once the dev server restarts and the in-memory `BuildRunStore` is gone.

## Independent review — 2026-08-21

Confidence: **High**

**Risks assessed** (per we:backlog/3103-*.md's taxonomy):

- **premise** (addressed; strategy: verify by mutation or reversion BEFORE building) — Every concrete citation (we:scripts/readiness/drain-lock.mjs, plateau:vite.config.mts:627-630 and :875, plateau:src/build-runner/runner.ts, plateau:src/build-runner/build-action.ts:42-57, plateau:tools/drain-daemon/{daemon,lib,cli}.mjs, we:scripts/lib/review-escalation.mjs's review:* labels) was independently re-verified against the live repos and matched exactly, including line numbers.
- **decorative-guard** (addressed; strategy: mutate the guarded line; require a NAMED test to redden) — The five done-when criteria are multi-signal (PR status+pr object, sessionId from system/init, drain daemon's own mergedPrs log line, review:* label transition, and a written record) — hard to satisfy without genuine cross-repo agent+review+drain activity; plateau:tools/drain-daemon/lib.mjs confirms mergedPrs is a real observable field, so criterion 3 is not aspirational.
- **legibility** (addressed; strategy: assert the failure SURFACES, not just that it occurs) — Criterion 5 explicitly requires writing the observation (run ids, repos, PR urls, daemon log window) onto the item because the in-memory BuildRunStore and dev-server state vanish on restart, otherwise the milestone would leave no trace.
- **unmeasured-impact** (addressed; strategy: measure the constraint before sizing) — Nothing is blockedBy #2462 (checked backlog/*.md); the card is honest that it is a downstream DoD/measurement gate for epic #2445, not work whose sizing needs justifying, and correctly avoids claiming it unblocks anything.

**Corrections recommended:**

- none — the preparation held up as written.

_Recorded through the declared `review-prep` operation._
