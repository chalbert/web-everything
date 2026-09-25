---
bornAs: xfzk99d
kind: story
size: 5
parent: "3443"
status: resolved
blockedBy: ["3853", "3854", "3851", "3852", "3855", "3865", "3891", "3901"]
scope: ["we:scripts/operations/land-advance-io.mjs", "we:scripts/operations/land-advance-cli.mjs", "we:scripts/operations/run.mjs", "we:scripts/operations/__tests__/http-adapter.test.mjs", "we:scripts/operations/__tests__/land-advance-io.test.mjs", "we:scripts/operations/__tests__/land-advance-io-real.test.mjs", "we:scripts/operations/__tests__/land-advance-cli.test.mjs", "we:scripts/operations/__tests__/land-advance-repair-io.test.mjs", "we:scripts/operations/__tests__/land-advance-items-io.test.mjs"]
dateOpened: "2026-09-21"
dateStarted: "2026-09-25"
dateResolved: "2026-09-25"
tags: []
---

# Graduate the land-advance IO and CLI (we:scripts/operations/land-advance-io.mjs) and its we:scripts/operations/run.mjs registration from lane/mechanical-dispatcher to main

Graduation slice 6 of 6 for the land-advance operation, the wiring slice. Ports we:scripts/operations/land-advance-io.mjs (224 lines) and we:scripts/operations/land-advance-cli.mjs (25), the LAND_ADVANCE_OP registration in we:scripts/operations/run.mjs, its read-only pin in we:scripts/operations/__tests__/http-adapter.test.mjs, and four tests. Lands after all five sibling slices and unblocks the #3443 reaper slice. Size 5, not 3: about 700 lines plus two shared files that differ on main. The notes below name every shared module to diff-merge rather than overwrite.

## Done when

1. **Executable** — `npx vitest run we:scripts/operations/__tests__/land-advance-io.test.mjs we:scripts/operations/__tests__/land-advance-io-real.test.mjs we:scripts/operations/__tests__/land-advance-cli.test.mjs we:scripts/operations/__tests__/land-advance-repair-io.test.mjs we:scripts/operations/__tests__/http-adapter.test.mjs` passes ON `main` after the port, the `land-advance` operation (run through `we:scripts/operations/run.mjs`, with `--json`) runs from a lane clone and prints a plan (plan by default; it must not execute anything without `--apply`), and `git diff origin/main...origin/lane/mechanical-dispatcher -- we:scripts/operations/land-advance-io.mjs we:scripts/operations/land-advance-cli.mjs we:scripts/operations/__tests__/land-advance-io.test.mjs we:scripts/operations/__tests__/land-advance-io-real.test.mjs we:scripts/operations/__tests__/land-advance-cli.test.mjs we:scripts/operations/__tests__/land-advance-repair-io.test.mjs` reports nothing. The diff of `we:scripts/operations/run.mjs` and `we:scripts/operations/__tests__/http-adapter.test.mjs` may show only hunks for branch-only operations (wip-agents, turn-digest, restart-runner and the like), never a land-advance hunk.
2. `npm run check:standards` reports 0 errors.
3. Landed as its own PR through the normal lane → `we:scripts/verify-lane.mjs` → `we:scripts/operations/run.mjs open-pr --mode=land` pipeline, never a direct push, and never before all five `blockedBy` slices above.

## Order and port notes

- Part of the six-slice land-advance graduation under #3443; this is the last slice. Order across the six: tools (2) → land-advance core (5) → session-verdicts (3); watchdog (1) and ci-heal (4) independent; this slice (6) after all five. It also unblocks the #3443 reaper slice, whose reaper imports `readFollowUps` from `we:scripts/operations/land-advance-io.mjs`. The branch's #3443 note lists a Fork A there (extract `readFollowUps` to a leaf first); this card does not touch that fork and ports `land-advance-io` whole, as the operator asked.
- **CORRECTION to the inventory:** `we:scripts/operations/__tests__/land-advance-repair-io.test.mjs` imports the io module and `we:scripts/operations/ci-heal-pr-dispatch.mjs`, so it belongs to this slice, not to the pure core slice. The branch's diffs of `we:scripts/operations/run.mjs` and the http-adapter test also carry other branch-only operations; port none of those.
- **Do not title the PR `#3443: …` or `WE #3443: …`.** The drain's resolve-on-land credited the epic as fully resolved from one partial-increment PR once before (#3473). Title each slice PR with its own card number.
- **What this slice does NOT deliver:** the item-pull half of #3720, the single-flight lease, the pause marker and the `Stop` hook. The prototype branch does not have them either (see the 2026-09-21 build-3720-queue-next result in the operations jobs folder), so #3720 stays open after this lands.
- Under the #3804 statute (`we:docs/agent/platform-decisions.md#poc-branch-mechanical-sync`) a graduation slice ports a file main has moved AS A DIFF and is exempt from the drift hold. Shared modules that exist on `main` with a different body and that this slice imports from: `we:scripts/operations/dispatch-lane-io.mjs`, `we:scripts/operations/dispatch-lane.mjs`, `we:scripts/operations/review-dispatch.mjs`, `we:scripts/conveyor/reconcile-fix-dispatch.mjs`, `we:scripts/conveyor/parked-pr-conflict-watch.mjs`, `we:scripts/operations/run-store.mjs`, `we:scripts/operations/effect-executor.mjs`. Every named import land-advance takes from them is already exported on `main`, checked name by name (`createFileRunStore` and `DISPATCH_EFFECT` included), so do NOT overwrite any of them with the branch copy. The files `main` has moved that this slice must edit are `we:scripts/operations/run.mjs` (add the two imports and the `LAND_ADVANCE_OP` registry line only) and `we:scripts/operations/__tests__/http-adapter.test.mjs` (add the `LAND_ADVANCE_OP` import and its read-only map entry only). If a test disagrees with a shared module's body, diff-merge only the hunk it needs and name it in the PR.
- The read-only pin only holds if `we:scripts/operations/land-advance.mjs` (the core slice) still reaches nothing that can act. All the effects live behind `we:scripts/operations/land-advance-io.mjs`. Run the http-adapter test before anything else.

## Step 0 re-plan (2026-09-22)

Added blockers #3865 and 3891: `we:scripts/operations/land-advance-io.mjs` imports `we:scripts/operations/land-advance-items-io.mjs` (#3865), which imports `we:scripts/lib/prototype-tracker-compact.mjs` (3891).

- Moved here from #3901 (2026-09-24): `we:scripts/operations/__tests__/action-dispatch-paths.test.mjs`, which imports `we:scripts/operations/land-advance-io.mjs`, a module this slice ports.

## Graduation import check

- 2026-09-24: graduation-import-check moved `we:scripts/operations/__tests__/land-advance-items-io.test.mjs` here from #3865 — it imports a module this card owns.
- 2026-09-24: graduation-import-check added blockedBy #3901 — the moved-in `we:scripts/operations/__tests__/action-dispatch-paths.test.mjs` also imports a module #3901 owns.

## Wave finding (2026-09-25)

`we:scripts/operations/__tests__/action-dispatch-paths.test.mjs` moved back OUT of this card's scope (it was
never in this card's own Done-when executable test list, only in `scope:` for import-ownership tracking). The
graduation-import-check that moved it in only checked its FIRST-level import (this card's own
`we:scripts/operations/land-advance-io.mjs`) and missed that it also exercises the `actions`-coordination wiring
(`createActionStore`, `held`/`unavailable` refusals before any spawn) into `we:scripts/operations/dispatch-lane-io.mjs`'s
`createDispatchSinks`, `we:scripts/operations/review-dispatch.mjs`'s `dispatchReview`, and
`we:scripts/conveyor/reconcile-fix-dispatch.mjs`'s `dispatchFix`/`tryResumeFix`/`runReconcileFixDispatch` — none of
which main's current bodies of those three files implement yet. That wiring belongs to #3906
(`we:scripts/operations/dispatch-lane-io.mjs`/`we:scripts/operations/dispatch-lane.mjs`) and #3908
(`we:scripts/operations/review-dispatch.mjs`/`we:scripts/conveyor/reconcile-fix-dispatch.mjs`), both still `open`
at this writing and neither in this card's `blockedBy`. Confirmed live: every one of the test's 11 failures
traces to one of those two gaps (no `actions` param on `createDispatchSinks`, no pre-spawn identity/held check),
never to this card's own `we:scripts/operations/land-advance-io.mjs`/`we:scripts/operations/land-advance-cli.mjs`.
Whichever of #3906/#3908 lands last should re-add this test file to its own scope.

Other divergences found and fixed IN THIS SLICE while porting (main's shared modules moved past the
`lane/mechanical-dispatcher` branch snapshot after it was cut; each is a wiring fix in this card's own
`we:scripts/operations/land-advance-io.mjs` and/or its own tests, never a change to the shared module itself):

- `we:scripts/conveyor/reconcile-fix-dispatch.mjs`'s `planFixesFromReconcile` itemless-PR branch (a bounced PR
  whose head ref names no backlog item) moved to the shared `resolvePrWorkUnit` (`we:scripts/conveyor/pr-work-unit.mjs`,
  #3959/#4022) via an injected, UN-prefixed `fetchItemlessDiffPaths(pr)` — no longer the old (pre-prefixed)
  `resolveFallbackScope(pr, itemNum)` this module's branch snapshot used for that case, and the `planned` entry
  it returns no longer carries `attributionKind`/`attributionNum` (`dispatchFix`/`dispatchCiHeal` already derive
  both from `itemNum`/`pr` when absent). Added `fetchItemlessDiffPaths` as its own injected port in
  `we:scripts/operations/land-advance-io.mjs`, wired it through, and updated the two tests that plan an itemless PR.
- `we:scripts/operations/effect-executor.mjs`'s `inFlight({handle, expectedBy})` on main only ever returns those
  two fields (plus its brand symbol) — it never passes an arbitrary `dispatch` payload through, unlike the
  branch snapshot's own copy. `writeFollowUp` (`we:scripts/operations/land-advance-io.mjs`) now re-attaches
  `dispatch` after the call so the follow-up ledger it reads back still round-trips it.
- `we:scripts/conveyor/ci-heal-mark.mjs`'s `countCiHealComments` / `we:scripts/conveyor/stand-down.mjs`'s
  `countStandDownComments` now gate every marker on `isTrustedMarkerAuthor` (`we:scripts/lib/marker-authorship.mjs`,
  #3383 — landed after this module's branch snapshot: a forged marker from an untrusted login must not inflate a
  round cap or force a stand-down). No `we:scripts/operations/land-advance-io.mjs` change needed; the ported
  test's fixture comments needed `viewerDidAuthor: true` to read as trusted.
- `we:scripts/operations/dispatch-lane.mjs`'s `sessionSlugFor` → `we:scripts/lib/constellation-repos.mjs`'s
  `repoSlugTag` accepts only a known internal repo KEY (`'we'`), never a gh slug (`'chalbert/web-everything'`) —
  unlike `repoProfile`, which accepts either. `we:scripts/operations/land-advance-io.mjs`'s applier was passing
  `repo: row.slug` (the gh slug) to `dispatchReview`/`dispatchFix`/`dispatchCiHeal`; fixed to `repo: row.repo`
  (the key already carried on every PR row).
