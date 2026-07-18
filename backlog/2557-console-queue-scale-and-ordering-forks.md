---
bornAs: xfk2sol
kind: decision
size: 3
parent: "2505"
status: open
dateOpened: "2026-07-18"
preparedDate: "2026-07-18"
relatedReport: reports/2026-07-18-console-queue-scale-ordering-prep.md
tags: [plateau-loop, console, console-board, queue, ordering, design-forks]
---

# Console queue scale & ordering forks

**Prepared, ready to ratify.** Four rulings the console mock deferred (design doc §3f/§3g): how the board
**renders** at hundreds of items, in what **order** a cleared set runs, whether a cluster launches **as one
wave or item-by-item**, and whether lanes are **per-program or one global fleet**. These are
*product-surface UX/mechanism* calls for the plateau console build (not WE standard-layer mints) — they gate
the board slices [#2555] so C1/C5/C6 don't hardcode an unratified choice. No greenfield survey: the prior
art is the console design record ([we:docs/design/backlog-console-design.md](docs/design/backlog-console-design.md),
landed #567); each fork is re-grounded against the **real shipped CLI** and carries a **bold default**.

## Axis framing

The four forks are orthogonal — a *render* rule, an *order* rule, a *launch* rule, a *namespace* rule —
each pinned to code that already exists:

- **Render** (Fork 1) reads the loader's derived graph: `blockers` / `openBlockers` / `children` and the
  unblock counts `directUnblocks` / `transitiveUnblocks` / `unblocksToReady`
  ([we:src/_data/backlog.js:367,440,570-577](src/_data/backlog.js)). The frontier rule is a *predicate over
  those fields*, not new data.
- **Order** (Fork 2) is already computed: [we:scripts/lib/build-queue.mjs:181-232](scripts/lib/build-queue.mjs)
  — `orderQueueDetailed` sorts the ready set `tier → effectiveScore → rank → dateOpened(FIFO) → num`, and
  `nextToBuild` filters that *same* order to `buildQueued` (cleared) items. Ratified as **#2526**.
- **Launch** (Fork 3) rides the wave engine: [we:scripts/readiness/batch-schedule.mjs:170-202](scripts/readiness/batch-schedule.mjs)
  — `scheduleWaves` derives contention waves; `readyAfter` adaptively dispatches each wave as predecessors
  land. Feeds [#2560]'s lease acquisition.
- **Namespace** (Fork 4) sits on the lane pool: [we:scripts/lane-pool.mjs:20-21,104-138](scripts/lane-pool.mjs)
  — the pool is keyed by **repo** (WE / FUI / plateau), fungible clones, per-repo dev bands. A *program*
  (backlog epic) is a cross-repo projection, not a pool partition.

### Recommended path at a glance

| Fork | Recommended default | Main alternative (rejected) | Confidence |
|---|---|---|---|
| **Fork 1** — frontier render rule | **State-based frontier** (in-flight ∪ next-cleared ∪ open gates + 1-hop), deeper chains fold to summary bands | k-hop graph-distance frontier | Med-high |
| **Fork 2** — cleared-set order | **Inherit** the ratified #2526 order, *filtered* — clearing is a boolean gate, not a re-sort | a separate cleared-only order signal | High |
| **Fork 3** — launch shape | **Whole-cluster launch** — one action clears the cluster + pours its ready frontier off an editable derived-wave plan (later-wave consent = #2561 F1) | by-hand per-item assembly, no cluster plan | High |
| **Fork 4** — lane namespace | **One global fleet**, program = a projection (chip + per-program share) | per-program lane pools | High |

**Supported by default (not decisions), settled context:**

- **Nothing is silently omitted** (forced invariant, all Fork 1 branches): every fold declares a threshold
  and an explicit "+N more" (design doc §3g G / A1). This is not a fork — it holds under any frontier rule.
- **Semantic zoom is the navigation model** (already settled, design doc §3d): L0 constellation → L1
  program → L2 cluster. Fork 1 rules only *what folds within a level*, not whether zoom exists.
- **The representational-zoom / LOD *intent* mint** is **[#2533] Fork 3's** call, not this item's. Fork 1
  rules the console's *render policy*; if that pattern graduates to a WE `SemanticZoom`/LOD standard, #2533
  owns the mint.

---

## Fork 1 — DAG frontier render rule

**Why it's a fork:** the excluded branch is *render everything flat* — provably broken at the board's
target scale (hundreds of items make the DAG unreadable; the entire premise of design doc §3g T4). So the
board *must* fold; the genuine either/or is **what defines the frontier** (the expanded set) — and the two
coherent definitions cannot both be the default boundary.

**Crux.** At 500 items the board can draw maybe 30–50 nodes legibly. The frontier rule picks which. Two
coherent definitions, grounded in the loader's derived graph
([we:src/_data/backlog.js:367,440,570-577](src/_data/backlog.js)):

- **(a) State-based frontier** *(recommended)* — a node renders **expanded** iff it is in the *active
  frontier*: `status: active` (an in-flight lane), `buildQueued` (the next-cleared cluster), an **open
  gate** (a Tier-B decision / prepared fork), **or** within **one hop** of such a node (its direct blocker
  or direct dependent, for context). Everything else — resolved ancestry, deep not-yet-ready chains — folds
  into a **summary band** (`{root} · +N folded`). This is design doc §3f G / §3g T4 ("only trees with an
  in-flight or next-cluster node render expanded; ✓-fold ancestry").
- **(b) k-hop graph-distance frontier** — render every node within *k* edges of any active node, regardless
  of that node's own state; fold beyond *k*.

**Recommended default: Fork 1 (a) — state-based frontier.** It maps the board to *what the human is
actually working* (in-flight + about-to-launch + gates blocking them), which is the console's whole job
(§3d "attention model"). It's a cheap pure predicate over already-derived fields (no graph BFS per render),
and it degrades honestly — a program with nothing active collapses to summary bands, which is the *correct*
"nothing to see" signal, not an empty screen.

*Rejected — Fork 1 (b):* a pure distance metric renders large fanned neighborhoods of *inactive* work
(#2249's real +#2252-54 sibling fan would flood the board with not-ready nodes) while burying a distant but
*gated* node the human must act on. Distance is not attention; state is. (b) also needs a per-render BFS
over the graph where (a) reads O(1) derived flags.

```js
// Fork 1 (a) DEFAULT — state-based frontier: a pure predicate over the loader's derived graph.
// (we:src/_data/backlog.js already gives each item .status, .buildQueued, .tier, .kind, .blockers, .openBlockers)
// NOTE on the "open gate" clause: deriveTier (we:src/_data/backlog.js:162-163) makes a decision tier 'B'
// ONLY when its blockers are clear (a ready-to-ratify gate) and tier 'C' when blocked — so 'B' already
// implies openBlockers === 0. The gate clause is therefore `tier === 'B'` (ready gate) OR a blocked
// decision (kind === 'decision' && openBlockers > 0); writing `tier === 'B' && openBlockers > 0` is
// unsatisfiable and would silently drop every prepared decision from the frontier.
const isActiveNode = (it) =>
  it.status === 'active'                                   // in-flight lane
  || it.buildQueued                                       // next-cleared cluster
  || it.tier === 'B'                                      // a ready-to-ratify gate (prepared decision)
  || (it.kind === 'decision' && it.openBlockers.length > 0); // a blocked (Tier-C) gate
const inFrontier = (it, active) =>
  isActiveNode(it) ||
  active.some((a) =>                                   // 1-hop context of any active node
    a.blockers.some((b) => b.num === it.num) ||
    it.blockers.some((b) => b.num === a.num));
// everything else → a collapsed summary band with an explicit "+N folded" (the §3g G invariant).

// Fork 1 (b) REJECTED — distance metric: needs a per-render BFS and renders inactive neighborhoods.
// const inFrontier = (it, active) => graphDistance(it, active) <= K;
```

`Skeptic:` SURVIVES-WITH-AMENDMENT — two attacks landed, both fixed in the sample above, not the ruling.
(1) *Omission:* "state-based can hide a far-downstream item whose whole chain is ready but nothing is
active." Closed: the frontier includes `buildQueued` *and* Tier-B gates, and the mandatory "+N more"
summary bands are clickable (zoom expands a band) — the §3g G invariant. (2) *Dead-code predicate
(load-bearing):* the reference `tier === 'B' && openBlockers > 0` is **unsatisfiable** given
`deriveTier` ([we:src/_data/backlog.js:162-163](src/_data/backlog.js)) — tier B already means cleared
blockers — so it would exclude *every prepared decision* (the exact gate the attention model exists to
surface) unless already 1-hop adjacent. Fixed to `tier === 'B'` OR a blocked decision. The frontier
*definition* (attention beats distance) is unchanged; the build must ship the corrected predicate, not
the first draft.
`Screen:` clear — the render rule is user-visible board content (which items appear), a UX/legibility
merit call, not an invisible impl detail; both branches free-to-build still differ on merit (attention vs
distance). Not prioritization. (The fresh-context screen flagged Fork 1 as the *closest* of the four to
"just how the board draws itself," but ruled it observable because the render rule is the console's
primary user-facing output — recorded here so the decider sees the borderline.)

## Fork 2 — Cleared-set ordering

**Why it's a fork (forced-invariant ratify, not a genuine weigh):** exactly one branch is correct and the
alternative is *broken* — the standing test's case (a). The excluded branch is *clearing introduces a
separate ordering signal* (a cleared-only run order that can diverge from the score order); it is broken
because it contradicts #2526's single-source invariant (two knobs that can disagree about "what's next").
So this is a one-line **ratify** the decider confirms, not an open A/B — but it still needs ruling, because
the board build ([#2555]) must cite whether a cleared-only ordering field exists, and the mock listed
"cleared reorder" as a wanted surface (§3f H) that a naive build could implement as that broken second field.

**Crux.** The item framed this as "FIFO **vs** score **vs** operator-pinned." Grounding dissolves that
trichotomy: those three are **already composed**, not rivals. [we:scripts/lib/build-queue.mjs:203-210](scripts/lib/build-queue.mjs)
sorts by `tier (operator-pin) → effectiveScore (by-score) → rank (operator-pin, LexoRank drag) →
dateOpened (FIFO) → num`, and `nextToBuild` ([we:scripts/lib/build-queue.mjs:229-232](scripts/lib/build-queue.mjs))
pulls the top **`buildQueued`** item off that *same* order. Ratified #2526. So the real open question is
narrower:

- **(a) Inherit — clearing is a pure filter** *(recommended)* — the cleared set runs in the ratified #2526
  composite order, *restricted* to `buildQueued: true`. The "cleared reorder" surface the mock wanted
  (design doc §3f H / §3g F list it as missing) is implemented by editing `tier`/`rank` — one ordering
  source of truth, exactly #2526's invariant.
- **(b) Separate cleared-only order** — clearing stamps a distinct signal (clear-time FIFO, or a
  `clearedRank` the operator drags independently of score), so the run order can diverge from the score
  order.

**Recommended default: Fork 2 (a) — inherit, clearing is a boolean gate not a re-sort.** #2526 ratified
that prioritization orders the ready set and readiness-editing is separate; a second cleared-only order
would be a *third* ordering surface that can contradict the first (an item scored #1 but dragged to the
back of the cleared tray — which order wins?). Keeping one source means "reorder the cleared view" simply
*is* "adjust tier/rank," which the operator already has. `buildQueued` stays what the code says it is
([we:scripts/lib/build-queue.mjs:99-101](scripts/lib/build-queue.mjs)): a safety gate (the builder pulls
only cleared items), never an ordering axis.

*Rejected — Fork 2 (b):* a separate cleared order re-opens the exact footgun #2526 closed — two knobs that
can disagree about "what's next," forcing a precedence rule between them and letting a cleared-tray drag
silently override a deliberate score/tier. The reorder need is real; the *second field* is not the way to
meet it.

```js
// Fork 2 (a) DEFAULT — cleared run-order = the ratified #2526 order, FILTERED. Already how the code works:
const clearedRunOrder = orderQueueDetailed(items, config, now).filter((r) => r.buildQueued);
// "reorder the cleared view" == edit tier/rank (ONE source, #2526). No cleared-only field is introduced.

// Fork 2 (b) REJECTED — a separate signal that can diverge from the score order → two ordering sources:
// const clearedRunOrder = items.filter(isBuildQueued).sort(byClearedRankOrClearTime); // contradicts #2526
```

`Skeptic:` SURVIVES-WITH-AMENDMENT — the classification attack partially landed and the framing was
sharpened. The skeptic showed the recommended default is *verbatim the shipped* `nextToBuild`
([we:scripts/lib/build-queue.mjs:230](scripts/lib/build-queue.mjs)) and the "rival" second field is one
nobody proposed — so this is not a genuine weigh. Folded in: reframed as a **forced-invariant ratify**
(above) — the alternative is broken, not a coherent co-equal — which is exactly what the standing test
prescribes for case (a). The *ruling* (inherit; one ordering source) is unchanged and still owed, because
#2526 codified `one-off` (no statute anchor) and never addressed whether *clearing* adds a signal; the
board build needs the explicit "no cleared-only field" cite. Merit-basis holds (one-source correctness vs
two-source precedence ambiguity).
`Screen:` clear — the fresh-context screen independently called this "the strongest, most legitimate fork":
strip cost/effort and a real merit difference remains (one ordering source vs a precedence ambiguity between
two). The ruling is observable (does a cleared-only field exist in the schema), not an impl detail.

## Fork 3 — Wave vs whole-cluster launch

**Why it's a fork:** the excluded branch is *a mandatory human gate between every wave/item* — broken
because it re-introduces the by-hand serialization that #2334's wave scheduler was built to remove,
defeating the parallelism the lane board exists for. The genuine either/or: does **one** launch action
commit the whole cluster (engine self-serializes), or does the operator drive each wave.

**Seam with [#2561] F1 (do not rule here).** #2561 F1 decides the *review/build UNIT* — is the thing a
human launches the same granularity the agent builds (cluster vs single item). **This fork decides only the
launch MECHANICS** given a cleared unit: one-shot pour vs stepped. They align (a cluster unit + whole-cluster
launch compose naturally) but are distinct calls; #2561 F1 owns the unit, this owns the trigger.

**Crux.** The wave machinery already exists and is adaptive:
[we:scripts/readiness/batch-schedule.mjs:170-202](scripts/readiness/batch-schedule.mjs) — `scheduleWaves`
derives contention waves, `readyAfter` re-evaluates dispatchability as items land, `selectModel` picks
all-parallel / all-serial / mixed from the pack's real shape.

- **(a) Whole-cluster launch (plan + pour the frontier)** *(recommended)* — one operator action clears the
  cluster and pours its **ready frontier** (wave 0) now, off the *derived* wave plan; the plan is **shown
  and editable** before launch (research R9, design doc §3h). WIP is a policy value (`lanes ≤ N`, §3d), not
  a hardcoded 1. Each dispatched item acquires a scope lease per [#2560]'s overlap policy. **What happens to
  *later* waves as predecessors land — auto-run vs a per-item front-confirm — is NOT ruled here; it is
  #2561 F1's per-item-consent call** (design doc §3g T1: "descendants surface a short confirm when they
  reach the front; consent stays per-item").
- **(b) Item-by-item, no cluster plan** — the operator assembles and launches each item by hand, with no
  cluster-level clear and no derived-wave plan.

**Recommended default: Fork 3 (a) — cluster-granularity launch: one action clears the cluster, derives the
wave plan, and pours the ready frontier; the plan is shown + editable.** The wave *derivation* already
exists ([we:scripts/readiness/batch-schedule.mjs:170-202](scripts/readiness/batch-schedule.mjs)); making the
operator re-assemble launches by hand throws that away and rebuilds the hand-serialization #2334's wave
derivation removed. "Editable waves before launch" (R9) keeps the human's judgment where it adds value —
*reviewing the plan* — not as a bottleneck on assembling every launch. Kiro's mistake (R9) was deriving
waves but *not* letting the human edit them; we take the waves *and* the edit.

*Rejected — Fork 3 (b):* by-hand per-item assembly with no cluster plan discards the derived-wave structure
and re-serializes throughput on human effort — the lane board's core value (unrelated work runs in parallel,
§3i) never materializes. A per-item *front-confirm* as later waves arrive is a *different* thing (it rides
on top of (a)'s plan) and is #2561 F1's call, not this rejected branch.

```js
// Fork 3 (a) DEFAULT — ONE action clears the cluster + pours its READY FRONTIER (wave 0) off the plan.
// we:scripts/readiness/batch-schedule.mjs derives the wave STRUCTURE (its scope: efficiency, not consent):
const waves = scheduleWaves(cluster);                // the derived plan — SHOWN + EDITABLE pre-launch (R9)
const frontier = readyAfter(cluster, landedNums);    // wave 0 = the ready frontier; poured now
// each poured item acquires its lease (#2560). Whether LATER waves auto-run or re-confirm per item as they
// reach the front is #2561 F1's per-item-consent call — deliberately NOT decided here.

// Fork 3 (b) REJECTED — by-hand per-item assembly, no cluster plan (discards the derived waves, re-serializes):
// for (const item of pickedByHand) { assembleLaunch(item); dispatch(item); }
```

`Skeptic:` SURVIVES-WITH-AMENDMENT — the skeptic caught a **seam overreach** (fixed above). The first draft
ruled "wave k+1 *auto-dispatches* as predecessors land (the engine self-serializes)" — but that decides
*later-wave consent timing*, which is #2561 F1's per-item call, and it *contradicts the design's own T1*
("consent stays per-item," §3g). It also over-extended #2334, whose docstring is explicit it governs wave
*structure* for drain efficiency, **not** dispatch/consent policy
([we:scripts/readiness/batch-schedule.mjs:13-22](scripts/readiness/batch-schedule.mjs)). Narrowed: the fork
now rules only *launch granularity* — one action clears the cluster + pours the ready frontier off the
editable derived plan — and explicitly punts later-wave auto-vs-confirm to #2561 F1. The consent worry
("arms N builds nobody read") is answered upstream (the `buildQueued` clear-gate, Fork 2; the review unit,
#2561 F1); whole-cluster launch pours only *already-cleared* items. Merit-basis holds after the narrowing.
`Screen:` clear — imagine both branches free-to-build and instantly maintained: (a) plans + parallelizes on
real disjointness, (b) re-serializes on by-hand assembly — a throughput/UX merit difference, not
prioritization. Not an impl detail: the operator sees one cluster action + an editable plan vs hand-built
launches. Aligned with #2561 F1's seam (now cleanly, after the narrowing), not duplicating it.

## Fork 4 — Repo / program dimension on lanes

**Why it's a fork:** the excluded branch is *per-program lane pools* — it fragments the fungible,
repo-keyed pool ([we:scripts/lane-pool.mjs:20-21](scripts/lane-pool.mjs)) and *hides cross-program
contention*, which is the design's stated anti-pattern (§3h A2: aggregate health that conceals item-level
truth). One physical fleet and per-program partitions genuinely cannot both be the namespace — the leases
are either global or siloed.

*(Pure scope/namespace call — no code example; there is no wire-form or API shape to show, only where the
partition boundary sits.)*

**Crux.** The physical lane pool is **already global, keyed by repo** (WE / FUI / plateau) with fungible
clones ([we:scripts/lane-pool.mjs:104-138](scripts/lane-pool.mjs)). A *program* is a backlog epic that can
span repos. So the namespace question is: does the console model lanes as —

- **(a) One global fleet, program = a projection** *(recommended)* — a single fleet across the
  constellation; a "program board" is a *filter/view* over it (a program chip + a per-program share, "plateau
  4 · we 1 · free 1", design doc §3i / §3e). Scope leases are global (a lease keeps conflicting work out of
  *any* lane, cross-program). Physical pool stays repo-keyed and fungible underneath.
- **(b) Per-program lane pools** — each program owns its own lane set / namespace; contention is scoped
  within a program.

**Recommended default: Fork 4 (a) — one global fleet, program is a projection not a partition.** Contention
is *physical* (same files → drain conflict), and files don't respect program boundaries — two programs can
touch `we:scripts/pr-land.mjs` and must serialize regardless of which epic they roll under. Only a global
lease namespace makes that visible; per-program pools would let two programs each think a lane is free while
they silently collide at the drain (the §3h A2 / §3i "scope rivals" case). The design already leans this way
— L0 is the *constellation* (all programs), the full fleet view is its own Observer surface (§3e), and
lanes carry a *program chip* precisely because the fleet is shared and needs the program labeled *on* it
(§3i, §3g T9). This composes with [#2560]: the scope-lease namespace is global. It also holds the north-star
open (§6b multi-backlog-system): a global fleet keyed by repo already generalizes to more repos; per-program
silos would not.

*Rejected — Fork 4 (b):* per-program pools optimize for a single-program view at the cost of the
cross-program contention signal that is the lane board's core novelty (§3i). It also fights the existing
repo-keyed pool (a program spans repos, so a per-program pool has no clean physical home) — inventing a
namespace the substrate doesn't have, to hide information the design says must be visible.

`Skeptic:` SURVIVES — the skeptic tried "a per-program board is what the user actually opens (L1 program),
so lanes should be per-program." Held by separating *view* from *namespace*: (a) fully supports a
per-program board — it's a *filter* over the global fleet — while keeping the underlying lease/contention
namespace global so cross-program collisions stay visible. You get the program view without siloing the
physical truth. The skeptic's own classification pass noted the default is *overdetermined by the substrate*
— the [we:scripts/lane-pool.mjs](scripts/lane-pool.mjs) pool has no program dimension at all and a program
spans repos, so (b) invents a key the pool lacks — which *strengthens* (a) (hence High confidence); the
genuinely-open half is the lease *namespace* [#2560] will build, and (a) rules only that it is global.
Cleanly on this side of the #2560 seam (it does not touch the conflict-resolution engine).
`Screen:` clear — merit difference under free-build: (a) surfaces cross-program contention, (b) hides it —
an observability/correctness merit (§3h A2), not prioritization. The call is a visible schema/namespace
property (is a lease global or program-scoped), not an impl detail across the WE↔FUI boundary.

---

## Context

**Nature of these forks.** All four are *product-console* design calls for the plateau board build — they
govern a consuming surface, not the WE standard layer, so none writes a reusable
[we:docs/agent/platform-decisions.md](docs/agent/platform-decisions.md) statute (at resolve,
`codifiedIn: one-off` is the likely home, mirroring the ratified #2526). The one adjacency to the standard
layer is Fork 1's frontier/zoom pattern, whose *mint* as a WE `SemanticZoom`/LOD intent is [#2533] Fork 3's
call — explicitly cross-referenced, not ruled here.

**Seams (do not resolve their forks).**
- **[#2561] F1** (review-unit vs build-unit) is the same granularity axis as Fork 3's launch shape — Fork 3
  rules launch *mechanics* (one-shot pour vs stepped), #2561 F1 rules the *unit*. Align, don't duplicate.
- **[#2560]** (scope-lease + conflict-policy engine) consumes Fork 3 (whole-cluster launch → its lease
  acquisition at each wave dispatch) and Fork 4 (global fleet → its lease namespace is global). This item
  rules the *policy inputs*; #2560 builds the lease engine.

**Grounding CLI (real, shipped).** `orderQueueDetailed` / `nextToBuild` / `isBuildQueued`
([we:scripts/lib/build-queue.mjs](scripts/lib/build-queue.mjs), #2526/#2528/#2530) · `scheduleWaves` /
`readyAfter` / `selectModel` ([we:scripts/readiness/batch-schedule.mjs](scripts/readiness/batch-schedule.mjs),
#2334) · the repo-keyed pool ([we:scripts/lane-pool.mjs](scripts/lane-pool.mjs)) · the derived graph fields
([we:src/_data/backlog.js](src/_data/backlog.js), #248/#254). Prior art + review campaign:
[we:docs/design/backlog-console-design.md](docs/design/backlog-console-design.md) §3d/§3e/§3f/§3g/§3h/§3i.

## Acceptance
Each fork ruled; the board build cites the frontier rule (render/fold), the cleared-order (inherit vs
separate), the launch-wave policy, and the lane namespace, so C1/C5/C6 [#2555] don't hardcode an unratified
choice. Fork 3 aligns with [#2561] F1 and Forks 3/4 feed [#2560] without re-deciding them.
