---
bornAs: x9ke51w
kind: story
size: 5
parent: "2873"
status: open
blockedBy: ["2877"]
dateOpened: "2026-08-02"
tags: [conveyor, self-approval, spec-first]
---

# Mutation testing on the trust-chain tier — stryker + vitest scoped to a named file set

Introduce mutation testing (Stryker with the vitest runner) scoped to a **named file set** on the trust-chain / engine tier, with a **stated cost**. Coverage says a branch *ran*; mutation says the tests would *catch it changing*. This is the **only mechanical catch for out-of-scenario impl behavior** — and it is imperfect (equivalent mutants, cost), so it raises the floor, it does not certify correctness.

## Gap

Stryker is **absent** from the repo (no `stryker.config.*`, not a dependency). The coverage-only floor is gameable: execution without assertion passes coverage but catches nothing. There is no mutation signal today.

## Why

The epic's honest bound names this slice as the sole mechanical backstop for bugs that live *outside* the ratified scenario set. Without it, the self-approval floor rests entirely on the human scenario set plus the red probes — mutation is what makes "the tests actually assert" mechanical, within its known limits.

## Mechanical approach

- Add Stryker + the vitest runner, **scoped to a named file set** (the trust-chain / engine files the `isTrustChainTier` predicate names in [#2875](2875-trust-chain-tier-predicate-coverage-instrumentation-the-mech.md), e.g. the `disposition-judge` / review-core cluster under [we:scripts/lib/](scripts/lib/)) — **never repo-wide**.
- **State the cost** in the config and the gate docs: mutation runs re-execute the suite per mutant, so the scoped set and the cadence (per-diff vs. nightly) are a deliberate budget, not an afterthought.
- Report a mutation-score floor for the scoped set as a `check:standards` / CI gate, worded as "raises the floor," and **acknowledge equivalent mutants** — a surviving mutant may be benign, so the score is a floor signal, not a proof.

## Non-goals

Not repo-wide mutation (cost). Not a correctness claim — the red probes ([#2877](2877-probe-runner-and-commit-the-probe-as-test-adversarial-reprod.md)) and the human scenario-coverage judgment remain the backstop.
