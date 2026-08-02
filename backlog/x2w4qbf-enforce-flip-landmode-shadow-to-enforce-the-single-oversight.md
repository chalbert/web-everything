---
kind: decision
size: 3
status: open
dateOpened: "2026-08-02"
preparedDate: "2026-08-02"
tags: [governance, enforce-flip, land-mode, shadow-mode, review-pending, auto-land, oversight]
---

# Enforce-flip — `landMode: shadow → enforce`, the single oversight-reducing switch

**Principle statement.** The scheduled review runner clears `review:pending` **mechanically** — writing
`review:accepted` so the drain merges — **only once** the global land mode flips from `shadow`
(observe-only) to `enforce`. That flip is the ONE switch that reduces human oversight, so it is gated: it
may arm only when the machinery that makes it safe has landed AND a clean shadow-mode track record proves
the auto-clear agrees with the human. Until then the seam runs in shadow: it computes the would-clear
decision and logs it, but a human still clears every `review:pending` PR.

This is a principle, so it lands in a decisions-only PR parked `review:human` alongside `#xhrni4v` and
`#x84bjrx`; the code that reads the flip predicate is a follow-on impl PR under the two-PR rule
(`#x84bjrx`).

## Current state

The auto-land seam already exists and already defaults to shadow (ratified, operator 2026-07-26). The
global `careJury.disposition.landMode` knob (`shadow | enforce`) is read via `resolveDispositionConfig`
(`we:scripts/lib/auto-land-seam.mjs#applyAutoLand`), and anything not exactly `enforce` normalizes to
shadow. In shadow the seam runs the `#2674` decider to a label INTENT and OBSERVES; it never writes
`review:accepted`. So today every `review:pending` PR waits for a human to clear it — correct, but it is
standing human work on a loop the seam is built to mechanize.

A separate, related flip already has its readiness metric built: `computeAgreementMetric` /
`resolveLandMode` (`we:scripts/lib/decision-routing.mjs#resolveLandMode`) with `ENFORCE_FLIP_TRIGGER`
(N = 20 consecutive shadow-vs-human matches, M = 20 trailing window, 0 divergences). That is the model this
decision reuses for the REVIEW seam's flip — the machinery is proven, only the gate conditions are new.

## The change

Define the review-seam enforce-flip behind a deterministic predicate. `landMode: enforce` may arm **only
when ALL** of:

- **(a) `#2820` merge-predicate landed (PR #975)** — review-hold labels block merge regardless of
  `ready-to-merge`. Without it, an auto-written `review:accepted` could be merged even while a hold label
  should have stopped it; the flip is unsafe until the hold actually holds.
- **(b) `#2823` prevention field landed (PR #976)** — every review that surfaces findings emits the
  mandatory prevention-introspection block. Without it, a mechanically-cleared review can pass without ever
  generalizing its finding to the class — the flip would mechanize an under-powered review.
- **(c) a defined clean shadow-mode track record** — N observations the operator agreed with, 0
  divergences, over the trailing M-window (the `computeAgreementMetric` bar). Proof the auto-clear decides
  what the human would.

## Mechanical enforcement design (the concrete gate)

The flip is NOT a free-text toggle a session can set. It is gated by a pure predicate + a write gate:

- **`enforceFlipReady()`** — a pure function (home: `we:scripts/lib/decision-routing.mjs`, beside the
  existing `resolveLandMode`) returning `{ ready, reasons }`, `ready` iff **all three** hold:
  - **(a)** the `#2820` merge-hold conformance test is GREEN on `main` (the merge gate refuses
    `ready-to-merge` when a `review:*` hold label is present) — a deterministic test read, not a claim.
  - **(b)** the `#2823` prevention-field conformance test is GREEN on `main` (the shared review core emits
    the required prevention block per finding-class) — likewise a test read.
  - **(c)** `computeAgreementMetric(reviewShadowLedger).flipReady === true` — the review-seam shadow ledger
    (a `ShadowOutcomeRecord[]` of auto-clear-vs-human outcomes, the same record shape
    `we:scripts/lib/decision-routing.mjs#computeAgreementMetric` already consumes) meets N/M with 0
    divergences.
- **The flip itself is a policy-spec change → `review:human`.** Setting `landMode: enforce` in the `#2651`
  disposition config is an edit to the declarative leash (the policy contract), so it is already
  human-gated by `we:docs/agent/platform-decisions.md#review-human-declarative-leash-only`. The operator
  makes the flip; the machine only proves it is *allowed*.
- **Write gate.** A `check:standards` rule (`we:scripts/check-standards-rules.mjs`) **refuses**
  `landMode: enforce` in the disposition config unless `enforceFlipReady().ready` is true, and stamps the
  three reasons. So the switch cannot be flipped early even by a human edit: the preconditions are a
  machine-checked precondition of the config value, not a checklist a session eyeballs.
- **Auto-clear consumes the resolved mode unchanged.** `applyAutoLand`
  (`we:scripts/lib/auto-land-seam.mjs#applyAutoLand`) already writes `review:accepted` only in `enforce`;
  the safety rails (never auto-land a keep-parked / red-refuted / gate-self intent; fail-closed on any
  write error) hold in both modes and are untouched. This decision adds only the *gate on the flip*, not
  new auto-land behaviour.

## RISK

**Flipping to enforce reduces human oversight** — that is the whole point, and the whole danger. Once
armed, `review:pending` PRs clear without a person, so any weakness in the auto-clear decision now lands
code instead of merely logging a disagreement. A too-loose readiness bar (small N, a lenient match
definition) flips before the track record actually earns trust.

## SAFEGUARD

The flip is **triple-gated and defaults closed.** (a) and (b) require the *safety machinery* to have
landed and stay green (a regression in either reddens the conformance test → `enforceFlipReady` returns
false → the write gate re-refuses `enforce`). (c) requires a *measured* agreement record — matches the
operator agreed with, 0 divergences — reusing the proven `computeAgreementMetric` bar; a single divergence
resets it. Anything not exactly `enforce` normalizes to shadow (`we:scripts/lib/auto-land-seam.mjs`), so an
unset / unknown / corrupted mode fails safe to observe-only. And the flip edit is itself `review:human`, so
a person makes the call the machine merely *permits*. The safe direction — staying in shadow — is the
default at every layer.

## Options

| Option | Shape | Verdict |
|--------|-------|---------|
| **A — triple-gated flip predicate + write gate (recommended)** | `enforce` armed only when (a)+(b) green on main AND (c) agreement metric met; the flip edit stays `review:human` | oversight reduced only after the machinery + track record earn it |
| B — operator flips by hand, no predicate | trust the operator to check the three conditions before editing the config | REJECT — the directive is "enforced by mechanical gating"; an unchecked hand-flip is the unenforced instruction |
| C — auto-flip on the metric alone | flip when `computeAgreementMetric.flipReady`, ignore (a)/(b) | REJECT — flips before the merge-hold and prevention machinery exist; mechanizes an under-powered, unsafely-mergeable review |

## Recommendation

**Adopt A.** This is the single switch that turns the whole shadow-mode investment into actual reduced
oversight, and it should flip exactly when — and only when — it is safe. Gating it on (a) the merge-hold,
(b) the prevention field, and (c) a measured clean track record makes "is it safe to stop having a human
clear these?" a deterministic predicate, not a judgment call each time. The flip edit remains the
operator's `review:human` act; the predicate only certifies it is permitted. The `enforceFlipReady`
predicate + the write gate are a follow-on impl PR under `#x84bjrx` — this PR authors only the principle
and its gate conditions.

**Lineage:** composes `we:docs/agent/platform-decisions.md#human-required-is-judgment-only` (mechanical
convergent review need not stay human once the flip is safe) and reuses the shadow→enforce readiness
machinery `we:scripts/lib/decision-routing.mjs#resolveLandMode` /
`we:scripts/lib/decision-routing.mjs#computeAgreementMetric` (`ENFORCE_FLIP_TRIGGER`) and the auto-land
seam `we:scripts/lib/auto-land-seam.mjs#applyAutoLand` (the #2675 shadow default). Preconditions: `#2820`
(review-hold merge predicate, PR #975) and `#2823` (prevention-introspection field, PR #976).
