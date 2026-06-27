---
kind: story
size: 5
parent: "1855"
status: resolved
dateOpened: "2026-06-27"
dateStarted: "2026-06-27"
dateResolved: "2026-06-27"
graduatedTo: "audit: no bulk pass (memories carry nuance); 1 worked right-home (specimen → #099 + repo, orphan deleted); ongoing trickle via #1878 reflect cadence"
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

## Audit finding (2026-06-27) — the bulk "already-in-canon → delete" premise is refuted

Member-by-member verification of a 6-memory sample of Bucket A (`theme_tokens_js_first`, `polyglot_reach_forward_adapters`, `design_system_assembler_plateau_owned`, `monetization_strategy`, `intents_open_design`, `plug_is_proposed_missing_standard`) showed **all six carry nuance the codified statute does not**: the *statute* is already in `we:docs/agent/platform-decisions.md` (several memories even cite the anchor, e.g. `#tokens-js-first`), but the memory adds the rationale, the rejected alternatives, build-program pointers (#505/#506/#507), and "still-open" residuals. **Deleting them would lose information, not remove redundancy** — so the mass right-home-by-deletion is unsafe.

Corrected picture:
- **The statutes are already right-homed.** #1881's core goal (durable rules live in canon) is largely *already true* — what remains in personal memory is the residual working nuance, which is legitimately on-demand topic-file material.
- **The index *line* is the always-loaded cost, not the file.** Dropping a line while keeping the file = an **orphan** — and orphan-to-recall-only is the **eviction branch [#1868](/backlog/1868-reconcile-the-always-loaded-memory-index-with-the-harness-co/) deferred** until the recall check reads positive. So the big index reclaim is gated, not available now.
- **Safe reclaim now is small** and per-memory: only memories whose residual nuance is *itself* stale/superseded (rule-3 prune-on-sight) or *fully* duplicated in canon are clean deletes — none of the sampled 6 qualified.

Action: **no deletions taken.** Recommend re-scoping #1881 from "bulk right-home" to "(1) per-memory prune of genuinely-stale memories (rule 3), and (2) revisit index reclaim once #1868's recall check resolves the eviction branch." Pending the human's call.

### Re-scoped 2026-06-27 — eviction is closed (recall read NEGATIVE)

[#1868](/backlog/1868-reconcile-the-always-loaded-memory-index-with-the-harness-co/)'s recall check read **NEGATIVE** (fresh session recalled only the index; unindexed files unreachable). So this card's scope is now **right-home + prune only — no eviction-to-orphan**:

1. **Right-home** a memory only when its *full* content (not just the topic keyword) is in `we:docs/agent/platform-decisions.md` **and** the `we:AGENTS.md` router points to it — then delete the memory (line + file) since it's reachable on-demand via the router. The audit showed this set is **small** (most memories carry nuance the statute doesn't).
2. **Prune** genuinely stale/superseded memories (rule 3) — surfaced each close-out by `npm run reflect` (#1878).

Expected reclaim is **modest** (a few hundred bytes to ~1–2 KB), not a structural shrink — the test proved the big lever doesn't exist. Lower-priority, incremental; no bulk pass.

## Resolved 2026-06-27

Investigation complete; conclusion is **no bulk right-home pass exists** (the audit refuted it — memories carry nuance beyond canon). One concrete right-home was done as the worked example: the `reference_front_end_platform_book` memory (the #1868 recall specimen) — its content was confirmed fully present in `we:reports/2026-06-06-front-end-platform-book.md` + #099, the unique un-itemized-ideas breadcrumb was preserved into #099, then the orphan memory was deleted (clearing the `check:memory` gate-red). **Ongoing incremental right-home/prune now flows through the close-out reflection cadence ([#1878](/backlog/1878-close-out-as-memory-instruction-self-improvement-loop/), `npm run reflect`)** — there is no standalone bulk task left, so this card closes rather than lingering as perpetual low-priority work.

## Boundaries

- **No eviction-to-recall-only** — that branch stays deferred to the [#1868](/backlog/1868-reconcile-the-always-loaded-memory-index-with-the-harness-co/) recall read-out. This pass only *moves* rules to canon, never drops a fact to an unreachable pool.
- Propose the right-home set for review before bulk-editing memory (the corpus is cross-project; the human disposes).
- Lineage: opened by [#1868](/backlog/1868-reconcile-the-always-loaded-memory-index-with-the-harness-co/) under [#1855](/backlog/1855-model-usage-watch-keep-claude-s-use-of-the-agent-system-effi/). Strategy: [we:docs/agent/memory-management.md](../docs/agent/memory-management.md) → "Strategy & direction".
