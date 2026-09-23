---
bornAs: xktw9vz
kind: story
size: 5
parent: "3383"
status: resolved
blockedBy: ["3871"]
scope: ["we:skills-src/conveyor/supervisor.mjs", "we:skills-src/conveyor/supervisor-launcher.mjs"]
dateOpened: "2026-09-22"
dateStarted: "2026-09-22"
dateResolved: "2026-09-22"
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

**Fourth correction, found in review (PR #2472, round 2, review:changes) — a real design defect, not a stale
literal.** The reviewer read we:skills-src/conveyor/supervisor-launcher.mjs directly against what
we:skills-src/conveyor/daemon-manifest.mjs's `DAEMON_MANIFEST` actually holds today (#3873's 15 real entries,
landed per correction 3 above) and found two compounding bugs, not one:

1. `planLaunchTargets` (we:skills-src/conveyor/supervisor-launcher.mjs) carried only `script`/`args` from each
   resolved manifest entry into the launch target, silently dropping the entry's own `intervalMs` — the field
   `DaemonManifestEntry`'s own typedef (we:skills-src/conveyor/daemon-manifest.mjs) documents as "how often
   we:skills-src/conveyor/pass-daemon.mjs re-runs this pass."
2. Worse, this ALSO falsified this card's own "WHY NO SEPARATE LEASE HERE" claim (that every resident script
   already protects itself via we:skills-src/conveyor/pass-daemon.mjs's `passDaemonLeaseKey(name)`): none of
   we:branch-drift.mjs/we:ci-queue-watch.mjs/etc. take that lease directly — only
   we:skills-src/conveyor/pass-daemon.mjs's own IO shell does, which this launcher bypassed entirely by
   spawning each entry's script straight from `launchEntry`. Combined with bug 1, a launched entry's clean exit
   fell straight into we:skills-src/conveyor/supervisor.mjs's `decideRestart`, which gives an ordinary clean
   exit `delayMs: 0` — a permanent, zero-delay busy-loop re-running every currently-registered entry nonstop
   the instant `main()` is invoked against real manifest entries, with no real lease taken against a
   concurrently-running we:skills-src/conveyor/pass-daemon.mjs instance either. Worse than the "occasional
   overlap" race the reviewer's own written finding described as the worst case.

**Why this is a real architecture mismatch, not a wiring typo.** Every one of the 15 real manifest entries
today is a PERIODIC ONE-SHOT pass (run to completion, wait `intervalMs`, run again) — exactly what
we:skills-src/conveyor/pass-daemon.mjs already correctly does. we:skills-src/conveyor/supervisor.mjs's own
reused-unmodified `classifyExit`/`decideRestart` core is built for a DIFFERENT shape: a long-running process
that should basically never exit, where any exit (including a fast, clean one) is a crash to restart with
backoff. Weighed three shapes (never just took the first): (a) refuse to launch any of today's entries at
all, since we:skills-src/conveyor/pass-daemon.mjs already correctly owns them — rejected because this card's
own scope and title explicitly name the 8 watchers as intended launch targets, so refusing them contradicts
the card's own stated purpose, not just a defect in it; (b) **chosen** — make `launchEntry` pace a periodic
entry correctly (wait `intervalMs` after a clean exit, mirroring we:skills-src/conveyor/pass-daemon.mjs's own
`runPassDaemonLoop` shape) AND take that entry's own `passDaemonLeaseKey(name)` lease (imported from
we:skills-src/conveyor/pass-daemon.mjs, never re-derived) before spawning, while still routing a GENUINE crash
(non-zero exit / signal death) through the reused, unmodified `classifyExit`/`decideRestart` doubling backoff;
(c) redesign we:skills-src/conveyor/daemon-manifest.mjs's schema to add a resident-vs-periodic discriminator —
rejected as out of THIS card's scope (that file belongs to #3871, and no resident entry exists yet to need it;
noted below as an open question for whichever slice registers the first one).

**Fix.** `planLaunchTargets` now carries `intervalMs` through unchanged. A new pure-core function,
`runPeriodicSupervisorLoop` (we:skills-src/conveyor/supervisor-launcher.mjs, NOT
we:skills-src/conveyor/supervisor.mjs — zero edits there, same invariant as corrections 1–3), reuses
`classifyExit`/`decideRestart` unmodified for the crash question but paces a clean exit by `intervalMs`
instead of `decideRestart`'s own `delayMs: 0`. It also disables `classifyExit`'s `too-short` heuristic (default
`crashThresholdMs` 0, not we:skills-src/conveyor/supervisor.mjs's 3s) — that heuristic is tuned for
we:skills-src/conveyor/runner.mjs's own tick-timing assumption ("a real tick costs low-hundreds of ms"), which
does not hold for an arbitrary one-shot watcher pass that may legitimately finish in well under 3s; a
non-zero exit code or signal death is still always classified `'crash'` regardless of this value. `launchEntry`
now acquires `passDaemonLeaseKey(name)` (we:skills-src/conveyor/pass-daemon.mjs, imported unmodified) before
spawning anything, held for the entry's whole lifetime via one heartbeat timer and released on stop or on
throw — a denied lease (already held by a live we:skills-src/conveyor/pass-daemon.mjs instance or a sibling
launcher) returns immediately without spawning, isolated per-entry exactly like an unresolvable name already
was.

**Prevention owed, delivered: the integration-level test the reviewer explicitly asked for.** Every existing
test in we:skills-src/conveyor/__tests__/supervisor-launcher.test.mjs injects a fake `spawnChild`/`runLoop`, so
none of them ever exercised the real `classifyExit`/`runPeriodicSupervisorLoop`/lease path against a real
one-shot script's real exit — precisely the gap the review named. New file
we:skills-src/conveyor/__tests__/supervisor-launcher.integration.test.mjs drives `launchEntry` with NO injected
`spawnChild`/`runLoop` (only file-system PATHS — `root`/`logRoot`/`lockRoot` — redirected to an isolated temp
dir, and small pacing NUMBERS for test speed): (1) a clean real `node -e "process.exit(0)"` child's second real
spawn never follows the first by less than its own `intervalMs`; (2) a real non-zero exit still gets the real
crash backoff, never confused with interval pacing (asserted with `intervalMs` deliberately far larger than
the crash backoff, so a misclassification would time out loudly rather than pass silently); (3) the real,
disk-backed `passDaemonLeaseKey` lease is genuinely held for the run's whole lifetime and genuinely released
after — read via `runnerLeaseStatus` (we:skills-src/conveyor/runner-lock.mjs) against an isolated temp
`lockRoot`, never the shared production one. None of the 15 real manifest entries are safe to actually spawn
in a test (each shells real git state and/or the real `gh` CLI); `node -e` is the SAME realistic-fixture
technique we:skills-src/conveyor/__tests__/supervisor.test.mjs's own `makeRealSpawnChild` suite already
established for exercising a real subprocess without a real pass script.

**Confirmed by reintroduction.** Temporarily reverted just we:skills-src/conveyor/supervisor-launcher.mjs to
its pre-fix (round-1) state and re-ran the full suite: 18 of 35 tests failed, including the new integration
test proving the pacing defect directly (the pre-fix second spawn followed the first almost instantly, not
after `intervalMs`). Restored the fix; all 35 pass again.

**Open question, not this fix's scope.** we:skills-src/conveyor/daemon-manifest.mjs's schema (#3871) requires
`intervalMs` on every entry with no discriminator for a genuinely long-running RESIDENT (Dispatcher,
Fix-dispatch, Review, Verify — this card's own eventual targets). Whichever slice registers the first such
entry will need to teach `launchEntry` to route it through we:skills-src/conveyor/supervisor.mjs's own
unmodified `runSupervisorLoop` instead of the new periodic path — not resolved here, since no resident entry
exists yet to need it.

## Done when

1. **Executable** — `npx vitest run we:skills-src/conveyor/__tests__/supervisor-launcher.test.mjs
   we:skills-src/conveyor/__tests__/supervisor-launcher.integration.test.mjs` passes (35/35 — 32 unit + 3
   integration): the pure `planLaunchTargets`/`defaultLaunchNames` resolve every valid manifest name
   (including its own `intervalMs`, carried through unchanged) and isolate an unresolvable one without
   aborting the rest; the new pure `runPeriodicSupervisorLoop` paces a clean exit by `intervalMs` and routes a
   genuine crash through we:skills-src/conveyor/supervisor.mjs's own reused, unmodified
   `classifyExit`/`decideRestart`; `launchEntry`/`launchAll` take the real `passDaemonLeaseKey(name)` lease
   before spawning (a denial isolates per-entry, never aborting a sibling launch) and wire the resolved
   `script`/`args`/`intervalMs` into we:skills-src/conveyor/supervisor.mjs's own (injected, never real-in-tests)
   `makeRealSpawnChild`/`makeJsonlLog` correctly, one call per manifest entry, with per-entry log isolation;
   every case touching the real, shared `DAEMON_MANIFEST` asserts against its own current state, never a value
   hardcoded at write time. The SEPARATE integration suite proves the same wiring with NO injected
   `spawnChild`/`runLoop` — a real one-shot child process, the real crash-vs-clean classification, and the
   real disk-backed lease, exactly the gap round 2 of PR #2472's review named.
