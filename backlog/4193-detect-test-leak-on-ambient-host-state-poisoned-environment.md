---
bornAs: xgy8sdb
kind: story
size: 5
parent: "4075"
status: open
scope: ["we:vitest.setup.ts", "we:.github/workflows", "we:scripts/conveyor/health"]
dateOpened: "2026-09-25"
tags: []
---

# Detect test-leak on ambient host state: poisoned-environment CI job + a canary parity sign

PR #2696 fixed the leaks it could reach (we:vitest.setup.ts now snapshots/restores process.env and defaults WE_TELEMETRY off) but explicitly left two approaches it tried and abandoned, because they did not work technically: a temp HOME is ignored by os.homedir() inside vitest worker threads (the value is captured before the override lands), and an fs-write guard cannot intercept a named ESM import like `import {writeFileSync} from 'node:fs'`. Add a CI job that runs the unit suite with a poisoned environment (an odd HOME with pre-existing ~/.claude state, stray WE_*/CONVEYOR_* env vars set) so a test that silently depends on ambient host state fails loudly instead of passing by accident, plus a health-watch sign that runs a small canary test set once in the plain host env and once in a clean/poisoned env and reports a parity mismatch.

## Done when

1. **Executable** — a deliberately-planted test that reads real ambient host state (e.g. an assumption baked into a fixture from the operator's own `~/.claude` contents) fails under the new poisoned-environment CI job and passes under today's plain job — proving the job actually detects the class of leak PR #2696 could not close.
2. **Live proof** — run the unit suite once in the plain host environment and once in the new poisoned environment on the SAME commit; before this lands there is no such second run to compare; after, the two runs' pass/fail sets for the canary test set are diffed and reported by the health-watch sign, with any parity mismatch surfaced (not silently ignored).
3. **Executable** — `npm run check:standards` reports 0 errors, and the PR's required `test` and `smoke` checks are green.
