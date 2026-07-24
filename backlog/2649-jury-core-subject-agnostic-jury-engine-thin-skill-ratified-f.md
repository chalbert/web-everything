---
bornAs: x1gvvdx
kind: epic
size: 13
parent: "2636"
status: open
scope: ["we:scripts/lib/", "we:scripts/conveyor/", "we:skills-src/"]
dateOpened: "2026-07-24"
tags: []
---

# jury-core — subject-agnostic jury engine + thin skill (ratified F1/F2/F3)

Build the reusable jury as a subject-agnostic WE core library plus a thin skill shell — the ratified F1 (both), F2 (shared-core), F3 (hybrid resolver-spined) shape.

**Ratified design.** This epic carries the jury-of-#2576 ruling (human-disposed). The decision record artefact is the source of truth: https://claude.ai/code/artifact/273a2dbd-402d-4bd4-98f4-ec45475a7052

- **F1 = both.** One subject-agnostic engine plus a thin skill shell. No jury logic lives in the shell — the shell only invokes the engine and renders.
- **F2 = shared-core.** The jury method lives once in a WE core library under [we:scripts/lib/](scripts/lib/), with thin per-domain adapters for the three subjects: PR-diff review, design-pixel review, and decision-prose review. This honours the #96 locus boundary — WE holds the core; the adapters are the only per-domain code.
- **F3 = hybrid, resolver-spined.** Config comes from the #2633 care→jury table; a STATELESS roster recompute from care + touch-set is the spine (deterministic, re-derivable), with a minimal, ledger-trailed override layer on top.

**Scope of the core (to be sliced into child stories).** Fan-out, diversity-selection, care-gating, the round-cap, the ledger schema, the red-team pass (#2637), and the invite mechanism (#2640) — all as one WE library. Plus the thin per-domain adapters, a `/jury` skill and a workflow entry, and the hybrid resolver-spined config wiring (#2633).

**Seed.** The working jury workflow already hand-run this session is the seed for the core — extract the method that produced the ruling into the library rather than re-deriving it.

Big — filed as an **epic to be sliced**. The first child slice drops this epic's `size`.
