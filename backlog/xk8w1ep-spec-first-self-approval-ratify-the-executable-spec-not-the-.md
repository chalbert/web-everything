---
kind: epic
status: open
dateOpened: "2026-08-02"
tags: [conveyor, self-approval, spec-first]
---

# Spec-first self-approval — ratify the executable spec, not the implementation

Umbrella for moving the human review act **upstream**: instead of repeatedly reviewing an *implementation*, a human ratifies once a small, **executable spec** — the tests that define "correct," including adversarial states — and everything downstream (impl built to pass, the self-approval floor) runs mechanically. Scope is the trust-chain / engine tier plus gate-self changes; genuinely exploratory work stays build-then-spec. **Low priority — prioritize only after the current review-machinery PR pile closes** (the #2830/#2838 cluster); this epic is filed so the design survives its red-team, not so it starts now.

## Problem (the evidence)

The trust-chain stories cost many human review rounds and heavy tokens because the impl was built first and the invariants lived *implicitly in the code* — checkable only by reading it, repeatedly, live. Agent convergence declared "dry" while live bugs sat (it *read* the diff; it did not *run* it). Every human check found a real bug — #984 four rounds, #983 a false-green in its own writer, #974 many false positives, #985 a duplicate. Nowhere near a trust bar that would let a machine self-clear an implementation.

## Goal

AI-driven building with a **strong, safe self-approval flow for standard changes**, where human judgment goes in **once, upstream**, at a small declarative spec. The human's job becomes: *ratify the spec + judge its scenario coverage* — once, on a small surface — not review N rounds of implementation.

## Self-test — this epic is itself gate-self and is NOT self-approvable

This proposal edits the **approval machinery itself** (it changes what "self-approval" is allowed to clear). That makes it **gate-self / statute**, so **this epic, and every edit to the self-approval floor it defines, is human-ratified** — never self-approvable — consistent with `disposition-judge`'s gate-self hard-escalate-to-human ([we:scripts/lib/disposition-judge.mjs](scripts/lib/disposition-judge.mjs)) and the #2838 leash pin. No slice here may let the machinery that governs approvals approve a change to itself.

## Honest bound on how much safety actually shifts to mechanical

A happy-path spec can still ship a subtly-wrong impl unreviewed, because a bug can live **outside** the ratified scenario set. So the claim is bounded: **self-approval is only as safe as the ratified scenario set.** The **mutation floor (slice 3) is the *sole* mechanical catch for out-of-scenario impl behavior, and it is imperfect** (equivalent mutants, cost, scoping). So this shifts **less** safety onto the mechanical floor than a raw "we have N spec tests" count implies — the human scenario-coverage judgment and the red probes remain the real backstop, not a formality.

## Composes with what exists

- **Enforce-flip (#2838)** — the spec-first default only arms at *enforce* once the floor + the shadow-agreement record are trustworthy (slice 4).
- **Throwaway-clone pattern (#2336)** — the probe-runner (slice 2) executes adversarial inputs only in throwaway clones, never in the review sandbox.
- **#2839 principle-separate-from-impl** — the spec/impl two-PR shape, applied to behavior (slice 4 states the landing mechanism, since a two-PR shape alone does not let a failing-spec PR land).
- **Gate-self tiering** — standard changes off the trust-chain self-approve on the floor; trust-chain/engine + gate-self stay human-ratified (above).

## The slices (rollout order, `blockedBy`-chained)

1. **#x0za326 — Diff-branch-coverage floor.** Per-diff branch-coverage attribution as the cheap first mechanical gate.
2. **#xrlfy17 — Probe-runner + commit-the-probe-as-test** (blockedBy 1). A *separate* runner executes adversarial inputs against the built head and emits ledger events; the existing pure `redRefute` reads them. **[fatal fix]**
3. **#x9ke51w — Mutation testing on the trust-chain tier** (blockedBy 2). Stryker + vitest scoped to a named file set, with a stated cost — the only mechanical catch for out-of-scenario bugs.
4. **#xtjajqz — Spec-first ratification default + enforce-flip gating** (blockedBy 3). The `it.todo`/`it.fails` landing mechanism that lets a spec PR land green, plus the gate that forbids weakening a ratified spec test and requires the impl PR to flip it live. **[fatal fix]**

Each slice is independently useful and downgraded to "raises the floor," not "proves the impl meets the spec."
