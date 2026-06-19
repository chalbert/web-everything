---
type: decision
workItem: story
size: 3
status: resolved
dateOpened: '2026-05-30'
dateStarted: '2026-06-08'
dateResolved: '2026-06-08'
codifiedIn: "docs/agent/platform-decisions.md#surface-contract-not-computation"
tags:
  - validation
  - conformance
  - validity-model
  - interop
  - design-decision
relatedReport: reports/2026-05-30-form-validation-standard-assessment.md
relatedProject: webvalidation
---

# Settle validation validity-model and conformance-tier open points

The form-validation interop design closed the meta-intent factoring but left two core decisions open. OP-1: should control validity be a source-reduction (merge native + schema + custom via a MergedValidity reduction — more robust) or a flat invalid flag (simpler)? Draft leans source-reduction, awaiting confirmation. OP-11: confirm the proposed L0/L1/L2 conformance tier model (Intent-aware → State & event → Shape & concern) as normative. Both are flagged "await confirmation" and gate any real engine/adapter build.

## Ruling (2026-06-08)

**OP-1 — validity model: RESOLVED, reframed from "pick one model" to "protocol on
the surface, strategy underneath."** The standard mandates the *observable surface
contract* — the `MergedValidity` hand-off shape + the four interaction regions +
stable-id events — **not** the merge math. Validity-merge is a **swappable concern**
(`ValidityMergeRegistry` provider, sibling to `CustomValidatorResolutionRegistry`).

- Native-first default = **source-reduction** (named sources, declared precedence,
  `pending{version}`), with the orchestration layer **auto-stamping** generation
  tokens so devs never hand-author ids for server errors (manual ids only for
  explicit stale-control). This kills the "I won't bother adding unique ids"
  objection without giving up robustness.
- The old **flat flag is not a competing model** — it's the degenerate
  single-source reduction. A "simple / last-write-wins" strategy still emits a valid
  `MergedValidity`, so it conforms and stays swappable. No second surface to
  reconcile.
- Frontier UI codifies ~2 strategies (source-reduction default + simple);
  custom strategies are first-class. **Hard constraint:** strategies vary
  *computation*, never the *surface* — varying the surface forfeits L1 swappability.

Build falls out as **#212** (ValidityMergeRegistry strategy plane); slots into the
capability-provider work #203–#207.

**OP-11 — conformance tiers: RATIFIED as-is.** L0 Intent-aware → L1 State & event
conformant (swappable) → L2 Shape & concern conformant (combinable), with the
**capability model orthogonal** to tiers (optional trait-like feature bundles,
published in a manifest; partial compliance first-class iff gaps are detectable +
reported). Conformance is observable-contract, never computation — so both
state-derived and event-driven engines conform. OP-11 is what makes OP-1's strategy
pluralism safe: the tier guarantees the surface regardless of merge strategy.

Phase-2 adapter builds (L1 RHF/Angular/Solid; L2 vanilla reference) are now
agent-ready.
