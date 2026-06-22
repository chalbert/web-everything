---
kind: story
size: 8
status: resolved
dateOpened: "2026-06-22"
dateStarted: "2026-06-22"
dateResolved: "2026-06-22"
graduatedTo: "we:docs/agent/memory-management.md"
tags: [memory, agent-workflow, tooling, enforcement, docs]
---

# Memory-management strategy: bounded always-loaded index, right-homed project rules, enforced by a gate

## Resolution (2026-06-22)

**Strategy established, codified, and enforced; index brought under budget.** Shipped:
1. **Policy** — `we:docs/agent/memory-management.md` (two-tier model, budget table, the four rules,
   core-set, lifecycle). Cross-linkable from `we:AGENTS.md`.
2. **Enforcement** — `we:scripts/check-memory.mjs` (sweep: KB + per-line + pointer-integrity) +
   `npm run check:memory` + a **`PreToolUse(Edit|Write)` hook** on the memory index (the #883
   write-time-gate pattern). It self-demonstrated this session by denying over-budget writes.
3. **Under budget** — trimmed the index **37.7 KB → 20.6 KB** (115 lines, every line ≤ 200 chars, pointer
   integrity clean); added a `project_memory_management_policy` pointer-memory.

Budgets chosen: index **≤ 22 KB** (warn ≥ 20 KB), per line **≤ 200 chars** — headroom under the ~24.4 KB
harness truncation limit. The two remaining one-time *reductions* the policy calls for — **consolidate the
WE↔FUI cluster** and **promote project invariants to the `we:docs/agent/platform-decisions.md` doc** (to
create more headroom; we're at 20.6/22) — are carved to **#1519** (lossy/judgment-heavy, deliberately not
rushed). The standing merge-before-add / prune cadence is now enforced by the gate.

---

Establish, codify, and **enforce** a strategy that keeps the agent memory system from growing unbounded as
rules accumulate. Agreed in session 2026-06-22; this card is the plan of record.

## Problem

The memory system has two tiers with very different costs:
- The **always-loaded index** (the per-session index file under the global `~/.claude` memory directory) is
  injected into **every** session. It grows monotonically (one line per memory), and the harness **silently
  truncates it when it exceeds the size limit** — so a load-bearing rule can be dropped from context with no
  warning. (It is already over: the index is ~34&nbsp;KB against a ~24&nbsp;KB limit, and a startup warning
  confirms only part of it was loaded.)
- The **on-demand topic files** (one fact per file) are loaded only on recall, so the corpus itself is
  cheap to grow.

So the target is a **bounded index**, not a bounded corpus. A concrete failure this session: the WE↔FUI
boundary rule was split across files and the index carried a *stale, absolute* one-liner ("WE NEVER imports
FUI block code") missing the website≠standard nuance — the always-loaded summary misled the work.

## Strategy (the policy to codify)

1. **Right-home project invariants into repo canon, not personal memory.** Project-architecture rules
   (placement, boundaries, "WE holds zero standard implementation") belong in
   `we:docs/agent/platform-decisions.md` + the `we:AGENTS.md` router — version-controlled, reviewable,
   pulled in **on demand**, not dumped into every session. Personal memory holds **only** what is *not* in
   the repo: cross-project working preferences (the `feedback_*` set) and a small **core-invariants** set.
   This is the structural cap: most future "rules" are project rules → they land in the platform-decisions
   doc, so the memory index stops absorbing them.
2. **Bounded always-loaded index.** A hard budget (lines + KB). Each index line = **title + one short hook**
   (≤ ~150 chars); all detail lives in the topic file. Keep a small **core set** (the handful of
   invariants that must be in-context every session, each a pointer into the platform-decisions doc); push
   everything else to on-demand-only (not in the index, recalled by description match).
3. **One canonical memory per idea.** Consolidate clusters into a single file with sub-points; delete the
   duplicates (a single source can't contradict itself — the drift that bit us). Prune superseded memories
   on sight.
4. **Merge-before-add at budget.** When the index is at budget, adding a rule **requires** merging or
   pruning one first — a standing discipline, mirrored by the gate below.

## Deliverables

1. **`we:docs/agent/memory-management.md`** — the codified policy: the two-tier model, the index budget +
   per-line cap, the right-home rule (project → platform-decisions doc, personal → memory), the core-set
   definition, merge-before-add, and the prune/consolidate cadence. Cross-link from `we:AGENTS.md`.
2. **One-time cleanup to get under budget** — consolidate the WE↔FUI / zero-impl cluster (boundary, dogfood,
   zero-impl, generator-is-tool, vision-is-plateau, npm-scope) into one canonical memory; trim every index
   line to the cap; promote any project invariant still living only in memory into the platform-decisions
   doc and reduce its memory entry to a pointer (or drop it).
3. **Enforcement gate** — a check (e.g. `we:scripts/check-memory.mjs`, or folded into `check:standards`)
   plus a hook that **fails** when: the index exceeds the line/KB budget; any index line exceeds the char
   cap; an index pointer is orphaned (no matching file) or a file is missing its index line; a memory
   duplicates a platform-decisions rule verbatim. The gate must read the global memory directory under
   `~/.claude` (cross-project, **outside** the repo) — see open knobs.

## Open knobs (implementation tuning, not forks — settle when building)

- **Budget numbers** — index line count + KB ceiling; per-line char cap (~150 suggested).
- **Core-set membership** — which invariants are important enough to stay always-loaded vs on-demand.
- **Gate home** — a `webeverything` repo check/hook (consistent with how this repo enforces agent-workflow
  rules, e.g. the #883 locus-prefix hook) that reads the global memory directory, **vs** a global
  `~/.claude` hook independent of any repo. Memory is cross-project, so weigh whether enforcement should be
  too; a repo-local gate is simplest to land first.
