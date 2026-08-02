---
bornAs: xva71x1
kind: task
status: open
dateOpened: "2026-08-02"
blockedBy: ["2892"]
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
- **Cover the SECOND flip path (not just the contract knob).** `landMode: enforce` in
  `we:scripts/lib/review-policy.contract.json` is not the only way to arm the runner:
  `we:scripts/lib/review-runner-core.mjs` hard-codes `LAND_MODES.SHADOW`, and `we:scripts/review-runner.mjs`
  carries the `--enforce` refusal. Editing that constant (or lifting the `--enforce` refusal) arms `enforce`
  WITHOUT touching `landMode` in the contract — and neither file is a statute anchor nor a `POLICY_SPEC`
  leash file, so `isPrincipleSurface` is false and `enforceFlipReady` is **never consulted** on that path. The
  write gate must therefore also refuse a hard-coded / `--enforce` arming of the runner unless
  `enforceFlipReady().ready` (or route both paths through one choke point that the gate covers), so there is
  no un-gated back door to `enforce`.
- **Leash-gate the predicate itself.** `enforceFlipReady` + the shadow ledger land in
  `we:scripts/lib/decision-routing.mjs` / `we:scripts/lib/auto-land-seam.mjs`, **neither of which is in
  `TRUST_CHAIN`** — so a committee-cleared PR could relax `ENFORCE_FLIP_TRIGGER` (N = 20, M = 20) or weaken
  the predicate itself without ever hitting `review:human`. Add these predicate/ledger surfaces to the
  declarative leash / `TRUST_CHAIN` (or add a `check:standards` conformance pin over `ENFORCE_FLIP_TRIGGER`
  and the predicate) so the safety bar cannot be lowered mechanically — the readiness metric is the thing the
  whole flip trusts, and it must not be agent-editable.

## Preconditions

`blockedBy: 2892` — the flip's own safeguard (the `landMode` leash pin) is an unbuilt `check:standards`
rule inside #2840's impl follow-on `2892`; without it this `landMode: enforce` write gate could land while
the pin that keeps `we:scripts/lib/review-policy.contract.json` human-gated does not yet exist (the write gate
exists while its safeguard does not — #2838's anchor calls the pin a "load-bearing dependency"). #2840's leash
pin ratified (now true — keeps `we:scripts/lib/review-policy.contract.json` human-gated so the flip edit stays
`review:human`); #2820 (PR #975) and #2823 (PR #976) merged (now true); the durable review-seam ledger to be
built (above). Enforces #2838's ratified anchor; mechanical, committee-clearable.
