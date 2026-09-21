---
bornAs: xmlh0rb
kind: story
size: 3
parent: "3443"
status: resolved
blockedBy: ["3482", "3483"]
scope: ["we:skills-src/conveyor/runner.mjs"]
dateOpened: "2026-09-04"
dateResolved: "2026-09-21"
graduatedTo: none
tags: []
---

# Graduate we:skills-src/conveyor/runner.mjs reconcile-pass wiring (the review step goes live) from lane/mechanical-dispatcher to main

Part 3 of 3 of the core reconcile-pass payload, and the piece #3443s own Done-when #2 explicitly held back pending #3437 -- #3437 is confirmed status:resolved and its name-based-bind fix (bind review-dispatch sessions by session name, not just cwd/HEAD-oid) is confirmed present on main in we:scripts/conveyor/reconcile-core.mjs as of 2026-09-04, so this is now unblocked. Wires the reconcile pass into we:skills-src/conveyor/runner.mjs so the runner actually dispatches review/fix continuously on its tick loop instead of only build/prepare -- this is the flip it live moment the whole epic has been building toward, and it should get the most scrutiny of any slice in this group: land it last, after the we:scripts/operations/route-pr-outcome.mjs and we:skills-src/conveyor/supervisor.mjs slices are on main, and validate with a single manual tick before trusting a live continuous loop against it (mirroring #3437s own Done-when #4 caution about not looping against an unproven fix).

## Done when

1. **Executable** — `git diff origin/main...origin/lane/mechanical-dispatcher -- we:skills-src/conveyor/runner.mjs` reports no diff not already accounted for by the sibling tick-core/alerting hardening slice, `we:skills-src/conveyor/__tests__/runner.test.mjs` passes on `main`, and a single manual tick (never a continuous loop, per #3437's own Done-when #4) confirms no double-dispatch on a re-armed PR.
2. Landed as its own PR through the normal lane → `we:scripts/verify-lane.mjs` → `we:scripts/operations/run.mjs open-pr --mode=land` pipeline, never a direct push, and never before both `blockedBy` slices above.

## Resolution (2026-09-21) — already on main, card was stale

The wiring this card names landed on `main` under a duplicate card, #3499 (`bornAs: x5v8yy9`): commit `98c6e53cc` + fix `12811c7ac`, merged via PR #1944 on 2026-09-05. `main` has since reshaped the same block for multi-repo (`f211888d0`, 2026-09-20): `makeCliMechanicalPasses` in `we:skills-src/conveyor/runner.mjs` shells `we:scripts/conveyor/reconcile-pass.mjs --json` per repo, then `we:scripts/operations/review-dispatch.mjs --pr=<N>` for each `kind:'review'` entry, `we:scripts/conveyor/review-round-tag.mjs` only on a successful dispatch, and `we:scripts/conveyor/review-status-tag.mjs` for every `selectStatusCandidates` PR. Nothing was ported; nothing is owed on the review-reconcile wiring itself.

Done-when, checked against `main` at `8a7583b8f`:

1. **Diff accounted for.** In the review-reconcile block, the branch still differs in two ways. (a) The review dispatch runs through `runQuietHeartbeating` (heartbeat the lease mid-pass) — that is #3404, which #3487 covers. (b) It expects a blocking `we:scripts/operations/review-dispatch-wrapper.mjs` (branch-only) — that is the open decision #3629. The rest of the file's diff is outside the reconcile-pass wiring: the `we:scripts/conveyor/main-ref-sync.mjs` / `we:scripts/conveyor/poc-branch-sync.mjs` passes, telemetry, action store, tick mutex, queue scope and driver mode. It belongs to #3487's own "no diff not accounted for" sweep, plus #3797 / #3639 / #3718. `we:skills-src/conveyor/__tests__/runner.test.mjs` passes on `main`: 42/42. It includes the review-reconcile block's own tests (`makeCliMechanicalPasses — the review-reconcile dispatch block …`).
   **No double-dispatch on a re-armed PR:** proven deterministically rather than by a live tick. `we:scripts/conveyor/__tests__/reconcile-core.test.mjs` "THE FIX: re-armed, fed through planReconcile TWICE, dispatches review exactly ONCE" passes on `main` (47/47; `we:scripts/conveyor/__tests__/reconcile-pass.test.mjs` 4/4). No manual live tick was run for this resolution. The "validate once before looping" caution was about the first live flip, and that flip happened on 2026-09-05 when #3499 landed.
2. **Own PR through the normal pipeline:** PR #1944 (#3499), after both blockers #3482 and #3483 were resolved.
