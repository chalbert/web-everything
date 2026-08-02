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

Make spec-first ratification the default for the in-scope tier, and arm it at *enforce* only once the shadow-agreement record is earned (#2838). This slice carries the **landing mechanism that lets a failing spec PR actually land** — the fatal gap the original two-PR prose left open — plus a concrete tier predicate and a signed scenario-coverage rubric.

## Gap

1. **[fatal] A failing-spec PR cannot land.** The required `test` check gates on green. #2839's two-PR shape (ratify the spec, then the impl) is *prose*: red spec tests would fail CI, so the spec PR could never land.
2. **[major] "Tier" and "scenario coverage" were undefined** — nothing let the runner mechanically decide who is in scope, or gave the human a concrete rubric to sign.

## Why

Spec-first only works if the spec can land *before* the impl (green CI) yet stay honestly red until the impl flips it. And the runner cannot self-approve a "standard change on the tier" unless "tier" is a mechanical predicate, not a vibe.

## Mechanical approach (the fatal fix, stated explicitly)

- **The spec PR lands its tests `it.todo` / `it.fails`-annotated** — declared pending, so they are **green in CI** (a declared-pending test is not a failure) while still encoding the ratified invariant.
- **A `check:standards` gate** then (a) **forbids weakening or deleting a ratified spec test** (the annotated pending tests are immutable-downward — you may strengthen, never remove or loosen), and (b) **requires the impl PR to flip them live** (`it.todo`/`it.fails` → real, passing `it`). The impl PR cannot land while a ratified spec test is still pending.
- **Alternative to keep on record:** spec + impl in one PR with a **checked-in, human-signed frozen test-manifest hash** — the human signs the spec's hash, the impl cannot alter the manifest without re-signing. (Documented as the fallback if the two-PR `it.todo` flow proves awkward.)
- **Enforce-flip gating (#2838):** the spec-first default arms at *enforce* only once the **shadow-agreement record** (floor vs. human agreement in shadow mode) is trustworthy — until then it runs in shadow, advisory only.

## Defining "tier" and "scenario coverage" (major fix)

- **In-scope tier = a concrete path/marker predicate**, like #2840's `isDeclarativeLeashPath` or the policy-core basename set — a function the runner evaluates mechanically (e.g. an `isTrustChainTier(path)` over the `disposition-judge` / review-core / engine file set under [we:scripts/lib/](scripts/lib/)). The runner decides tier by predicate, never by judgment.
- **"Scenario coverage" = a concrete signed rubric** over the adversarial-state axes the human ratifies: **races, multi-owner, held-after-join, ordering.** The human signs that the spec covers each axis (or explicitly waives it); "did we imagine enough mean states?" becomes a checklist against named axes, not an open question.

## Self-test

This slice edits the self-approval floor, so it is itself gate-self → **human-ratified, never self-approvable** (see the epic). Arming enforce for spec-first is a human act.
