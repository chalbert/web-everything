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
| Index pointer integrity | every leaf reachable from the map or a sub-index; the map links **only** `index-*` sub-indexes | no orphans; no flat-surface regrowth |

## The index is a tree (#1893) {#index-tree}

`MEMORY.md` is **not** a flat list — it is a three-tier tree (adopted #1893, amending #1868):

1. **Tier 1 — `MEMORY.md` (always-loaded):** a ~10-line **category map** (each line links one
   `index-<category>.md` sub-index) **+** a small **core-invariants block** (~12 load-bearing rules kept
   always-on as `- N. Title — hook` lines). This is the only auto-loaded surface.
2. **Tier 2 — `index-<category>.md` sub-indexes (recall-gated):** the cluster's one-liners as bare
   `- N. Title — hook`. The agent opens one when the map line's keywords match the task (the **router
   pattern** — an explicit read from an always-loaded pointer, *not* `description` auto-recall).
3. **Tier 3 — leaf files `N-slug.md` (the fact):** reached via `node scripts/memory-resolve.mjs <N>`
   (by number or slug; `--cat` prints the body). `name:` stays the slug, so `[[slug]]` links resolve.

**Add a rule:** create the next `N-slug.md`, add a `- N. Title — hook` line to its **sub-index** (never
to `MEMORY.md`). Promote to the core-invariants block only if it must be always-loaded.

**Why this is safe under #1868** (whose negative recall test covered only *fully-unindexed* files): every
sub-index is reachable from the always-loaded map, and the core-invariants block keeps rule-level
awareness for the highest-stakes rules. `check:memory` enforces the shape — the map may link only
`index-*` sub-indexes (a leaf link there is denied), and every leaf must be reachable.

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

2. **Bounded index, detail in files.** Each line is ≤ 200 chars. The map links a sub-index
   (`- **[Category](index-x.md)** — keywords (N rules)`); a core/sub-index line is `- N. Title — hook`
   (see [The index is a tree](#index-tree)). Never put memory content in `MEMORY.md`; the leaf file is the
   home for the fact, the why, and the `[[links]]`.

3. **One canonical memory per idea.** When a new fact extends an existing one, **update that file** —
   don't add a parallel memory. Consolidate clusters (several files orbiting one idea) into a single file
   with sub-points; a single source can't contradict itself (split sources drift — e.g. an index line that
   went stale while the nuance lived in another file). When a new fact **conflicts** with an existing
   memory, delete the stale one (don't let both stand). **Prune superseded / disproven memories on sight.**

4. **Merge-before-add at budget.** When the index is at budget, adding a memory **requires** merging or
   pruning one first. The write-time hook enforces this mechanically (a save that pushes the index over
   budget is denied).

## The core-invariants set

A handful of rules are load-bearing enough that re-deriving them wrong is costly, so they stay in the
always-loaded index even though they're project rules — each as a **pointer** into
`platform-decisions.md`, not a full restatement. Keep this set small (≈ ≤ 12). The "core" distinction is
only about *how much* a line carries (a fuller pointer vs a terse one): **every topic file still keeps an
index line.** *(Which rules are "core" is a judgment call, revisited when the set grows.)*

> **The index is the sole recall surface (verified #1868, 2026-06-27).** A fresh-session recall test
> confirmed the harness auto-loads only `MEMORY.md`'s one-line pointers — **topic-file bodies are never
> auto-recalled by `description`; an agent reads a body only because it first saw the pointer.** So an
> *unindexed* topic file is **unreachable**, not "lazily recalled." The `description` field aids the agent's
> *choice* of what to read once it sees the line — it is not a retrieval key. Consequence: you cannot evict a
> line to a recall-only pool without losing the fact (the eviction branch of #1868 is **closed**), and the
> gate's error on any unindexed topic file is correct. What *is* lazy is the **body** (loaded on read), not
> the **existence** (the pointer must always load). The only way to drop a line safely is **rule 1** — move
> the rule into `platform-decisions.md` + the `AGENTS.md` router, which the agent reaches on-demand via the
> router (an explicit-read path that works), not via memory recall.
>
> **Amended by #1893:** the negative test above covered only *fully-unindexed* files. The adopted index
> **tree** applies this same router pattern one level deeper — leaf one-liners live in recall-gated
> `index-<category>.md` sub-indexes that the always-loaded map links, so they stay reachable (explicit-read
> from the map) without bloating the always-loaded surface. Core invariants stay always-loaded. See
> [The index is a tree](#index-tree).

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
| Shrink the always-loaded surface — **right-home / prune only; eviction CLOSED** | **RATIFIED 2026-06-27, recall-tested 2026-06-27.** A fresh-session recall test read **NEGATIVE** — the harness auto-loads only the index; unindexed topic files are unreachable. So **evict-to-recall-only is closed** (would lose the fact), not merely deferred. The only safe reclaim is **rule 1** (right-home durable rules into `platform-decisions.md` + `AGENTS.md`, agent-read on-demand) + pruning genuinely-stale/redundant memories — a **modest** saving (most memories carry nuance beyond canon, per #1881). Gate tracks the documented ~24.4 KB limit (22 KB ceiling). **Amended by #1893:** the router-**tree** is the adopted reclaim beyond right-homing — sub-indexes reachable from the always-loaded map were the case this negative test didn't cover; index now ~3 KB. | [#1868](../../backlog/1868-reconcile-the-always-loaded-memory-index-with-the-harness-co.md) |
| **Write-time UPDATE/DELETE/NOOP** + a minimal `last-affirmed` stamp (over merge-only-at-budget) | **OPEN** — direction set, needs prep/ratify | [#1879](../../backlog/1879-sharpen-memory-write-time-discipline-update-delete-noop-plus.md) |
| **Close-out as a consolidation/reflection pass** (the scheduled-consolidation cadence, propose-not-auto) | **OPEN** — story filed | [#1878](../../backlog/1878-close-out-as-memory-instruction-self-improvement-loop.md) |

### Rigor-preservation invariant (binds any index shrink)

Shrinking the index must not regress how rigorously instructions are applied. The eviction branch is acceptable **only** if all hold: (1) the core-invariants set (≈ ≤ 12) stays always-loaded; (2) eviction is gated on a *passing* recall check — never drop an index line before proving the fact is still reachable; (3) `check:memory` + the write-time hook keep enforcing budget/pointer integrity; (4) durable rigor-bearing rules live in repo canon (rule 1), never in the evictable memory surface — so the shrink only ever evicts low-recall, non-load-bearing facts.

### Explicitly not adopted

Vector/embedding search, knowledge-graph memory, and bi-temporal validity (*Mem0*, *Zep/Graphiti*, *Cognee*) all require infrastructure this file-based, single-developer store lacks — and are the patterns least justified at this scale. The lightweight stand-in for temporal validity is a `superseded-by` note on a reversed memory, not a timestamped graph.
