---
kind: decision
size: 3
parent: "1855"
status: open
dateOpened: "2026-06-27"
tags: [memory, write-time, dedup, metadata, model-usage-watch]
---

# Sharpen memory write-time discipline — UPDATE/DELETE/NOOP + recency metadata

Our memory policy ([we:docs/agent/memory-management.md](../docs/agent/memory-management.md)) enforces dedup only **at budget** (rule 4, merge-before-add) plus "one canonical memory per idea". The 2025–2026 literature treats contradiction-avoidance as a **per-write** discipline, not a budget event (*Mem0* classifies every new fact ADD/UPDATE/DELETE/NOOP; *Generative Agents* tags facts with recency+importance to drive what surfaces). Two open calls on whether to adopt those, weighed against overhead for a solo file-based store.

## Fork 1 — write-time classification vs merge-only-at-budget

*Fork-existence:* a real either/or on *when* contradiction-resolution fires.

- **(default) Adopt UPDATE/DELETE/NOOP on every write** — when a new fact arrives, immediately decide: extends an existing one (UPDATE in place), conflicts with one (DELETE the stale), or is noise (NOOP) — so contradictions never co-exist, independent of budget pressure. Cheap policy change; sharper than today's "merge when full". *Confidence the direction is right: high — it's the field's consensus and matches our existing "prune on sight".*
- **(b) Keep merge-only-at-budget** — simpler, but lets contradictions sit until the index fills.

## Fork 2 — how much per-fact metadata is worth it

*Fork-existence:* a real either/or — metadata aids pruning but adds authoring overhead with no scorer to consume it.

- **(a) None** — status quo; pruning stays pure judgment.
- **(default) Minimal — a `last-affirmed` date only** — cheap stamp that lets a consolidation pass (and [#1878](/backlog/1878-close-out-as-memory-instruction-self-improvement-loop/)) flag un-reaffirmed/stale facts without a scoring engine. *Recommended: the one metadatum with a consumer (staleness surfacing) and near-zero cost.*
- **(c) Full recency+importance scores (Generative-Agents style)** — likely over-engineering for solo file-memory: no retrieval scorer exists to use importance weights, so the cost buys little. Rejected unless a scorer lands.

## Boundaries / lineage

Scope is the **policy + `we:scripts/check-memory.mjs`** surface only — no embeddings or graph store (those are separately judged not worth it at this scale). Un-prepared: run [/prepare](.claude/skills/prepare-decision-item) before ratifying. Surfaced 2026-06-27 in the second [#1855](/backlog/1855-model-usage-watch-keep-claude-s-use-of-the-agent-system-effi/) watch run (front B literature sweep, gaps #2 + #3). Report: [we:reports/2026-06-27-program-model-usage-watch.md](../reports/2026-06-27-program-model-usage-watch.md).
