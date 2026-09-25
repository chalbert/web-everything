---
kind: story
size: 5
parent: "4075"
status: open
scope: ["we:scripts/operations/heavy-queue.mjs", "we:scripts/operations/heavy-queue-io.mjs", "we:scripts/operations/run.mjs", "we:skills-src/queue/SKILL.md", "we:.claude/commands/queue.md", "we:scripts/readiness/heavy-admission.mjs", "we:scripts/readiness/__tests__/heavy-admission.test.mjs", "we:scripts/operations/__tests__/heavy-admission-contention.test.mjs"]
dateOpened: "2026-09-25"
tags: []
---

# Heavy-queue report: declared operation + /queue skill/command, and heavy-admission FCFS fairness fix

Operator request 2026-09-25 ~16:55 ET: the heavy test queue report the orchestrator has been building by hand becomes a declared read-only operation + skill/slash-command, following we:scripts/operations/daemon-status.mjs (#4067)'s read/assess-split + fidelity-test pattern. It reads we:scripts/readiness/heavy-admission.mjs's admissionStatus() exports directly (no subprocess), joins each holder/waiter with its lane-pool lease purpose/session (WHO) via readLaneLease, classifies job KIND from the held pid's live process command (selected / FULL / standards / files / other), and reports a projected-wait estimate using constant standard-times per kind. Separately fixes a live mechanical-fairness bug in we:scripts/readiness/heavy-admission.mjs: slot acquisition today is 'try slot-0, then slot-1 ..., poll every 2s', so ANY waiter can win a freed slot regardless of arrival order -- observed live: a check:standards waiter (lane-16) waited 47+ minutes while newer jobs took slots ahead of it. The fix makes it first-come-first-served: only the OLDEST live waiter (by requestedAt, ignoring stale/dead waiters) may take a free slot, keeping the existing PID-liveness + lease-TTL reclaim untouched. Also REPORTS, but does not fix, why workers on lanes forked before PR #2680 (the diff-driven default-gate merge) still run the old unconditional full-suite we:scripts/verify-lane.mjs: guard-bash is loaded from the lane's own checkout, so a deny wired only into main after that merge never reaches an old-base lane's own copy of the hook.

## Done when

1. **Executable** — `node we:scripts/operations/run.mjs heavy-queue --json` exists and reports `held`/`waiting`
   rows with `state`/`lane`/`who`/`kind`/`minutes`/`projectedWaitMinutesForNewJob` against the real queue.
2. **Skill + command** — `we:skills-src/queue/SKILL.md` + `we:.claude/commands/queue.md` exist and `/queue`
   runs the operation and presents the table.
3. **Fairness, red→green** — a vitest fairness test in `we:scripts/readiness/__tests__/heavy-admission.test.mjs`
   (3 waiters, oldest live one by `requestedAt` wins each freed slot) fails against `main`'s current
   slot-0-then-slot-1 scan and passes once `we:scripts/readiness/heavy-admission.mjs` enforces FCFS.
4. `npm run check:standards` and the affected vitest files are green.
