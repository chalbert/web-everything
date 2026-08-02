---
kind: story
size: 5
parent: "xk8w1ep"
status: open
blockedBy: ["x9ke51w"]
dateOpened: "2026-08-02"
tags: [conveyor, self-approval, spec-first]
---

# Spec-first ratification default and enforce-flip gating on the shadow-agreement record

Make spec-first ratification the default for the in-scope tier, and arm it at *enforce* only once the shadow-agreement record is earned (#2838). This slice carries the **landing mechanism that lets a ratified spec actually land green** — the fatal gap the original two-PR prose left open — plus a signed scenario-coverage rubric. (The in-scope tier predicate itself is defined upstream in [#xsxz3lk](xsxz3lk-trust-chain-tier-predicate-coverage-instrumentation-the-mech.md); this slice consumes it.)

## Gap

1. **[fatal] A ratified spec cannot land green — and the `it.fails`/`it.todo` workaround does NOT hold.** The required `test` check gates on green, so #2839's two-PR shape (ratify the spec, then the impl) as *prose* fails: red spec tests fail CI. The earlier draft's fix — land the spec tests `it.fails`-annotated so they read as "declared pending, green in CI" — was **grounded and refuted**. A ratified regression-guard invariant that the **existing code already satisfies** has a *passing* body; `it.fails` over a passing body does not go green, it goes **RED**. So the very check this slice exists to keep green would go red on any already-satisfied invariant. (See the grounding note below.) `it.todo` is not a substitute either: `it.todo` **never executes its body**, so it validates nothing — it and `it.fails` are not interchangeable.
2. **[major] "Scenario coverage" was undefined** — nothing gave the human a concrete rubric to sign. (The companion "tier" gap is fixed upstream in [#xsxz3lk](xsxz3lk-trust-chain-tier-predicate-coverage-instrumentation-the-mech.md), which defines `isTrustChainTier`.)

## Why

Spec-first only works if the ratified spec can land *before* the impl on a **green** `test` check, yet the invariant stays frozen so the impl cannot silently weaken it. The `it.fails` route can't deliver that green (grounded below), so the landing mechanism must be one that is green regardless of whether the current code already satisfies the invariant.

## Grounding note (the refutation, on record)

Probe run in a lane clone under `vitest run` (v8/happy-dom, v1.6.1): a test written `it.fails('x', () => { expect(1).toBe(1) })` — an `it.fails` wrapper over a **passing** body — produced:

```
FAIL  … > x
Error: Expect test to fail
 Test Files  1 failed (1)
      Tests  1 failed (1)
```

vitest **hard-fails** an `it.fails` test whose body passes. So any already-satisfied ratified invariant landed as `it.fails` turns the `test` check red and blocks the spec PR — the exact failure this slice was meant to remove. This is why the manifest-hash mechanism below is the **primary**, not the fallback.

## Mechanical approach (the fatal fix, stated explicitly)

- **Primary: ONE PR (spec + impl together) + a checked-in, human-signed frozen test-manifest hash.** The human signs a hash over the ratified spec's test set; the manifest is checked in. All tests are real `it`s that must pass, so the `test` check is green by construction — no dependence on runner-specific pending semantics, and no "already-satisfied invariant goes red" problem. The impl **cannot alter the manifest without re-signing**, so it cannot silently drop or loosen a ratified test.
- **A `check:standards` gate** then (a) **forbids weakening or deleting a ratified spec test** — the signed manifest is immutable-downward; you may strengthen (and re-sign), never remove or loosen — and (b) verifies the checked-in manifest hash matches the current spec test set, so any post-sign tampering fails the gate.
- **Retired: the two-PR `it.todo` / `it.fails` flow.** Kept only as a rejected-alternative record (see the grounding note) — `it.fails` red-fails an already-passing invariant and `it.todo` executes nothing, so neither delivers the green-yet-frozen property the manifest hash gives directly.
- **Enforce-flip gating (#2838):** the spec-first default arms at *enforce* only once the **shadow-agreement record** (floor vs. human agreement in shadow mode) is trustworthy — until then it runs in shadow, advisory only.

## Defining "scenario coverage" (major fix)

- **"Scenario coverage" = a concrete signed rubric** over the adversarial-state axes the human ratifies: **races, multi-owner, held-after-join, ordering.** The human signs that the spec covers each axis (or explicitly waives it); "did we imagine enough mean states?" becomes a checklist against named axes, not an open question. (The in-scope **tier** — which files this rubric governs — is the `isTrustChainTier` predicate from [#xsxz3lk](xsxz3lk-trust-chain-tier-predicate-coverage-instrumentation-the-mech.md); the runner decides tier by that predicate, never by judgment.)

## Self-test

This slice edits the self-approval floor, so it is itself gate-self → **human-ratified, never self-approvable** (see the epic). Arming enforce for spec-first is a human act.
