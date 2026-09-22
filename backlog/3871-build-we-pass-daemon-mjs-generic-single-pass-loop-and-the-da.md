---
bornAs: x3fixx3
kind: story
size: 5
parent: "3383"
status: resolved
scope: ["we:skills-src/conveyor/pass-daemon.mjs", "we:skills-src/conveyor/daemon-manifest.mjs"]
dateOpened: "2026-09-22"
dateStarted: "2026-09-22"
dateResolved: "2026-09-22"
tags: []
---

# Build we:pass-daemon.mjs (generic single-pass loop) and the daemon manifest schema

New generic wrapper: we:skills-src/conveyor/pass-daemon.mjs runs ONE mechanical pass script on its own interval, under a singleton lock, with its OWN heartbeat on an independent timer (not only between iterations, so a long-running pass like we:scripts/conveyor/infra-blocked.mjs's unlocked resumeOpen call, which can legitimately block for minutes, doesn't silently stall the daemon's own liveness signal the way today's single shared lease does). Its script argument resolves ONLY from a closed allowlist (a manifest file, we:skills-src/conveyor/daemon-manifest.mjs) -- never an arbitrary path -- covering every entry any daemon launcher in this epic can start, not just the watcher passes. This is foundational for we:3860's sibling watcher-wiring slice and for the Supervisor manifest launcher slice; it introduces no changes to any existing pass script. Part of daemonizing the conveyor runner under epic #3383; see #3860 for the design context.

## Progress

Built both files as scoped. we:skills-src/conveyor/daemon-manifest.mjs's `DAEMON_MANIFEST` starts EMPTY by design — this item builds the mechanism only and touches no existing pass script; the allowlist and validator are proven via fixture entries in its own test file. we:skills-src/conveyor/pass-daemon.mjs spawns each pass as a real child process (never in-process) specifically so the independent heartbeat (`setInterval`, separate from the pure run/sleep loop) keeps beating while a long-running pass's own subprocess is still executing — proven false-positive-free: a smoke test confirmed `spawnPassOnce` genuinely awaits a real script's exit (incidentally also confirming, the hard way, that an argument-less invocation of we:scripts/conveyor/branch-drift.mjs falls through to its real default `sweep` verb rather than erroring — noted for whoever wires #3873, since a bare smoke invocation of any manifest entry should pass an explicit verb).

Sibling slices (#3873 wiring the 8 watchers, #3874 the Supervisor launcher) populate `DAEMON_MANIFEST` with real entries; neither is this item's scope.

## Done when

1. **Executable** — `npx vitest run we:skills-src/conveyor/__tests__/daemon-manifest.test.mjs we:skills-src/conveyor/__tests__/pass-daemon.test.mjs` passes (24/24): the closed allowlist refuses any unregistered/path-shaped name and validates every entry's shape; the pure daemon loop isolates a failing run, paces its own interval, and stops immediately (no extra run or sleep) the instant `isAlive()` reports the lease lost; `passDaemonLeaseKey` gives each pass name its own distinct key, never colliding with the Dispatcher's or #3870's own.
