---
kind: story
size: 5
parent: "4075"
status: resolved
scope: ["we:scripts/pr-land.mjs", "we:scripts/lib/pr-limit.mjs", "we:scripts/operations/pr-limit.mjs", "we:scripts/operations/dispatch-eligibility.mjs", "we:scripts/readiness/dispatch-plan.mjs", "we:scripts/conveyor/tick-core.mjs", "we:scripts/operations/operator-queue.mjs"]
dateOpened: "2026-09-24"
dateStarted: "2026-09-24"
dateResolved: "2026-09-24"
tags: []
---

# we: open-PR backpressure limit — cap concurrent agent-authored PRs per repo

we:scripts/pr-land.mjs / we:scripts/lib/pr-limit.mjs / we:scripts/operations/pr-limit.mjs / we:scripts/operations/dispatch-eligibility.mjs / we:scripts/operations/operator-queue.mjs — count open agent-authored, not-yet-review:accepted PRs per repo (WE 15 / frontierui 5 / plateau-app 5, env override), refuse a NEW pr-land open over the limit (branch stays pushed), hold new-PR dispatch intake with a named reason (fix/review/ci-heal never blocked), exempt conveyor/daemon infra paths, add an operator-queue alert line, and give global (state file + env + CLI on/off with optional --for=<duration> expiry) and per-branch/--force-open overrides, every override logged with actor+reason

## Done when

1. **Executable** — `node we:scripts/readiness/heavy-admission.mjs run -- npx vitest run we:scripts/lib/__tests__/pr-limit.test.mjs we:scripts/readiness/__tests__/dispatch-plan.test.mjs` fails before this item lands (no `we:scripts/lib/pr-limit.mjs`, no `pr-limit` gate in `we:scripts/readiness/dispatch-plan.mjs`) and passes after (136 tests: the five required behaviours — over-limit refuses, exempt allowed, global off allows, per-branch allow allows, under-limit allows — plus the `pr-limit` intake-hold gate and its exemption).
2. **Live proof** — `node we:scripts/lib/pr-limit.mjs status` returns real, read-only per-repo open-PR counts against the live `we`/`frontierui`/`plateau-app` repos; a real dry-run with the limit lowered via `WE_PR_LIMIT_WE=<n>` env produces a genuine `decideOpenPr` refusal against the live count.
