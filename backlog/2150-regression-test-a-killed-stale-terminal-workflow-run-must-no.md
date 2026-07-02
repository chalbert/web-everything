---
kind: story
size: 2
status: resolved
dateOpened: "2026-07-02"
dateStarted: "2026-07-02"
dateResolved: "2026-07-02"
graduatedTo: none
tags: []
---

# Regression test: a killed/stale-terminal workflow run must not render live on the Active-work board

Follow-up committed-test debt from the 77a66d18 fix (a status:killed /workflow run stuck as live on /backlog#active because neither terminal set included killed). The fix landed with functional verification only (served asset + logic) — no committed test, because the two surfaces are awkward to test as-is: the client we:src/assets/js/backlog-active.js is an IIFE browser script (needs the Playwright interaction lane, not a unit test), and the watcher we:scripts/dev/active-progress-watch.mjs runs its watch loop on import (needs a small main-guard refactor — if import.meta.url === argv[1] — plus exporting its TERMINAL set / a pure classify helper before it can be unit-tested). Deliver: (1) guard the watcher main + export the terminal-status contract, unit-test that killed classifies terminal and a stale terminal run ages out of the feed; (2) an interaction-lane test loading /backlog with a mocked active-progress feed carrying a killed run, asserting it does NOT drive the live pulse / workflows-live vital and is dropped once past the 10-min window. Guards against the terminal-set drifting from the harness real run-status vocabulary again.

## Progress

Done — both deliverables landed, guarding the 77a66d18 fix.

**(1) Watcher unit-testable + contract exported** — `we:scripts/dev/active-progress-watch.mjs`:
- Added a **main-guard** (`import.meta.url === pathToFileURL(process.argv[1]).href`) around the `--once`/watch-loop entry, so importing the module no longer spins up `setInterval` or writes files.
- **Exported the terminal contract**: `TERMINAL` set, `isTerminalStatus(status)`, and a pure `terminalRunAgedOut(status, mtimeMs, now, recentMs)` classifier (clock + window injected → filesystem-free). `digestJournal` now calls `terminalRunAgedOut` instead of the inline check (single source of truth).
- **New unit test** `we:scripts/dev/__tests__/active-progress-watch.test.mjs` (7 tests): `killed` (and all five statuses) classify terminal; a stale killed run ages out while a fresh one is kept; a still-running run never ages out; every terminal status ages out uniformly. The import-doesn't-hang behaviour is itself the main-guard regression.

**(2) Interaction-lane test** — appended 2 cases to `we:tests/interaction/backlog-active.spec.ts` (now 7) against the REAL shipped `we:src/assets/js/backlog-active.js`, with `updatedAt` computed off the real clock so fresh/stale are honest vs the shipped 10-min `TERMINAL_MAX_AGE_MS`: a **fresh** killed run renders as a card but leaves `#active-tab-live` + `#aw-vital-workflows` hidden (liveN=0 — no pulse/vital); a **stale** killed run is dropped entirely (board hidden, no live signal).

Verified: unit suite green (7/7), interaction lane green (7/7), watcher `--once` still runs as a CLI, `check:standards` clean for the changeset.
