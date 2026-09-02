---
bornAs: xediz51
kind: story
size: 5
parent: "3402"
status: open
scope: ["we:scripts/readiness/conveyor-state.mjs", "we:scripts/readiness/dispatch-plan.mjs", "we:scripts/backlog.mjs", "we:scripts/conveyor/tick-core.mjs", "we:scripts/conveyor/__tests__/"]
dateOpened: "2026-09-01"
tags: []
---

# Finish the dispatcher fixture-root thread: close the --repo gap, add --backlog-dir, ship withFakeGh(), and a harness test

#3402 (Fork 1, ratified) needs the deterministic conveyor/dispatch core validated against a fixture instead of production. Close the incomplete --repo thread in we:scripts/readiness/conveyor-state.mjs's gh pr list call (it drops the flag other calls in the same file already pass), add a --backlog-dir override to we:scripts/readiness/dispatch-plan.mjs and we:scripts/backlog.mjs's build-queue read, ship a withFakeGh() PATH-fake helper mirroring we:scripts/operations/__tests__/helpers/fake-claude.mjs, and add a mkdtemp-fixture harness test asserting we:scripts/readiness/conveyor-state.mjs -> we:scripts/readiness/dispatch-plan.mjs -> we:scripts/conveyor/tick-core.mjs end to end against a synthetic backlog corpus, per we:docs/agent/platform-decisions.md#skill-memory-replay-substrate.

## Done when

1. **Executable** — a new vitest under `we:scripts/conveyor/__tests__/` `mkdtemp`s a throwaway backlog-dir fixture, points `we:scripts/readiness/conveyor-state.mjs` / `we:scripts/readiness/dispatch-plan.mjs` / `we:scripts/conveyor/tick-core.mjs` at it via `--repo`/`--backlog-dir`, runs `withFakeGh()` on `PATH`, and asserts the resulting `decisions` (spawn/watch surface) against the fixture corpus covering at minimum: an open build-ready item, a blocked item, an in-flight `review:changes` PR, and a red-CI PR. The test fails on `main` today (the harness doesn't exist) and passes once this item lands.
2. **Executable** — `we:scripts/readiness/conveyor-state.mjs`'s `gh pr list` call carries `--repo=${flags.repo}` when `flags.repo` is set (grep confirms parity with the `poolArgs`/`scopeArgs` calls above it), and `we:scripts/readiness/dispatch-plan.mjs` / `we:scripts/backlog.mjs` accept a `--backlog-dir` (or equivalent) override on their `build-queue` shell.
3. **Executable** — `npm run check:standards` stays green.
