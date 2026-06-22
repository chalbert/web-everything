---
kind: decision
status: resolved
preparedDate: "2026-06-22"
dateOpened: "2026-06-22"
dateStarted: "2026-06-22"
dateResolved: "2026-06-22"
graduatedTo: none
codifiedIn: "docs/agent/backlog-workflow.md#hold-model"
tags: [backlog, tooling, hold-model, priority, parked, amends-1392]
crossRef: { url: /backlog/1392-parked-items-must-carry-a-strong-machine-readable-reason-sur/, label: "Parked items need a machine-readable reason (#1392)" }
---

# Backlog hold model: add a load-bearing priority field + mint a `maturityGated` park reason (amends #1392)

Surfaced while reviewing the demand-gated "decisions" (#232/#367/#499/#718…): the hold model has a gap.

## Grounding digest

- #1392 ([the park-reason rule](/backlog/1392-parked-items-must-carry-a-strong-machine-readable-reason-sur/))
  **retired** the soft `deferred`/`external-infra`/`superseded` park reasons — "parking is not a
  prioritisation escape" — leaving only `platform-gated` as a standalone `parkedReason`, plus `blockedBy`,
  `humanGate`, and the `kind: decision` decision-lane. Vocab + enforcement in
  [`we:src/_data/backlogMeta.js`](../src/_data/backlogMeta.js) (`parkedReasonMeta`) and the gate.
- **But `deferred` was doing two different jobs**, and #1392 killed both: (1) a *prioritisation* hold
  ("settled & valid, just not worth doing now"); (2) a *can't-build-it-well-yet* hold ("building now
  produces a worse artifact — you'd guess the shape, tune against nothing, or automate the unproven").
  Neither has an honest home today.
- A `priority` field is **not load-bearing** — exactly one item (#232) carries `priority: low` and nothing
  reads it ([`we:scripts/check-readiness.mjs`](../scripts/check-readiness.mjs) +
  [`we:scripts/readiness/`](../scripts/readiness/) reference "priority" only for reservation
  deprioritisation, unrelated).
- Both forks were skeptic-attacked in prep; Fork 1's enum was narrowed to a bit, and Fork 2 flipped from
  "don't mint" to "mint, with a guardrail."

## Axis framing — two mechanisms, two different effects on the ready pool

The distinction #1392 lost is **what the hold does to the pool**. The operator's test — *"low priority,
not rejected; if I have context free and nothing else, I might pick it up"* — separates a hold that keeps
an item **pickable** (demoted but browsable) from one that **removes** it until an external gate clears.
The fix is two mechanisms, one per job:

| Mechanism | Pool effect | When |
|---|---|---|
| **`priority: low`** (Fork 1) | dropped from the **auto-selected ready set**, but **stays visible** in a filler section | settled & valid, just low-value-now |
| **`maturityGated` park** (Fork 2) | **removed** until a typed trigger fires | building now yields a *worse artifact* |
| `platform-gated` park | removed | waits on a shipped browser feature |
| `blockedBy` / `humanGate` | removed | a real prerequisite item / a human-clearable residual |
| `kind: decision` open | decision lane | a genuine merit fork |

## Recommended path at a glance

| Fork | Recommended default | Main alternative | Confidence |
|---|---|---|---|
| **Fork 1** — a load-bearing `priority` signal | **a single optional `priority: low` bit** that drops the item from the **auto-selected** ready set but keeps it **visible/pickable** in a filler section | a 3-value enum (`low/normal/high`) — *rejected* (priority-rot); full exclusion to a "shelved" view — *rejected* (breaks "pickable") | **high** |
| **Fork 2** — a new park reason for "build-now-is-worse" holds | **mint `maturityGated`** with a **mandatory typed, externally-verifiable `maturityTrigger`** (`externalConsumers≥N` · `realRuns≥N` · a named adoption milestone) | don't mint, reuse existing mechanisms — *rejected* (soak ≠ humanGate; blockedBy phantoms) | **med-high** (name is the residual sub-call) |

## Fork 1 — a load-bearing `priority` signal (demote from auto-select, keep visible)

**Fork-existence justification:** forced invariant — the excluded branch ("keep using park/blockers to get
low-priority work out of the way") is *broken*: #1392 forbids it, so settled-but-low-value work today
either falsely surfaces as ready Tier-A or gets dishonestly parked. A demote signal is the only honest
home — a **ratify**, with the design choice being the shape + the demote-not-hide discipline.

**Crux:** the operator's spec — *"not rejected; might pick it up if nothing else"* — means the item must
stay **visible and pickable** when idle, yet must **not** be auto-selected into batches as ready Tier-A.
That's "drop from auto-select, keep in view," not "sort last and hope," and not "shelve out of sight."

**Options:**

- **(a) A single optional `priority: low` bit, demote-from-auto-select + visible filler** *(recommended
  default)* — add an optional `priority` field whose only honored value is `low` (absent = normal). The
  readiness `--select` ranker **excludes `priority: low` from the auto-selected ready set** (so it stops
  false-surfacing as Tier-A), but the loader still **lists it** under a separate "deprioritised / filler"
  group on `/backlog/` and in the selector output — visible, browsable, hand-pickable when nothing better
  exists. A `low` pill renders from `backlogMeta`. **Anti-escape guard:** because it stays *visible* (just
  out of auto-select), it can't silently vanish the way a soft park did — it's auditable filler, not a hide.
- **(b) A 3-value `low/normal/high` enum** — *Rejected.* `high`/`normal` import JIRA priority-rot (everyone
  marks their own work `high`; `normal` becomes "untriaged") and duplicate tier; only the **demote bit** is
  the real unmet need.
- **(c) Full exclusion to a "shelved" view** (the skeptic's first amendment) — *Rejected.* Honestly
  auditable, but it **removes** the item from the pool, contradicting the operator's "stays pickable as
  filler." Demote-but-visible threads that needle; shelving overshoots into a park.

**Recommended default: (a) the single `priority: low` bit — drop from auto-select, keep visible.**

**Skeptic:** SURVIVES-WITH-AMENDMENT → the skeptic's "ranks-but-never-excludes is self-defeating, a ranker
picks the top so the tail is never reached" hit is **folded in**: the bit now **excludes from the
auto-selected set** (not merely sorts last), so it genuinely stops surfacing as ready — while the loader
keeps it **visible in a filler group**, preserving the operator's pickable-when-idle spec (the skeptic's
own "shelved" amendment over-corrected into a park, so it's rejected). The enum→single-`low`-bit narrowing
(priority-rot) and the duplicate-with-tier concern are both adopted.

## Fork 2 — mint a `maturityGated` park reason for "build-now-is-worse" holds

**Fork-existence justification:** real either/or — "mint a new reason" vs "reuse existing mechanisms" both
seemed coherent, but the prep skeptic *disproved* the reuse branch (below), leaving an irreducible residual
(the soak + threshold + adoption gates) with no honest existing home → mint is forced.

**Crux:** some holds aren't low-priority and aren't a merit fork — building *now* yields a **worse
artifact** (guess the IR shape #939, tune a Rust/WASM SWC plugin against no real integration #718, automate
an unproven cadence #367). The risk is `deferred` 2.0 — but `platform-gated` proves a "wait for X" reason
is **not** an escape when X is a **concrete, externally-verifiable trigger**. So the mint is safe *iff* it
carries the same discipline.

**Options:**

- **(a) Mint `maturityGated` with a mandatory typed trigger** *(recommended default)* — a `parkedReason:
  maturityGated` plus a **required** machine-readable `maturityTrigger`, one of: `externalConsumers≥N` (a
  real 2nd impl / first external consumer exists — #1486), `realRuns≥N` of a named manual skill with a
  stability assertion (the soak — #367), or a named `adoptionSignal` (a concrete integration milestone to
  test against — #718/#232 SWC). The gate **errors** on a `maturityGated` item with no typed trigger
  (exactly as a body-less park fails today), and the trigger **must** name a counter or an external
  artifact's existence — **never a date or bare "later."** That guard is what makes it `platform-gated`-grade,
  not `deferred` 2.0.
- **(b) Don't mint; reuse existing mechanisms** — *Rejected (skeptic-disproved).* #367's soak is **not** a
  `humanGate` (a humanGate is a residual a human clears *on demand*; a soak accrues over *time* through real
  runs — no action discharges it today). Routing #1486/#718 to `blockedBy` **manufactures phantom tracker
  items** ("build a 2nd adapter", "SWC adoption") no one owns — the *Map-Item-Is-Not-A-Blocker* /
  *verify-mechanism-has-a-consumer* anti-pattern. And cramming three structurally distinct external gates
  into mismatched buckets makes the board **lie about why** each is held.

**Recommended default: (a) mint `maturityGated` with a mandatory typed `maturityTrigger`.**

**Residual sub-call (name + scope) — for the decision turn:** `maturityGated` is the skeptic's name and
fits all three flavors ("the artifact is worse until the design / process / ecosystem *matures*"); confirm
or override against `awaiting-real-use` / `adoption-gated` / `consumer-gated` (+ `soak` for the stability
flavor). And confirm scope: keep #939 on `blockedBy #818`, keep true merit forks (#978/#513, the #718
launch-completeness call) on `kind: decision` — `maturityGated` is **only** for the genuinely-unmapped
soak/threshold/adoption residual, not a catch-all.

**Skeptic:** REFUTED → the "don't mint" lean was overturned. humanGate is a *residual cleared on demand*,
not a time-accruing soak (#367 has no honest existing home); `blockedBy` for #1486/#718 invents phantom
blockers (my own anti-pattern); and "deferred 2.0" proves too much — it would condemn `platform-gated` too,
yet that isn't an escape *because its trigger is concrete and external*. **Default flipped to (a) mint
`maturityGated`** with the mandatory-typed-trigger guard that supplies exactly that concreteness.

## Cluster this re-homes (the review that surfaced it)

- `priority: low` (Fork 1): `#232` `ts-patch` transformer; likely `#499`; the cheap "build-whenever" halves.
- `maturityGated` (Fork 2): `#367` (`realRuns≥N` soak), `#718`/`#232` SWC-native plugin (`adoptionSignal`),
  `#1486` (`externalConsumers≥1` — a 2nd dockable adapter).
- existing mechanism (unchanged): `#939` (`blockedBy #818`); `#978`/`#513` + #718 launch-completeness
  (`kind: decision`).
- already correct: `#928` (`platform-gated`).

## Ratified — 2026-06-22

Both forks ratified to their recommended defaults; the residual sub-call (name) is taken as written.

- **Fork 1 → (a) a single optional `priority: low` bit — demote-from-auto-select, keep visible.** The only
  honored value is `low` (absent = normal). The readiness `--select` ranker **excludes** `priority: low`
  from the auto-selected ready set (it stops false-surfacing as Tier-A), but the loader still **lists** it
  in a visible *"deprioritised / filler"* group — pickable when idle, auditable, not a hide. Rejected: (b)
  the `low/normal/high` enum (priority-rot, duplicate tier) and (c) full exclusion to a "shelved" view
  (over-corrects into a park; breaks the operator's *stays-pickable* spec).
- **Fork 2 → (a) mint `maturityGated` with a mandatory typed `maturityTrigger`.** A `parkedReason:
  maturityGated` plus a **required** machine-readable trigger, one of `externalConsumers≥N` · `realRuns≥N`
  (a named manual skill + stability assertion) · a named `adoptionSignal`. The gate **errors** on a
  `maturityGated` item with no typed trigger, and the trigger **must** name a counter or an external
  artifact's existence — **never a date or bare "later."** That concreteness is what makes it
  `platform-gated`-grade, not `deferred` 2.0. Rejected: (b) reuse existing mechanisms (skeptic-disproved —
  a soak is not a `humanGate`; routing #1486/#718 to `blockedBy` manufactures phantom blockers).
- **Residual sub-call (name) → `maturityGated`** as recommended (fits all three flavors — design / process /
  ecosystem *maturity*). Scope confirmed: `maturityGated` is **only** for the genuinely-unmapped
  soak/threshold/adoption residual — true prerequisites stay `blockedBy` (#939 → #818), real merit forks
  stay `kind: decision` (#978/#513, the #718 launch-completeness call).

Codified as statute in [we:docs/agent/backlog-workflow.md § the hold model](../docs/agent/backlog-workflow.md#hold-model)
(pointer in [we:docs/agent/platform-decisions.md](../docs/agent/platform-decisions.md)). **Graduates to spin-off
builds via a `blockedBy` chain:** [#1622](/backlog/1622-implement-the-backlog-hold-model-priority-low-demote-from-au/)
(implement the vocab + ranker + gate + badges) → [#1623](/backlog/1623-re-categorise-the-hold-model-cluster-onto-priority-low-matur/)
(re-categorise the cluster below). No new entity → `graduatedTo: none`.

## Cluster to re-categorise (handled by #1623, after #1622 lands)

- `priority: low` (Fork 1): `#232` `ts-patch` transformer; likely `#499`; the cheap "build-whenever" halves.
- `maturityGated` (Fork 2): `#367` (`realRuns≥N` soak), `#718`/`#232` SWC-native plugin (`adoptionSignal`),
  `#1486` (`externalConsumers≥1` — a 2nd dockable adapter).
- existing mechanism (unchanged): `#939` (`blockedBy #818`); `#978`/`#513` + #718 launch-completeness
  (`kind: decision`).
- already correct: `#928` (`platform-gated`).
