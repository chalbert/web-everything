---
bornAs: x8dkcqt
kind: decision
size: 3
status: resolved
locus: plateau-app
dateOpened: "2026-07-19"
dateStarted: "2026-07-20"
dateResolved: "2026-07-20"
codifiedIn: "docs/backlog-console-design.md#3i-a4"
preparedDate: "2026-07-20"
relatedReport: reports/2026-07-20-scope-breach-recovery-transition-table.md
tags: [console, card-taxonomy, scope-lease, scope-breach, auto-recovery, plateau, decision]
---

# Refine the scope-breach card state (A4) — define its transition table

A4 'paused — scope breach' (UC-A4) is a designed console card state (plateau business logic, sibling to
#2553) whose post-pause behaviour is unspecified. Detection already exists (the write-time
`PreToolUse(Edit|Write)` gate); the gap is the **transition table**. **No design exists yet** — the four
forks below are grounded in a prior-art survey published as the
[scope-breach recovery transition table](/research/scope-breach-recovery-transition-table/) `/research/`
topic (session report via `relatedReport`), each carrying a recommended default in **bold**. This is a
`kind: decision` because the item *is* the fork-set (the transition-table calls), not a build.

## Axis-framing

The concern decomposes into three orthogonal axes the survey surfaced, plus one settled-spec guard:

- **Enforcement granularity** — what unit the lease occupies. Today's implemented primitive is a
  **whole-clone exclusive lease** (`acquire`/`release` over an entire lane clone,
  [we:scripts/lane-pool.mjs:29-30](../scripts/lane-pool.mjs)), while the §3i model *describes* a file-grained
  scope (predicted module-level → observed file-level via `git diff --name-only`,
  `plateau:docs/backlog-console-design.md` §3i). Fork 1.
- **Recovery routing** — where A4 transitions once paused. The §3i breach-mid-build knob already lists three
  policy routes (pause-for-lease · park · resolve-at-drain); the survey maps them onto four named recovery
  archetypes and to the cross-lane family (B2/B3/B8, `plateau:src/backlog-view/card-taxonomy.webcases.ts`
  UC-B2/B3/B8). Fork 2.
- **Hold-source** — who may place a merge-hold. A12 "merge held" (UC-A12, `actor=you`, primary *Unhold
  merge*) is the voluntary counterpart to A6 park-by-policy (UC-A6) and A4 involuntary-fault. Fork 3.
- **Settled-spec guard** — B8 "Swap order" is one of the 17 ruled you-act verbs in the ratified §6e manifest
  (`plateau:docs/backlog-console-design.md` §6e). Whether to drop it is a governance question, not a merit
  fork. Fork 4.

### Recommended path at a glance

| Fork | Recommended default | Main alternative | Confidence |
|---|---|---|---|
| **1 · scope granularity** | Keep the **whole-clone lease** as the enforcement unit; predicted file-scope is an advisory breach signal; git is ground-truth at drain | Per-file/per-path lease manager *(rejected — O(N×L) contention + deadlock surface the parallel-agent consensus avoids)* | **Med-High** — matches whole-worktree-isolation consensus |
| **2 · A4 exits** | Default **retry-in-place / re-plan within scope** (supervisor-restart); *widen* · *hand-off-to-B2/B3/B8* · *bounce/drop* are the §3i policy routes; only `ask` makes A4 amber | A4 is always an amber you-card with the full route menu *(rejected — breaks its `cat:run` grammar)* | **Med-High** — four named recovery archetypes + the ruled §3i knob |
| **3 · A12 hold-source** | **Not user-only** — one hold mechanism with an explicit `holdSource ∈ {user, policy, sibling-lane}`, mirroring A6/A4 | User-only hold *(rejected — A6 policy-park already needs a non-user source)* | **Med** — the sibling-lane source is the thinner half |
| **4 · remove B8?** | **Keep the 17 verbs — §6e is settled** | Drop B8 → 16 *(rejected here — requires re-opening the ratified count with lineage)* | **High** — governance, not merit |

## Fork 1 — scope granularity: whole-clone lease (today) vs finer per-file/per-path scope

**Fork-existence:** a real either/or — the two branches cannot both be the default because they define
"breach" differently. Under a whole-clone lease, breach = "the lane wrote a file its prepared spec didn't
*predict*" (a solo over-reach, gate-detected). Under per-file leases, breach = "the lane wrote a file another
live lease *owns*" (a cross-lease collision). The composability probe *fails*: a per-file lease manager
cannot be a facade over a whole-clone lease (it needs its own lock table, queue, and deadlock discipline),
and the whole-clone lease cannot express per-file ownership — so they are genuinely distinct enforcement
models, not configs of one.

**Crux:** the §3i design describes file-grained scope, but the shipped primitive
([we:scripts/lane-pool.mjs:29-30](../scripts/lane-pool.mjs)) is a whole-clone exclusive lease; enforcement is
the write-time gate, not the lease. So "which granularity is the enforcement unit" is an open, load-bearing
call that fixes what A4 even *means*.

- **(a — recommended) Keep the whole-clone lease as the enforcement unit.** The lane owns its whole tree;
  predicted file-scope is an **advisory breach signal**, not a second lock; git is the ground-truth conflict
  detector at drain. **Merit:** matches the 2025–26 parallel-agent consensus (whole-worktree isolation turns
  silent corruption into visible merge conflicts — Augment/MindStudio/Claude Code) and avoids the **O(N×L)
  contention + deadlock surface** a per-file lock table incurs (CodeCRDT); reuses the existing lease lib with
  zero new machinery. Lock-escalation stays available as Fork 2's *widen* exit without a standing fine-grained
  manager.
- **(b) Subdivide into per-file / per-path leases.** A real lock table with intention locks (Gray et al.
  multi-granularity), per-file FIFO queues, and TTL. **Merit:** maximum concurrency (two lanes on disjoint
  files of the "same module" never serialize) and a precise breach definition. **Cost/complexity is not the
  disqualifier** — the merit disqualifier is that it re-introduces the deadlock + contention surface the
  whole-tree consensus was designed to remove, for a collision git already catches cheaply at drain.

**Default: (a) whole-clone lease.** Coarse-lease-with-predicted-scope-as-advice is the native-first,
lowest-lock-in choice; finer scope is a *later escalation* justified only if real two-lane file collisions are
observed (the #083 survey's fencing-token conclusion, re-applied).

*Rejected:* (b) per-file lease manager — merit-rejected for the O(N×L) contention + deadlock surface it adds
over a git-detected collision, not merely for cost.

**Skeptic:** "A whole-clone lease over-serializes — two lanes editing *different* files of one feature block
each other needlessly." SURVIVES — beat: the pool already dispatches non-overlapping work to *separate* lanes
by item-level scope prediction, so same-clone contention is not the common case; when two lanes genuinely want
the same tree, that is exactly the cross-lane collision Fork 2's hand-off (B2/B3/B8) routes, and git resolves
the residue at drain. The residual the Skeptic surfaces is real but bounded: per-file leasing is the escalation
if measured collision rates ever justify it. `Screen: clear` — the ruling is observable across the impl
boundary (a consumer sees "whole-lane lease" vs "per-file lease" behaviour); merit difference survives with
cost stripped (contention/deadlock model, not effort).

## Fork 2 — A4's exits after the auto-pause

**Fork-existence:** a real either/or on A4's *card grammar*. Either A4 stays `cat:run` (auto/system, no amber
edge) with its transitions driven by the §3i policy knob, or A4 becomes an `actor=you` amber card that always
asks the human to pick a route. Both cannot be the default: UC-A4's ratified triple is
`actor=agent · edge=none · primary=—`, so making it always-amber contradicts the settled grammar, while
keeping it auto needs a defined default transition. The excluded branch is "A4 is always a you-card" — it
violates the ratified `cat:run` classification.

**Crux:** the §3i breach-mid-build knob already lists three configured routes (**pause-for-lease · park ·
resolve-at-drain**), and UC-A4's description already pins the one you-card exception (*"only policy = `ask`
turns this into a you-card"*). So the open call is *which auto transition is the default* and how the routes
map onto the cross-lane family.

The four exits, each a named recovery archetype:

- **(a — recommended default) Retry-in-place / re-plan within scope** ≈ supervisor **restart** (Erlang/OTP).
  The lane drops the out-of-scope edit and finishes the work that stayed in-lease. Cheapest, reversible,
  and the honest default when the breach was a retractable over-reach.
- **(b) Widen the scope / lease** ≈ **lock escalation**. When the work genuinely needs the extra files *and
  no other live lease owns them*, the lane widens its lease to absorb the observed scope. Bounded: widenable
  only into currently-free scope.
- **(c) Hand off to the cross-lane family (B2/B3/B8)** ≈ **reschedule/evict** (Kubernetes). When the wanted
  files belong to *another lane's* live lease, A4 is a cross-lane collision, not a solo fault — route it to
  B2 (starts when both free) / B3 (forced past, resolve step queued at drain) / B8 (rival pair, order
  swappable).
- **(d) Bounce / drop if mis-scoped** ≈ **quarantine** (CI flaky-test isolation). If the slice's real
  footprint was never containable in one lease, bounce it to prepare (re-slice) or drop it — terminal,
  re-filed as a new item.

**Default: (a) retry-in-place, with (b)/(c)/(d) as the §3i policy routes.** A4 stays `cat:run`; the three
auto-policies land directly in their target state tagged "via breach" (exactly as UC-A13 "gap found" routes
its three auto branches), and only `policy = ask` promotes A4 to an amber you-card offering the route menu.

*Rejected:* "A4 is always an amber you-card with the full menu" — contradicts the ratified `actor=agent`
`cat:run` grammar; the amber form is the `ask`-policy special case, not the default.

**Skeptic:** "Retry-in-place will loop forever if the work *inherently* needs the out-of-scope file — you'll
re-breach every attempt." SURVIVES-WITH-AMENDMENT → bound the retry: a re-plan that breaches the *same* scope
twice escalates to (b) widen (if the scope is free) or (c) hand-off (if it's another lease's), and a slice
that can be contained by neither falls to (d) quarantine. The default is retry-*once*-then-escalate, not
retry-forever — the supervisor restart-intensity limit. `Screen: clear` — the routing is observable (a
consumer sees which state A4 transitions to); merit difference survives cost-stripping (correctness of the
recovery path, not effort).

## Fork 3 — A12 "merge held" hold-source: user-only vs policy vs sibling-lane

**Fork-existence:** a real either/or on the hold model. Either a merge-hold has a single implicit source (the
user) or it carries an explicit `holdSource` admitting non-user origins. The excluded branch is "user-only":
A6 "built — parked for review" already needs a **policy** source (the design doc's parked state says *"policy
(or you) parked the work"*), so a user-only hold model cannot express a state the taxonomy already ships —
it is disproven by an existing consumer, not asserted.

**Crux:** A4 (involuntary-fault), A6 (policy-park), and A12 (voluntary merge-hold) are three *sources* over
one hold mechanism, but only A12's source is named in the taxonomy. Kubernetes's voluntary-vs-involuntary
disruption split plus PodDisruptionBudget is the exact prior-art trichotomy: involuntary fault · human action
· policy budget, over one mechanism.

- **(a — recommended) Not user-only — one hold mechanism with an explicit `holdSource ∈ {user, policy,
  sibling-lane}`.** A policy hold (e.g. "hold all merges touching the shared data registry until the schema
  decision ratifies") and a user hold render the same card with a different source chip and unhold authority:
  a user can unhold a user-hold; a policy-hold clears when its condition clears. **Merit:** one mechanism
  serves A4/A6/A12 (correctness + coherence); no new bespoke states; the sibling-lane source expresses "this
  must land after that lane" without a `blockedBy` edit.
- **(b) User-only hold.** A12's hold is always human-placed. **Merit:** none over (a) that survives — it
  cannot represent A6's policy-park, forcing a *second* hold mechanism for policy holds (duplication +
  drift), the exact opposite of the one-mechanism win.

**Default: (a) explicit `holdSource`, not user-only.** Mirror A6/A4; the sibling-lane source is the thinner
half (admit it, but it is the lowest-confidence element — a program may choose to model lane ordering purely
as `blockedBy` instead).

*Rejected:* (b) user-only — disproven by A6's existing policy-park consumer; forces a duplicate hold mechanism.

**Skeptic:** "A sibling-lane hold-source duplicates `blockedBy` — you already have a dependency edge for
'land after that lane.'" SURVIVES-WITH-AMENDMENT → the two are distinct: `blockedBy` is a *logical* item-level
prerequisite (B needs A *merged*), while a sibling-lane merge-hold is a *physical* drain-ordering hold placed
at merge time without editing the item's dependency graph. Keep both, but flag sibling-lane as the optional,
lowest-confidence source (a deployment may collapse it into `blockedBy`). `Screen: clear` — the hold-source is
observable on the card (source chip + unhold authority); merit survives cost-stripping (who-can-unhold
correctness, not effort).

## Fork 4 — "Remove B8 Swap-order?" (settled-spec guard: keep 17 vs drop to 16)

**Fork-existence:** the branches genuinely cannot coexist — the ratified you-act verb count is either **17**
(keep B8) or **16** (drop it); the webcase conformance test and the glyph columns (#2553/#2555) assert a
single number. The excluded branch is "drop B8 as a prep default": B8 "⚔ rival pair" (`Swap order=swap`) is
one of the 17 ruled verbs in the **settled §6e manifest** (`plateau:docs/backlog-console-design.md` §6e,
ratified 2026-07-20; the count reconciled by #2578). This fork does **not** weigh design merit — it weighs
*honor the settled ruling* vs *re-open it*.

- **(a — recommended default) Keep the 17 verbs — §6e is settled.** B8 stays. Any change to the ratified
  count is a *new* decision that supersedes §6e **with lineage** (the platform-decisions reversibility rule),
  not an edit folded into A4's transition table. **Merit:** preserves the ratified conformance count the
  webcase test + glyph columns cite; no silent spec drift.
- **(b) Drop B8 → 16.** Only warranted if the rival-pair state proves to never need an explicit swap verb in
  the *built* board — a finding that does not exist yet. **Merit:** none available now; pursuing it means
  re-opening a ratified count without evidence.

**Default: (a) keep-17.** This prep does **not** apply any change to §6e; the settled spec stands. If a
genuine drop case ever arises, file a separate decision that re-opens the §6e verb-count ruling with lineage.

*Rejected (here):* (b) drop B8 — out of scope for A4's transition table; requires re-opening the ratified
§6e count, which prep must not do.

**Skeptic:** "Framing a settled-spec question as a 'fork' invites relitigating §6e every time A4 is touched."
SURVIVES — beat: the fork exists precisely to *record* B8 as settled and quarantine the removal question away
from A4's real transitions, so the ratification turn nods keep-17 in one glance rather than the removal
leaking in as an undocumented aside. `Screen: flagged(prio) → recorded as a settled-spec guard, not a merit
call` — there is no live merit unknown; the "fork" is a governance guard whose only job is to keep §6e
honored, so it is a one-line ratify, not a research residue.

## Context

- **Lineage:** granular `kind: decision` refining the console card taxonomy (UC-A4), sibling to #2553's glyph
  column and the ratified webcase registry (`plateau:src/backlog-view/card-taxonomy.webcases.ts`). It settles
  the *behaviour* the taxonomy states but leaves undefined; the glyph (A4 → `octagon-alert`) is already ruled
  in §6e and untouched here.
- **Inherited and not re-opened:** the §3i scope-lease model (predicted plans / observed enforces / breach =
  their difference) and its two policy knobs (overlap-at-launch = wait/ask/force+resolve; breach-mid-build =
  pause/park/resolve-at-drain) are settled substrate. The §6e visual-grammar manifest (17 you-act verbs
  incl. B8) is settled and **must not change** — Fork 4 only records that guard.
- **Constellation:** plateau-app-owned (`locus: plateau-app`); this is product business logic on the console
  card taxonomy, not a WE standard entity — no Intent, no conformance/interop story. The whole-clone lease it
  reasons about lives in `we:scripts/lane-pool.mjs` (the WE-side lane pool the plateau console visualizes).
- **Downstream:** ratifying these defaults gives #2553/#2555's board build the A4 transition table to render
  (the breach-paused cell's exits + hover verbs) and pins A12's hold-source and the scope-granularity model
  the board's lease chips depend on.

## Ruling (2026-07-20)

All four forks RATIFIED to their recommended defaults. A three-lens jury (systems/correctness · parallel-agent
ops · governance/spec-integrity) rated each default and **unanimously concurred** (jury-lines 5/4/4/5 · 5/4/4/5
· 4/5/4/5); no lens dissented and none flagged an improper spec/constitution touch. Codified into the design
record: `plateau:docs/backlog-console-design.md` §3i-A4 (the A4 transition table + the hold-source model); §6e
is untouched.

- **F1 · scope granularity → (a) whole-clone lease** is the enforcement unit; predicted file-scope is an
  advisory breach signal; git is ground-truth at drain. Per-file leasing is a later escalation only if measured
  collisions justify it.
- **F2 · A4 exits → (a) retry-in-place / re-plan within scope**, then the §3i escalation ladder (widen if free ·
  hand off to B2/B3/B8 if another lease owns the files · bounce/quarantine if uncontainable). A4 stays
  `cat:run`; only `policy = ask` promotes it to an amber you-card.
- **F3 · A12 hold-source → (a) explicit `holdSource ∈ {user, policy, sibling-lane}`** over one hold mechanism
  shared by A4/A6/A12; sibling-lane is the lowest-confidence source (collapsible to `blockedBy`).
- **F4 · remove B8? → (a) keep the 17 verbs** — §6e is settled; B8 stays; any count change is a separate
  lineage'd decision, never folded here.

**Two jury build-amendments carried into the ruling (implementation notes, not new forks):**
1. **F2 retry bound is a *total attempt counter*, not "same-scope-twice."** Both the systems and ops jurors
   showed that a re-plan breaching a *different* out-of-scope file each attempt evades a same-scope bound and
   livelocks. Retry-once-then-escalate on a total counter.
2. **F3 `holdSource=policy` must be reconciled against UC-A12's ratified triple** (`actor=you · primary=Unhold
   merge`). A policy/sibling hold renders the same card with a different source chip + unhold authority; the
   board build decides whether one UC-A12 covers all sources or splits. The taxonomy pins A12's user form today.
