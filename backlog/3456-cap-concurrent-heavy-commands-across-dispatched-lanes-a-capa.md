---
bornAs: xre3ri7
kind: decision
parent: "3383"
status: resolved
dateOpened: "2026-09-02"
dateStarted: "2026-09-02"
dateResolved: "2026-09-02"
preparedDate: "2026-09-02"
codifiedIn: "docs/agent/platform-decisions.md#heavy-command-admission-queue"
relatedTo: ["3427", "3451", "3449", "3411", "3405"]
tags: [conveyor, capacity, concurrency, lane-pool, throttle, admission-queue]
relatedReport: reports/2026-09-02-heavy-command-admission-queue.md
---

# Cap concurrent heavy commands across dispatched lanes — a capacity-aware admission queue distinct from lane leasing

## Ruling (2026-09-02)

**Ratified 2026-09-02** — per the operator's explicit in-conversation instruction to ratify this card,
delegated to the driving session's own call (epic #3383's own standing kanban-style doctrine); all three
forks plus the two "Supported by default" items accepted as presented, no alternative picked, no amendment
beyond what each fork's own `Skeptic:` pass already folded in.

- **Fork 1 (what counts as "heavy"): (a) — the bold default.** An explicit named list (`check:standards`,
  `verify-lane`/`test:unit`, `npm ci`/`npm install`, the Playwright visual-capture pass); v1 ships as an
  equal-cost named SET, not weighted.
- **Fork 2 (where the cap applies): (b) — the bold default.** At heavy-command-invocation time, not at
  lane-acquire time. The card's own amendment carries forward unresolved by this ruling: `npm ci` already runs
  inside `we:scripts/lane-pool.mjs`'s `acquire` today (via `ensureDeps`) unless `--no-install` is passed, and
  no dispatched-agent brief currently passes it — the follow-on build must resolve this concretely (either
  make acquire calls pass `--no-install` and gate `npm ci` as its own step, or document it as a narrow,
  acquire-time exception).
- **Fork 3 (how "waiting for capacity" surfaces): (a) — the bold default.** A new, distinct signal in the
  runner's own tick JSON via the existing `notes` array `{ kind, ... }` pattern (e.g. `{ kind:
  'waiting-for-capacity', num, text }`) — not folded into `#3451`'s telemetry (schema mismatch), not silent.
- **Supported by default (not ratifiable forks, already settled):** heavy-command classification stays the
  fixed named list for v1 (no adaptive/measured classifier yet); the admission cap is a fixed number,
  env/config-overridable per machine, sized conservatively below measured host capacity (not Bazel-style
  near-full-utilization) — a fixed cap alone will not fully eliminate the contention failure mode, an
  accepted, named residual risk of v1, not something this ruling overstates as solved.

**Follow-on build scaffolded at ratification:**

- [Build the heavy-command admission queue: a capacity semaphore for check:standards, verify-lane, npm ci, and
  Playwright
  visual-capture](/backlog/3461-build-the-heavy-command-admission-queue-a-capacity-semaphore/) (parent:
  this item) — names the concrete throttle mechanism, cap value/override, `npm ci` resolution, and a real
  "fails pre-fix" regression test as this build item's own call to make, per this card's own "What this
  decision does NOT settle." Must land, or be concretely scheduled to land, before the dispatcher's parallel
  lane count increases further, per the operator's own sequencing.

Codified in `we:docs/agent/platform-decisions.md#heavy-command-admission-queue`.

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
CPU/IO-bound commands. This closed-brief shape is itself ratified doctrine, not incidental: per
`we:backlog/3405-ratify-the-agents-never-run-commands-only-the-mechanical-lay.md`
(`#dispatched-agent-never-runs-commands-directly`), a dispatched agent never invokes an arbitrary command —
only the mechanical layer's own declared briefs/operations do — so the heavy-command surface really is this
small, enumerable set, not an open-ended one a Fork 1(a) named list could never keep up with:

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
  which item **numbers** are mid-build for the in-flight double-dispatch guard — a correctness guard
  against dispatching the same item twice (the exact bookkeeping-handoff bug #3416 diagnosed and fixed,
  in `we:skills-src/conveyor/runner.mjs`'s `bookkeepingForDispatch()`, was a bug in how this guard's
  snapshot reached `dispatch-lane`, not the guard's own creation), not a resource cap on how many heavy
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
permanent number. For one real case tonight, `we:backlog/3455-...md` → `#3455`: the merge landed at
`2026-09-02 14:27:02` (`9dc873eb`) and the drain's numbering commit landed at `2026-09-02 14:46:52`
(`027ee219`) — a **19m50s** gap, **6.6x** past the documented 180s grace window, not a near-miss. This
fell inside a burst of concurrent merges (#1835 at 14:30:43, #1837 at 14:41:52, #1838 at 14:50:50,
#1839 at 14:53:29), and a dispatched agent (`prepare-3448`) hit a real `check:standards` gate-red off
this stranded file mid-window before it self-resolved. Same underlying capacity problem this card
already argues for, a second concrete data point — not a separate issue. **Correction (two-confusion
screen catch):** an earlier draft of this section claimed "the grace-window timing is exactly what this
card's own ratification should decide" — that overstated this card's own scope. None of Forks 1–3 below
rule on `STRANDED_HASH_GRACE_SECONDS`'s value, and this card does not retune it. The two are related only
in that a working admission queue (whatever this card ratifies) should, as a side effect, shrink real
concurrent-merge contention and so the drain's own numbering lag — not because this card sets the grace
window. Retuning `STRANDED_HASH_GRACE_SECONDS` itself, if warranted, is separate follow-up work, out of
scope here (see "What this decision does NOT settle"). A third data point in the same family:
`we:backlog/3411-lane-pool-reap-on-acquire-s-ttl-backdating-tests-flake-red-u.md` (resolved) is a
TTL-backdating test suite that itself flaked red under real host contention — the identical
"tests fail under concurrent load, not because the code is wrong" shape this card's own motivating evidence
already establishes, from a third, independent angle.

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

## Prior-art research

No design for a *counting* (N>1) capacity semaphore exists anywhere in this repo — only single-holder
mutex precedent (below). Surveyed job schedulers (GNU Make's jobserver, Bazel's local-resource
scheduler), a real adaptive-throttle tool (GNU Parallel's `--load`), a CI concurrency-queue UX (GitHub
Actions concurrency groups), and this repo's own two existing cross-process locks
(`we:scripts/readiness/file-locks.mjs`, `we:scripts/conveyor/infra-blocked.mjs`) — published as
`/research/heavy-command-admission-queue-capacity-throttle/`, session report linked via `relatedReport`
above. Each finding is cited inline in the fork it grounds, below.

## Why this is a design decision, not a five-minute implementation

Three real, live forks, plus two adjacent concerns that read like forks at first but dissolve under the
two-confusion screen into "what v1 ships + real, separately-prioritized future work" — each grounded below,
with no existing precedent in this repo to inherit from:

## Fork 1 — what counts as "heavy": an explicit named list, or a blanket cap on every command?

**Fork-existence justification:** a forced invariant on (b) — even at zero build cost, a blanket cap
permanently wastes admission capacity on commands that cost nothing to run concurrently; that is a
merit flaw, not a readiness gap, so it stays excluded regardless of how cheap it would be to build.

- **(a) An explicit, named list** of known-heavy commands — `check:standards`, `verify-lane`/`test:unit`,
  `npm ci`/`npm install`, the Playwright visual-capture pass — each entry carrying a declared admission
  *weight* rather than a bare uniform slot, mirroring how Bazel's local-resource scheduler subtracts a
  per-action *declared* cost (`cpu=N`, `memory=N`) from a tracked pool rather than counting undifferentiated
  job slots (research Finding 2). Simple, matches exactly the commands the grep above already found, easy
  to reason about and test. Silently misses a future heavy command nobody adds to the list — mitigated the
  same way the operation catalog itself grows (#3427 Fork 1): organically, the moment a real gap is
  observed, not by up-front enumeration. **Bold default.**
- **(b) A cap on every command a dispatched agent invokes** through the declared-operations engine,
  regardless of weight. *Rejected — on merit, not cost.* Simplest mechanically (one chokepoint, one rule)
  but wastes admission capacity throttling genuinely cheap `compute` calls (`gate-health`, `suggest-next`,
  `pr-status` — the same calls #3427's own ruling already classifies as cheap, all-`compute`, effectively
  free to run concurrently) alongside real heavy ones. This holds even if (b) were free to build and
  instantly maintained forever: it would still serialize cheap and heavy work indiscriminately, a
  permanent efficiency defect, not a one-time setup cost. (**Citation fix, skeptic-caught:** an earlier
  draft cited "#3427's own Fork 1" as having already rejected this exact shape — checked against #3427's
  real text and that is wrong; #3427 Fork 1 rules on operation-*catalog membership scope* (bounded vs.
  unbounded), not cost weighting. The real precedent is #3427's "Already settled — tiered by cost" clause,
  which treats `compute`/`judge`/`confirm`/`effect` as a real, closed cost-tier vocabulary worth preserving
  distinctions for, not a duplicate rule to cite as rejecting (b) outright — (b) is rejected here on its own
  merits, above, not by analogy to #3427.)

**Not a third branch of this fork (two-confusion-screen catch).** An earlier draft of this fork listed
"(c) adaptive — classify a command as heavy by measured cost" as a third, rejected co-equal option. The
fresh-context screen correctly flagged that as prioritization wearing a fork's clothes: the stated
objection was purely "no measurement/classification layer exists in this repo yet" — a readiness/build-cost
argument that would evaporate if the layer were free to build, not a claim that adaptive classification is
*wrong*. Per this repo's own fork-existence test, that is not a real fork branch. Corrected: **v1 ships
(a)**, and a measured/adaptive heavy-command classifier is **separately-prioritized future work** — not
ruled out, not decided here, not part of this fork's pick (see "Supported by default" below for the
grounding).

**Known occurrence.** Bazel's local-resource scheduler tracks a pool against per-action *declared* costs,
not a blanket per-job slot — the same "named, weighted list" shape as (a) (research Finding 2).

```js
// Illustrative shape for (a) — a named admission list (mechanism TBD by the follow-on build). Skeptic-caught:
// an earlier draft gave every entry the same weight:1, which would be behaviorally identical to (b)'s uniform
// cap until real relative weights exist — so v1 starts as a plain named SET (equal cost), and the follow-on
// build item must treat per-command weighting as a real, separately-measured refinement, not assumed for free:
const HEAVY_COMMANDS = new Set([
  'check:standards',
  'verify-lane',              // npm run test:unit && npm run check:standards
  'npm-ci',
  'playwright-visual-capture',
]);
```

Skeptic: SURVIVES-WITH-AMENDMENT — attacked on (i) the illustrative weighted-list code example being
functionally identical to the rejected (b) until real per-command weights exist, and (ii) a mis-citation of
"#3427 Fork 1" as precedent. Both folded in above: the code example now ships as an equal-cost named set
(not a claimed weighting this decision doesn't actually establish), and the citation now points at #3427's
real "tiered by cost" clause. The default itself (a) survives unchanged — the scope difference from (b),
which commands are throttled at all, was never about weighting and holds regardless.
Screen: flagged(prio) on the original 3-branch framing — resolved by removing (c) as a competing branch
(see "Not a third branch" above); the remaining (a)/(b) choice screens clear (a genuine, cost-independent
merit difference).

## Fork 2 — where does the cap apply: at lane-acquire time or at heavy-command-invocation time?

**Fork-existence justification:** a forced invariant on (a) — coupling lane availability to CPU capacity
re-introduces exactly the conflation the operator's own framing explicitly rejects ("lane availability and
CPU/heavy-command capacity are two different resources"); (b) is the only branch that keeps them
genuinely separate. (c) is not a competing branch (see below).

- **(a) At lane acquire** — `we:scripts/lane-pool.mjs acquire` itself refuses (or blocks) past some
  CPU-capacity-derived limit, even if lane slots are free. *Rejected.* Couples two resources the operator
  explicitly said are separate, which risks re-introducing exactly the conflation this card exists to undo
  — a lane sitting idle-but-leased (writing nothing, spawning nothing) would be charged CPU cost it never
  actually spends. This holds at any build cost: an idle lease is never itself the expensive thing.
- **(b) At heavy-command-invocation time** — a lane may always be acquired freely; the heavy command
  itself queues/blocks on a capacity semaphore right before it runs. Matches the operator's own framing
  most directly, and mirrors GNU Make's jobserver protocol (research Finding 1): a `make` process is always
  free to start — the token is acquired only at the moment a *job* (the actual costly unit) is about to
  run, never at process startup, and one implicit slot is always reserved so a caller is never fully
  starved of forward progress. **Bold default.** **Amendment (skeptic-caught):** "`we:scripts/lane-pool.mjs`'s
  existing `acquire` contract untouched" overstates it for one of the four named heavy commands —
  `we:scripts/lane-pool.mjs`'s `cmdAcquire` (~line 1151) already runs `ensureDeps` (`npm ci`) synchronously
  *inside* `acquire` unless the caller passes `--no-install`, and every dispatched-agent brief's own acquire
  call (`we:skills-src/conveyor/delivery-agent-brief.md:42`, and the prepare briefs' equivalents) never
  passes it — so `npm ci` already executes at acquire time today, not at a separate invocation moment. The
  default (gate at invocation time) still stands, but the follow-on build must resolve this concretely: either
  (i) change dispatched-agent acquire call sites to pass `--no-install` and invoke `npm ci` as its own
  explicit, gated step, or (ii) document `npm ci` as a narrow, named exception whose gate point is inside
  `acquire` itself, not after it. Left for the follow-on build to pick, not re-opening this fork.
- **(c) Both** — a soft, informational check at acquire (so a caller CAN see capacity is tight before
  committing a lane) plus the hard admission gate at invocation time. Not a genuinely competing branch:
  nothing about (b) precludes surfacing a capacity hint at acquire time later, and (c) adds real build and
  consistency surface (a second capacity read that must stay in sync with the invocation-time gate) for a
  benefit that stays speculative until real usage shows callers actually want the early warning. Not ruled
  out — deferred as a possible later enhancement on top of (b), not decided here.

**Known occurrence.** GNU Make's jobserver: a shared token pipe propagated via `MAKEFLAGS`, acquired
immediately before a job starts and released immediately after — never at process/`make`-invocation time —
with one implicit slot always reserved so a caller can always make forward progress even under full
contention (research Finding 1).

Skeptic: SURVIVES-WITH-AMENDMENT — attacked by checking the "acquire's contract stays untouched" claim
against the real `we:scripts/lane-pool.mjs` code: `npm ci` (one of this card's own four named heavy
commands) already runs inside `acquire` today, contradicting the claim as originally worded. The default
itself survives — invocation-time gating is still correct in principle, `npm ci`'s current wiring is a
pre-existing wrinkle, not a reason to gate at acquire-time generally — but the amendment above is folded in
so the follow-on build doesn't silently inherit a false "untouched" premise.
Screen: clear (fresh-context) — a real, caller-visible difference (whether acquiring an idle lease blocks
on CPU capacity it never spends); the argument against (a) survives at zero build cost, so this is a
genuine merit fork, not prioritization in disguise.

## Fork 3 — how does a throttled-but-not-yet-running dispatch surface its own "waiting for capacity" state?

**Fork-existence justification:** a forced invariant on (c) (reproduces an already-flagged gap); (a) vs
(b) is a genuine either/or on *when and where* the state lives — ship a small dedicated signal now, or
depend on #3451 landing first — and (b) is excluded on a schema-mismatch ground independent of sequencing,
not merely "who builds it first."

- **(a) A new, distinct signal** surfaced in the runner's own tick JSON immediately, independent of
  #3451's timeline — visibly different from a not-yet-cleared item, a known-blocked one, or one already
  mid-build (`inFlight`), giving the operator and any supervisor a truthful read on why a ready item
  hasn't actually started. Matches the mainstream shape for exactly this UX: GitHub Actions concurrency
  groups expose a queued job as a distinct, visible `queued`/`pending` state rather than silence (research
  Finding 4). Also the branch that avoids the coupling cost (b) accepts: a tick-JSON field is read on the
  runner's own already-live tick, not a second async read path — satisfying
  `we:backlog/3449-lane-pool-lease-reconciliation-must-not-depend-on-an-activel.md`'s caution that
  whatever state this adds must not create another resource whose reconciliation quietly depends on a live
  `/conveyor` session ticking. **Bold default.**
- **(b) Folded into the #3451 call-visibility signal** once it's built — an `admitted`/`queued`/`released`
  outcome recorded per heavy-command call. *Rejected — on a schema-mismatch ground, not only sequencing.*
  Reuses a mechanism this epic is already building rather than adding a parallel one, but #3451 is
  telemetry (an after-the-fact record a caller queries), not a live status a caller can poll before
  deciding what to do next — the same schema-mismatch shape #3427 Fork 2 already ruled an access-log-shaped
  signal is *not* the same thing as a resumable, pollable status. That mismatch holds even if #3451 shipped
  today for free: querying a log is still not the same operation as polling a live status field. The
  coupling-to-#3451's-timeline cost is real but secondary to this structural reason.
- **(c) No new surfaced state** — rely on process-level observation only (`ps`, load, the existing
  `.operations/runs/` records). *Rejected.* Cheapest to build, but reproduces exactly the "found only by
  checking by hand" pattern #3383's own card already flags as a real, live gap for the notification/
  escalation problem (#3398) — a forced invariant against it, not a preference.

**Known occurrence.** GitHub Actions' concurrency-group queueing: a pending job is a first-class, visible
state (queryable, and since 2026-05-07 queue-depth-configurable up to 100), never silent — the shape (a)
matches (research Finding 4).

```js
// Illustrative shape for (a) — skeptic-caught: an earlier draft invented a `status: 'waiting-for-capacity'`
// enum field that doesn't exist anywhere in we:scripts/conveyor/tick-core.mjs (checked directly — no such
// vocabulary is declared there). The real, grounded precedent already in that file is the `notes` array's
// `{ kind, ... }` shape (tick-core.mjs:847, the existing `kind: 'degraded-infra'` entry) — a new admission-
// queue signal should follow that same real pattern, not a fictitious status enum:
notes.push({
  kind: 'waiting-for-capacity',
  num: 3456,
  text: 'heavy-command admission queue full — waiting for a slot',
});
```

Skeptic: SURVIVES — attacked on whether the cited "not yet claimed / blocked / in flight" tick-JSON status
vocabulary is real; grepping `we:scripts/conveyor/tick-core.mjs` found no such literal enum (only derived
booleans like `buildQueued` and the `inFlight` Set, plus a `notes` array of `{ kind, ... }` entries — e.g.
the existing `kind: 'degraded-infra'` at `we:scripts/conveyor/tick-core.mjs:847`). The default survives: a new, distinct,
immediately-surfaced signal is still right, and the shape now cites the REAL existing `notes`-array pattern
above instead of an invented enum — a stronger, more grounded illustration than the one the attack found
wrong, not a different ruling.
Screen: clear (fresh-context) — directly interface-facing (what an operator/supervisor sees), and the
schema-mismatch argument against (b) survives cost removal, so this is a genuine merit fork.

## Supported by default — not ratifiable forks, screen-caught and dissolved out of Forks 1 and (the former) 3

Two concerns were originally framed as a third competing branch of Fork 1 and as the whole of a "Fork 3,"
respectively. The two-confusion screen (fresh-context, run before stamping) flagged both: in each case the
stated objection to the alternative was purely "the infrastructure to build it doesn't exist yet," which
collapses to nothing once build cost is imagined away — prioritization wearing a fork's clothes, not a
real design fork. Per this repo's own fork-existence test, neither gets a `## Fork N` heading or a ratified
pick; both are recorded here as what v1 ships, with the deferred alternative named as real, separately-
prioritized future work rather than a "rejected" design:

- **Heavy-command classification stays the explicit named list (Fork 1(a)) for v1.** A measured/adaptive
  classifier (cost inferred from wall-clock/CPU%, self-correcting as new heavy commands appear) is real,
  precedented future work (GNU Parallel's `--load` — research Finding 3) — not built because the
  measurement/classification layer doesn't exist anywhere in this repo yet, not because it would be worse.
  File a follow-up idea once real usage shows the fixed list is actually insufficient; not scaffolded here.
- **The admission cap is a fixed number, env/config-overridable per machine — not real-time adaptive.**
  Mirrors Bazel's own default: a pool sized once from a measured host fact (e.g. `HOST_CPUS`-derived), not
  continuously re-sampled (research Finding 2). Real-time adaptive load-sampling (research Finding 3: GNU
  Parallel's `--load` — which itself deliberately avoids naive `os.loadavg()` in favor of a dedicated
  instantaneous `ps`-based signal with hysteresis) would better address the actual root cause described
  above (dev servers, review sessions, and other invisible-to-a-static-count contention) — the card admits
  this plainly. It is not shipped in v1 only because that measurement/hysteresis layer does not exist
  anywhere in this repo yet, the identical readiness gap as the classification point above — not because a
  fixed cap is the better design. Real, separately-prioritized future work once the classification layer
  above exists to share it with; not scaffolded here. ("Hardcoded constant" vs. "config/env-overridable
  constant" is a further non-fold, folded straight into this bullet: it is a config dimension per
  `we:docs/agent/platform-decisions.md#config-extends-platform-default`, whose most-permissive
  platform-default flavor is trivially "overridable, never hardcoded with no escape hatch," at essentially
  zero extra build cost.) **Amendment (skeptic-caught):** Bazel's own `HOST_CPUS`-derived default assumes a
  build machine largely dedicated to Bazel's own work — that authority doesn't fully reach a dev workstation
  whose baseline headroom is itself volatile from processes the admission queue never controls (the
  operator's own review session, other lanes' dev servers — #3383's own finding-4 contention sources). So
  the follow-on build's default `N` must be set **conservatively below measured host capacity**, not
  Bazel-style near-full-utilization, and the follow-on build item must say plainly that a fixed cap alone
  will reduce but not fully eliminate recurrence of #3383's finding-4 scenario — the residual risk from
  contention sources outside the admission queue's own visibility is a known, accepted limitation of v1,
  not a claim this bullet overstates.

Skeptic: SURVIVES-WITH-AMENDMENT (both bullets) — the classification bullet's own citations and reasoning
held up unattacked; the cap-value bullet's citation of Bazel's default was attacked as reaching further than
its real authority (a shared-nothing build farm vs. a dev workstation with uncontrolled competing processes)
and amended above — conservative sizing, and an explicit residual-risk admission, rather than a straight
Bazel-style default.

## What this decision does NOT settle

The exact throttle *mechanism* (an OS-level semaphore file, an in-process limiter inside the runner, a
lock directory under `.operations/`, etc.) is implementation, once the forks above are ruled — mirroring
how #3427 left its own enforcement mechanism as a follow-on build, not part of the ruling itself. The
prior-art survey above names a concrete starting shape for that later build to weigh, without foreclosing
it here: this repo already ships two independently-designed cross-process advisory locks —
`we:scripts/readiness/file-locks.mjs` (#1936, atomic lock-directory + heartbeat-TTL lease + PID-liveness
fast-reclaim) and `we:scripts/conveyor/infra-blocked.mjs`'s `withInfraLock` (exclusive-create lock file +
stale-steal + a hard "never deadlock a tick" timeout fallback) — both single-holder (`N=1`) mutexes. The
follow-on build's natural starting point is generalizing one of those shapes to an `N=cap` counting
semaphore, but which shape (and whether a counting semaphore is even the right primitive vs. a token-pipe
like Make's jobserver) is that item's call, not this one's.

### Review jury (provisional — pre-registered #2638)

Care level: `elevated` — the follow-on build this decision authorizes (Done-when #3) touches
`we:scripts/` system machinery (blast-radius signal), estimated from the item's own nature per #2638's
prepare-time procedure, ahead of a real diff. Predicted touch-set (#2619 probe): `we:scripts/lane-pool.mjs`,
`we:scripts/verify-lane.mjs`, `we:scripts/conveyor/tick-core.mjs`, `we:scripts/conveyor/runner.mjs`,
`we:scripts/readiness/dispatch-plan.mjs`, `we:docs/agent/platform-decisions.md` — the same files this
item's own "no existing cap" grep already named, plus the statute file for the eventual `codifiedIn` entry.
This jury binds against that predicted scope and is re-checked against the real diff when the follow-on
build item opens its PR.

| juror | lens | grounding method | pre-registered expectation |
| --- | --- | --- | --- |
| correctness#1 | correctness | static-review | The change does what the spec says with no behaviour regression — every changed branch is exercised, and no test is missing, weakened, or gamed to pass while the behaviour is wrong. |
| security#1 | security | static-review | No untrusted input, secret, auth, or file/network path is left unguarded and the trust boundary is not widened — anything touching those earns an explicit security check. |
| simplicity#1 | simplicity | static-review | The change is the smallest one that solves the problem — it reuses what already exists and adds no dead code or needless abstraction. |
| standards-conformance#1 | standards-conformance | static-review | The change follows this repo's conventions and platform-native defaults, and does not diverge from a ratified standard or placement rule. |
| claim-accuracy#1 | claim-accuracy | static-review | Every factual claim the change makes about the repo holds against the repo: a cited path:line names what is actually there, a quoted grep literal really matches, a stated count is the real count, a referenced id or link resolves, and anything the description says was changed appears in the diff. |

## Done when

1. This item is prepared (`/prepare`) — each fork above brought to Definition-of-Ready shape (named
   options + tradeoffs + a bold default + a `Skeptic:`/`Screen:` pass), per this repo's own
   `we:docs/agent/backlog-workflow.md` prepared-fork convention — before any ratification turn is
   presented on it. **Do not attempt to rule on this card directly from the raw forks above.**
2. A ruling is recorded on Forks 1–3 (ratify or override the eventual prepared defaults) — the "Supported by default" items need no separate ratification, they are already settled by their own classification — with
   `codifiedIn` naming where the ruling lands in `we:docs/agent/platform-decisions.md`.
3. A follow-on build item is scaffolded at ratification, naming the concrete mechanism chosen (semaphore
   shape, where it's enforced, how it's tested — including a real regression test that reproduces
   heavy-command contention with the cap absent, mirroring #3449's own "fails pre-fix" Done-when
   discipline) and citing this card as its origin.
4. The follow-on build item explicitly lands, or is scheduled to land, **before** the dispatcher's
   parallel lane count is increased beyond its current provisioned size — per the operator's own
   explicit sequencing ("we need the queue there first before merging" further parallelism). A ruling
   that defers the build past the next parallelism increase does not satisfy this card.
