---
bornAs: x76ggt5
kind: story
size: 3
parent: "3443"
status: resolved
blockedBy: ["3853", "3854"]
scope: ["we:scripts/conveyor/session-verdicts.mjs", "we:scripts/conveyor/session-verdicts-io.mjs", "we:scripts/conveyor/__tests__/session-verdicts.test.mjs", "we:scripts/conveyor/__tests__/session-verdicts-io.test.mjs"]
dateOpened: "2026-09-21"
dateStarted: "2026-09-24"
dateResolved: "2026-09-24"
graduatedTo: main
tags: []
---

# Graduate we:scripts/conveyor/session-verdicts.mjs and we:scripts/conveyor/session-verdicts-io.mjs (new modules) from lane/mechanical-dispatcher to main

Graduation slice 3 of 6 for the land-advance operation (step 3 of the reaper chain in #3443). Ports two new modules missing from main: we:scripts/conveyor/session-verdicts.mjs (202 lines, the pure per-session verdict classifier) and we:scripts/conveyor/session-verdicts-io.mjs (132), with their tests. Needs the tools and core slices, because the verdicts test imports both. The test's last describe block waits for the reaper slice, since main's reaper lacks classifySessionReapWithVerdict. The notes below give the details and one grammar check to run on main.

## Done when

1. **Executable** — `npx vitest run we:scripts/conveyor/__tests__/session-verdicts.test.mjs we:scripts/conveyor/__tests__/session-verdicts-io.test.mjs` passes ON `main` after the port, with the verdicts test minus its last describe block ('the reaper plan, through the classifier') and minus the `classifySessionReapWithVerdict` import, and `git diff origin/main...origin/lane/mechanical-dispatcher -- we:scripts/conveyor/session-verdicts.mjs we:scripts/conveyor/session-verdicts-io.mjs we:scripts/conveyor/__tests__/session-verdicts-io.test.mjs` reports nothing. The only diff left on the verdicts test file is that one described block, and the PR names it as the part that moves to the #3443 reaper slice.
2. `npm run check:standards` reports 0 errors.
3. Landed as its own PR through the normal lane → `we:scripts/verify-lane.mjs` → `we:scripts/operations/run.mjs open-pr --mode=land` pipeline, never a direct push, and never before both `blockedBy` slices above.

## Order and port notes

- Part of the six-slice land-advance graduation under #3443. **CORRECTION to the inventory:** it lists only the tools slice as a prerequisite. The verdicts test also imports `buildEscalationPacket` (land-advance-escalations) and `OWED_ACTIONS` (land-advance), both in the core slice, so this slice is blockedBy the tools slice and the core slice. It does NOT need the watchdog or ci-heal slices. Order across the six: tools (2) → land-advance core (5) → this slice (3); watchdog (1) and ci-heal (4) independent; IO and wiring (6) last, and it needs this slice because `we:scripts/operations/land-advance-io.mjs` imports both session-verdicts modules.
- **CORRECTION to the inventory: the test file cannot travel whole.** `we:scripts/conveyor/__tests__/session-verdicts.test.mjs` imports `classifySessionReapWithVerdict` from `we:scripts/conveyor/session-reaper.mjs`. `main` does not export it: it belongs to the branch-only reaper change, which is its own #3443 slice, and that slice must also hand-port onto `main`'s reaper (`main` moved to `parseSessionSlug` and a `repo` field). So the six tests in the last describe block wait for the reaper slice. That is a scoping fact read off the imports, not a design choice: nothing about the ruling changes, and nothing here decides the reaper slice's own forks.
- Its grammar-pin test compares `dispatchGrammar` with `main`'s own `sessionTarget`, which now parses through `parseSessionSlug`. Run it on `main` first. If it disagrees for a name, fix the pin's expectation only if `main`'s grammar is the intended one; otherwise stop and record it, because the reaper slice already owns that reconciliation.
- Under the #3804 statute (`we:docs/agent/platform-decisions.md#poc-branch-mechanical-sync`) a graduation slice ports a file main has moved AS A DIFF and is exempt from the drift hold. Shared modules that exist on `main` with a different body and that this slice imports from: `we:scripts/operations/completion-record.mjs` (one named import), `we:scripts/lib/constellation-repos.mjs` (one), and, in the test, `we:scripts/conveyor/session-reaper.mjs` and `we:scripts/conveyor/reconcile-core.mjs`. Do NOT overwrite any with the branch copy. `we:scripts/operations/completion-store.mjs` is identical on both sides.

## Finding (2026-09-21) — #3721's reaper build touched this slice's own session-verdicts module, folded in here rather than duplicated

#3721's reaper rewrite (prototype commit `b50d8f125`) is NOT a duplicate of this slice: its own family (`we:scripts/conveyor/session-reap-plan.mjs`, `we:scripts/conveyor/session-reap-stop.mjs`, `we:scripts/conveyor/session-reap-evidence.mjs`, `we:scripts/conveyor/session-reaper.mjs`) sits entirely outside this slice's scope and is filed separately as its own #3443 child (hash id `3862`, `blockedBy: [3855, 3856]`) — the reaper slice this card's own "Order and port notes" above already forward-references. But `b50d8f125` ALSO changed a file that IS in this slice's scope: `we:scripts/conveyor/session-verdicts.mjs` gained the grace-period rule (a session with a finished-proof is reaped only when `status` is `idle` AND its transcript has been quiet for `DEFAULT_STALL_MINUTES` — default 30 — with `--grace-minutes` overriding it), and `we:scripts/conveyor/__tests__/session-verdicts.test.mjs` grew from 59 to 72 tests (13 new: the grace edge at 29 vs 30 minutes, busy, unknown status, unknown quiet time, `waitingFor`, interactive, `started`/older-result-file cases, the `graceMinutes` knob, and a five-row planner case — see the operator's own build-3721-reaper job result for the exact list). This slice's own `git diff` (Done-when 1) already covers both files in full, so this finding changes nothing about what to port — it only explains why the diff is bigger than the original "202 lines / 132 lines" line-count estimate in this card's lead paragraph suggests, and confirms no separate card is needed for the grace-period rule itself.
