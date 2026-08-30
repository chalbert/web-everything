---
kind: task
status: open
dateOpened: "2026-08-30"
tags: []
---

# Bounded-child-process timeout is flaky under the full unsharded local suite

we:scripts/__tests__/sync-skills-deploy.test.mjs -- the blocker-2 symlink-cycle test (a real child process bounded by a timeout) failed 3/3 consecutive full local we:npm run test:unit runs, always the same test, always err.signal === SIGTERM (the timeout fired before the child exited on its own). Not a real bug: passes in isolation (502ms), and never failed across 3 real CI runs on a branch that split several large test files (CI shards; this machine ran the full 9863-test suite unsharded, enough extra load to blow the bound).

Fix the bound (widen it, or scale the wait proportionally) so a full local run is not spuriously red on a healthy tree.

## Done when

1. **Executable** — `npx vitest run we:scripts/__tests__/sync-skills-deploy.test.mjs` passes reliably (say, 10/10) when run concurrently with the rest of `npm run test:unit` on a loaded machine, not just in isolation. A quick repro: run `npm run test:unit` (full, unsharded) 3 times in a row on a normally-loaded dev machine; today this fails "blocker 2 — a symlink cycle fails fast" every time with `err.signal === 'SIGTERM'`, and after the fix it should not.
