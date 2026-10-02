---
bornAs: xizojf8
kind: story
size: 3
status: open
scope: ["we:skills-src/conveyor/build-dispatch-daemon.mjs", "we:scripts/pr-land.mjs", "we:scripts/operations/__tests__/build-pr-authorship.test.mjs", "we:scripts/operations/deliver-item-wrapper.mjs", "we:skills-src/conveyor/__tests__/build-dispatch-daemon.test.mjs", "we:scripts/__tests__/pr-land.test.mjs", "we:scripts/operations/__tests__/deliver-item-wrapper.test.mjs", "we:skills-src/conveyor/__tests__/build-red-draft-recovery.test.mjs"]
dateOpened: "2026-09-30"
preparedDate: "2026-10-02"
preparedAgainstSha: "9c7c11b5d2591989598af099594d500aa24ffbc6"
tags: []
---

# File the prevention guard(s) owed by chalbert/web-everything#3117's independent review

Filed mechanically by the unattended review loop (#2749) — every finding below reduced chalbert/web-everything#3117's review (reviewed head `c962f25c1b839f9e743ed7e7a98431a87d5743eb`) to prevention-outstanding by naming a guard neither captured nor filed:

1. `we:skills-src/conveyor/build-dispatch-daemon.mjs:1036` — Add a test in `we:skills-src/conveyor/__tests__/build-red-draft-recovery.test.mjs` where the receipt handle is dead and the current run-store entry with the same key has a live handle, and assert no dispatch. A comment stating that receipts are immutable evidence and liveness is always read live would also help.
2. `we:scripts/pr-land.mjs:888` — Add a `resumeOpen` or pr-land test that resumes with a `builderContext` whose run has been pruned. Decide whether that should degrade to opening without a receipt or fail loudly, and have the infra store hold the run alive. A lint that flags prune-retention sets against other stores' foreign keys would be a further guard.
3. `we:skills-src/conveyor/build-dispatch-daemon.mjs:1036` — In `backfillAuthorship`, require the open PR's `headRefName` to satisfy `prDeliversNum` for `entry.payload.num`. Add a test with a matching PR number but a non-matching branch. A review lens on 'authorship evidence must be two-factor' would also catch it.
4. `we:scripts/operations/__tests__/build-pr-authorship.test.mjs:36` — Add table-driven negatives to `we:scripts/operations/__tests__/build-pr-authorship.test.mjs`, one per skip clause: foreign scope, foreign URL, non-build launchKind, and a missing `num`.
5. `we:scripts/pr-land.mjs:919` — Add a deterministic integration test that simulates successful PR creation followed by failed checkpointing, then retries against the existing PR and requires a durable receipt before wrapper settlement.
6. `we:scripts/operations/deliver-item-wrapper.mjs` — A cross-domain integration test for deliverItem covering both build and fix dispatch flows, asserting non-builder dispatches can still publish.

## Done when

1. **Executable** — `npx vitest run` over the four test files named in the Test plan (`we:skills-src/conveyor/__tests__/build-red-draft-recovery.test.mjs`, `we:scripts/operations/__tests__/build-pr-authorship.test.mjs`, `we:scripts/__tests__/pr-land.test.mjs`, `we:scripts/operations/__tests__/deliver-item-wrapper.test.mjs`) fails before this item lands (the three RED cases in the Test plan) and passes after.

## Progress

- Premise check (2026-10-02, origin/main `9c7c11b5d`): none of the six guards exist yet. `we:skills-src/conveyor/__tests__/build-red-draft-recovery.test.mjs` has no dead-receipt/live-current-entry case; `we:scripts/__tests__/pr-land.test.mjs` has no `builderContext`/pruned-run case; `we:scripts/operations/__tests__/build-pr-authorship.test.mjs` has one end-to-end test only; `we:scripts/operations/deliver-item-wrapper.mjs:2442` sets `WE_BUILD_PR_CONTEXT` whenever `runId && effectKey`, and `producerBuildContext` (`we:scripts/operations/build-pr-authorship.mjs:43-48`) throws `unproven builder PR context` for any non-build entry. Review (adversarial subagent) found item 6's premise unproven: `openPr` (`we:scripts/operations/deliver-item-wrapper.mjs:2417`) is called only from the builder path (line 574, which already throws without `runId`/`effectKey`); fix and CI-heal dispatches do not reach it. So item 6 is a pinning test, not a code change. Citations `we:skills-src/conveyor/build-dispatch-daemon.mjs:1036` and `we:scripts/pr-land.mjs:888` / `we:scripts/pr-land.mjs:919` have drifted: the receipt/draft-recovery loop is now at `we:skills-src/conveyor/build-dispatch-daemon.mjs:1187-1200`, `producerBuildContext()` at `we:scripts/pr-land.mjs:895`, create+`checkpointBuildPr` at `we:scripts/pr-land.mjs:926`. Goal and scope unchanged.

## Design

Six guards, each a regression test plus the minimal code it forces.

1. **Receipts are immutable, liveness is read live** (`we:skills-src/conveyor/build-dispatch-daemon.mjs:1192`): the loop gates on `isLive(row.entry.handle)` from the *receipt's snapshot* entry, while `currentEntry` (line 1194) is the live run-store entry, read only for `lastSeenLiveAt`. Make the gate require the receipt handle dead AND, when `currentEntry?.handle` exists, not live; a missing `currentEntry` (pruned run) falls back to the receipt handle alone (tested). Add the immutability/live-read comment.
2. **Pruned run on resume** (`producerBuildContext` at `we:scripts/operations/build-pr-authorship.mjs:43`, called from `we:scripts/pr-land.mjs:895`): a `builderContext` naming a pruned run throws `unproven`. SETTLED: fail loudly (current behaviour kept) — a PR must never open without authorship evidence for a build dispatch. The test pins it. Retention: `we:scripts/conveyor/infra-blocked.mjs` stores `builderContext` as an opaque JSON string (lines ~207, 233-257) and `pruneTerminalRuns` (`we:scripts/operations/run-store.mjs:190`) is age-based over terminal runs. Must: make the prune skip any run id referenced by a pending infra-blocked record's `builderContext` (parse `runId` from it), with a test. A generic lint is a Follow-up.
3. **Two-factor authorship** (`backfillAuthorship`, `we:scripts/operations/build-pr-authorship.mjs:57`, number-only match at lines 63-67): require `prDeliversNum(open, entry.payload.num)` (exported from `we:scripts/conveyor/build-dispatch-policy.mjs:126`; import it) in addition to the PR number match.
4. **Skip-clause negatives**: table-driven cases in `we:scripts/operations/__tests__/build-pr-authorship.test.mjs` for foreign scope, foreign URL, non-build `launchKind`, missing `num`.
5. **Create-then-checkpoint-fail retry** (create at `we:scripts/pr-land.mjs:924`, checkpoint at 926): contract — if checkpointing throws after create, pr-land exits non-zero (PR stays open, `checkpointBuildPr` error surfaces); the retry finds the existing PR (`listOpenByHead`) and must call `checkpointBuildPr` before returning success. Today the existing-PR `else if` branch never checkpoints, so add an idempotent checkpoint there (`writeAuthorship` tolerates same-run rewrites). The existing `we:scripts/__tests__/pr-land.test.mjs` is mostly source-grep; the test needs a seam: export a small `landPr({forge, checkpoint, buildContext, ...})` core (or inject `forge`/`checkpoint`) driven by a fake forge.
6. **Non-builder dispatch can publish**: pinning only. `openPr` (`we:scripts/operations/deliver-item-wrapper.mjs:2417`) is reached only from the builder path, so non-build dispatches never set `WE_BUILD_PR_CONTEXT`. Add a test asserting `openPr` sets the env only with `runId`+`effectKey` and that the fix/CI-heal dispatch paths (`dispatchCiHeal`, reconcile-fix) never reference `openPr`/`deliverItem`. No production change.

## MVP

Musts: code changes for 1 (gate), 2 (prune skips infra-blocked run ids), 3 (two-factor), 5 (existing-PR checkpoint + test seam), each with a test. Pinning-only regression tests (already green today, not RED proofs): 4 skip-clause table, 6 wrapper pin, and the item-2 fail-loudly pin. Out of scope: the prune-retention lint and the two-factor review lens (Follow-ups).

## Test plan

- `we:skills-src/conveyor/__tests__/build-red-draft-recovery.test.mjs`: dead receipt handle + live current entry ⇒ no dispatch. RED today: the gate reads only the snapshot handle.
- `we:scripts/operations/__tests__/build-pr-authorship.test.mjs` (or `we:scripts/operations/__tests__/run-store.test.mjs`): a run referenced by a pending infra-blocked `builderContext` survives `pruneTerminalRuns` with `maxAgeMs: 0`. RED today: pruned by age. Plus a pin: `producerBuildContext` on a pruned run throws `unproven` (green today).
- Same dead-receipt test also covers a missing `currentEntry` (pruned run): falls back to the receipt handle.
- `we:scripts/operations/__tests__/build-pr-authorship.test.mjs`: matching PR number, non-matching branch ⇒ `[]` (RED today: number-only match). Table of four skip-clause negatives (pass today; guard regressions).
- `we:scripts/__tests__/pr-land.test.mjs` (via the new seam, fake forge): create succeeds, checkpoint throws ⇒ non-zero; retry ⇒ `checkpointBuildPr` called and receipt written. RED today: the existing-PR path never checkpoints.
- `we:scripts/operations/__tests__/deliver-item-wrapper.test.mjs`: pin that env context is set only with `runId`+`effectKey` and fix/CI-heal paths never reach `openPr`. Green today (pin, not RED).

## Proof plan

1. Before: with the new tests written first, run the Done-when `npx vitest run` command on unmodified code and save the output in the PR body (expected: the dead-receipt, branch-mismatch, prune-retention and retry-checkpoint cases fail). After: same command green.
2. Live probe: `node we:skills-src/conveyor/build-dispatch-daemon.mjs --dry-run` before and after on current open PRs; the draft-recovery candidate list must be identical (no regression), and a crafted fixture (live current handle, dead receipt handle) must yield zero candidates after vs one before.

## Follow-ups

- Lint flagging prune-retention sets against other stores' foreign keys.
- Review lens: "authorship evidence must be two-factor".
