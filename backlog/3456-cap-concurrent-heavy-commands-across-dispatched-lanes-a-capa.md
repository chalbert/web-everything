---
bornAs: xre3ri7
kind: decision
parent: "3383"
status: open
dateOpened: "2026-09-02"
relatedTo: ["3427", "3451", "3449", "3411", "3405"]
tags: [conveyor, capacity, concurrency, lane-pool, throttle, admission-queue]
---

# Cap concurrent heavy commands across dispatched lanes — a capacity-aware admission queue distinct from lane leasing

## The problem, in the operator's own words (2026-09-02)

As the mechanical dispatcher under #3383 scales up to run more lanes in parallel, each dispatched
delivery/prepare agent's own workflow runs genuinely heavy commands against the local machine — a
full `we:scripts/verify-lane.mjs` (`npm run test:unit && npm run check:standards`), `npm ci`/`npm
install`, a Playwright visual capture for UI-locus items. If enough lanes fire these heavy commands
at the same moment, they compete for CPU/IO and everything grinds to a stop together — **even though
each individual lane's *lease* was perfectly valid.** The operator's own framing: *"if all trigger
heavy command all get to a stop, so we need the queue there first before merging"* (scaling
parallelism further) — i.e. this needs to be built BEFORE increasing parallel lane usage further, not
as nice-to-have follow-on work.

Lane availability and CPU/heavy-command capacity are two different resources. Today only the first is
throttled (the lane pool caps how many lanes can be leased); nothing caps how many of those leased
lanes may be running a heavy command at the same instant.

## What "heavy" actually means today — grounded in the actual briefs and code, not invented

Every dispatched delivery/prepare agent's brief (`we:skills-src/conveyor/delivery-agent-brief.md`,
`we:skills-src/conveyor/prepare-scope-agent-brief.md`, `we:skills-src/conveyor/prepare-decision-agent-brief.md`,
`we:skills-src/conveyor/fix-agent-brief.md`) routes through the same small set of genuinely expensive,
CPU/IO-bound commands:

- **`npm run check:standards`** — the deterministic gate every WE item must pass green before it may
  resolve (`we:skills-src/conveyor/delivery-agent-brief.md` step 5).
- **`we:scripts/verify-lane.mjs`** (`npm run test:unit && npm run check:standards`, unless the
  #3372 diff-driven shrink applies) — run via the declared `we:scripts/operations/run.mjs verify`
  operation, **twice per delivery**: once at step 5 (pre-review gate) and again, synchronously and in
  the foreground, at step 8 against the FINAL commit before `open-pr` will accept
  `--requireVerified=true`. As of #3383's own 2026-08-31 session update this suite was 4181+ tests
  across `lane-pool*`, `operations`, `conveyor`, `lib`, `skills-src/conveyor` alone.
- **`npm ci`** at lane provision/refresh time (`we:scripts/lane-pool.mjs`'s `ensureDeps`, header
  comment: *"Node deps (`node_modules`) are NOT shared — `ensureDeps` runs `npm ci` per lane on a
  fresh clone"*) — not shared across lanes, so N lanes provisioning/refreshing together is N
  independent `npm ci` runs.
- **A Playwright visual-capture pass** (`we:skills-src/conveyor/delivery-agent-brief.md` step 7,
  `plateau-app:tests/visual/capture.mjs`) for any UI-locus item, run against a live dev server.

This is not a hypothetical list — #3383's own card already recorded the failure mode this decision
exists to prevent, live: its "Session update (2026-08-30, night session)" finding 4 reports **four
consecutive local `verify-lane` runs on the SAME diff each failing on a different, unrelated,
timing-sensitive test** under real host contention — *"this session plus a review session plus
several other lanes' dev servers all running concurrently … not a corner case for a dispatcher whose
whole point is more concurrent local agents, not fewer."* That was observed with only a handful of
concurrent lanes. Scaling parallelism further without a cap makes the failure mode systematic, not
occasional.

## Confirmed: no existing concurrency cap on heavy commands — the gap is real, not assumed

Grepped `we:scripts/lane-pool.mjs`, `we:scripts/conveyor/tick-core.mjs`, `we:skills-src/conveyor/runner.mjs`,
and `we:scripts/readiness/dispatch-plan.mjs` for anything resembling a semaphore, a max-parallel
setting, or a job queue (`semaphore|concurrency|throttle|admission|max.?parallel|maxConcurrent`):
**zero hits** in any of the four. What those files DO cap:

- `we:scripts/lane-pool.mjs provision --count=N` / `--acquirable` caps how many lane leases exist —
  a **slot count**, not a simultaneous-heavy-command limit. `we:skills-src/conveyor/SKILL.md` describes
  `freeSlots` in exactly those terms: how many *lanes* are free, nothing about CPU headroom.
- `we:scripts/conveyor/tick-core.mjs`'s only concurrency-shaped value (`inFlight`, line ~693) tracks
  which item **numbers** are mid-build for the in-flight double-dispatch guard (#3416's fix) — a
  correctness guard against dispatching the same item twice, not a resource cap on how many heavy
  commands may run at once.
- `we:scripts/verify-lane.mjs` itself only guards against **two overlapping verify runs corrupting the
  SAME lane's own marker file** (its own header, "#2833 finding 1") — a per-lane correctness guard, not
  a cross-lane capacity limit.

So a dispatcher that grows `provision --count=N` to run more lanes in parallel today has no mechanism
anywhere that would stop all N of them from running `check:standards`/`verify-lane`/`npm ci`
simultaneously the moment their work happens to line up — which is exactly the shape #3383's own
finding 4 already hit by accident with a small handful of lanes.

## Evidence update (2026-09-02 night): the same contention also shows up in the drain daemon's own cadence

Not just a lane's own `verify-lane`/`check:standards` run — the resident drain daemon's separate
JIT-numbering follow-up commit stalled the same way, under the same kind of concurrent-merge load.
`we:scripts/check-standards-rules.mjs` sets `STRANDED_HASH_GRACE_SECONDS = 180`, documented as "~2.5x
the measured 7-73s drain numbering-commit lag" — the window `check:standards` tolerates between a PR
merging (item still under its `bornAs` hash-id filename) and the drain's own commit renaming it to its
permanent number. For one real case tonight, `we:backlog/xhxezum-...md` → `#3455`: the merge landed at
`2026-09-02 14:27:02` (`9dc873eb`) and the drain's numbering commit landed at `2026-09-02 14:46:52`
(`027ee219`) — a **19m50s** gap, **6.6x** past the documented 180s grace window, not a near-miss. This
fell inside a burst of concurrent merges (#1835 at 14:30:43, #1837 at 14:41:52, #1838 at 14:50:50,
#1839 at 14:53:29), and a dispatched agent (`prepare-3448`) hit a real `check:standards` gate-red off
this stranded file mid-window before it self-resolved. Same underlying capacity problem this card
already argues for, a second concrete data point — not a separate issue, and not something to fix here
(the grace-window timing is exactly what this card's own ratification should decide).

## Why this is distinct from #3427 and #3451 — cited, not re-litigated

Both are real, related, non-overlapping context, not something this decision re-opens:

- **#3427** (resolved, ratified 2026-09-01) ruled two forks: Fork 1 bounds the operation *catalog's*
  growth (organic, via the already-ratified missing-operation mechanism); Fork 2 rules that
  read-only/`compute` operation calls get a lightweight, access-log-shaped **visibility** signal
  (operation name, timestamp, caller kind, outcome) — explicitly NOT a control, and explicitly not a
  run-record (the ruling's own reasoning: a `compute` call never suspends, so forcing it into the
  resumable run-record schema is a categorical mismatch). Neither fork says anything about how many
  heavy commands may execute *at the same time*.
- **#3451** (open, queued, parented under #3427) is the build item for that Fork-2 telemetry signal —
  `we:scripts/operations/call-log.mjs` / `we:scripts/operations/call-log-store.mjs`, a rotated
  append-only log. It is observability (what was called, when, by what, with what outcome), not
  admission control. Even fully built, #3451 tells you *after the fact* that ten heavy commands ran at
  once; it does not stop the eleventh from starting until one finishes.

This decision is a genuinely distinct concern: a **capacity-aware admission queue/throttle** so heavy
commands wait their turn instead of all firing at once. It sits logically *downstream* of whatever
execution chokepoint #3427/#3451 establish — a real chokepoint every heavy command routes through (the
declared-operations engine #3427 already ratified) is the natural place to enforce a concurrency
cap, once one exists — but it is not yet designed or scoped by either.

## Why this is a design decision, not a five-minute implementation

Four real, live questions, each with more than one defensible shape and no existing precedent in this
repo to inherit from:

### Fork 1 — what counts as "heavy," and is the list fixed or discovered?

- (a) **An explicit, named list** of known-heavy commands (`check:standards`, `verify-lane`/`test:unit`,
  `npm ci`/`npm install`, the Playwright visual-capture pass) — simple, matches exactly the commands
  found above, easy to reason about and test, but silently misses a future heavy command nobody adds to
  the list.
- (b) **A cap on every command a dispatched agent invokes through the declared-operations engine**,
  regardless of weight — simplest mechanically (one chokepoint, one rule) but wastes capacity throttling
  genuinely cheap `compute` calls (`gate-health`, `suggest-next`, `pr-status` — the same four #3427's
  ruling already names as cheap) alongside real heavy ones.
- (c) **Adaptive** — classify a command as heavy by *measured* cost (wall-clock duration, CPU%) rather
  than a fixed list, self-correcting as new heavy commands appear, but needs a measurement/classification
  layer that doesn't exist yet and adds its own design surface.

### Fork 2 — where does the cap apply: at lane-acquire time or at heavy-command-invocation time?

- (a) **At lane acquire** — `we:scripts/lane-pool.mjs acquire` itself refuses (or blocks) past some
  CPU-capacity-derived limit, even if lane slots are free. Couples two resources the operator explicitly
  said are separate ("lane availability and CPU/heavy-command capacity are two different resources"),
  which risks re-introducing exactly the conflation this card exists to undo.
- (b) **At heavy-command-invocation time** — a lane may always be acquired freely (lane leasing stays
  exactly as it is today); the heavy command itself queues/blocks on a capacity semaphore right before it
  runs. Matches the operator's own framing most directly — a lane can sit idle-but-leased with zero CPU
  cost; only the heavy command consumes the throttled resource.
- (c) **Both** — a soft, informational check at acquire (so a caller CAN see capacity is tight before
  committing a lane) plus the hard admission gate at invocation time — more defense-in-depth, more
  surface to build and keep consistent.

### Fork 3 — a fixed global cap, or adaptive based on real load?

- (a) **A fixed number** (e.g. "at most N heavy commands system-wide," N configurable) — deterministic,
  trivially testable, matches how `provision --count=N` already thinks about lane capacity, but a static
  N either wastes headroom on a quiet machine or still overloads a busy one (the operator's other work,
  a review session, dev servers — all cited as real contention sources in #3383's own finding 4 — are
  invisible to a static count).
- (b) **Adaptive, sampling real CPU/load** (e.g. load average, `os.loadavg()`) and admitting more or
  fewer heavy commands as headroom changes — closer to what actually caused the observed failure
  (real host contention, not lane count alone), but is a fundamentally harder mechanism: noisy signal,
  needs hysteresis to avoid thrashing admission decisions, no existing precedent anywhere in this repo.
- (c) **Fixed but env/config-overridable per machine** (no runtime sampling, but not one hardcoded
  number either) — a middle ground: still deterministic and simple to test, but lets a beefier or
  quieter machine tune the cap without a code change.

### Fork 4 — how does a throttled-but-not-yet-running dispatch surface its own "waiting for capacity" state?

- (a) **A new, distinct status** (e.g. `waiting-for-capacity`) surfaced in the runner's own tick JSON /
  status line, visibly different from "not yet claimed," "blocked," or "in flight" — gives the operator
  and any supervisor a truthful read on why a ready item hasn't actually started.
  Related: `we:backlog/3449-lane-pool-lease-reconciliation-must-not-depend-on-an-activel.md`
  (a sibling #3383 child) is a caution here — whatever state this adds must not create ANOTHER resource
  whose reconciliation quietly depends on a live `/conveyor` session ticking, the exact failure shape
  #3449 names for lease reconciliation.
- (b) **Folded into the #3451 call-visibility signal** once it's built — an `admitted`/`queued`/`released`
  outcome recorded per heavy-command call — reuses a mechanism this epic is already building rather than
  adding a parallel one, but couples this card's landing to #3451's, and #3451 is telemetry, not a live
  status a caller can poll before deciding what to do next.
- (c) **No new surfaced state** — rely on process-level observation only (`ps`, load, the existing
  `.operations/runs/` records) — cheapest to build, but reproduces exactly the "found only by checking by
  hand" pattern #3383's own card already flags as a real, live gap for the notification/escalation
  problem (#3398).

## What this decision does NOT settle

The exact throttle *mechanism* (an OS-level semaphore file, an in-process limiter inside the runner, a
lock directory under `.operations/`, etc.) is implementation, once the forks above are ruled — mirroring
how #3427 left its own enforcement mechanism as a follow-on build, not part of the ruling itself.

## Done when

1. This item is prepared (`/prepare`) — each fork above brought to Definition-of-Ready shape (named
   options + tradeoffs + a bold default + a `Skeptic:`/`Screen:` pass), per this repo's own
   `we:docs/agent/backlog-workflow.md` prepared-fork convention — before any ratification turn is
   presented on it. **Do not attempt to rule on this card directly from the raw forks above.**
2. A ruling is recorded on Forks 1–4 (ratify or override the eventual prepared defaults), with
   `codifiedIn` naming where the ruling lands in `we:docs/agent/platform-decisions.md`.
3. A follow-on build item is scaffolded at ratification, naming the concrete mechanism chosen (semaphore
   shape, where it's enforced, how it's tested — including a real regression test that reproduces
   heavy-command contention with the cap absent, mirroring #3449's own "fails pre-fix" Done-when
   discipline) and citing this card as its origin.
4. The follow-on build item explicitly lands, or is scheduled to land, **before** the dispatcher's
   parallel lane count is increased beyond its current provisioned size — per the operator's own
   explicit sequencing ("we need the queue there first before merging" further parallelism). A ruling
   that defers the build past the next parallelism increase does not satisfy this card.
