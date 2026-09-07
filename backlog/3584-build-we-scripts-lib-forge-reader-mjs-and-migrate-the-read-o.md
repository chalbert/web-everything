---
bornAs: xmfwhm0
kind: story
size: 8
status: open
blockedBy: ["3174"]
scope: ["we:scripts/lib/forge-reader.mjs", "we:scripts/conveyor/pr-watch.mjs", "we:scripts/conveyor/tick-core.mjs", "we:scripts/conveyor/ci-heal-mark.mjs", "we:scripts/conveyor/parked-pr-conflict-watch.mjs", "we:scripts/conveyor/stand-down.mjs", "we:scripts/conveyor/lease-reaper.mjs", "we:scripts/readiness/conveyor-state.mjs", "we:scripts/readiness/conveyor-instrument.mjs", "we:scripts/lane-resume.mjs"]
dateOpened: "2026-09-07"
tags: []
---

# Build we:scripts/lib/forge-reader.mjs and migrate the read-only gh watchers onto it

Per #3174 Fork 1=(c) (ratified 2026-09-07): the roughly thirty read-only PR watchers/status-probes that own no operation — `we:scripts/conveyor/tick-core.mjs`, `we:scripts/conveyor/ci-heal-mark.mjs`, `we:scripts/conveyor/pr-watch.mjs`, `we:scripts/conveyor/parked-pr-conflict-watch.mjs`, `we:scripts/conveyor/stand-down.mjs`, `we:scripts/conveyor/lease-reaper.mjs`, `we:scripts/readiness/conveyor-state.mjs`, `we:scripts/readiness/conveyor-instrument.mjs`, `we:scripts/lane-resume.mjs:454` and others in the same shape — currently shell their own `gh pr view`/`gh pr list` directly, with no home to route a mutation-style port through and no operation that owns them. Build the named shared module `we:scripts/lib/forge-reader.mjs` (`createForgeReader`, injectable, mirroring `we:scripts/lib/review-label-provider.mjs`'s `createGhProvider` shape) exposing the read operations these watchers need (`readPrState`, `readPrList`, `readChecks`, …), and reuse `PR_STATE_FIELDS` (`we:scripts/lib/review-label-provider.mjs:37`) rather than minting a second field list, so a test stub cannot drift from what the real reader returns. A module import is not a mutation route, so this does not reopen the sole-writer invariant Fork 1's mutating-arc rulings protect — reads bind through the shared module directly, with NO per-caller home required. Per Fork 2=(b): this is one arc-fitted port (the read arc), not a repo-wide neutral `ForgeProvider`. Migrate every watcher above onto it. Done-when: every bare read-only `gh` invocation across those watchers sits behind `we:scripts/lib/forge-reader.mjs`; argv asserted byte-identical to prior behavior, per the discipline `we:scripts/lib/__tests__/review-label-provider.test.mjs:19` already applies; each watcher's existing tests pass unmodified in behavior. No second forge provider is stood up or tested.

## Done when

1. **Executable** — TODO: a command that fails before this item lands and passes after.
