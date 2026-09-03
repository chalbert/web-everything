---
bornAs: xsrqk8h
kind: task
parent: "3383"
status: resolved
dateOpened: "2026-09-03"
dateStarted: "2026-09-03"
dateResolved: "2026-09-03"
tags: []
---

# session-reaper: stop/rm the SHORT `id`, not the full `sessionId` — the near-universal `claude stop` failure was a wrong-field bug

`stopSession` in `we:scripts/conveyor/session-reaper.mjs` passed `session.sessionId` (the full listing UUID `claude stop`/`claude rm` do not match on) instead of `session.id` (the short form the CLI actually accepts). Live-verified 2026-09-03: every `kind: background` row in a fresh `claude agents --json --all` carries a real `id` (only `kind: interactive` rows lack one, and those never reach the reap loop — `classifySessionReap`s `kind !== background` guard runs first); `claude stop <sessionId>` on a real done session failed `No job matching`, `claude stop <id>` on the SAME session immediately after succeeded. Swapped the handle, added a logged-anomaly guard for the (structurally-should-never-happen) missing-id case, corrected the file's own doc comments that had read this as general CLI staleness rather than the wrong-field bug it was, and pinned-argv tests proving the short id is what ships.

## Done when

1. **Executable** — `npx vitest run we:scripts/conveyor/__tests__/session-reaper-cli.test.mjs` includes a
   pinned-argv case asserting a real (non-dry-run) pass calls `claude stop <id>` (the short form), not
   `claude stop <sessionId>` (the full UUID) — fails against the pre-fix `we:scripts/conveyor/session-reaper.mjs`
   (which passes `session.sessionId`), passes after.
2. A reap candidate missing `id` is never passed to `claude stop`/`claude rm` — logged as an anomaly (non-zero
   exit) rather than a silent skip or a bad call. Covered by a dedicated CLI test.
3. `we:scripts/conveyor/session-reaper.mjs`'s own doc comments no longer frame the near-universal `claude stop`
   failure as a general CLI reliability/staleness limitation — they name the wrong-field root cause, with the
   live before/after proof (`conveyor-2972`), and still distinguish it from the separate, real "reported
   success is a hint, not a certainty" listing-lag issue this file already documented.
4. `npm run test:unit` and `npm run check:standards` both pass.
