---
kind: story
size: 5
status: active
scaffoldedBy: "converge-skill"
dateScaffolded: "2026-08-06"
dateOpened: "2026-08-06"
tags: []
---

# Extract the editor↔reviewer convergence loop into a testable core (decisions AND observations)

The convergence loop lives only inside we:scripts/workflows/review-parked-prs.mjs, a harness body that cannot be imported or unit-tested. Extract it into we:scripts/lib/converge-core.mjs covering BOTH the decisions (continue/escalate, round-cap backstop, grow-only roster union) and the OBSERVATIONS they rest on (fetch ok, per-lens ran/crashed, editor advanced) — the seam the fail-closed bugs of #2639/#2640/#2450 actually span. The core takes RAW per-lens results, never a pre-reduced verdict, so 'a crashed mandatory lens degrades to needs-human' becomes a unit test.

## Why the seam includes the observations

The obvious extraction takes only the *decisions* — the `continue`/`escalate` branch, the cap backstop, the
roster union. A jury on this design (elevated care, decision-prose) rejected that seam: the historically
bug-prone surface it cites spans **both** the decision and the **sensing that precedes it**. Drawing the line
mid-mechanism leaves the untrusted half exactly where it was while claiming the invariant is now covered.

Concretely: if the core is handed an already-reduced verdict, then "a crashed mandatory lens degrades the
round to `needs-human`" is *unreachable* from inside the core — the degradation already happened upstream, in
the untestable harness. So the core's step function takes the **raw per-lens results** (`{ lens, ok,
findings }[]`) plus the round's observation record, and performs the degradation itself.

## What the core owns

- `deriveRoundObservations({ readResult, lensResults, editResult })` — the fail-closed sensing: did the read
  produce material, which lenses actually ran, did the editor advance the work.
- `convergeStep(state, observations)` → `{ action, state }` where `action ∈ read | panel | invite | edit |
  land | escalate`. Pure. The harness executes actions; it never decides.
- The cap backstop, the grow-only roster union, and the fail-closed degradations — all inside `convergeStep`,
  all unit-tested.

Judging stays out: the roster, the care→rigor dial, the mandatory set, and how verdicts reduce remain in
we:scripts/lib/jury-core.mjs, reached through the existing we:scripts/review-core-cli.mjs bridge.

## Declared dependency on the jury engine

A concurrent workstream is revising panel weighting inside we:scripts/lib/jury-core.mjs. Promising "zero
lines changed in that file" prevents merge conflicts but **not** semantic drift — this core's tests can break
with zero textual overlap if the meaning of a shared export changes. So this item declares the exports it
depends on (`derivePanelVerdict`, `deriveNegotiationOutcome`, `MANDATORY_LENSES`, `NEGOTIATION_ROUND_CAP`) as
a named contract in the module header, so a weighting change surfaces as a stated contract break rather than
a mystery test failure.

## Proof

Unit tests over `convergeStep` and `deriveRoundObservations` — deterministic, no live agents. The
behaviour-preservation check is **record/replay**, not an end-to-end ledger diff: an end-to-end diff against a
real PR cannot fail meaningfully, because every verdict originates in a nondeterministic `agent()` call and
any delta reads as model variance.
