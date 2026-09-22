---
bornAs: xktw9vz
kind: story
size: 5
parent: "3383"
status: active
blockedBy: ["3871"]
scope: ["we:skills-src/conveyor/supervisor.mjs", "we:skills-src/conveyor/supervisor-launcher.mjs"]
dateOpened: "2026-09-22"
dateStarted: "2026-09-22"
tags: []
---

# Build the Supervisor manifest launcher (spawns one unmodified we:supervisor.mjs per manifest entry)

we:skills-src/conveyor/supervisor.mjs's restart/backoff core already takes an injected child (runSupervisorLoop, line 189; makeRealSpawnChild, line 422; main, line 587) -- no internal rewrite is needed to run more than one. Build a thin top-level launcher that reads #3871's daemon manifest and starts one existing, UNMODIFIED we:skills-src/conveyor/supervisor.mjs process per entry, rather than teaching we:skills-src/conveyor/supervisor.mjs to manage N children internally. The launcher's own script-resolution must use the SAME closed allowlist #3871 defines for we:skills-src/conveyor/pass-daemon.mjs, generalized to every entry it can launch (Dispatcher, Fix-dispatch, Review, Verify, each of the 8 watchers), never an arbitrary path. Part of daemonizing the conveyor runner under epic #3383; see #3860 for the design context.

## Progress

Built we:skills-src/conveyor/supervisor-launcher.mjs, a thin top-level launcher, and its unit suite
(we:skills-src/conveyor/__tests__/supervisor-launcher.test.mjs, 18/18). we:skills-src/conveyor/supervisor.mjs
was not touched at all.

**Two false premises in this card's own digest, corrected rather than worked around:**

1. **"starts one existing, UNMODIFIED we:skills-src/conveyor/supervisor.mjs process per manifest entry" via a
   `--pass=`-style flag does not work — read directly, no such flag exists.**
   we:skills-src/conveyor/supervisor.mjs's `main()` hardcodes its child to a fixed path built off its own
   directory pointing at we:skills-src/conveyor/runner.mjs; there is no CLI flag, env var, or other lever to
   point it at a different script. Spawning N copies of `node we:skills-src/conveyor/supervisor.mjs` would
   spawn N supervisors of the SAME we:skills-src/conveyor/runner.mjs, never one per manifest entry. What the
   file's own test suite already proves generic (`makeRealSpawnChild — real node child processes, never
   we:skills-src/conveyor/runner.mjs itself`, in we:skills-src/conveyor/__tests__/supervisor.test.mjs, spawning
   arbitrary `-e` scripts) is its EXPORTED pure core — `runSupervisorLoop` and `makeRealSpawnChild`, both
   effect-injected. The launcher imports both UNMODIFIED and drives one restart/backoff loop per manifest
   entry inside itself, each of which spawns a REAL, independent child OS process for that entry's own
   script. Zero edits to we:skills-src/conveyor/supervisor.mjs; the "process per entry" in the card's own
   title is real at the supervised-child level, just not at the supervisor-CLI level the card's own phrasing
   implied. (The card's cited line numbers for `runSupervisorLoop`/`makeRealSpawnChild`/`main` — 189/422/587 —
   are also stale against the current file, now 157/370/479; ordinary drift from later edits, not a design
   mismatch, noted for completeness.)

2. **we:skills-src/conveyor/daemon-manifest.mjs's `DAEMON_MANIFEST` is NOT already populated with 15 real
   entries — it is empty, by design, and confirmed so by its own test's first assertion
   (`Object.keys(DAEMON_MANIFEST)` === `[]`).** #3873 (wiring the 8 watcher passes) is still `status: open`,
   unbuilt, as of this writing; no Dispatcher/Fix-dispatch/Review/Verify entries exist either. The launcher is
   built to be correct against that reality: it takes whatever names are currently registered (or an explicit
   `--only=` subset) with zero hardcoded entry names, so the same unchanged file picks up #3873's watchers —
   and any later entries — the instant a sibling slice registers them. It deliberately does NOT register any
   new entries itself: `resolveManifestEntry` is the SAME closed allowlist
   we:skills-src/conveyor/pass-daemon.mjs resolves `--pass=<name>` through, so adding an entry here would
   silently change what THAT daemon can also be pointed at — a real decision belonging to whichever slice
   actually wires each script (this item's own `scope` only ever named we:skills-src/conveyor/supervisor.mjs).

**Real-behavior confirmation (not just unit-mocked coverage).** Since the real manifest has zero entries,
"resolve a couple of real manifest entries" was proven against a scratch manifest resolved through the REAL
`resolveManifestEntry` (never a fake), not the empty production one: `launchAll()` correctly spawned two real,
independent OS child processes (confirmed via distinct PIDs), correctly isolated one deliberately-unregistered
name into a failure without blocking the other two launches, and correctly classified/backed-off two
real-but-broken child exits via the reused, unmodified `classifyExit`/`decideRestart`. A second smoke test
against a genuinely long-running child proved the SIGTERM-forwarding kill path `main()` implements (mirroring
we:skills-src/conveyor/supervisor.mjs's own single-child shutdown, generalized to N tracked children by name):
the live child was confirmed alive by PID, then confirmed genuinely gone (not orphaned) after signalling it
and stopping the loop.

**Third correction, found in review (PR #2472, review:changes):** two tests hardcoded "the real DAEMON_MANIFEST
is empty" as a literal expected value -- true when this file was written (correction 2, above), but #3873
landed 15 real entries onto that SAME shared, mutable export before this PR merged, reddening both hardcoded
literals against current main (confirmed by the reviewer's own direct execution: 16 passed / 2 failed, not
the 18/18 this card and the PR both claimed). Fixed per the reviewer's own prescribed remedy: both tests now
assert against `Object.keys(DAEMON_MANIFEST)`'s own CURRENT state rather than a value pinned at write time,
so neither test can ever again go stale the instant a sibling PR populates that same shared export. Added one
further test that resolves every REAL currently-registered name (guarded to skip, not assert either shape, if
the manifest is ever empty again) -- proving the launcher genuinely handles today's real 15-entry manifest,
not only a fixture. 19/19 now.

## Done when

1. **Executable** — `npx vitest run we:skills-src/conveyor/__tests__/supervisor-launcher.test.mjs` passes
   (19/19): the pure `planLaunchTargets`/`defaultLaunchNames` resolve every valid manifest name and isolate an
   unresolvable one without aborting the rest; `launchEntry`/`launchAll` wire the resolved `script`/`args` into
   we:skills-src/conveyor/supervisor.mjs's own (injected, never real-in-tests) `runSupervisorLoop`/
   `makeRealSpawnChild`/`makeJsonlLog` correctly, one call per manifest entry, with per-entry log isolation;
   every case touching the real, shared `DAEMON_MANIFEST` asserts against its own current state, never a
   value hardcoded at write time. This proves the launcher's own resolution + wiring logic; it does not spawn
   a real subprocess (that path is exercised by we:skills-src/conveyor/__tests__/supervisor.test.mjs's own
   real-subprocess suite, reused here unmodified).
