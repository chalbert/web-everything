---
name: feedback_soft_deferred_parks_retired
description: "Don't park a soft \"deferred-on-priority\"/low-demand item — the tightened gate rejects it; keep it open + low-rank"
metadata: 
  node_type: memory
  type: feedback
  originSessionId: 531100f0-2f65-465a-94ea-394ac972ef0f
---

A soft "deferred-on-priority" / "build when a demo needs it" / low-demand park is **retired** — the
2026-06-22-tightened `check:standards` gate (#1392) errors on any `status: parked` item without a
machine-readable structural reason. #1620 then ratified the **hold model**: the thing that classifies a
hold is *what it does to the ready pool*. Valid holds — `priority: low` (a load-bearing frontmatter field,
the only honored value; demote-not-hide: dropped from the auto-selected ready set but visible/pickable in
the filler group), a `blockedBy` edge, a `humanGate`, `kind: decision` + `status: open`, `parkedReason:
platform-gated`, or `parkedReason: maturityGated` (+ a typed `maturityTrigger` like `externalConsumers≥N`).
An item that is **additive + agent-doable with no real blocker** (e.g. #764) takes **`priority: low`**, NOT
a park.

**The `priority: low` vs `maturityGated`-park discriminator (#1620/#1592):** the test is *"would building
it NOW yield a worse artifact?"* If the artifact is **fully specifiable today** (shape frozen, surface
pre-decided) it is `priority: low` — settled & valid, just low-value-now — **even with zero consumers**.
Only when building now would force you to *guess the shape / tune against nothing / automate the unproven*
is it a `maturityGated` park. Zero-consumer alone ⇒ low-*value*, not un-buildable ⇒ `priority: low`, not a
park. (Worked: #1592 — a credibility-weight tuning editor whose `opts` shape is frozen by #1591 → ruled
`priority: low`, not a `maturityGated` park, despite no caller of the override path.)

**Stated value — full features BEFORE consumers (#232):** we want the full feature surface complete *ahead
of* adoption, not gated on it. So a demand-gated "build it when a project/team asks" opt-in whose shape is
already frozen is **`priority: low`** (build in a slack window ahead of any consumer) — a named eventual
consumer is a value-signal, NOT grounds for a `maturityGated`-on-`externalConsumers≥N` park. Pushes additive
opt-ins to the priority:low side. (Worked: #232 — a fake `kind: decision` re-typed to an epic of three
`priority: low` opt-in slices #1628/#1629/#1630, each built ahead of consumers.)

**Two more lanes + a sequencing test (#1620 review):** (a) **research-gated** — when the seam is
*under-researched but explorable now* (e.g. #499 identity-ceremony authoring), open a `/research/` topic;
the survey IS the work, it's neither `priority:low` (a guessed default would be *wrong*) nor a park. (b) A
**defer-ruling RESOLVES, never parks**, when building-ahead is flawed *but the answer is forced* — run the
test *"does the trigger change the ANSWER or just unlock the WORK?"*: changes the answer → stays open /
decision-gated (`kind:decision`); only unlocks the work → **resolve now**, file the build as a gated item.
Two gotchas: **`priority:low` is INERT on a Tier-B `kind:decision`** (the demote only acts on buildable
Tier-A — retype/split first); and a **real tracked prereq build beats a `maturityGated` park** — file the
prereq item and use `blockedBy` (e.g. #1486 → #1627 dockview adapter, not a park). Also: a *ratified ruling
≠ a wired mechanism* — verify the vocab is in `backlogMeta`/the gate before applying a newly-ratified field.

**Why:** parking is not a prioritisation escape (#1392). It's tempting to park a deferred/low-demand item
to stop it surfacing as Tier-A — but that now produces a red gate caught noisily at close (park → red →
revert), wasting a cycle; and reaching for a `maturityGated` park when the real signal is just "low value"
is soft-`deferred` 2.0 under a new name.

**How to apply:** when an item is mis-flagged as ready but you'd defer it, do NOT reach for `status:
parked` by reflex. Run the discriminator: fully-specifiable-now ⇒ `priority: low`; would-yield-a-worse-
artifact ⇒ `maturityGated` park (+ typed trigger); a real prereq/human/fork ⇒ `blockedBy` / `humanGate` /
`kind: decision`. Relates to [[feedback_misflagged_batchable_fix_real_state]] and the parking discipline
behind [[feedback_collect_decision_residual_as_card]].
