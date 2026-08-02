---
bornAs: xrlfy17
kind: story
size: 5
parent: "2873"
status: open
blockedBy: ["2876"]
dateOpened: "2026-08-02"
tags: [conveyor, self-approval, spec-first]
---

# Probe-runner and commit-the-probe-as-test — adversarial reproduction feeding the ledger

Upgrade the red judge from *refute-by-reasoning* to *refute-by-reproduction* **without touching `redRefute`'s purity or the review sandbox.** A **separate probe-runner** executes adversarial inputs against the built head in a throwaway clone and **emits ledger events**; the existing pure `redRefute` reads those events. Every probe that finds a bug is committed as a permanent regression test, feeding spec completeness.

## Gap

The proposal's original wording ("`redRefute` executes code") is unsafe and was rejected: `redRefute` in [we:scripts/lib/disposition-judge.mjs](scripts/lib/disposition-judge.mjs) is a **pure** function over the ledger (no I/O, deterministic), and the review harness is a **no-`import` / no-`child_process` / no-fs sandbox** (#2418); code runs only in throwaway clones (#2336). Making the pure judge execute inputs would break both its purity and the sandbox.

## Why

Refutation today reasons over a diff instead of running it — the exact failure mode behind the evidence (convergence declared "dry" while live bugs sat). We want reproduction, but we cannot get it by weakening the two invariants that keep the judge safe.

## Mechanical approach (the fatal fix, stated explicitly)

- **Add a separate probe-runner** — a CI stage **or** a spawned agent in a throwaway clone (#2336) — that executes the adversarial inputs against the **built head** and **emits ledger events** (`probe-refuted` / `probe-passed`).
- **`redRefute` stays pure and unchanged**: it *reads* those emitted ledger events; it never spawns, imports, or touches the filesystem. The sandbox (#2418) is likewise untouched — execution happens only in the throwaway clone, never in the review harness.
- **Commit-the-probe-as-test**: any adversarial input that reproduces a bug is committed as a permanent regression test, so the ratified spec's scenario set *grows* from real refutations.

## Non-goals

Do **not** modify `redRefute`'s signature-level purity or relax the sandbox. This slice adds a runner *beside* the judge and a ledger contract between them; it does not move execution into the judge.
