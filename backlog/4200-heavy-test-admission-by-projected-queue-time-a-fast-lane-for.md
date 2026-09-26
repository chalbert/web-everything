---
bornAs: xkyw1x4
kind: story
size: 5
parent: "4075"
status: open
scope: ["we:scripts/readiness/heavy-admission.mjs", "we:scripts/readiness/heavy-queue-projection.mjs", "we:scripts/conveyor/tick-core.mjs", "we:scripts/operations/heavy-queue.mjs", "we:scripts/operations/heavy-queue-io.mjs", "we:scripts/conveyor/reconcile-fix-dispatch.mjs", "we:scripts/operations/ci-heal-pr-dispatch.mjs", "we:skills-src/conveyor/reconcile-fix-dispatch-daemon.mjs", "we:scripts/verify-lane.mjs", "we:scripts/readiness/__tests__", "we:scripts/conveyor/__tests__", "we:scripts/operations/__tests__", "we:scripts/conveyor/soak", "we:skills-src/queue/SKILL.md"]
dateOpened: "2026-09-25"
tags: []
---

# Heavy-test admission by projected queue time + a fast lane for short jobs

Admit a new dispatched session only when the projected heavy-test queue wait stays under 30 min, and give short heavy jobs (selected/files/standards) a fast lane so a 1-min fixer check never waits behind a 25-min full suite. Standard hold time per heavy-command kind is recorded on slot release in we:scripts/readiness/heavy-admission.mjs (rolling median, seeded: selected 3m, full 18m, standards 0.25m). Expected demand per dispatch kind: review/prepare exempt, fix and ci-heal = selected + standards, build scaled by card size. Projected wait = (remaining held time + waiting jobs + dispatched-not-yet-queued sessions + the new one) / slots. Applied as a queue-cap hold in we:scripts/conveyor/tick-core.mjs planTick beside the #4076 load-cap, in the fix/ci-heal daemon dispatch (we:scripts/conveyor/reconcile-fix-dispatch.mjs, we:scripts/operations/ci-heal-pr-dispatch.mjs), and shown by the heavy-queue operation. Fast lane (operator decision on PR #2707): `WE_HEAVY_ADMISSION_FAST_SLOTS` (default 1) short-only slots ADDED ON TOP of the heavy cap (default 2 heavy + 1 fast; weekend 3 + 1), short jobs may also take a free heavy slot, and first-come-first-served ranking per lane. Projected wait per lane: full-suite demand over the heavy slots, short demand over fast + free heavy slots.

## Done when

1. **Executable** — the vitest files we:scripts/readiness/__tests__/heavy-admission-fast-lane.test.mjs and we:scripts/conveyor/__tests__/tick-core-queue-cap.test.mjs fail on the tree before this item (a short job waits behind a full-suite waiter; four quick dispatches are all admitted) and pass after. The soak break `short-job-behind-full-suite` reproduces the live case with real processes: a short selected job took ~6 s behind two full suites before, ~65 ms after.
2. **Live** — the `heavy-queue` operation (we:scripts/operations/run.mjs `heavy-queue --json`) reports `verdict.queueAdmission` ("projected wait if you start now", per dispatch kind admit / held), and a dry-run tick (we:scripts/conveyor/tick-core.mjs with `--queue-status-file=<busy baseline>`) holds new fix / CI-heal / build spawns as `queue-cap` once the projected wait would pass 30 min.
