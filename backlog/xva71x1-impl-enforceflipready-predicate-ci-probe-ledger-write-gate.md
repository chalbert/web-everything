---
bornAs: xva71x1
kind: task
status: open
dateOpened: "2026-08-02"
tags: [governance, mechanization, enforce-flip, land-mode, ci-probe, check-standards]
---

# Impl: `enforceFlipReady` predicate + CI-status probe + durable review-seam ledger + write gate (enforces #2838)

Mechanical follow-on that enforces the ratified enforce-flip gate
(`we:docs/agent/platform-decisions.md#enforce-flip-triple-gated`, #2838): the `enforceFlipReady({ ciStatus,
reviewShadowLedger })` readiness predicate, the impure CI-status probe that feeds it, the durable
review-seam ledger it reads, and the `check:standards` write gate that refuses `landMode: enforce` unless
the predicate is ready. Code only, committee-cleared under the two-PR rule.

## Scope

- Add `enforceFlipReady({ ciStatus, reviewShadowLedger })` in `we:scripts/lib/decision-routing.mjs` beside
  `resolveLandMode`. Pure over its injected inputs; returns `{ ready, reasons }`, `ready` iff all three:
  **(a)** `ciStatus` shows #2820's merge-hold conformance test GREEN on `main`; **(b)** `ciStatus` shows
  #2823's prevention-field conformance test GREEN on `main`; **(c)**
  `computeAgreementMetric(reviewShadowLedger).flipReady === true`.
- **CI-status probe** (impure caller-side read) for (a)/(b) — NOT a file-exists check (which passes
  vacuously once the test file exists and would not re-refuse on a regression).
- **Durable review-seam ledger:** persist each shadow-mode review auto-clear-vs-human outcome as a
  `ShadowOutcomeRecord[]` (the shape `computeAgreementMetric` consumes). Today `applyAutoLand`
  (`we:scripts/lib/auto-land-seam.mjs`) only logs an observation line to stderr — this ledger is real new
  scope, not a reuse.
- **Write gate** in `we:scripts/check-standards-rules.mjs` refusing `landMode: enforce` in the disposition
  config unless `enforceFlipReady().ready`, stamping the three reasons.

## Preconditions

#2840's leash pin ratified (now true — keeps `we:scripts/lib/review-policy.contract.json` human-gated so the
flip edit stays `review:human`); #2820 (PR #975) and #2823 (PR #976) merged (now true); the durable
review-seam ledger to be built (above). Enforces #2838's ratified anchor; mechanical, committee-clearable.
