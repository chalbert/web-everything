---
bornAs: xaibmeu
kind: story
size: 3
parent: "3029"
status: open
blockedBy: ["3037"]
dateOpened: "2026-08-13"
scope:
  - we:skills-src/conveyor/
  - we:scripts/operations/
scopeRationale: "Switches the conveyor SKILL's dispatch bridge to call the already-declared operation, and (per the round-3 review of #1211) hardens stampLiveness/assertHandleNotLive/createDispatchObservers in scripts/operations/ against an unverified claude agents --json shape before the first live dispatch."
tags: [plateau-loop, delivery, operations, conveyor, dispatch]
---

# Route the conveyor's build dispatch through the declared dispatch-lane operation

#3037 declared and registered the dispatch operation, but the conveyor still dispatches the old way: the runner
surfaces `decisions.spawnBuilds` and the main-session bridge spawns each one with the harness `Agent` tool
(`we:skills-src/conveyor/SKILL.md` §3). Two dispatch paths now exist and only one records a durable handle, so a
restart still loses a build the bridge launched. Switch the bridge to call the operation per surfaced launch and
delete the hand-spawn prose.

## The seams to watch

- **The operation shells its OWN tick read.** The bridge must pass its live bookkeeping as `--bookkeepingFile`
  or the read runs guard-less (`guardsFrom: 'none'` on the verdict). Note that the operation forwards only the
  `bookkeeping` key — `config` and `signals` are dropped and reported as `droppedBookkeeping`, so a runner using
  non-default TTLs gets the shipped ones instead; check that before switching.
- **The first LIVE dispatch happens here.** #3037 asserted the `claude --bg --session-id …` argv and never fired
  it. This item settles what a background session's permission mode and isolation default have to be
  (`WE_DISPATCH_AGENT_ARGS` is the knob), and whether the brief's step 1 works from a background agent.
- **The agent-runner CLI backend ruling**
  ([#agent-runner-cli-backend](../docs/agent/platform-decisions.md#agent-runner-cli-backend)) may want to own the
  spawn instead. This item is where the two designs meet; if the ruling wins, the operation becomes its caller.
- **Land #3095 first or with this.** Until the observer can resolve a finished build, every real dispatch
  leaves an entry the waker re-reports forever and eventually exits non-zero on.

## It carries the other half of #3037's acceptance

Ruled by the independent review of PR #1211, and written into #3037's own acceptance rather than left in a
footnote: **the clause "a lane IS dispatched through the declared operation … with the same scope-lease
arbitration … verified against a real queue" is REASSIGNED here.** #3037 delivered the declaration, the
structural holds and the durable handle; nothing has ever been dispatched, and the lease is taken by the agent
running `lane-pool acquire` from the brief — a path that has not executed. This item is where that clause is
met, so #3037 is not fully accepted until this one is.

Named classes of defect only a live run can catch (from the same review, so they are checked here and not
rediscovered): a background session's permission mode (the agent's first act is `bash` inside a `$( … )`, and a
prompt there stalls it holding a handle that reads `running` forever); whether `--session-id` really pins the id
that `claude agents` reports back; whether `-n` is the session-name flag; what the child inherits from a
conveyor runner's environment (`spawnAgent` passes no `env`); and the agent's lane acquisition racing the
parent's assignment, which is the entire reason the in-flight guard exists.

## Carried from PR #1211's round-3 review — must land before the first live dispatch

The round-3 independent review of #3037's PR **accepted with a named residual**: `stampLiveness` and its two
siblings trust the *shape* of `claude agents --json` on a surface nothing in the repo has ever observed. The
review ruled this could not be fixed honestly blind (a fourth guess at an unverified CLI surface) and reassigned
it here, where the payload becomes real. Full finding: H1/H2 of the round-3 review on PR #1211.

**The risk, stated plainly:** if the liveness listing ever comes back in a shape the code does not expect, the
guard reads it as "the agent is dead" and dispatches a SECOND agent onto the same lane about two minutes later
— while the verdict still reports `dispatchLiveness: 'claude-agents'`, the label for "checked against a real
listing and found clear." The failure looks like the strong guard, not like a degraded one.

1. **Capture one real `claude agents --json` payload during this item's own live run and pin the field name to a
   fixture.** Everything below rests on `sessionId` being the right key — the `#3030` spike's account of it, per
   [we:scripts/operations/dispatch-lane-io.mjs:225-249](scripts/operations/dispatch-lane-io.mjs) (`stampLiveness`'s
   docblock), was narrower than the CLI in the one place it mattered, and no code path in the repo has ever run
   `claude --bg --session-id …` and then listed it back. Land the fixture (e.g.
   `we:scripts/operations/__fixtures__/claude-agents-payload.json`) before touching the three functions below, so
   their fix is checked against something real rather than another guess.

2. **A non-empty listing that yields zero usable ids must read as `unreadable`, not as "everyone is gone."**
   Three call sites share the exact-match assumption and must all change together:
   - [we:scripts/operations/dispatch-lane-io.mjs:251-271](scripts/operations/dispatch-lane-io.mjs) — `stampLiveness`.
     Line 265 builds `listed` from `sessions.map((s) => String(s?.sessionId ?? '')).filter(Boolean))`; if
     `sessions` is a non-empty array but `listed.size === 0` after that filter (every element lacked a usable id),
     return the `unreadable` branch (currently we:scripts/operations/dispatch-lane-io.mjs lines 262-264) instead
     of falling through to line 266's `listed.has(...)` comparison, which stamps `live: false` on every row.
   - [we:scripts/operations/wake.mjs:304-330](scripts/operations/wake.mjs) — `assertHandleNotLive`. Same shape:
     `sessions` is checked for `Array.isArray` (we:scripts/operations/wake.mjs lines 319-324) but never for
     "parsed fine, yielded nothing matchable" before the `.some()` compare at line 325. A non-empty-but-unmatchable
     listing must throw the same "could not be told" refusal as the not-an-array branch (lines 320-323), not fall
     through to "not listed, therefore safe to close out."
   - [we:scripts/operations/dispatch-lane-io.mjs:621-650](scripts/operations/dispatch-lane-io.mjs) —
     `createDispatchObservers`. Line 634's `sessions.find((s) => s && String(s.sessionId) === handle)` has the
     same hole; a non-empty, no-match listing must report an observer error (like the `!Array.isArray` throw at
     line 632 of we:scripts/operations/dispatch-lane-io.mjs) rather than falling into the `unresolved` branch at
     line 643.
3. **Compare session ids case- and whitespace-tolerantly**, or state in each docblock why an exact match is
   deliberate. All three exact-match sites above
   (we:scripts/operations/dispatch-lane-io.mjs lines 265/267 and 634, we:scripts/operations/wake.mjs line 325)
   currently do `String(x) === handle`; normalize both sides (e.g. `.trim().toLowerCase()`) before comparing,
   since a CLI that echoes the id in a different case turns every dispatch into a double-dispatch under the
   current exact match.
4. **Age `live: false` from `lastSeenLiveAt`, not `startedAt`.** `dispatchStillHolds`
   ([we:scripts/operations/dispatch-lane.mjs:306-334](scripts/operations/dispatch-lane.mjs), the `entry?.live ===
   false` branch at lines 320-323) currently has nothing but the deadline computed from the original dispatch
   time to decide how long a `live:false` reading is trusted. Persist a `lastSeenLiveAt` timestamp on the run's
   effect entry the first time a listing read confirms `live: true` for it (the natural write point is wherever
   the observer or the guard read next stamps the entry back to the run store), and use that field — falling back
   to `startedAt` only when it was never set — as the anchor for the listing-grace comparison. This means a single
   bad read right after a real "seen alive" cannot release the item; two consecutive bad reads, spaced by the
   grace window, can.
5. **Give the guard its own listing grace, larger than the observer's.** Today both readers share one constant:
   `DISPATCH_LISTING_GRACE_MINUTES = 2` at [we:scripts/operations/dispatch-lane.mjs:108](scripts/operations/dispatch-lane.mjs),
   consumed directly as the guard's default (`listingGraceMinutes = DISPATCH_LISTING_GRACE_MINUTES` at
   we:scripts/operations/dispatch-lane.mjs line 309) and re-derived as `LISTING_GRACE_MS` for the observer at
   [we:scripts/operations/dispatch-lane-io.mjs:65](scripts/operations/dispatch-lane-io.mjs). Their costs of being
   wrong differ by roughly 100x: the observer's wrong answer (`unresolved`) writes nothing, while the guard's
   wrong answer starts a second agent in the same lane clone. Add a distinct, larger constant (e.g.
   `DISPATCH_GUARD_LISTING_GRACE_MINUTES`) and pass it as `dispatchStillHolds`'s default for `listingGraceMinutes`
   instead of reusing the observer's constant, with a docblock stating why the two differ.

## Acceptance

The conveyor dispatches builds only through the declared operation, one live dispatch has been observed end to
end (agent started, handle recorded, run resumable after a restart), the scope-lease arbitration has been
exercised by that live agent's own `acquire`, the SKILL no longer instructs a hand-rolled `Agent` spawn for
a build, and the five liveness-reading hardenings above are landed and each covered by a test that reddens when
the fix is reverted.
