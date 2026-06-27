---
kind: story
size: 5
parent: "1855"
status: open
dateOpened: "2026-06-27"
tags: [memory, right-home, platform-decisions, context, model-usage-watch]
---

# Right-home durable memory rules into platform-decisions + the AGENTS router

The build pass that [#1868](/backlog/1868-reconcile-the-always-loaded-memory-index-with-the-harness-co/) (ratified 2026-06-27, right-home-first) opens: shrink the always-loaded per-session surface by **moving load-bearing project rules out of personal memory into version-controlled canon** — `we:docs/agent/platform-decisions.md` (the statute layer) + the `we:AGENTS.md` router — pulled in on-demand. This is memory rule 1 applied at scale; it is the *proven* shrink lever, with no dependency on the (still-unproven) description-recall mechanism.

## Why this and not eviction

[#1868](/backlog/1868-reconcile-the-always-loaded-memory-index-with-the-harness-co/) deferred evict-to-recall-only until the armed recall check reads positive. Right-homing delivers the same goal — a smaller always-loaded context — *safely*: a rule moved into `we:docs/agent/platform-decisions.md` leaves the always-injected memory index but stays reachable (versioned, router-linked, on-demand), so instruction-rigor is preserved (the [#1868](/backlog/1868-reconcile-the-always-loaded-memory-index-with-the-harness-co/) rigor invariant).

## Scope

- **Audit the corpus** — of the 42 `project_*` (and any `feedback_*` that are really project invariants) personal memories, identify those that are *this constellation's architecture/placement rules* — the rule-1 candidates.
- **Right-home each** — codify the rule in `we:docs/agent/platform-decisions.md` (or confirm it already is), then in `we:MEMORY.md`/the topic file leave **at most a one-line pointer** (or drop the index line entirely for non-core rules), recovering index headroom.
- **Keep the core-invariants set** (≈ ≤ 12) always-loaded as pointers — do not right-home those out of reach.
- **Re-measure** — `we:scripts/check-memory.mjs` should show recovered headroom under the 22 KB ceiling; capture the before/after as a watch front-A data point.

## Boundaries

- **No eviction-to-recall-only** — that branch stays deferred to the [#1868](/backlog/1868-reconcile-the-always-loaded-memory-index-with-the-harness-co/) recall read-out. This pass only *moves* rules to canon, never drops a fact to an unreachable pool.
- Propose the right-home set for review before bulk-editing memory (the corpus is cross-project; the human disposes).
- Lineage: opened by [#1868](/backlog/1868-reconcile-the-always-loaded-memory-index-with-the-harness-co/) under [#1855](/backlog/1855-model-usage-watch-keep-claude-s-use-of-the-agent-system-effi/). Strategy: [we:docs/agent/memory-management.md](../docs/agent/memory-management.md) → "Strategy & direction".
