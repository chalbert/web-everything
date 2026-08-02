---
bornAs: xk8w1ep
kind: epic
status: open
dateOpened: "2026-08-02"
tags: [conveyor, self-approval, spec-first]
---

# Spec-first self-approval — ratify the executable spec, not the implementation

Umbrella for moving the human review act **upstream**: instead of repeatedly reviewing an *implementation*, a human ratifies once a small, **executable spec** — the tests that define "correct," including adversarial states — and everything downstream (impl built to pass, the self-approval floor) runs mechanically. Scope is the trust-chain / engine tier plus gate-self changes; genuinely exploratory work stays build-then-spec. **Low priority — prioritize only after the current review-machinery PR pile closes** (the #2830/#2838 cluster); this epic is filed so the design survives its red-team, not so it starts now.

## Problem (the evidence)

The trust-chain stories cost many human review rounds and heavy tokens because the impl was built first and the invariants lived *implicitly in the code* — checkable only by reading it, repeatedly, live. Agent convergence declared "dry" while live bugs sat (it *read* the diff; it did not *run* it). Every human check found a real bug — PR #984 four rounds, PR #983 a false-green in its own writer, PR #974 many false positives, PR #985 a duplicate. Nowhere near a trust bar that would let a machine self-clear an implementation.

## Goal

AI-driven building with a **strong, safe self-approval flow for standard changes**, where human judgment goes in **once, upstream**, at a small declarative spec. The human's job becomes: *ratify the spec + judge its scenario coverage* — once, on a small surface — not review N rounds of implementation.

## Self-test — this epic is itself gate-self and is NOT self-approvable

This proposal edits the **approval machinery itself** (it changes what "self-approval" is allowed to clear). That makes it **gate-self / statute**, so **this epic, and every edit to the self-approval floor it defines, is human-ratified** — never self-approvable — consistent with `disposition-judge`'s gate-self hard-escalate-to-human ([we:scripts/lib/disposition-judge.mjs](scripts/lib/disposition-judge.mjs)) and the #2838 leash pin. No slice here may let the machinery that governs approvals approve a change to itself.

## Honest bound on how much safety actually shifts to mechanical

A happy-path spec can still ship a subtly-wrong impl unreviewed, because a bug can live **outside** the ratified scenario set. So the claim is bounded: **self-approval is only as safe as the ratified scenario set.** The **mutation floor (slice 4) is the *sole* mechanical catch for out-of-scenario impl behavior, and it is imperfect** (equivalent mutants, cost, scoping). So this shifts **less** safety onto the mechanical floor than a raw "we have N spec tests" count implies — the human scenario-coverage judgment and the red probes remain the real backstop, not a formality.

## Composes with what exists

- **Enforce-flip (#2838)** — the spec-first default only arms at *enforce* once the floor + the shadow-agreement record are trustworthy (slice 5).
- **Throwaway-clone pattern (#2336)** — the probe-runner (slice 3) executes adversarial inputs only in throwaway clones, never in the review sandbox.
- **#2839 principle-separate-from-impl** — the spec/impl separation applied to behavior. Slice 5 states the landing mechanism (a human-signed frozen test-manifest hash in ONE PR), since neither a two-PR shape nor an `it.fails` annotation lets a ratified spec land green on its own.
- **Gate-self tiering** — standard changes off the trust-chain self-approve on the floor; trust-chain/engine + gate-self stay human-ratified (above).

## The slices (rollout order, `blockedBy`-chained)

The tier predicate ("which files are in scope") and its coverage instrumentation are the definitional prerequisite everything else consumes, so they lead — never a forward-reference from an earlier slice to a later one.

1. **#2875 — Trust-chain tier predicate + coverage instrumentation** (no `blockedBy`; Tier-A first). Defines `isTrustChainTier(path)` and adds the trust-chain tier to `coverage.include` (v8 does not instrument `scripts/` today). Everything below `blockedBy`-depends on this.
2. **#2876 — Diff-branch-coverage floor** (blockedBy 1). Per-diff branch-coverage attribution over the now-instrumented tier, as the cheap first mechanical gate.
3. **#2877 — Probe-runner + commit-the-probe-as-test** (blockedBy 2). A *separate* runner executes adversarial inputs against the built head and emits ledger events; the existing pure `redRefute` reads them. **[fatal fix]**
4. **#2878 — Mutation testing on the trust-chain tier** (blockedBy 3). Stryker + vitest scoped to a named file set, with a stated cost — the only mechanical catch for out-of-scenario bugs.
5. **#2879 — Spec-first ratification default + enforce-flip gating** (blockedBy 4). A ONE-PR, human-signed frozen test-manifest hash lets a ratified spec land green, plus the gate that forbids weakening a ratified spec test. (The earlier `it.fails` landing mechanism was grounded and retired — vitest hard-fails `it.fails` over an already-passing invariant.) **[fatal fix]**

Each slice is independently useful and downgraded to "raises the floor," not "proves the impl meets the spec."
