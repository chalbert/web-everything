---
kind: epic
ongoing: true
status: open
dateOpened: "2026-06-27"
relatedReport: reports/2026-06-27-program-we-consistency.md
tags: []
---

# WE consistency watch

A standing watch (review-program pattern) that periodically audits the live Web Everything tree
against the codified standing rules in `we:docs/agent/platform-decisions.md` — catching **semantic
drift** the deterministic gate cannot see (an entity in the wrong repo, a backward DAG edge, a
hand-rolled pattern a trait already covers), and filing each real violation as a backlog card linked
to the rule it breaks. The statute is the rubric; this program is the recurring read against it.

The program runs on **two fronts**. **Front A — conformance arm (already built):** `check:standards`
enforces every cheaply-mechanizable rule on every `/check` (status vocab, dup ids, retirement
triplet, trait/registry naming, entity-manifest shape). Nothing to add today — see the seed audit
`we:audits/we-consistency-mechanizable-rules.md`, which classifies all ~45 standing rules and finds
the gate already covers section A. **Front B — semantic watch (the recurring human pass):** each run
takes a *rotating slice* of the genuinely-semantic rules (placement, boundary, taxonomy-bar,
authoring/derivation, anti-uniform naming) and reads the live tree against them, surfacing drift as
cards.

Why a watch and not just more gate code: several standing rules are **anti-uniform by design** —
[#registry-name-guard-namespace](../docs/agent/platform-decisions.md#registry-name-guard-namespace)
("never a flat every-`define()` rule") and
[#host-backreference-naming](../docs/agent/platform-decisions.md#host-backreference-naming) ("two
right names beat one uniform name") — so a flat grep check would *violate* the rule it tries to
enforce. Conformance to these can only be judged, never asserted by a regex.

## Cadence

- **Front A** runs continuously — it is the existing `check:standards` gate on every `/check`.
- **Front B** runs **monthly** via `/review-program 1852` (rotating ≈5–8 anchors per pass so the
  full statute is swept over a few months, then repeats with later tree state). Scheduling it (L2) is
  a later, separately-prioritized follow-up — not assumed here.

## Deferred fronts (owned elsewhere — don't duplicate)

- **Placement / boundary** is deferred to **#1770** while that holding review-gate is open — it
  already performs a constellation-wide end-state placement audit (`blockedBy` the in-flight
  relocation set). This watch re-confirms #1770 is still open each run rather than re-auditing the
  same surface. Re-absorb the placement front here only if #1770 resolves.

## Seed slices

- **#1853** (`task`, parked) — promote the two migration-blocked invariants (ZERO-impl, no-backward-
  DAG-edge) into `check:standards` once WE source stops legitimately importing `@frontierui/*`. Un-
  park trigger lives on the card.

## Review log

- **2026-06-27 — creation run (L0→L1, front-A baseline).** Audited all standing rules for mechanical
  checkability → `we:audits/we-consistency-mechanizable-rules.md`. Finding: the gate already enforces
  everything cheaply mechanizable (section A); two invariants are checkable only post-relocation
  (section B → parked #1853); the remainder is semantic / anti-uniform and belongs to the front-B
  watch (section C). No new gate code added this run — promoting a check today would fire on correct,
  mid-migration lines.

- **2026-06-27 — Run 1, first front-B pass (placement/boundary slice).** Audited
  [#constellation-placement](../docs/agent/platform-decisions.md#constellation-placement),
  [#we-fui-embed-boundary](../docs/agent/platform-decisions.md#we-fui-embed-boundary),
  [#devtools-placement](../docs/agent/platform-decisions.md#devtools-placement),
  [#reusable-home](../docs/agent/platform-decisions.md) against the live tree → see
  `we:reports/2026-06-27-program-we-consistency.md`. **Delta: 0 new cards** — the placement front is
  saturated by **#1770** (a constellation-wide end-state placement gate, `blockedBy` the relocation
  set), and an orphan scan for delivery-runtime in WE outside the carded dirs found only `.njk`
  doc-templates (no uncarded residual). **Steering:** deferred the placement front to #1770 (see
  above) and re-pointed the rotation to backlog white space — a coverage check found 0 dedicated
  audit cards for the authoring/derivation, taxonomy-bar, and anti-uniform-naming slices. **Next
  run:** authoring/derivation slice
  ([#single-authoring-sot-derived-projection](../docs/agent/platform-decisions.md#single-authoring-sot-derived-projection),
  [#faithful-derivation-exclude-not-fabricate](../docs/agent/platform-decisions.md#faithful-derivation-exclude-not-fabricate),
  [#compose-dont-handroll](../docs/agent/platform-decisions.md#compose-dont-handroll)) — audit real
  authoring entities for a second authoring home / hand-rolled covered patterns; re-confirm #1770
  still open before re-deferring placement.
