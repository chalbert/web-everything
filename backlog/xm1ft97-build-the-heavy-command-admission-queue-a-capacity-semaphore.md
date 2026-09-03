---
kind: task
parent: "3456"
status: open
scope: ["we:scripts/lane-pool.mjs", "we:scripts/verify-lane.mjs", "we:scripts/conveyor/tick-core.mjs", "we:skills-src/conveyor/runner.mjs", "we:scripts/readiness/dispatch-plan.mjs", "we:scripts/operations/__tests__/"]
dateOpened: "2026-09-02"
tags: []
---

# Build the heavy-command admission queue: a capacity semaphore for check:standards, verify-lane, npm ci, and Playwright visual-capture

Ratified by #3456: build a capacity-aware admission queue distinct from lane leasing, capping how many of the closed named set of heavy commands (check:standards, verify-lane/test:unit, npm ci/npm install, the Playwright visual-capture pass) may run concurrently across dispatched lanes. v1 ships an equal-cost named SET, not weighted. The cap applies at heavy-command-invocation time, not at lane-acquire time — a lane may always be acquired freely; the heavy command itself queues on a capacity semaphore right before it runs. Must concretely resolve the npm ci wrinkle the ruling names but leaves open: we:scripts/lane-pool.mjs acquire already runs npm ci via ensureDeps unless --no-install is passed, and no dispatched-agent brief passes it today — either change acquire call sites to pass --no-install and gate npm ci as its own explicit step, or document it as a narrow, named acquire-time exception. A throttled dispatch must surface a new, distinct waiting-for-capacity signal in the runners own tick JSON, via the existing notes array kind pattern in we:scripts/conveyor/tick-core.mjs (e.g. kind: waiting-for-capacity, num, text) — never folded into #3451s call-visibility telemetry (a schema mismatch: that signal is after-the-fact access-log telemetry, not a live pollable status) and never silent. The admission cap is a fixed number, env/config-overridable per machine, sized conservatively below measured host capacity, not Bazel-style near-full-utilization. Must name plainly, per the ratification, that a fixed cap alone reduces but does not fully eliminate #3383s own finding-4 contention failure mode — an accepted, named residual risk of v1, not something to overstate as solved. The exact throttle mechanism (an OS-level semaphore file, an in-process limiter inside the runner, a lock directory under .operations/, etc.) is this items own call, weighing the two existing single-holder advisory locks we:scripts/readiness/file-locks.mjs and we:scripts/conveyor/infra-blocked.mjs as prior art to generalize from, per #3456s own What this decision does NOT settle section. Include a real regression test that reproduces heavy-command contention with the cap absent (fails pre-fix), mirroring #3449s own fails-pre-fix Done-when discipline. Per the operators own sequencing, this item must land, or be concretely scheduled to land, before the dispatchers parallel lane count increases beyond its current provisioned size.

## Done when

1. **Executable** — a new regression test (mirroring `we:backlog/3449-*.md`'s "fails pre-fix" discipline) that
   reproduces heavy-command contention with the cap absent — fails before this item lands, passes after: spawn
   N concurrent invocations of a stubbed heavy command past the chosen cap and assert at most `cap` run at
   once, the rest observably queued rather than started.
2. **Observable** — with the cap saturated, the runner's own tick JSON carries a `{ kind:
   'waiting-for-capacity', num, text }` entry (the existing `notes`-array `{ kind, ... }` pattern in
   `we:scripts/conveyor/tick-core.mjs`) for the queued item, and it clears once a slot frees up.
3. **Assertable** — the PR body names, for the record: the throttle mechanism chosen (and why, weighed
   against `we:scripts/readiness/file-locks.mjs` and `we:scripts/conveyor/infra-blocked.mjs` as prior art), the
   default cap value and how it is env/config-overridden, and concretely how the `npm ci`-at-acquire-time
   wrinkle was resolved (either `--no-install` at every dispatched-agent acquire call site plus `npm ci` as its
   own gated step, or a documented narrow acquire-time exception) — so `#3456`'s "left to the follow-on build
   item" list is traceably closed, not silently dropped.
