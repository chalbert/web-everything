---
kind: decision
status: open
dateOpened: "2026-06-22"
tags: [backlog, tooling, hold-model, priority, parked, amends-1392]
crossRef: { url: /backlog/1392-parked-items-must-carry-a-strong-machine-readable-reason-sur/, label: "Parked items need a machine-readable reason (#1392)" }
---

# Backlog hold model: add a load-bearing priority field; decide if a new park reason is warranted (amends #1392)

Surfaced while reviewing the demand-gated "decisions" (#232/#367/#499/#718…): the hold model has a gap.

## Grounding digest

- #1392 ([the park-reason rule](/backlog/1392-parked-items-must-carry-a-strong-machine-readable-reason-sur/))
  **retired** the soft `deferred`/`external-infra`/`superseded` park reasons — "parking is not a
  prioritisation escape" — leaving only `platform-gated` as a standalone `parkedReason`, plus `blockedBy`,
  `humanGate`, and the `kind: decision` decision-lane. Vocab + enforcement in
  [`we:src/_data/backlogMeta.js`](../src/_data/backlogMeta.js) (`parkedReasonMeta`) and the gate.
- **But `deferred` was doing two different jobs**, and #1392 killed both: (1) a genuine *prioritisation*
  hold ("settled & valid, just not worth doing now") and (2) a genuine *can't-build-it-well-yet* hold
  ("building now produces a worse artifact"). Job (1) now has **no honest home**; job (2) is the open
  question below.
- A `priority` field is **not load-bearing today** — exactly one item (#232) carries `priority: low` and
  **nothing reads it** ([`we:scripts/check-readiness.mjs`](../scripts/check-readiness.mjs) +
  [`we:scripts/readiness/`](../scripts/readiness/) only reference "priority" for reservation
  deprioritisation, unrelated).

## Axis framing — two mechanisms, two different effects on the ready pool

The distinction that #1392 lost is **what the hold does to the pool**, captured by the operator's own test
— *"low priority, not rejected; if I have context free and nothing else, I might pick it up."* A hold that
keeps an item **pickable** (ranked last) is fundamentally different from one that **removes** it (held until
a gate clears):

| Mechanism | Pool effect | When |
|---|---|---|
| **`priority: low`** (proposed) | **stays in pool, ranks last** — filler | settled & valid, just low-value-now |
| **park** (`platform-gated`, + a possible new reason) | **removed** until the gate clears | acting now is *flawed* / blocked |
| `blockedBy` / `humanGate` | removed | real prerequisite / human action |
| `kind: decision` open | decision lane | a genuine merit fork |

## Recommended path at a glance

| Fork | Recommended default | Main alternative | Confidence |
|---|---|---|---|
| **Fork 1** — add a load-bearing `priority` field | **yes — `priority` ranks/demotes but NEVER excludes** (stays pickable); the loader sorts it last, the gate doesn't drop it | keep using park/blockers for low-priority (the #1392-forbidden escape) | **high** |
| **Fork 2** — is a *new park reason* needed for "act-now-builds-a-worse-artifact" holds, and what is it called? | **undecided** — lean *don't mint one yet*; prefer existing mechanisms, mint only if a residual class survives | mint a new reason (naming TBD — *not* "evidence-gated"/"premature") | **low — the genuine open call** |

## Fork 1 — add a load-bearing `priority` field (ranks, never excludes)

**Fork-existence justification:** forced invariant — the excluded branch ("keep using park/blockers to get
low-priority work out of the way") is *broken*: #1392 forbids it (prioritisation is not a park reason), so
settled-but-low-value work today either falsely surfaces as ready Tier-A or gets dishonestly parked. A
ranking field is the only honest home — so this is a **ratify**, with the design choice being the
rank-not-exclude discipline.

**Crux:** the operator's spec — *"not rejected; might pick it up if nothing else"* — means the item must
stay **visible and pickable**, just ranked last. That is a *ranking*, not a *removal*.

**Options:**

- **(a) `priority` ranks, never excludes** *(recommended default)* — add a small `priority` enum
  (`low` | `normal` | `high`, default `normal`/absent). The readiness loader **sorts** by it (low → bottom
  of the pool) but never drops it; the gate never treats `priority: low` as "not surfaced." This is the
  anti-#1392 guard: because a low-priority item *stays in the pool*, the field **cannot** become a
  hide-it-to-escape mechanism the way a soft park did — it only reorders. Pill renders like the other
  badge metadata.
  - **Sub-fork (field shape):** enum `low`/`normal`/`high` *(default)* vs a bare boolean `lowPriority` vs a
    numeric weight. Enum is legible + extensible without a sort-weight bikeshed.
- **(b) Keep using park/blockers for low-priority** — *Rejected (the #1392-forbidden escape).* Parking
  removes the item, contradicting "still pickable as filler," and re-opens the prioritisation-escape door.

**Recommended default: (a) a `priority` enum that ranks-not-excludes.**

**Skeptic:** *(not yet run — see close-out; Fork 1's default is discussion-derived but unattacked).*

## Fork 2 — is a *new* park reason warranted for "act-now-builds-a-worse-artifact" holds?

**Fork-existence justification (provisional):** the candidate branch (mint a new reason) is only real if a
class of holds genuinely fits *none* of the existing mechanisms. The risk is that any new "we're waiting
for X" reason becomes **`deferred` 2.0** — the rationalised prioritisation escape #1392 closed. So the
burden of proof is on *minting*, not on reusing.

**Crux:** some holds aren't low-priority and aren't a merit fork — building *now* would produce a **worse
artifact** (you'd guess the IR shape #939, tune a Rust/WASM SWC plugin against no real integration #718,
automate an unproven cadence #367). Is that a distinct park reason, or already covered?

**Options (genuinely open — no bold default):**

- **Prefer existing mechanisms (lean):** route each "worse-artifact" hold to what it already is — a real
  prerequisite → **`blockedBy`** that item (file it if missing; #939 already `blockedBy #818`; #1486 wants
  a "build a 2nd dockable adapter" item); a human-operation soak → **`humanGate`** (#367: a human runs
  `/gap-sweep` a few times and judges stability); an undecided design → keep **`kind: decision`** open
  (#978, #513). Mint nothing.
- **Mint a new park reason** *if* a residual class survives that fits none of the above (e.g. "held until
  real adoption/usage that is neither a tracked item nor a single human action exists"). **Naming is part
  of this fork** — *not* "evidence-gated" (too vague) or "premature" (a G4 prioritisation tell). Descriptive
  candidates, by flavor: shape-informing → `awaiting-real-use` / `consumer-gated`; stability-proving →
  `unproven` / `soak`. Open whether it's one reason (body names the signal, like `platform-gated`) or two.

**Recommended default: undecided** — this is the call to make; lean *don't mint yet, prefer existing
mechanisms*, and only add a reason (well-named) if the review of the cluster turns up an irreducible
residual.

## Cluster this re-homes (the review that surfaced it)

- `priority: low` (Fork 1): `#232` `ts-patch` transformer; likely `#499`; the cheap "build-whenever" halves.
- existing-mechanism or new-reason (Fork 2): `#367` (soak), `#718`/`#232` SWC-native plugin (adoption),
  `#939` (already `blockedBy #818`), `#1486` (wants a 2nd-impl item), `#978`/`#513` (open decisions).
- already correct: `#928` (`platform-gated`).

## Close-out / what's left

- Fork 1 is at DoR pending a **skeptic pass** (attack rank-not-exclude — does a never-excluded low item
  still clutter the pool? does the loader sort actually demote it enough?). Run before stamping `preparedDate`.
- Fork 2 is **genuinely open** — do not stamp until it's resolved (or delegated). Implementation surfaces
  when ratified: [`we:src/_data/backlogMeta.js`](../src/_data/backlogMeta.js), the readiness loader, the
  gate, and the badge render.
