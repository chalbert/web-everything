---
bornAs: xn7olnj
kind: story
size: 5
status: resolved
dateOpened: "2026-09-30"
dateStarted: "2026-09-30"
dateResolved: "2026-09-30"
preparedDate: "2026-09-30"
tags: []
---

# Settle preparation before build eligibility and avoid repeated refused dispatch scans

Builder postmortem: 33 refused dispatch reads cost 35.24 minutes; seven preparation-to-build handoffs span 91.63 minutes after last-seen liveness (exposure, not proven idle). Make terminal preparation completion authoritative and invalidate eligibility on events. Evidence and proof are in we:reports/2026-09-30-builder-postmortem.md.

## Evidence and cost

The 2026-09-30 cohort has 33 refused dispatch operations totaling **35.24 minutes** in recorded step timings. Seven preparation-to-build handoffs span **91.63 item-minutes** from last liveness observation to launch; this is exposure, not proven idle. Preparation effects remain in-flight while succeeding build effects report PRs.

Source directory is defined in the report. Preparation run ID: `dispatch-lane-5d4b6d72-bd24-4343-b4f1-ea31c6f7c927`, `effects[0].lastSeenLiveAt`; succeeding build `dispatch-lane-fcc1c84e-5a69-4e53-a177-65e66ee2ba3a`, `effects[0].startedAt`. Worker corroboration: T4331 lines 15–16 in the report source index. The report attachment enumerates all 53 dispatch records, including 33 refusals; no worker tokens are attributed to pre-spawn waits.

## Root cause and change

Terminal preparation is not authoritative in dispatch eligibility; repeated expensive reads fall back to agent-listing and clock inference. Persist completion against its original operation effect, reconcile once, invalidate eligibility on changed inputs, and put the cheap in-flight check before expensive planning. Preserve live-worker protection and uncertain-crash reconciliation. Do not merely shorten timeouts.

## Done when

Extend the existing build-dispatch policy/claim tests and preparation terminal adapter tests: a completed preparation admits the next build immediately; a positively live preparation still holds; duplicate terminal events settle once; unchanged held candidates do not rerun expensive planning. Run the targeted Vitest files through the admitted runner. Live proof: observe a prepare→build handoff with original effect settled and no repeated same-input refusal, recording actual completion and launch times. Compare refused-operation cost to this cohort.

## Prep

Preserve the original dispatch run/effect identity through the prepare launcher and terminal writer. Reconcile observed completion before build planning, remove only the completed preparation's cached guards and holds, and short-circuit held dispatch reads before planning. Keep positive worker liveness and the existing crash recovery path.

Implementation loci: we:scripts/operations/dispatch-providers/probation-worker.mjs, we:scripts/operations/probation-build-run.mjs, we:scripts/operations/dispatch-lane-io.mjs, and we:skills-src/conveyor/build-dispatch-daemon.mjs. Regression coverage will exercise next-tick admission, duplicate completion, live-worker protection, and crash recovery. Run related Vitest tests, the daemon invalid-flag boot probe, standards, and we:scripts/verify-lane.mjs.

## Implementation and verification

The probation prepare provider now passes the original run/effect identity to the runner, which persists its terminal result through the existing idempotent settlement adapter. The daemon reconciles stamped preparation before planning and invalidates its prepare guards and holds, preserving unrelated build holds. Positive liveness still blocks; failed observations or settlement retain ownership for crash recovery. The dispatch reader checks local in-flight records before invoking the planner and rechecks after planning for races.

Targeted tests pass: 144 daemon cases, 114 probation runner cases, 3 routing cases, and 5 file-backed dispatch integration cases. The integration probe observes duplicate completion settling once and a fresh reader immediately reaching planning; the daemon probe observes next-tick build admission without an intervening refused dispatch. The invalid-flag boot exits 2. Direct standards scan reports zero errors.

Verification limits: the full related run has 5664 passing tests and seven failures in existing process-table/socket tests; direct probes confirm this sandbox denies ps and local socket binding. The requested we:scripts/verify-lane.mjs invocation selects its wider suite but cannot write its marker under we:.git/; its marker-free run also cannot acquire the host admission directory. Its printed wider test selection was executed separately: 7400 tests passed, with the same seven sandbox-blocked failures. Production prepare-to-build timing and refused-operation cost were not measured: this checkout-only task does not publish a prepare PR or launch a production build. No savings claim is made against the historical cohort.
