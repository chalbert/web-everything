# Backlog split analysis — 2026-07-10

Focused run: `/slice 2387`.

## Candidate

**#2387 — Serial-batch → drain coordination: overlap-stack lanes, proof-of-land gate, push the handoff** (`kind: epic`, unsliced — no children). A red-team-converged design epic whose body already carries a migration-ordered slice plan. Condition (1) of the split-safety rubric ("size is volume not a fork") is settled at the parent level: every open fork (F1–F5) was decided during convergence, so the slices are **pure build**, not buried decisions.

## Could split — 11 slices, clean DAG

The body's 10-slice plan holds, with **one refinement**: peel `lane-pool-base` (the `--base=<ref>` flag) off `producer-overlap-stacking`, since a lane-pool flag is independently testable and useful on its own. That drops the producer slice from 6→5 (the remainder rounds to the nearest Fibonacci point).

| # | Slug | size | blockedBy | Home |
|---|---|---|---|---|
| 1 | `drain-dual-lock` | 5 | — | `we:scripts/lane-drain.mjs`, `we:scripts/merge-ai-prs.mjs`, `we:scripts/pr-land.mjs` |
| 2 | `hash-aware-cascade` | 2 | — | `we:scripts/merge-ai-prs.mjs` |
| 3 | `manifest-stack-fields` | 2 | — | `we:scripts/readiness/lane-manifest.mjs`, `we:scripts/lane-manifest-write.mjs` |
| 4 | `lane-pool-base` | 2 | — | `we:scripts/lane-pool.mjs` |
| 5 | `bornas-proof-of-land` | 3 | 1 | `we:scripts/lane-drain.mjs`, `we:scripts/backlog/id.mjs` |
| 6 | `proof-gated-stacked-drain` | 5 | 2, 3, 5 | `we:scripts/merge-ai-prs.mjs` |
| 7 | `per-item-review-diff` | 3 | 3 | `we:scripts/merge-ai-prs.mjs` |
| 8 | `producer-overlap-stacking` | 5 | 3, 6, 4 | `we:.claude/skills/batch-backlog-items` |
| 9 | `push-at-close` | 3 | 1, 8 | `we:.claude/skills/batch-backlog-items` |
| 10 | `finish-stack-repair` | 3 | 6, 8 | `we:scripts/lane-resume.mjs` |
| 11 | `docs-stacked-batch` | 2 | 8, 9, 10 | skills + `we:docs/agent/backlog-workflow.md` |

**DAG is acyclic.** Roots 1–4 deliver standalone value; slices 1 and 2 are **latent-bug fixes that stand alone today** (the drain has no numbering lock; the `blockedBy` cascade already NaN-collapses hash-keyed items). Every slice leaves a valid demoable state — enforced by the migration order: the proof gate (6) + capability marker ship and are confirmed live on `origin/main` **before** any producer stacks (8).

## Could not split further — 2 irreducible cores (both flagged, with rationale)

Two slices land above the size-3 target. Splitting either would **cost quality / safety**, so they stay atomic (rubric condition: "every slice leaves a valid demoable state").

- **`proof-gated-stacked-drain` (5).** Bundles the impl-PR→WE-manifest `laneRef` join + the proof-of-land gate + the capability-marker commit. These cannot ship separately: the join without the gate is a no-op; the gate without the join leaves the impl-orphan-always-ready hole open; and the capability marker must go live **with** the gate (it advertises "gate supported," so a marker ahead of the gate is actively unsafe — producers would stack against a non-gated drain). Any partial ship is an unsafe intermediate drain state. **Keep atomic.** Unblocking action if it must shrink later: land the join+gate first with the marker withheld, then the marker as a trailing 1-pointer — but only once the gate is proven on main.
- **`producer-overlap-stacking` (5).** After peeling `lane-pool-base`, the remainder — union-find overlap-chain construction + the push-time `actual⊆declared` re-check + in-session rebase-on-violation — is one coherent producer change. The re-check is meaningless without the construction, and it is the **safety-critical** step (it's what stops a mis-predicted sibling reaching the deferred drain), so fragmenting it risks shipping construction without its guard. **Keep atomic at 5.**

## Verdict

Safe to slice into **11 children** under `#2387`. Sum ≈ 35 pts. No fork is buried; the DAG is real (independent roots + incremental delivery); the two >3 slices are documented irreducible cores.
