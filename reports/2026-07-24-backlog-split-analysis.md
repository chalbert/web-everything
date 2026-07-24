# Backlog split analysis — #2649 jury-core (subject-agnostic jury engine + thin skill)

**Date:** 2026-07-24 · **Session:** split-2649 · **Parent epic:** [#2649]

> This is the split rationale for [#2649]. It lives in `reports/` — not `backlog/` — because any `.md`
> under `backlog/` is parsed as a backlog *item*. [#2649] references this file via `relatedReport`, so it
> is exposed on the board, not a hidden doc.

## What #2649 was

A `size: 13` **candidate** that was already retyped `kind: epic` (it carries the ratified jury-of-#2576
design: F1 = both, F2 = shared-core, F3 = hybrid resolver-spined). The decision record is the source of
truth: the artefact **273a2dbd** (`https://claude.ai/code/artifact/273a2dbd-402d-4bd4-98f4-ec45475a7052`).
Because it was already an epic, there is no `story → epic` conversion — the split only **drops the residual
`size: 13`** (a storied epic with sized children double-counts and `check:standards` errors) and scaffolds
its child slices.

## What changed on #2649

Removed `size: 13` (the epic now carries no points — its six children carry them). Added `relatedReport`
pointing at this file. Umbrella body left intact (the ratified F1/F2/F3 framing is the epic's record).

## Could split — the six slices

The core folds into a **build-order DAG** along a *engine → schema → resolver → adapter-contract →
adapters → skin* spine. WE holds the core; per-domain adapters are the only per-subject code (honours the
#96 locus boundary). All engine slices scope `we:scripts/lib/`; the shell slice scopes `we:skills-src/`.

| Slice | id | Size | Scope | Realizes | blockedBy |
|---|---|---|---|---|---|
| **S1** subject-agnostic engine core (extract from review-core) | [#xswr4dr] | 5 | `we:scripts/lib/` | F2 core: finding contract, round loop + `NEGOTIATION_ROUND_CAP`, diversity-selection, care→rigor dial | — (foundational root) |
| **S2** jury ledger event schema | [#xiiyuvd] | 3 | `we:scripts/lib/` | the durable-log *shape* #2641 persists + #2642 serializes | S1 |
| **S3** stateless roster-recompute spine + ledger-trailed override (F3) | [#xwrsimd] | 5 | `we:scripts/lib/` | F3 resolver-spine: `roster = f(care, touch-set)` off the #2633 table + minimal override as ledger events | S1, S2, #2633, #2634 |
| **S4** adapter contract + PR-diff reference adapter (F2 heart) | [#x9pa439] | 5 | `we:scripts/lib/` | the subject-adapter interface + PR-diff re-homed as the reference adapter that proves it | S1, S3 |
| **S5** design-pixels + decision-prose adapters | [#xqg3my2] | 5 | `we:scripts/lib/` | the other two subjects (design-pixels per #2576; decision-prose over plan-handshake) | S4 |
| **S6** thin `/jury` skill shell + subject-agnostic workflow (F1) | [#xnthi3f] | 5 | `we:skills-src/` | F1 shell: `we:skills-src/jury/SKILL.md` (invoke + render only) + one harness over all three subjects | S4, S5 |

Total = **28 points** across six stories (up from the seed's single 13 — slicing surfaced the schema,
resolver, adapter-contract, and skin work the umbrella had bundled). Every slice is a distinct,
independently-deliverable, agent-ready unit (each `size` ≤ 5).

## The DAG

```
S1 ─┬─────────────► S3 ──► S4 ──► S5 ──► S6
    │   S2 ─────────►│      ▲       │      ▲
    └───► S2         │      └───────┴──────┘
                     ▲
   #2633 ────────────┤   (care→jury table)
   #2634 ────────────┘   (lens-vs-validation split)
```

- **S1** is the root (no blocker) — the engine extraction every other slice imports.
- **S2** (schema) needs only S1; **S3** (resolver) needs S1 + S2 **and** the two ratified config
  prerequisites **#2633** (care→jury table) and **#2634** (lens/validation-method split).
- **S4** (adapter contract) needs the engine (S1) and the resolver (S3) it dispatches through.
- **S5** (two more adapters) needs the contract S4 proves.
- **S6** (skin) needs the contract (S4) and the full adapter set (S5) so one harness runs any subject.

All `--blocked-by` edges resolve to real ids (sibling hashes minted in DAG order + the landed numbers
#2633 / #2634). `#2633` and `#2634` are the only cross-item prerequisites, both already present.

## Deferred inside a slice (recorded, not a separate item)

The **design-pixels screenshot-vs-target grounding** is registered by **S5** as a **DEFERRED** method
until the visual-diff primitive lands. The unblock is a small **~size-2 follow-up** that wires it in once
that primitive exists — noted in S5's digest rather than scaffolded now (nothing to wire against yet).

## Could NOT split — kept whole / left out

- **Conveyor-surfacing of the ledger is NOT a child of #2649.** Making the jury ledger *live to the
  conveyor as the single source of truth* is already owned by **#2641** (the on-disk log + the fold), with
  a **later ~2-pt wiring story** to connect the engine's emitted events to that surface once both exist.
  #2649's S2 defines only the event **schema** (the shape #2641 persists); the persistence, the fold, and
  the conveyor surfacing stay in #2641's lane. Pulling them into #2649 would duplicate #2641's deliverable.
- **The deferred disposition layers stay out of #2649.** **#2650** (micro-decision surfacing / challenge
  loop), **#2651** (per-lens weights + dissent threshold config), and **#2652** (judge / red-judge over the
  jury ledger) are their own tracked epics/stories downstream of the jury core — not slices of it. They
  build *on* the ledger and adapters #2649 produces; folding them in would re-bundle the exact
  post-core work they were separated to hold.
- **The red-team pass (#2637) and juror-invite mechanism (#2640) are not re-sliced here.** They are
  already tracked items; #2649's engine exposes the seams they plug into rather than re-owning them.

## Not done here (per task)

No settle needed (the six children are **born-open**, not session-owned). No resolve, one commit, PR opened
**ready-to-merge and left un-merged**. The epic keeps its `NNN` (#2649) — never renumbered.
