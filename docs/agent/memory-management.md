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
