---
bornAs: xfodvzc
kind: story
size: 3
status: open
scope: ["plateau:src/wip/wip-read.ts", "plateau:src/wip/wip-model.ts", "plateau:src/wip/wip-view.ts", "plateau:src/wip/types.ts", "plateau:wip-relay.js", "plateau:src/wip/wip-relay-contract.test.ts", "plateau:src/wip/wip-read.test.ts", "plateau:src/wip/wip-model.test.ts", "plateau:src/wip/wip-view.test.ts", "plateau:src/wip/wip-view.hostile.test.ts"]
dateOpened: "2026-09-28"
preparedDate: "2026-09-30"
preparedAgainstSha: "6025c3536f4df5989ec664206727f8d3a923f3d4"
tags: []
---

# /wip shows the daemons and what they are really doing

**Scope.** A new "Daemons" panel on /wip, additive to the existing runner chips
(plateau:src/wip/wip-read.ts's `readRunners`/`readDrainRunner`) and machine-health strip — reuse those readers
where they overlap rather than re-fetching the same data twice.

**Problem.** The operator has no single place to see whether the build-dispatch daemon's own "N building"
status text matches what is REALLY in flight, or why work is held. Confirmed live today:
~/workspace/.operations/coordination/build-dispatch-daemon.log's JSON status lines carry `status` (the
tick-core's own "conveyor · N building · ... · N queued" text), `inFlight`, `dispatched`, `hold` (array of
`{num, lane, rule, reason}`, e.g. `"7 builds in flight (cap 4)"`) and `freeze` — these can and do diverge from
each other.

**Panel content, each source confirmed live:**
1. Resident launchd daemons up/down — `launchctl list | grep -E 'com\.(we|plateau)\.'` (16 entries today:
   build-dispatch, verify, review, fix-dispatch, health-watch, lease-reaper, wip-publisher, drain-daemon, the
   per-repo lane-pool-health-watch/parked-pr-conflict-watch daemons, conveyor-pass-daemon.merge-orphan-sweep).
2. Build-dispatch: real in-flight builds (`inFlight`/`dispatched`) vs. the tick-core's own "N building" count,
   plus the `hold[]` reason(s) — tail the last JSON line of
   ~/workspace/.operations/coordination/build-dispatch-daemon.log.
3. Verify daemon's queue — `node we:scripts/operations/run.mjs heavy-queue --json` (the host-wide admission pool
   verify-lane runs share), not the plain-text tick log (~/workspace/.operations/coordination/verify-daemon.log
   has no JSON/queue-depth field).
4. Live daemon-started agent sessions — `claude agents --json`, filtered to entries whose pid is actually
   alive; reuse plateau:src/wip/wip-read.ts's existing `readRunningNow` (WE's `live-state`/`live-work` RUNNING
   section) instead of a second, parallel read where the two already cover the same sessions.
5. The operator's own hand-briefed workers — no cheap live source found; leave an explicit "not shown, no
   cheap source" note in the panel rather than fake a row.

**Risks.** `launchctl list` and the daemon log are laptop-local (no relay yet) — same constraint as the rest of
/wip; degrade this panel the same way (`degraded` source) rather than block the page. Log tailing must bound
the read (last line only) — the file is large (build-dispatch-daemon.log is ~280KB and growing).

**Test plan.** Unit-test each new reader with injected `exec`/`readFileSync` fakes (mirrors `readRunners`'s own
seam); a shape-mismatch (stale daemon build) degrades only this panel, never the rest of the snapshot. Add a
`wip-view` render test for the panel's up/down + in-flight-vs-reported-mismatch + hold-reason display.

**Tasks.** (1) add the three readers (launchd, dispatch log, heavy-queue; live agents reuse `readRunningNow`, see ## Design) to plateau:src/wip/wip-read.ts, each in its own `attempt()` boundary;
(2) extend plateau:src/wip/types.ts with the panel's wire shape; (3) render it in plateau:src/wip/wip-view.ts;
(4) wire plateau:src/wip/wip-model.ts if any derived state is needed; (5) tests; (6) `npm test` in plateau-app.

**Proof plan.** At the same moment: the panel's daemon up/down list must match `launchctl list | grep com.we`
(plus `com.plateau`), and its build-dispatch row must match that moment's last line of
~/workspace/.operations/coordination/build-dispatch-daemon.log.

## Design

Premise checked against plateau `origin/main` (1888d29): no daemons panel exists. `plateau:src/wip/wip-view.ts` renders
only `daemonChips` (the 3 non-dispatcher `runners[]` entries), the machine-health strip and the "Running now"
panel; `git log` has only the filing commit for this card. The card's sources are real today: `launchctl list`
shows 15 `com.we|plateau` entries, `we:scripts/operations/run.mjs heavy-queue --json` returns `verdict.{cap,heldCount,waitingCount,rows[]}`,
and the build-dispatch log's JSON lines carry `at`/`status`/`freeze`/…. Correction found while checking: the log
is NOT all JSON — plain lines such as `daemon-self-sync: clone moved …` are interleaved, so "last line" would
sometimes be non-JSON. The reader must scan back through a bounded tail (last ~64 KB via `fs.open` + read at
`size - N`) for the last line that parses as a JSON object with an `at` field.

Mechanism, all additive:
1. `plateau:src/wip/types.ts`: add `WipDaemonsPanel = { observedAt; launchd: {label, running, pid|null}[]; dispatch: {at, reported, inFlight, dispatched, hold: {num, lane, rule, reason}[], freeze}|null; verifyQueue: {cap, held, waiting}|null; }` (live agents are NOT duplicated here — the panel renders the existing `snapshot.runningNow`) and `WipSnapshot.daemons: WipDaemonsPanel | null`; extend `WipSource` with `'daemons'`.
2. `plateau:src/wip/wip-read.ts` (next to `readRunners`, line ~89): three readers, each behind its own `attempt()` boundary so a failure degrades only that sub-panel — `readLaunchd(exec)` (`launchctl list`, filter `com.(we|plateau).`, parse pid/status columns), `readDispatchLog(readTail)` (bounded tail, last JSON line, type-checks fields, throws on shape mismatch), `readHeavyQueue(weRoot, exec)` (`we:scripts/operations/run.mjs heavy-queue --json`). Live agent sessions REUSE `readRunningNow(await liveStatePromise)` (`plateau:src/wip/wip-read.ts:207`, the shared `live-state` promise) — no `claude agents --json` shell-out is added unless `live-state` proves not to cover daemon-started sessions (then a single `claude agents --json` read filtered by `process.kill(pid,0)` liveness). The hand-briefed-workers row is a static "not shown — no cheap source" note in the view, not data.
3. `plateau:src/wip/wip-model.ts` (`buildWipSnapshot`, line ~317): pass `daemons` through (`input.daemons ?? null`), and derive `mismatch = inFlight.length !== reportedBuilding` where `reportedBuilding` is parsed from the `status` text `(\d+) building`; a status that does not parse yields `mismatch: null` (unknown), never `false`.
4. `plateau:src/wip/wip-view.ts` (after `runningPanel`, line ~395): a "Daemons" section, same live-only gating and same `null`-vs-empty honesty as the running panel — up/down list, build-dispatch row ("reported N building · M really in flight" with a mismatch flag), `hold[]` reasons, verify queue, agents, and the no-source note.
5. `plateau:wip-relay.js` `validateSnapshot` (line ~208) validates every field and closes the `WipSource` list (`SOURCES`): the new `daemons` field and `'daemons'` source MUST be added there with bounded strings/arrays (mirroring `checkRunningNow`). Two reasons: (a) `validateSnapshot` rejects any `degraded[].source` outside `SOURCES`, so a failed daemons read (`degraded: ['daemons']`) would make the relay reject the whole snapshot and the page go stale; (b) it never iterates unknown top-level keys, so an unvalidated `daemons` field would be stored untyped and unbounded, breaking the file's "publish token can only store a well-formed snapshot" invariant. This file was missing from the card's scope; added above. `WipSnapshot.daemons` is OPTIONAL (`daemons?: … | null`) so existing fixtures and the `wip-snapshot`/`wip-publish` scripts need no edits.

Two further build details: the log tail read drops its partial first line (a 64 KB cut lands mid-line) before scanning; and `mismatch` is labelled "reported N building · M in flight" and states only the difference — the card's own live sample shows `status` "6 building" against 1 `inFlight` with `dispatched: []`, so the two may legitimately count different things; the panel must not assert a fault, only show both numbers and flag when they differ.

## MVP

Musts only: launchd up/down list; build-dispatch reported-vs-real in-flight with mismatch flag and `hold[]` reasons; verify heavy-queue depth (`cap`/`held`/`waiting`); live agent sessions via the existing `readRunningNow`; the explicit "not shown, no cheap source" note for hand-briefed workers; per-sub-panel degradation; relay schema acceptance of the new field. Out (see Follow-ups): per-daemon last-tick ages, links from a hold row to its card, `launchctl` exit-status decoding, relay-side (phone) rendering of laptop-local-only detail beyond the validated shape.

## Test plan

- `plateau:src/wip/wip-read.test.ts` `readLaunchd`: fake `exec` returning a `launchctl list` table with a running (pid) and a stopped (`-`) `com.we.*` plus a non-matching label → asserts only matching labels, `running` from pid. RED before: reader does not exist.
- `readDispatchLog`: fake tail whose last line is `daemon-self-sync: …` plain text after a JSON line → asserts the JSON line is returned (RED against a naive last-line parse); tail of only non-JSON → throws (degrades); a JSON line with `hold` not an array → throws.
- `readHeavyQueue`: fake exec verdict → asserts cap/held/waiting mapped; malformed verdict throws.
- `readWip` isolation: one reader throwing puts only `'daemons'` in `degraded` while backlog/runners/runningNow still populate.
- `plateau:src/wip/wip-model.test.ts`: `status` "6 building" vs 3 `inFlight` → `mismatch: true`; unparseable status → `null`.
- `plateau:src/wip/wip-view.test.ts`: renders up/down, mismatch flag, hold reason text (escaped), degraded-unknown copy, the no-source note; hostile strings in `reason` are escaped (extend `plateau:src/wip/wip-view.hostile.test.ts` pattern).
- `plateau:src/wip/wip-relay-contract.test.ts`: (a) a snapshot with `degraded: [{source: 'daemons', …}]` passes `validateSnapshot` — RED before, the closed `SOURCES` list rejects it; (b) a snapshot with a malformed `daemons` (string where an array belongs, oversized `reason`) is rejected — RED before, nothing validates the field; (c) a valid `daemons` passes (regression guard, green before and after). Also in `readDispatchLog` tests: a tail beginning with a truncated partial line before valid JSON lines still returns the last JSON line.

## Proof plan

Run `npm run wip:snapshot` in plateau-app (a vite-node script that reads directly; it needs no dev server, so the operator's running server is untouched) and capture the `daemons` field. Immediately after, run `launchctl list | grep -E 'com\.(we|plateau)\.'` and `tail -c 65536 ~/workspace/.operations/coordination/build-dispatch-daemon.log`. Compare: the panel's up/down set equals launchctl's; the build-dispatch row equals the log line whose `at` equals the panel's `dispatch.at` (the daemon appends every tick, so match by `at`, not "last line"; if it has moved on, re-run); the verify queue equals `we:scripts/operations/run.mjs heavy-queue --json`. Relay before/after: feed a live snapshot with `degraded: ['daemons']` and one with a malformed `daemons` through `validateSnapshot` (via `plateau:src/wip/wip-relay-contract.test.ts`'s helper) — before the change the first is rejected and the second accepted; after, the first is accepted and the second rejected. Record both in the PR body.

## Follow-ups

- Per-daemon last-tick/heartbeat ages in the panel.
- Hold rows link to their backlog card / PR.
- Decode `launchctl` last-exit status (crash-looping vs cleanly stopped).
- A live source for the operator's own hand-briefed workers (currently a stated gap, not a Must).

## Done when

1. **Executable** — `npx vitest run plateau:src/wip/wip-read.test.ts plateau:src/wip/wip-view.test.ts` passes
   with cases for the new daemons-panel readers (launchd up/down, build-dispatch in-flight-vs-reported +
   hold reason, verify heavy-queue; live agent sessions are the existing `readRunningNow`, rendered in the panel) and their render.
