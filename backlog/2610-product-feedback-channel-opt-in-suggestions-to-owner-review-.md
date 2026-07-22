---
bornAs: xcciuwx
kind: epic
parent: "2527"
status: open
dateOpened: "2026-07-22"
tags: [plateau-loop, product, feedback, privacy]
---

# Product feedback channel: opt-in suggestions → owner review screen

When the conveyor/console is offered as a product, the learnings pipeline goes multi-tenant: opt-in suggestion telemetry from users' sessions flows to the owner, who reviews it on a triage screen. Deliberately later work — filed now to shape the seams (especially the drop-box schema in #2614, which must be tenant-ready from day one). Parent: the #2527 console program; lineage: governance epic #539 (approval roles, opt-in policy).

## Same pipeline shape

capture → dedup → red-team → closed-verdict review → accept/land — the multi-tenant generalization of the single-tenant drop-box sweep (#2614).

## The review screen reuses the ratified console grammar

Per the console design record (plateau:docs/backlog-console-design.md): the **closed verdict vocabulary** (§3h R4), **queue-with-peek**, the **triage stepper** (§3g T7), and **dedup before expensive review**.

## HARD privacy requirements (ratified 2026-07-22, Nicolas)

1. **Minimal-by-construction schema** — generalized lessons only; no code, diffs, secrets, paths, or repo-identifying strings. If the schema has no field for it, it can't leak.
2. **Deterministic scrub gate at the SEND seam** — a secret/path/token scan that **denies on hit**, following the write-time gate hook precedent (the PreToolUse deny-the-write pattern).
3. **Opt-in = verbatim payload preview** — per send or as a digest, the user sees exactly what leaves the machine.

## Slicing

Unsliced on purpose: the epic exists to anchor the seams and the privacy statute-shape now; it gets sliced when the product conveyor work (#2527) reaches the multi-tenant stage.
