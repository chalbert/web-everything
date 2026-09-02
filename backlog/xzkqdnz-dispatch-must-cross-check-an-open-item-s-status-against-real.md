---
kind: decision
parent: "3383"
status: open
dateOpened: "2026-09-02"
relatedTo: ["3435", "3449", "3434", "3433"]
tags: [conveyor, dispatch, verification, ground-truth]
---

# Dispatch must cross-check an open item's status against real merged-PR history before treating it as needing work

## The problem, evidenced tonight (2026-09-02), not hypothesized

Across one session, at least nine distinct backlog items under this epic were found functionally
already-implemented — a merged PR proved the work was done — while their own `status:` frontmatter still read
`open`/`active`: `#3403`, `#3404`, `#3406`, `#3416`, `#3418`, `#3439`, and most recently `#3434` (a
`kind: decision`) and `#3433`. Every one of these is now confirmed independently against the live repo, not
just recalled from conversation:

- **`#3434` is the motivating, costliest case.** Its own card (`we:backlog/3434-*.md`) is `kind: decision`,
  `tier: pinned`, `status: open` — reads as an unratified decision still needing `/prepare`. In fact its
  implementation shipped hours earlier: `gh pr list --search "3434" --state merged` returns `PR #1768`
  ("review-loop-policy: mechanical acceptance from a clean independent verdict (#3434)", merged
  2026-09-01T16:44Z), plus two follow-ups, `PR #1777` and `PR #1784`. The orchestrating session presented
  `#3434` to the operator as needing preparation, and the mechanical dispatcher itself — both the operator's
  own explicit `dispatch-lane` call AND the continuous runner's automatic sweep, racing each other — dispatched
  TWO separate `prepare-decision` agents against it. Real background sessions, real dispatch capacity, real
  token spend, burned on an item whose actual work was already merged, discoverable with one `gh pr list
  --search` call.
- **`#3433` reproduces the exact same shape live, right now, independent of tonight's original 9.** Re-checked
  while authoring this card: `we:backlog/3433-*.md` still reads `status: active`, but `gh pr list --search
  "3433" --state merged` shows `PR #1829` ("WE #3433: bake a Bash disallowedTools deny list into every
  dispatched review session") merged 2026-09-02T16:31Z — after this card's own scaffold. The gap this card
  describes is not a one-night anomaly; it recurred within the same session that is now filing the fix for it.
- `#3403`, `#3404`, `#3406`, `#3416`, `#3418`, `#3439` all now show `status: resolved` in their current
  frontmatter — they were eventually reconciled by hand, in a later close-out pass, not caught mechanically at
  the moment their PRs merged.

The operator's own words, directly, after the `#3434` incident: **"We need better verification to avoid
this."**

## The mechanical gap, verified against the actual dispatch path — not assumed

Grepped `we:scripts/readiness/dispatch-plan.mjs`, `we:scripts/conveyor/queue.mjs`,
`we:scripts/operations/dispatch-lane.mjs`, and `we:scripts/operations/dispatch-lane-io.mjs` for anything
resembling a pre-dispatch "is this already done" check (`gh pr list --search`, an "already implemented" guard,
a status-vs-PR-history cross-check). None exists. What DOES exist, and why it does not cover this case:

- `we:scripts/operations/dispatch-lane-io.mjs`'s `classifyDispatchPr`/`fetchDispatchPrs` machinery (the "PR
  axis") runs `gh pr list --state all`, but its whole job is **attributing a merged PR to the CURRENT dispatch
  attempt** — it matches by `lane/<num>-*` head ref and a `startedAt` cutoff, purpose-built to answer "did the
  PR this run itself produced land," not "does unrelated, prior work already close this item out." It is the
  wrong shape for this gap by construction, not merely unused for it.
- `we:scripts/conveyor/queue.mjs add` (the manual/orchestrator-facing clear-for-build path) checks only the
  item's `kind` (refuses/warns for `epic`/`decision`, per `NON_DISPATCHABLE`) — no PR-history check at all.
- `we:scripts/readiness/dispatch-plan.mjs` enriches its queue rows (`scope`, `openBlockers`, `kind`) from the
  same backlog loader `we:scripts/operations/dispatch-lane-io.mjs` also reads — no PR-history check there
  either. Confirmed this module sits on the automatic-sweep path: `we:scripts/conveyor/tick-core.mjs` shells
  `node we:scripts/readiness/dispatch-plan.mjs --json` every tick (`PLAN_CLI`, line ~899-952).
- `we:scripts/operations/dispatch-lane.mjs` itself only guards against a dispatch already in flight for the
  same num/lane (`"an agent is already in flight for this item"`) — nothing about whether the item's real-world
  state already satisfies it. Critically, **a direct `we:scripts/operations/dispatch-lane.mjs --num=<N>` call
  does not itself re-run `we:scripts/readiness/dispatch-plan.mjs`'s read** — the module's own docblock says
  "the tick already decides multiplicity; a loop here would be a second scheduler in front of it," i.e. it
  trusts that whoever called it already made the planning decision. This is exactly the seam `#3434`'s
  double-dispatch fell through: the operator's manual `dispatch-lane` call and the runner's automatic
  `tick-core` → `dispatch-plan` sweep are two genuinely different call paths into the same spawn point, and
  only one of them (the automatic sweep) would even pass through a `we:scripts/readiness/dispatch-plan.mjs`-only
  check.

**The gap is real, confirmed by grep and by re-reproducing it live on `#3433` while writing this card — not a
guess.**

## Related but distinct — cited, not folded in

- **`#3435`** (mechanically reap/stop finished `claude agents` sessions) is about SESSIONS outliving their
  work — a process-liveness reconciliation problem. This card is about ITEM STATUS lagging real completion — a
  data-freshness problem. Same root shape (trust live ground truth, not stale bookkeeping) applied to a
  different resource; fixing one does not fix the other, mirroring how `#3449` already draws the same
  distinction against `#3435` for lane leases.
- **`#3449`** (lane-pool lease reconciliation must not depend on an actively-ticking conveyor session) is the
  closest sibling in shape — same family, "trust real ground truth over stale bookkeeping" — but for lane
  *leases*, not item *status*. Its own "Done when" pattern (name at least one cadence that is independent of a
  live `/conveyor` session) is a useful precedent for this card's own Fork 2 below.

## Why this needs a ruling, not a direct build

Three genuinely different, real integration points exist, each catching a different real failure path, each
with a real cost tradeoff — this is not a forced invariant with one buildable branch and one flawed one (the
shape that would make this a plain story instead).

## Fork 1 — WHERE does the check run?

- **(a) `we:scripts/conveyor/queue.mjs add`-time only.** Cheapest, and catches an already-done item before it
  ever competes for a dispatch slot. **Insufficient alone**: it is a session-local, manual/orchestrator-facing
  path — `#3434`'s own double-dispatch happened via a DIRECT `dispatch-lane` call plus the runner's automatic
  sweep, neither of which is gated by `we:scripts/conveyor/queue.mjs add`. A queue-add-only check would have
  missed both actual dispatches of `#3434` tonight.
- **(b) `we:scripts/readiness/dispatch-plan.mjs`'s read/enrichment step.** Sits on the automatic runner sweep
  (confirmed: `we:scripts/conveyor/tick-core.mjs` calls it every tick) and enriches every candidate row from
  the same backlog loader already in hand — a natural place to add one more per-item enrichment field.
  **Insufficient alone**: a direct `we:scripts/operations/dispatch-lane.mjs --num=<N>` call (the operator's own
  manual path, and the exact other half of `#3434`'s double-dispatch) does not route through
  `we:scripts/readiness/dispatch-plan.mjs` at all, per `we:scripts/operations/dispatch-lane.mjs`'s own docblock
  ("the tick already decides multiplicity").
- **(c) A guard inside `we:scripts/operations/dispatch-lane.mjs` itself, immediately before spawn.** Closest
  to the actual waste (the token/session cost is spent exactly here) and covers the manual-call path (b)
  misses. Per-item, not batch — runs once per dispatch attempt rather than once per tick, which actually suits
  a live network call better (see Fork 2).

**Bold default: (b) + (c) together, not a single chokepoint.** The evidence above shows each single point
demonstrably misses a real path that already caused waste tonight — (b) alone misses the manual path that
delivered half of `#3434`'s double-dispatch; (c) alone would still let the automatic sweep waste a full
tick-to-dispatch-plan cycle deciding to launch something already-done, only to discover it late. (a) is worth
keeping as a cheap, non-authoritative nicety (`we:scripts/conveyor/queue.mjs` already does a similar advisory
check for `kind`), but should not be the sole enforcement point given it provably doesn't cover the
direct-dispatch path.

## Fork 2 — how does the check stay cheap and non-blocking?

A `gh pr list --search "#NNN"` call per candidate item, on every tick, for every queued item, does not scale —
this epic's own machinery already treats `gh pr list` as an expensive, rate-limitable resource elsewhere
(`we:scripts/operations/dispatch-lane-io.mjs`'s own `PR_LIST_TIMEOUT_MS`/`PR_LIST_LIMIT` bounds exist for
exactly this reason, and `we:scripts/conveyor/lease-reaper.mjs` shares one bounded page rather than issuing a
call per lease). Real options, not exhaustive:

- **(a) Check every tick, every item.** Simplest, always-fresh. Rejected as the default: does not scale past a
  handful of queued items and duplicates the rate-limit risk this codebase already designed around elsewhere.
- **(b) Age-gated — only check items that have sat `open`/`active` past some threshold** (e.g. hours, or N
  ticks since last check). Cheap, catches the real failure mode (stale status lagging real completion is, by
  definition, a thing that has had time to happen), but adds a tunable threshold and a "since when" clock to
  maintain per item.
- **(c) One-time gate at first dispatch only** — check once, the first time an item is actually about to be
  spawned (naturally fits Fork 1's option (c), inside `we:scripts/operations/dispatch-lane.mjs`, immediately
  before spawn), never re-checked on subsequent ticks for the same item. Cheapest steady-state cost (bounded by
  dispatch attempts, not by tick frequency × queue depth), and matches the actual failure shape: the waste
  happened AT the moment of dispatch, so a check exactly there, exactly once per attempt, closes it without
  adding per-tick overhead anywhere.
- **(d) Cached/batched — one `gh pr list --state merged --search "#3383"` (or similar, scoped to the epic) per
  runner tick, shared across every candidate item that tick**, mirroring
  `we:scripts/conveyor/lease-reaper.mjs`'s existing one-bounded-page-shared-across-many-leases pattern.
  Cheapest amortized cost at high queue depth, but only covers the automatic-sweep path (Fork 1(b)), not a
  direct manual `dispatch-lane` call, and needs a cache-freshness policy of its own.

**Bold default: (c) for the `we:scripts/operations/dispatch-lane.mjs` guard (Fork 1's (c)) — check once,
immediately before spawn, never on a tick cadence** — this is the cheapest shape that still closes the exact
`#3434` gap (a check that runs at the actual spawn point, at the actual moment of waste, costs one `gh pr list
--search` call per dispatch ATTEMPT, not per tick). For `we:scripts/readiness/dispatch-plan.mjs`'s enrichment
step (Fork 1's (b)), **age-gate per (b)** — only enrich-and-flag items that have been `open`/`active` for some
minimum age (e.g. items that predate the current tick's own dispatch cycle), so a freshly-opened item never
pays the cost and a long-stale one gets caught before it even reaches the spawn point. Both defaults avoid a
per-tick, per-item, unconditional `gh pr list` call — the shape this fork exists to rule out.

## What this decision does not settle

The exact `gh pr` search query shape (search by `#NNN` in title/body vs. a head-ref match vs. something else),
the specific age threshold for Fork 2(b), and whether a stale-status find should auto-resolve the item, only
flag it, or hold the dispatch pending a human/agent look, are implementation — left to the follow-on build
item(s) once this ruling stands, matching how `we:backlog/3427-*.md` (the closest sibling decision in this
epic) left its own wire-shape questions to its build item rather than pre-deciding them here.

## Done when

1. A ruling is recorded on Fork 1 (which chokepoint(s) run the check) and Fork 2 (how the check stays cheap and
   non-blocking) — ratify or override the bold defaults above.
2. A follow-on build item is scaffolded under this card (mirroring how `#3427` → `#3451` scaffolded its own
   follow-on), naming: the exact `gh pr` query, which file(s) from Fork 1's ruling gain the check, the
   age/caching policy from Fork 2's ruling, and what happens to an item the check flags (hold, auto-resolve, or
   surface — a real, small design choice of its own, not pre-answered here).
3. This card `resolve`s once both forks are ruled — building the follow-on item is separate work tracked on its
   own card, not a precondition of this card's own resolution (matching `#3427`'s same convention).
