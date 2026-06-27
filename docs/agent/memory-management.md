# Memory-Management Policy

> Tier-1 reference. The operating rules for the agent's persistent file memory
> (`~/.claude/projects/<project>/memory/`). Ratified in backlog #1517. Enforced by
> `npm run check:memory` + a write-time hook (see *Enforcement*).

## Why this exists

Agent memory has **two tiers with very different costs**:

- **`MEMORY.md` — the always-loaded index.** Injected into **every** session (one line per memory). It
  grows monotonically, and the harness **silently truncates it when it exceeds the size limit** — so a
  load-bearing rule can drop out of context with no warning. **This file is the scarce resource.**
- **The topic files** (`<name>.md`, one fact each) — loaded only on recall. The corpus is **cheap to
  grow**; detail belongs here, not in the index.

So the goal is a **bounded index**, not a bounded corpus.

## The budget (enforced)

| Limit | Value | Rationale |
|---|---|---|
| Index size (`MEMORY.md`) | **≤ 22 KB** (warn ≥ 20 KB) | headroom under the ~24.4 KB harness truncation limit |
| Per index line | **≤ 200 chars** | title + one short hook; detail lives in the topic file |
| Index pointer integrity | every line links to an existing file; every topic file has one index line | no orphans / no unindexed files |

## The four rules

1. **Right-home project invariants into repo canon — not personal memory.** A rule about *this
   constellation's architecture* (placement, the WE↔FUI boundary, "WE holds zero standard
   implementation") belongs in **`docs/agent/platform-decisions.md`** + the **`AGENTS.md`** router —
   version-controlled, reviewable, and pulled in **on demand**, not dumped into every session. Personal
   memory holds **only** what is *not* in the repo: cross-project working preferences (`feedback_*`) and a
   small **core-invariants** set. This is the structural cap — most new "rules" are project rules, so they
   land in `platform-decisions.md` and the index stops absorbing them. *Before saving a `project_*`
   memory, ask: does this belong in `platform-decisions.md` instead?* If yes, codify it there and (at
   most) leave a one-line memory pointer.

2. **Bounded index, detail in files.** Each index line is `- [Title](file.md) — <≤1-line hook>`, ≤ 200
   chars. Never put memory content in `MEMORY.md`; the file is the home for the fact, the why, and the
   `[[links]]`.

3. **One canonical memory per idea.** When a new fact extends an existing one, **update that file** —
   don't add a parallel memory. Consolidate clusters (several files orbiting one idea) into a single file
   with sub-points; a single source can't contradict itself (split sources drift — e.g. an index line that
   went stale while the nuance lived in another file). **Prune superseded / disproven memories on sight.**

4. **Merge-before-add at budget.** When the index is at budget, adding a memory **requires** merging or
   pruning one first. The write-time hook enforces this mechanically (a save that pushes the index over
   budget is denied).

## The core-invariants set

A handful of rules are load-bearing enough that re-deriving them wrong is costly, so they stay in the
always-loaded index even though they're project rules — each as a **pointer** into
`platform-decisions.md`, not a full restatement. Keep this set small (≈ ≤ 12). Everything else is
on-demand-only: it lives as a topic file recalled by description match, and need not have an index line at
all once the index is at budget. *(Which rules are "core" is a judgment call, revisited when the set
grows.)*

## Lifecycle

- **Add:** check for an existing file that covers it → update rather than duplicate. If it's a project
  invariant, prefer `platform-decisions.md` (rule 1). Otherwise write the topic file + one index line
  (≤ 200 chars). If at budget, merge/prune first (rule 4).
- **Update:** edit the topic file; keep the index line truthful and short. A reframe is **subtractive** —
  fix or delete the old framing everywhere (the index line included), don't append a contradiction.
- **Prune:** delete superseded/disproven memories (and their index line). Memories are point-in-time;
  stale ones mislead.

## Enforcement

- **`npm run check:memory`** — sweeps the index against the budget table (size, per-line length, pointer
  integrity) and exits non-zero on a violation. Folded into the close-out check set.
- **Write-time hook** — a `PreToolUse(Edit|Write)` hook on `MEMORY.md` denies a save that would breach the
  budget (the [#883](../../backlog/) write-time-gate pattern: catch it before it lands, not after). First
  cut is repo-local (this repo's `.claude/settings.json`); promoting the hook to the global
  `~/.claude/settings.json` for cross-project enforcement is a tracked follow-up (memory is cross-project,
  but a repo-local gate is the simplest to land first).

## Strategy & direction (the target architecture)

This section records the **memory-optimization strategy** the model-usage watch ([backlog #1855](../../backlog/1855-model-usage-watch-keep-claude-s-use-of-the-agent-system-effi.md)) is steering toward, grounded in a 2025–2026 agent-memory literature sweep (run 2 of that watch). It is the permanent home for the strategy; the open calls below are tracked as decision cards and **codify back here on resolve** — until then they are direction, not ratified policy.

### The principle: just-in-time, lightweight identifiers

The field has converged on **just-in-time retrieval**: keep the always-loaded surface to a minimal set of high-signal *pointers*, and load the detail on demand (*Anthropic, "Effective context engineering for AI agents"*; Claude memory-tool docs). Our two-tier model already is this shape — `MEMORY.md` is the index of pointers, topic files hold the detail. The strategy is to push the always-loaded surface **smaller**, toward a core-invariants set plus on-demand recall, because the full ~22 KB index is a per-session context cost.

### What the literature validates (keep)

- **Index of pointers + detail in files** = the mainstream pattern; our design is aligned.
- **Right-home durable/procedural rules into version-controlled canon** (rule 1 → `platform-decisions.md` + `AGENTS.md`), *not* the volatile memory store — the single strongest distinction in the literature. This is also what preserves **instruction-rigor** independent of how small the index gets: load-bearing rules never live in the evictable memory surface.
- **One canonical memory, prune on sight** (rule 3) = the field's update-not-append / dedup discipline.

### Levers (status-tracked)

| Lever | Status | Card |
|---|---|---|
| Shrink the always-loaded index toward a **core-invariants set + recall** | **OPEN** — gated on the empirical recall check (does the harness surface an *unindexed* topic file by its `description`?). External evidence conflicts: the *documented* Claude memory tool does no auto-search, but this repo's harness injects description-matched recalled memories. Resolve before any eviction. | [#1868](../../backlog/1868-reconcile-the-always-loaded-memory-index-with-the-harness-co.md) |
| **Write-time UPDATE/DELETE/NOOP** + a minimal `last-affirmed` stamp (over merge-only-at-budget) | **OPEN** — direction set, needs prep/ratify | [#1879](../../backlog/1879-sharpen-memory-write-time-discipline-update-delete-noop-plus.md) |
| **Close-out as a consolidation/reflection pass** (the scheduled-consolidation cadence, propose-not-auto) | **OPEN** — story filed | [#1878](../../backlog/1878-close-out-as-memory-instruction-self-improvement-loop.md) |

### Rigor-preservation invariant (binds any index shrink)

Shrinking the index must not regress how rigorously instructions are applied. The eviction branch is acceptable **only** if all hold: (1) the core-invariants set (≈ ≤ 12) stays always-loaded; (2) eviction is gated on a *passing* recall check — never drop an index line before proving the fact is still reachable; (3) `check:memory` + the write-time hook keep enforcing budget/pointer integrity; (4) durable rigor-bearing rules live in repo canon (rule 1), never in the evictable memory surface — so the shrink only ever evicts low-recall, non-load-bearing facts.

### Explicitly not adopted

Vector/embedding search, knowledge-graph memory, and bi-temporal validity (*Mem0*, *Zep/Graphiti*, *Cognee*) all require infrastructure this file-based, single-developer store lacks — and are the patterns least justified at this scale. The lightweight stand-in for temporal validity is a `superseded-by` note on a reversed memory, not a timestamped graph.
