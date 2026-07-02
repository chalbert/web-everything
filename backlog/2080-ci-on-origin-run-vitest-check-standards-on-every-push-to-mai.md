---
kind: story
size: 3
status: resolved
dateOpened: "2026-07-02"
dateStarted: "2026-07-02"
dateResolved: "2026-07-02"
tags: []
---

# CI on origin: run vitest + check:standards on every push to main

GitHub Actions workflow running the 9.6s unit suite + 2.5s gate on push; also fold vitest into push-if-green default gate. Closes the no-CI gap: 2003 tests currently run only when an agent remembers.

## Progress

- Added we:.github/workflows/ci.yml — on every push to main (+ workflow_dispatch): `npm ci` → `npm run test:unit` → `npm run check:standards`, node 22, npm cache, per-ref concurrency cancel. Playwright lanes deliberately out of scope (tracked by #2070).
- Folded vitest into the push-if-green default gate: we:scripts/push-if-green.mjs default `--gate` is now `npm run test:unit && npm run check:standards` (explicit `--gate` callers — frontierui/plateau-app — unaffected; no in-repo caller relied on the old default).
- Verified: unit suite 2014/2015 green — the 1 failure is a concurrent session's untracked we:reports/2026-07-02-portfolio-tiering.md (hidden-report rule), not this changeset; CI on origin sees only committed state.
