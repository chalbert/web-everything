---
bornAs: xay19t3
kind: story
size: 3
status: open
dateOpened: "2026-08-08"
tags: []
---

# Wire a cadence trigger for the harvest, sharing one lock with the manual command

Fork 4 of #2978 rules the harvest fires on a cadence in addition to the manual `/harvest` command. The hook point exists — `we:scripts/conveyor/tick-core.mjs` is the tick, and `poolStatus()` (`we:scripts/conveyor/learnings-harvest.mjs:173-182`) already returns the depth/age numbers a threshold would read — this is wiring, not new machinery.

#2978 previously cited this as "already filed as #x5nbg4n", a hash that resolves nowhere; this item is the real filing. The manual `/harvest` trigger stays available, and the cadence tick and a manual run must share ONE lock so the two can never double-file — that lock is this item's to build.

## Two grounding corrections carried in from #2978's fork text

Both are verified against `main` at prep time (2026-08-21); the fork's prose predates them.

1. **`poolStatus()` is at `we:scripts/conveyor/learnings-harvest.mjs:187-193`**, not `:173-182`. Its return
   shape is `{ entries, sessions, ageDays, oldest, dir }` — `entries` is the depth, `ageDays`/`oldest` the age.
   Those are exactly the two threshold inputs, and it is already pure-enough to call from a planner (it does
   fs reads, so the *read* stays in the shell — see below).
2. **There is no "singleton pattern `we:scripts/conveyor/*` already uses".** Nothing under
   `we:scripts/conveyor/` takes a lock of any kind — grep it for `file-locks` or `reserve(` and you get
   nothing. The real primitive is `we:scripts/readiness/file-locks.mjs` (`reserve` / `heartbeat` /
   `releaseLockDir`, an atomic `O_EXCL` mkdir + TTL lease), and the worked example of wrapping it in a
   named, machine-global singleton is `we:scripts/readiness/drain-lock.mjs`. Build on those; do not invent
   a third lock mechanism, and do not go looking for a conveyor one that does not exist.

## Design

**The lock — a HOME-level lease, not a repo-level one.** `/harvest` runs from any checkout (primary or a lane
clone) and the conveyor tick runs from another, so two contenders would never see a `.claude/locks` lock in
each other's tree. `we:scripts/readiness/drain-lock.mjs` already solved exactly this and says why: its
`DRAIN_LOCK_ROOT` is a fixed `~/.claude/drain-locks` dir. Local only, never committed (Rule #105). The pool
itself is already machine-fixed (`$LEARNINGS_POOL || ~/.claude/conveyor/learnings`), so the lock's home
matches the resource's home.

**Take the WHOLE-PROCESS LEASE half of that exemplar, not the short mutex — and it must HEARTBEAT.**
`we:scripts/readiness/drain-lock.mjs` ships **two** distinct shapes and they are not interchangeable:

| shape | API | lifetime | refresh |
|---|---|---|---|
| critical-section mutex | `withNumberingLock(fn)` / `withLandWriteLock(fn)` | seconds, one JS call | none |
| whole-process lease | `acquireDrainLease` / `heartbeatDrainLease` / `releaseDrainLease` | a full run | heartbeat |

A harvest is the **second** shape. Its consumer is a multi-step agentic flow —
`we:skills-src/harvest-learnings/SKILL.md` reads the pool, red-teams via a panel that can escalate to three
votes, acquires a lane, routes to backlog/memory, lands a PR, and only then archives — across several
independent `node` invocations, not one function call. That skill's own text says *"Steps 2–3 take
minutes"* (`we:skills-src/harvest-learnings/SKILL.md:147`).

**Why the mutex shape would be actively worse than today.** A TTL-bounded lease with no heartbeat expires
mid-run on any harvest that runs long (a panel escalation, lane contention, a slow `pr-land`). A cadence tick
that fires at that moment finds the lease stale, reclaims it via TTL, and starts a **second** harvest against
the same still-unarchived pool — both routing the same clusters. Today, with a manual-only trigger and no
lock at all, that race cannot happen; shipping the mutex shape would *introduce* the exact double-file this
item exists to prevent. `archivePool` is what makes a re-run non-duplicating, and it runs last.

So the module exports the lease trio, not a `withHarvestLock(fn)` wrapper:

```js
export function acquireHarvestLease(root, owner, { nowMs, leaseMinutes })  // → { ok, reason, heldBy }
export function heartbeatHarvestLease(root, owner, { nowMs })              // → boolean; a stranger's is a no-op
export function releaseHarvestLease(root, owner)                           // → boolean; owner-only
export function harvestLeaseStatus(root, { nowMs, leaseMinutes })          // → { held, stale, owner }
```

and the skill must issue a heartbeat between its long steps, exactly as the drain does across its passes.

**The cadence decision belongs in the pure planner, the pool read does not.**
`we:scripts/conveyor/tick-core.mjs` is pure by contract — its header states no `child_process`, no filesystem,
no `Date.now()`; the clock and the state are injected. So `planTick` (`:737`) must not call `poolStatus()`.
The split that keeps that contract intact:

- the tick's io shell reads `poolStatus()` and passes the numbers in as part of `state` (or `signals`);
- `planTick` gains a small pure predicate — the natural name is `assessHarvestDue({ entries, ageDays, lastHarvestTick, thresholds })` —
  returning a decision the tick emits alongside its existing `spawnBuilds` / prepare / fix decisions;
- the shell acts on that decision, taking the lock first.

This is the same shape `assessIdleStop` (`we:scripts/conveyor/tick-core.mjs:635`) already has: a pure
assessment over injected clock + state, with the effect left to the caller. Copy it rather than adding a new
kind of thing to the tick.

**Thresholds are config with defaults, in the tick's existing style.** `planTick`'s `config` object at
`:738-746` already carries every tunable as `config.x ?? DEFAULT_X`. Add the harvest depth/age thresholds
there; do not read env vars from inside the core.

**Never double-file, and never silently skip.** A manual `/harvest` that finds the lease held must say so and
exit non-zero-or-noisily, not no-op quietly — the failure this item exists to prevent is two runs routing the
same cluster twice, and the failure it must not introduce is a cadence tick that silently swallows the
operator's manual run. `archivePool` (`we:scripts/conveyor/learnings-harvest.mjs:195+`) is the acknowledgement
step and must stay inside the lock: it is what makes a re-run non-duplicating.

## Done when

1. **Executable — the cadence predicate exists and is pure.** Run, from the WE checkout root:

   ```
   npx vitest run scripts/conveyor/__tests__/tick-core.test.mjs
   ```

   It passes with cases driving the new harvest-due assessment over injected `{ entries, ageDays }` +
   thresholds + an injected clock: below both thresholds → not due; over the depth threshold → due; over the
   age threshold with a shallow pool → due; already-harvested-this-window → not due. Fails on `main` (no such
   export).
2. **Executable — the tick core stays pure.** The same suite asserts the new code path runs with no fs and no
   real clock — i.e. the test constructs its inputs as plain objects and never touches `$LEARNINGS_POOL`. A
   `poolStatus` import appearing in `we:scripts/conveyor/tick-core.mjs` fails this criterion by inspection.
3. **Executable — one lock, mutual exclusion proven, INCLUDING the heartbeat.** A unit suite for the new
   harvest-lock module asserts all **four** properties the drain's whole-process-lease block pins at
   `we:scripts/readiness/__tests__/drain-lock.test.mjs:109-141`, not three:
   (a) a second acquire on a live lease returns `{ ok: false, reason: 'held' }`;
   (b) a stale lease (a crashed holder) is reclaimable via TTL;
   (c) **a heartbeat keeps a running harvest live — a refresh before the TTL leaves the lease held past the
   original expiry, and a stranger's heartbeat is a no-op**;
   (d) release frees the lease only for its owner, never stomping a reclaimer.
   Property (c) is the one that makes this lock correct for a minutes-long consumer; a suite that omits it
   passes over the exact race described in *Design*.
4. **Executable — the long-run race is pinned directly.** A case simulates the failure: acquire the lease,
   advance the injected clock past the TTL **with a heartbeat issued in between**, then attempt a cadence
   acquire — it must be refused. Advance past the TTL **without** a heartbeat and the same acquire must
   succeed (the crashed-holder reclaim). The two cases together prove the heartbeat is load-bearing rather
   than decorative.
5. **Observable — the manual path takes the same lock and keeps it alive.** The `/harvest` entry point
   acquires the harvest lease before reading the pool, **heartbeats it between its long steps**, and releases
   it after `archivePool`; a manual run started while the lease is held reports that a harvest is in flight
   rather than proceeding or silently no-opping.
6. **Observable — the fork's two stale claims are corrected at the source.** #2978's Fork 4 text no longer
   cites `we:scripts/conveyor/learnings-harvest.mjs:173-182` or a conveyor singleton lock pattern, so the
   next reader of that ruling is not sent to a line range and a mechanism that do not exist.

## Independent review — 2026-08-21

Confidence: **Medium**

**Risks assessed** (per we:backlog/3103-*.md's taxonomy):

- **premise** (addressed; strategy: verify by mutation or reversion ahead of the build) — The card re-verified #2978's two inherited claims against live main and both corrections check out: poolStatus() is at we:scripts/conveyor/learnings-harvest.mjs:187-193 (not :173-182, confirmed by direct read), and grepping we:scripts/conveyor/ for 'file-locks' or 'reserve(' returns nothing, confirming no conveyor singleton lock pattern exists — the real primitive is we:scripts/readiness/file-locks.mjs / we:scripts/readiness/drain-lock.mjs as the card says.
- **interface** (addressed; strategy: round-trip test at the seam, written by whoever owns neither half) — The pure-core/io-shell split at the poolStatus() seam matches an existing, working precedent: we:scripts/conveyor/tick-core.mjs already threads external async state through a dedicated `signals` param (currently `signals.returnedBuildNums`, read from stdin JSON in main() at :925-935) distinct from `state`, so folding poolStatus()'s {entries, ageDays} into `signals` is a natural, low-risk fit even though the card itself leaves 'state (or signals)' undecided.
- **population** (addressed; strategy: name the population each threshold guards) — The depth/age thresholds guard the exact same population they gate — poolStatus()'s entries/ageDays are read from the same $LEARNINGS_POOL directory that archivePool later drains, so there's no proxy-population mismatch.
- **decorative-guard** (NOT addressed; strategy: mutate the guarded line; require a NAMED test to redden) — The card's own cited exemplar, we:scripts/readiness/drain-lock.mjs, has TWO distinct lock shapes: a short critical-section wrapper (withNumberingLock(fn), seconds-scale, no heartbeat) and a long-lived whole-process lease (acquireDrainLease/heartbeatDrainLease/releaseDrainLease, held across a drain's full run, refreshed by heartbeat). The card's design names only the first shape (withHarvestLock(fn)/acquireHarvestLease()) and never mentions a heartbeat primitive. But the actual consumer -- confirmed by reading we:skills-src/harvest-learnings/SKILL.md -- is a multi-step agentic flow (pool read, red-team via judgePanel/panel-fanout with possible 3-vote escalation, lane acquire, backlog/memory routing, pr-land, then archive) that the skill's own text says 'Steps 2-3 take minutes', spanning several independent `node` subprocess invocations, not one JS call. That shape matches the long-lived whole-process lease, not the short mutex. Done-when #3 claims we:scripts/readiness/__tests__/drain-lock.test.mjs 'pins' three properties for the harvest lock to mirror (blocked-while-held, expired-reclaimable, release-frees); I read that file directly and its whole-process-lease describe block (we:scripts/readiness/__tests__/drain-lock.test.mjs:109-141) actually pins a fourth, load-bearing property -- 'a heartbeat keeps a running drain live (not reclaimed under it)' -- which Done-when #3 omits entirely. As written, a harvest lease with no heartbeat call and a TTL sized like the short mutex (or even the drain's 15-minute default) can expire mid-run on any harvest that runs long (panel escalation, lane contention, PR creation), letting a concurrent cadence tick reclaim the lock and start a second harvest over the same still-unarchived pool -- both routing the same clusters, i.e. the double-file this item exists to prevent. No implementation exists yet to mutate/redden, so I verified this by reading the exemplar's own test suite and the skill's documented duration rather than by mutation. Net effect versus the current base (manual-only trigger, no lock, no automatic double-file path at all): shipping the lock exactly as designed would newly enable a race that cannot happen today, for the item whose whole point is to prevent exactly that race -- introduced by this design, worse than the current no-race baseline, and not fixable in a parallel lane since it requires correcting this same lock module's shape and this same Done-when checklist before the build starts.
- **legibility** (addressed; strategy: assert the failure SURFACES, not just that it occurs) — The card explicitly requires the manual /harvest to fail loudly (non-zero/noisy) rather than silently no-op when the lease is already held, directly targeting the silent-skip failure mode.

**Corrections applied by this review:**

- Done-when #3 says the harvest-lock test suite must assert 'the same three properties we:scripts/readiness/__tests__/drain-lock.test.mjs pins for the drain's leases', but that file's whole-process-lease block (lines 109-141) actually pins four properties, including a heartbeat-sustains-lease test the card's list omits.

The prep's factual grounding is solid and its two corrections to #2978 check out against the live repo, but its lock design borrows the wrong half of its own cited exemplar (a short critical-section wrapper instead of the heartbeat-refreshed whole-process lease we:scripts/readiness/drain-lock.mjs also provides), leaving a plausible path for the cadence tick and a long-running manual harvest to double-file — the exact failure this item exists to prevent.

_Recorded through the declared `review-prep` operation._

**Author response (2026-08-21).** The `decorative-guard` finding is correct, was the most valuable thing this
review produced, and is fully applied. Verified independently: `we:scripts/readiness/__tests__/drain-lock.test.mjs:125-131`
does pin *"a heartbeat keeps a running drain live (not reclaimed under it)"* as a fourth property, and
`we:skills-src/harvest-learnings/SKILL.md:147` does say *"Steps 2–3 take minutes"*. The card's *Design* now
takes the **whole-process lease** half of the exemplar with an explicit `heartbeatHarvestLease`, states why
the mutex shape would newly enable the very race this item prevents, and Done-when #3 lists all four
properties with a new #4 pinning the heartbeat as load-bearing rather than decorative.
