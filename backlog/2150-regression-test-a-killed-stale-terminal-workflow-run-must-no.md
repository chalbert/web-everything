---
kind: story
size: 2
status: open
dateOpened: "2026-07-02"
tags: []
---

# Regression test: a killed/stale-terminal workflow run must not render live on the Active-work board

Follow-up committed-test debt from the 77a66d18 fix (a status:killed /workflow run stuck as live on /backlog#active because neither terminal set included killed). The fix landed with functional verification only (served asset + logic) — no committed test, because the two surfaces are awkward to test as-is: the client we:src/assets/js/backlog-active.js is an IIFE browser script (needs the Playwright interaction lane, not a unit test), and the watcher we:scripts/dev/active-progress-watch.mjs runs its watch loop on import (needs a small main-guard refactor — if import.meta.url === argv[1] — plus exporting its TERMINAL set / a pure classify helper before it can be unit-tested). Deliver: (1) guard the watcher main + export the terminal-status contract, unit-test that killed classifies terminal and a stale terminal run ages out of the feed; (2) an interaction-lane test loading /backlog with a mocked active-progress feed carrying a killed run, asserting it does NOT drive the live pulse / workflows-live vital and is dropped once past the 10-min window. Guards against the terminal-set drifting from the harness real run-status vocabulary again.
