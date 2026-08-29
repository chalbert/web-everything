---
bornAs: xp2pmg4
kind: task
parent: "2606"
status: resolved
scaffoldedBy: "isolate-git-subprocess-tests"
dateScaffolded: "2026-08-28"
dateOpened: "2026-08-28"
dateResolved: "2026-08-28"
graduatedTo: none
tags: []
---

# Isolate 3 git-subprocess-heavy vitest files onto the forks pool

Three vitest files spin up real git subprocesses (git init/git clone fixtures) and dominate unit-test/verify-lane wall-clock: we:scripts/__tests__/lane-pool-acquire-base.test.mjs (202.4s/13 tests), we:scripts/operations/__tests__/wake-cli.test.mjs (129.9s/16 tests), we:scripts/__tests__/publish-secret-gate.test.mjs (40.6s/12 tests). Precedent: we:scripts/__tests__/gate-entrypoint-integration.test.mjs and we:scripts/operations/__tests__/wake-cli.test.mjs are already routed to the singleFork forks pool in we:vitest.config.ts poolMatchGlobs (around lines 126-148) specifically because real subprocess spawns contend badly with the default shared threads pool. Extend that same poolMatchGlobs override to the remaining files (we:scripts/__tests__/lane-pool-acquire-base.test.mjs, we:scripts/__tests__/publish-secret-gate.test.mjs) — quick win, config-only, no changes to the tests themselves (mocking git there is a separate, bigger design call).

## Done when

1. **Executable** — `grep -c "we:scripts/__tests__/lane-pool-acquire-base.test.mjs\|we:scripts/__tests__/publish-secret-gate.test.mjs" we:vitest.config.ts` returns `2` (both files added to the `poolMatchGlobs` forks override), where today it returns `0`.
