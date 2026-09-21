---
kind: story
size: 5
parent: "3383"
status: resolved
scaffoldedBy: "heavy-admission-routing"
dateScaffolded: "2026-09-21"
scope: ["we:package.json", "we:scripts/readiness/heavy-admission.mjs", "we:scripts/readiness/file-locks.mjs", "we:scripts/verify-lane.mjs", "we:scripts/dev/regression.mjs", "we:scripts/push-if-green.mjs", "we:scripts/pr-land.mjs", "we:scripts/readiness/test-selection.mjs", "we:scripts/operations/mutation-check-io.mjs", "we:scripts/codex-direct-task.mjs", "we:scripts/gemini-direct-task.mjs", "we:scripts/guard-bash.mjs", "we:docs/agent/platform-decisions.md"]
dateOpened: "2026-09-21"
dateResolved: "2026-09-21"
relatedTo: ["3456", "3461", "3471", "3417", "3650", "3611", "3612"]
tags: [conveyor, capacity, admission-queue]
---

# Route every heavy command through the heavy-admission pool so the core budget is enforced structurally

Operator 2026-09-21: 'Yes to routing heavy cmd, I thought this was already done since a while'. Only we:scripts/verify-lane.mjs runs under we:scripts/readiness/heavy-admission.mjs (#3456/#3461). npm run test:unit, check:standards, direct vitest, we:scripts/push-if-green.mjs, we:scripts/pr-land.mjs (id-collision heal), we:scripts/readiness/test-selection.mjs, we:scripts/operations/mutation-check-io.mjs and the codex/gemini direct-task verification calls bypass it. Wrap the package scripts in the admission run wrapper (no-op in CI or with WE_HEAVY_ADMISSION=off, re-entrant via WE_HEAVY_ADMISSION_HELD), route the direct callers through runUnderAdmission, widen we:scripts/guard-bash.mjs VERIFICATION_RUN, reap stale waiting markers (TTL), and document the provisional core budget.

## Done when

1. **Executable** — `we:scripts/readiness/__tests__/heavy-admission.test.mjs` (xaipsbs blocks): a NESTED wrapper
   under cap 1 finishes and holds exactly one slot (no deadlock, no second slot); two wrappers from the same
   checkout under cap 1 never overlap (real processes; this failed before the `we:scripts/readiness/file-locks.mjs` mkdir/write-gap
   fix); `CI=true` is a pass-through that creates nothing; the stale-waiter reap previews, applies and is
   counted by `status`.
2. **Executable** — `we:scripts/__tests__/guard-bash.test.mjs`: each new raw spelling is a verification run
   (denied to a dispatched agent, backgrounding blocked for everyone), and the mentions (`npx vitest --version`,
   `git commit -m "npx vitest run"`, a grep for the string) are not.
3. **Observable** — two wrapped vitest runs plus a third, cap 2: `we:scripts/readiness/heavy-admission.mjs status` shows the third
   in `waiting`, then empty once a slot frees (recorded in the PR body).
4. **Observable** — the four stale `waiting` markers (2026-09-04/14: frontierui lane-1, web-everything lane-27,
   lane-30, lane-57) are removed by the reap, not by hand.
5. **Assertable** — `we:docs/agent/platform-decisions.md#heavy-command-admission-queue` carries the rule
   "every heavy command goes through the pool", the `CI` / `WE_HEAVY_ADMISSION=off` switch, and the core
   budget marked PROVISIONAL with where its telemetry lives.

Out of scope: the lane ceiling (#3612), the Playwright visual-capture pass (#3471), the container work (#3621),
and the smoothed load brake (a later slice on the prototype branch).
