---
bornAs: xzkqdnz
kind: decision
parent: "3383"
status: resolved
dateOpened: "2026-09-02"
dateStarted: "2026-09-02"
dateResolved: "2026-09-02"
preparedDate: "2026-09-02"
codifiedIn: "docs/agent/platform-decisions.md#dispatch-status-ground-truth-check"
relatedTo: ["3435", "3449", "3434", "3433"]
relatedReport: reports/2026-09-02-dispatch-status-ground-truth-check.md
tags: [conveyor, dispatch, verification, ground-truth]
---

# Dispatch must cross-check an open item's status against real merged-PR history before treating it as needing work

## Ruling (2026-09-02)

**Ratified 2026-09-02** — per the operator's explicit in-conversation instruction to ratify this card,
delegated to the driving session's own call (epic #3383's own standing kanban-style doctrine); both rulings
below accepted as presented, no alternative picked, no amendment beyond what each fork's own `Skeptic:` pass
already folded in.

- **Ruling 1 (WHERE the check runs): support-both, as stated.** Implement the check at BOTH (b)
  `we:scripts/readiness/dispatch-plan.mjs`'s enrichment step (guards the automatic per-tick sweep) AND (c) a
  guard inside `we:scripts/operations/dispatch-lane.mjs` immediately before spawn (guards the manual
  `dispatch-lane --num=<N>` CLI path). (a) — a `we:scripts/conveyor/queue.mjs add`-time check — remains an
  optional, non-authoritative nicety, not required.
- **Fork 2 (how the check stays cheap): bold default as stated.** For (c), check once, immediately before
  spawn, never on a tick cadence — one `gh pr list --search` call per dispatch attempt. For (b), age-gate:
  only enrich-and-flag items that have sat `open`/`active` past a minimum age, so a freshly-opened item never
  pays the cost while a long-stale one is still caught within a bounded delay.

**Follow-on build scaffolded at ratification:**

- [Wire the dispatch already-done ground-truth check into `we:scripts/operations/dispatch-lane.mjs` and
  `we:scripts/readiness/dispatch-plan.mjs`](/backlog/3460-wire-the-dispatch-already-done-ground-truth-check-into-we-sc/)
  (parent: this item) — names the exact `gh pr` query shape, the age/caching policy, and what happens to a
  flagged item as this build item's own call to make, per this card's own "What this decision does not
  settle."

Codified in `we:docs/agent/platform-decisions.md#dispatch-status-ground-truth-check`.

## Grounding digest

Full survey in
[`we:reports/2026-09-02-dispatch-status-ground-truth-check.md`](../reports/2026-09-02-dispatch-status-ground-truth-check.md),
research topic [`dispatch-status-ground-truth-check`](/research/dispatch-status-ground-truth-check/).

- **Traced both dispatch paths' actual spawn calls — they do NOT converge on one file today.** The manual
  operator path (`node we:scripts/operations/run.mjs dispatch-lane --num=<N>`) is the only caller of
  `we:scripts/operations/dispatch-lane.mjs`. The automatic per-tick sweep is a SEPARATE path:
  `we:skills-src/conveyor/SKILL.md` §3/§3b instructs the live conveyor session to "spawn one background
  `Agent`" directly, with **no mention of `we:scripts/operations/dispatch-lane.mjs`** in either spawn step —
  confirmed by reading `we:skills-src/conveyor/SKILL.md`'s text itself, not inferred. Its own inline comment
  (line 77) names the gap explicitly:
  "routing the spawnBuilds and spawnPrepareScope halves through the operation is its own item" —
  `we:backlog/3096-*.md` (`status: open`, `blockedBy: ["3353"]`, itself `status: open`). The ratified statute
  [`we:docs/agent/platform-decisions.md#conveyor-dispatch-calls-the-declared-operation`](../docs/agent/platform-decisions.md#conveyor-dispatch-calls-the-declared-operation)
  describes this convergence as the TARGET state, not the current one — its own governing card (`#3096`)
  is still open. (An earlier draft of this card asserted the opposite — that both paths already funnel
  through `we:scripts/operations/dispatch-lane.mjs` — based on this prepare session's own system-prompt boilerplate; that
  inference was wrong and is corrected in Fork 1 below.)
- **This means Fork 1 is not "one forced floor plus optional layers" — it is support-both: two currently
  independent chokepoints, each covering a dispatch path the other does not reach.** Recorded as a ruling
  rather than a pick, below.
- **Three independent infra-automation systems converge on a two-tier check-cadence shape** relevant to
  Fork 2: Kubernetes controllers are level-triggered at the reconcile layer specifically so a missed event
  is still caught by the next reconciliation reading live state (periodic full resync is a backstop, not
  the primary mechanism); Terraform's `plan`/`apply` always refreshes real infrastructure state first, with
  a cheaper `-refresh-only` mode for drift visibility alone; `skip-duplicate-actions` (GitHub Actions) puts
  its authoritative dedup check inside the triggered job, not only at trigger-time filtering. All three: an
  authoritative check immediately before the actuation, plus a cheaper advance-visibility pass upstream of
  it — directly relevant once (or if) the two chokepoints above are ever consolidated into one.

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

Two genuinely different, real integration points exist, each catching a different real failure path — this
is not a forced invariant with one buildable branch and one flawed one (the shape that would make this a
plain story instead), and the WHERE question resolves to a ruling rather than a pick (see Ruling 1).

## Ruling 1 — WHERE does the check run? (support-both, not a fork)

**Not a genuine fork, per the standing test:** the original framing of this as "pick among (a)/(b)/(c)"
does not survive tracing the real code (see Grounding digest and the folded-in Skeptic finding below).
Today, (b) and (c) are **both independently required** — they are two coherent branches that must coexist,
not alternatives, because each is the *only* check point on a dispatch path the other does not reach:

- **(c) — a guard inside `we:scripts/operations/dispatch-lane.mjs`, immediately before spawn.** The ONLY
  point the operator's manual `dispatch-lane --num=<N>` CLI path passes through. Nothing upstream of it
  (queue-add, dispatch-plan) sits on this path at all.
- **(b) — `we:scripts/readiness/dispatch-plan.mjs`'s read/enrichment step.** The ONLY point the automatic
  per-tick sweep passes through *today*, because `we:skills-src/conveyor/SKILL.md`'s spawn steps (§3/§3b)
  read `dispatch-plan`'s output and spawn directly via the Agent tool — they do not call
  `we:scripts/operations/dispatch-lane.mjs` (see Grounding digest). A guard placed only at (c) would leave the automatic sweep
  completely unguarded, which is the literal shape of `#3434`'s double-dispatch (one of its two dispatches
  WAS the automatic sweep).
- **(a) `we:scripts/conveyor/queue.mjs add`-time only** remains a cheap, optional, non-authoritative nicety
  — it catches an already-done item before it competes for a slot, but is session-local and gates neither
  the manual nor the automatic path on its own, so it cannot substitute for (b) or (c).

**Ruling: implement the check at BOTH (b) and (c) now; keep (a) as an optional nicety.** Neither (b) nor
(c) is dispensable while the two dispatch paths remain architecturally separate. This is contingent on the
CURRENT architecture, not a permanent shape: once `#3096` lands (routing the automatic sweep through the
declared `dispatch-lane` operation too, per the ratified
[`#conveyor-dispatch-calls-the-declared-operation`](../docs/agent/platform-decisions.md#conveyor-dispatch-calls-the-declared-operation)
statute), a single guard at (c) would cover both paths and (b) could be retired as redundant — but deciding
whether/when to retire it is `#3096`'s own follow-on concern, not this card's.

```js
// Ruling 1 — the check needed at EACH of the two current chokepoints. Exact query shape is explicitly
// left to the follow-on build item (see "What this decision does not settle"); this sketch only fixes
// WHERE the calls sit and what each gates.
async function guardAgainstAlreadyDone({ num, gh }) {
  const mergedPr = await gh.prListSearch({ query: `#${num}`, state: 'merged', limit: 5 });
  if (mergedPr.length) return { dispatch: false, reason: `already closed by ${mergedPr[0].url}` };
  return { dispatch: true };
}
// Called from we:scripts/operations/dispatch-lane.mjs immediately before the spawn effect (guards the
// manual path), AND surfaced as a flag from we:scripts/readiness/dispatch-plan.mjs's enrichment (guards
// the automatic sweep, which reads dispatch-plan's output directly — see Grounding digest).
```

**Skeptic:** REFUTED, then AMENDED. A skeptic sub-agent attacked the prior draft's central claim — that
both dispatch paths already funnel through `we:scripts/operations/dispatch-lane.mjs` — and refuted it by
reading `we:skills-src/conveyor/SKILL.md`'s actual spawn steps (no mention of `we:scripts/operations/dispatch-lane.mjs`) and
`we:backlog/3096-*.md` (still `status: open`, `blockedBy: ["3353"]`, itself open — confirmed via
`gh pr list --search "3096"`/`"3353"`, which show `#3096` and `#3353`'s own PREPARE/harden/split PRs merged
but no PR yet routing the SKILL's dispatch bridge through the declared operation). The prior draft's
"(c) mandatory + (b)/(a) optional" framing is wrong under the corrected facts and is replaced by the
support-both ruling above. This also corrects the two-confusion screen's earlier "flagged(prio)" verdict
(below), which was evaluated against the now-refuted framing.

**Screen:** clear (re-assessed against the corrected, support-both framing — the original fresh-context
screen ran on the earlier, refuted "(c) mandatory + optional layers" draft and flagged it as prioritization;
that flag is now moot because the fork it evaluated no longer exists). Whether a given dispatch path is
checked at all is externally observable (a duplicate spawn happens, or it doesn't), not an implementation
detail; and under a free/instant-engineering-time test a real requirement survives — building (c) does not
reduce or remove the need for (b), because they gate two architecturally separate spawn call sites, so this
is a genuine support-both requirement, not prioritization in disguise.

## Fork 2 — how does the check stay cheap and non-blocking?

**Fork-existence:** (a) is the excluded/broken branch — a per-tick, per-item, unconditional `gh pr list` call
does not scale and duplicates a rate-limit risk this codebase already designed around elsewhere
(`PR_LIST_TIMEOUT_MS`/`PR_LIST_LIMIT`). The real either/or is between (b) (age-gated, periodic) and (c)/(d)
(one-time or batched) — genuine, because a periodic policy trades staleness-tolerance for a standing per-tick
cost while a one-time gate trades a small blind spot (an item that goes stale again after its one check) for
near-zero steady-state cost. **Because Ruling 1 above establishes that (b) is currently the sole enforcement
point for the automatic-sweep path** (not merely an optional efficiency layer), this fork's answer for (b) is
now a correctness-latency parameter — how quickly a stale item stops being re-planned on the automatic path —
not just a cost-saving knob.

A `gh pr list --search "#NNN"` call per candidate item, on every tick, for every queued item, does not scale —
this epic's own machinery already treats `gh pr list` as an expensive, rate-limitable resource elsewhere
(`we:scripts/operations/dispatch-lane-io.mjs`'s own `PR_LIST_TIMEOUT_MS`/`PR_LIST_LIMIT` bounds exist for
exactly this reason). Real options, not exhaustive:

- **(a) Check every tick, every item.** Simplest, always-fresh. Rejected as the default: does not scale past a
  handful of queued items and duplicates the rate-limit risk this codebase already designed around elsewhere.
- **(b) Age-gated — only check items that have sat `open`/`active` past some threshold** (e.g. hours, or N
  ticks since last check). Cheap, catches the real failure mode (stale status lagging real completion is, by
  definition, a thing that has had time to happen), but adds a tunable threshold and a "since when" clock to
  maintain per item.
- **(c) One-time gate at first dispatch only** — check once, the first time an item is actually about to be
  spawned (naturally fits Ruling 1's (c), inside `we:scripts/operations/dispatch-lane.mjs`, immediately
  before spawn), never re-checked on subsequent ticks for the same item. Cheapest steady-state cost (bounded by
  dispatch attempts, not by tick frequency × queue depth), and matches the actual failure shape: the waste
  happened AT the moment of dispatch, so a check exactly there, exactly once per attempt, closes it without
  adding per-tick overhead anywhere.
- **(d) Cached/batched — one `gh pr list --state merged --search "#3383"` (or similar, scoped to the epic) per
  runner tick, shared across every candidate item that tick**, mirroring
  `we:scripts/conveyor/lease-reaper.mjs`'s own independent, analogous bounded-page-per-tick pattern (a
  separate `gh pr list` call, bounded per invocation — not literally sharing
  `we:scripts/operations/dispatch-lane-io.mjs`'s `PR_LIST_TIMEOUT_MS`/`PR_LIST_LIMIT` constants, which
  `we:scripts/conveyor/lease-reaper.mjs` does not reference). Cheapest amortized cost at high queue depth, but only covers the
  automatic-sweep path (Ruling 1's (b)), not a direct manual `dispatch-lane` call, and needs a
  cache-freshness policy of its own.

**Bold default: (c) for the `we:scripts/operations/dispatch-lane.mjs` guard (Ruling 1's (c)) — check once,
immediately before spawn, never on a tick cadence** — this is the cheapest shape that still closes the exact
`#3434` gap on the manual path (a check that runs at the actual spawn point costs one `gh pr list --search`
call per dispatch ATTEMPT, not per tick). For `we:scripts/readiness/dispatch-plan.mjs`'s enrichment step
(Ruling 1's (b)), **age-gate per (b)** — only enrich-and-flag items that have been `open`/`active` for some
minimum age (e.g. items that predate the current tick's own dispatch cycle), so a freshly-opened item never
pays the cost while a long-stale one still gets caught on the automatic path within a bounded delay. Both
defaults avoid a per-tick, per-item, unconditional `gh pr list` call — the shape this fork exists to rule
out. This hybrid (immediate check at (c) + periodic check at (b)) mirrors, independently, Kubernetes'
event-driven-plus-periodic-resync reconcile loop, Terraform's implicit refresh-before-apply, and
`skip-duplicate-actions`'s in-job authoritative check (see Grounding digest) — three unrelated systems
converging on the same two-tier cadence for the same underlying reason, though here the two tiers currently
also happen to be gating two different code paths (Ruling 1), not just two cost tiers of the same path.

```js
// Fork 2(b) — the age-gated periodic check, inside we:scripts/readiness/dispatch-plan.mjs's enrichment
// step. Currently load-bearing for the automatic-sweep path (Ruling 1), not merely a cost optimization —
// its threshold bounds how long a stale item can keep being re-planned before it's caught. Exact
// threshold left to the follow-on build item.
const STALE_AGE_MS = /* left to the follow-on build item */ 0;
function needsGroundTruthCheck(item, now) {
  return now - Date.parse(item.dateOpened || item.dateStarted) > STALE_AGE_MS;
}
```

**Skeptic:** SURVIVES-WITH-AMENDMENT. A skeptic sub-agent found two issues in the prior draft, both folded
in above: (1) framing (b)'s age-gate as purely an "optional upstream filter" whose absence "only costs
efficiency" no longer holds once Ruling 1 establishes (b) as currently the sole enforcement point for the
automatic path — its cadence is now a correctness-latency parameter, reflected in the Fork-existence line
and bold default above; (2) the prior citation "`we:scripts/conveyor/lease-reaper.mjs` shares one bounded page" with
`we:scripts/operations/dispatch-lane-io.mjs`'s `PR_LIST_TIMEOUT_MS`/`PR_LIST_LIMIT` overstated the code reuse —
`we:scripts/conveyor/lease-reaper.mjs` does not reference either constant, it independently applies an analogous pattern — corrected in option (d)
above. The core cadence recommendation (one-time at (c), age-gated at (b)) survives both corrections.

**Screen:** clear. The cadence question is externally visible as "how quickly does a stale item get caught
on each path" — not an implementation detail hidden from a consumer — and it is a genuine merit tradeoff
(steady-state API cost vs. staleness-detection latency on the automatic path specifically, now that Ruling 1
establishes (b) as load-bearing there), not prioritization: even with free, instant engineering time,
unconditional per-tick checking would still cost real rate-limit budget on every tick, which the "free to
build" test does not erase.

### Review jury (provisional — pre-registered #2638)

Care level: `elevated` (dispatch/build machinery — `we:scripts/operations/dispatch-lane.mjs`,
`we:scripts/operations/dispatch-lane-io.mjs`, `we:scripts/readiness/dispatch-plan.mjs`,
`we:scripts/conveyor/queue.mjs` — is system-machinery, not a routine change). This jury binds against the
item's predicted scope and is re-checked against the real diff at PR open.

| juror | lens | grounding method | pre-registered expectation |
| --- | --- | --- | --- |
| correctness#1 | correctness | static-review | The change does what the spec says with no behaviour regression — every changed branch is exercised, and no test is missing, weakened, or gamed to pass while the behaviour is wrong. |
| security#1 | security | static-review | No untrusted input, secret, auth, or file/network path is left unguarded and the trust boundary is not widened — anything touching those earns an explicit security check. |
| simplicity#1 | simplicity | static-review | The change is the smallest one that solves the problem — it reuses what already exists and adds no dead code or needless abstraction. |
| standards-conformance#1 | standards-conformance | static-review | The change follows this repo's conventions and platform-native defaults, and does not diverge from a ratified standard or placement rule. |
| claim-accuracy#1 | claim-accuracy | static-review | Every factual claim the change makes about the repo holds against the repo: a cited path:line names what is actually there, a quoted grep literal really matches, a stated count is the real count, a referenced id or link resolves, and anything the description says was changed appears in the diff. |

## What this decision does not settle

The exact `gh pr` search query shape (search by `#NNN` in title/body vs. a head-ref match vs. something else),
the specific age threshold for Fork 2(b), and whether a stale-status find should auto-resolve the item, only
flag it, or hold the dispatch pending a human/agent look, are implementation — left to the follow-on build
item(s) once this ruling stands, matching how `we:backlog/3427-*.md` (the closest sibling decision in this
epic) left its own wire-shape questions to its build item rather than pre-deciding them here. Also not
settled here: whether/when to retire Ruling 1's (b) once `#3096` lands — that is `#3096`'s own follow-on
concern.

## Done when

1. A ruling is recorded on Ruling 1 (which chokepoint(s) run the check) and Fork 2 (how the check stays cheap
   and non-blocking) — ratify or override the defaults above.
2. A follow-on build item is scaffolded under this card (mirroring how `#3427` → `#3451` scaffolded its own
   follow-on), naming: the exact `gh pr` query, which file(s) from Ruling 1 gain the check, the
   age/caching policy from Fork 2's ruling, and what happens to an item the check flags (hold, auto-resolve, or
   surface — a real, small design choice of its own, not pre-answered here).
3. This card `resolve`s once both Ruling 1 and Fork 2 are ruled — building the follow-on item is separate work
   tracked on its own card, not a precondition of this card's own resolution (matching `#3427`'s same
   convention).
