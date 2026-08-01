---
bornAs: xnu179a
kind: epic
parent: "2527"
status: open
dateOpened: "2026-08-01"
relatedReport: reports/2026-07-31-ui-fidelity-gate-design.md
tags: [plateau-loop, conveyor, ui-fidelity, gate, build-ui, epic, slice-uifg]
---

# UI-Fidelity Gate — real-route conformance, born-with-contract to on-land

A standing conveyor guarantee that **any UI story ships faithfully** — feature completeness *and* visual look —
so the console-board failure class cannot recur. Design converged **RRFC (Real-Route Fidelity Contract)** by a
design + review committee (4 architects → adversarial red-team → 3-judge panel → convergence); full reference:
[we:reports/2026-07-31-ui-fidelity-gate-design.md](../reports/2026-07-31-ui-fidelity-gate-design.md).

## Why (the console-board post-mortem)
All console-board stories were marked `resolved`, but the live `/console-board` route was poor: 3 stacked
headers, the lane pool rendering full cards instead of composition chips, an empty center, no legend. Root
cause: every story was verified against the standalone `?demo=1` **fixture** (never the embedded product route),
each story's pixel check was **deferred** to a later baseline item that then screenshotted that same fixture (a
circular oracle), and green unit tests were read as design fidelity. The gate that was missing: **fidelity was
left as judgment, so it got skipped.**

## The guarantee (one line)
Move UI fidelity out of hoped-for judgment into a **per-item contract** that a **non-bypassable gate** reads
against the **real route** — an item cannot reach `resolved` until the product route renders (in its host shell,
with seeded data, both themes) and matches its declared design. WE **validates**; the product **renders**
(WE holds zero implementation (MEMORY #6) preserved).

## Two structural invariants
- **A — the target is not the subject.** The visual baseline derives from a registry-anchored ratified mock
  (token-signed over its content hash, must pre-date the build lane, must sit above a perceptual-distance floor
  from any build shot). A screenshot of the subject can never become the oracle.
- **B — absence is failure, never skip.** Missing target / missing record / boot failure / stale record at
  `resolved` is a hard ERROR. The comparator's `baseline-missing → warn` is re-graded to error at this caller.

## Ratified
Oracle tightness = **B** (deterministic floor gates; perceptual diff advisory) — decision [#2800]. **C**
(perceptual mandatory in the jury) is parked; reopen once the registry target has a known false-block rate,
possibly as a configurable dial.

## Slices (build order — full detail in the reference §4)
Foundation first; WE-validation and product-render slices sit on separate sides of the #6 boundary.

- **[#2805]** contract schema + validator (WE, 5)
- **[#2802]** dependency-aware UI-item classifier (WE, 5)
- **[#2807]** scaffold stub + readiness refusal (WE, 3)
- **[#2808]** product seed seam (plateau-app, 5)
- **[#2809]** real-route render harness (plateau-app, 8)
- **[#2810]** geometry + theme assertion lib (plateau-app, 5)
- **[#2806]** target registry + token + perceptual-distance floor (WE, 8)
- **[#2811]** real-route conformance test (plateau-app, 8)
- **[#2815]** required-set freeze guard (plateau-app, 3)
- **[#2812]** WE floor: record consumption + warn→error (WE, 5)
- **[#2803]** resolve-time scope reconciliation (WE, 5)
- **[#2816]** jury visual-lens flip, advisory-until-trusted (WE, 3)
- **[#2813]** on-land escalate: ui-fidelity-unverified (WE, 3)
- **[#2817]** assembledOwner whole-route guard (WE, 5)
- **[#2814]** build-ui method + resolve judgment criterion (WE, 3)

**Build waves:** `{schema, classifier, seed-seam}` → `{scaffold/readiness, harness, registry}` →
`{geometry, conformance-test}` → `{freeze-guard, WE-floor, scope-reconcile}` →
`{jury, escalate, assembledOwner, build-ui}`.

## Acceptance
A UI item cannot reach `resolved` without a fresh, green, commit-bound conformance record for its **real route**
rendered in its host shell across seeds × themes, checked against a registry-anchored target; the six
console-board failure modes each map to a gate that now blocks them (reference §2). Children above resolved.
