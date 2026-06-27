---
kind: story
size: 5
parent: "1855"
status: resolved
dateOpened: "2026-06-27"
dateStarted: "2026-06-27"
dateResolved: "2026-06-27"
graduatedTo: scripts/memory-reflect.mjs (npm run reflect) + .claude/commands/close-session.md reflection step
tags: [memory, close-out, self-improvement, consolidation, model-usage-watch, cadence]
---

# Close-out as memory/instruction self-improvement loop

Extend the `closing-session` skill with a consolidation/reflection pass so every session-end becomes the standing cadence beat for the [#1855](/backlog/1855-model-usage-watch-keep-claude-s-use-of-the-agent-system-effi/) model-usage watch — turning close-out into a self-improvement loop instead of a pure safety audit.

## Why

The 2025–2026 agent-memory literature treats **consolidation/reflection as a distinct scheduled step** ("sleep-time" agents, offline consolidation — *Letta*; *Park et al., "Generative Agents"*; *Anthropic, "Effective context engineering"*), not something done opportunistically. The [#1855](/backlog/1855-model-usage-watch-keep-claude-s-use-of-the-agent-system-effi/) watch named this gap and still lacks an L1→L2 cadence trigger. Session close is the natural hook — it already audits durable capture and runs the health gate — so wiring the reflection pass here graduates the watch's cadence **without a cron** (the #367 scheduling pattern becomes unnecessary for this front).

## Scope

At close-out, after the existing capture audit + health gate, run a bounded reflection pass that **proposes, never auto-applies** (per the discovery-proposes/human-disposes rule and "hand back early in interactive loops"):

- **Learnings → memory:** surface this session's durable insights as candidate `feedback_*`/`project_*` memories (or a right-home into `we:docs/agent/platform-decisions.md` per memory rule 1).
- **Dedup/prune:** flag topic files that duplicate or are superseded by a later one, and stale/contradictory memories, for one-tap pruning (the front-A metrics of [#1855](/backlog/1855-model-usage-watch-keep-claude-s-use-of-the-agent-system-effi/)).
- **Instruction/skill drift:** note instructions that fired wrong or skills that went unused this session.
- **Output is a checklist**, presented to the human; nothing is written without an explicit go.

## Boundaries

- Reflection is **additive to** `we:.claude/skills/closing-session`, behind the existing audit — it must not block or slow a normal close when there's nothing to consolidate (zero-finding close stays one step).
- Propose-only: no memory write, prune, or instruction edit lands without confirmation. Auto-apply is explicitly out of scope (rigor + the human-disposes rule).
- Enforcement stays with `we:scripts/check-memory.mjs` + the write-time hook; this skill *surfaces* candidates, it does not replace the gate.

## Blocked on a placement fork (surfaced 2026-06-27, mid-batch)

The card assumed a repo-local `we:.claude/skills/closing-session`, but the **closing-session skill is global** (it lives under the user's home `~/.claude/skills/`, not the repo); the repo only holds the command alias `we:.claude/commands/close-session.md`. So where the reflection pass lives is a real fork an agent shouldn't pick unattended (it changes blast radius + committability):

- **(a) Edit the global skill** — one place, applies the reflection loop to *every* project's close. But it's outside this repo (not version-controlled here, not committable in a WE batch) and changes close behaviour everywhere, so it needs explicit human sign-off.
- **(b) Repo-local close mechanism** — a WE-scoped close step (extend `we:.claude/commands/close-session.md`, or a repo skill/script the close invokes) that runs the memory/instruction reflection only for this repo. Committable here; no cross-project blast radius; but doesn't generalise to other projects.

Recommendation: **(b) for the WE-specific memory-consolidation reflection** (it reads this repo's `check:memory --json` + memory dir), with the *generic* "propose learnings" idea promoted to the global skill only on a deliberate, separately-approved pass.

**Resolved 2026-06-27 → (b) repo-local** (human-ratified). No global skill change.

## Delivered (2026-06-27)

- **`we:scripts/memory-reflect.mjs`** (`npm run reflect`) — a propose-only close-out consolidation pass: prints index headroom + corpus skew, lists **orphans**, surfaces **near-duplicate** topic-file candidates (description-token Jaccard ≥ 0.5, a rule-3 consolidation signal), flags index pressure, and prompts the session-learnings capture. **Writes nothing** — advisory, always exits 0.
- **`we:.claude/commands/close-session.md`** — added the repo-local reflection step after the existing safety audit: run `npm run reflect`, act on its checklist, propose-don't-apply, skip silently on a zero-finding close. Repo-local only — the global `closing-session` skill is untouched (option a rejected).
- Reuses the #1880 metrics surface; this is the L1→L2 **cadence trigger** the watch lacked (close-out, no cron).

## Lineage

Surfaced 2026-06-27 in the second [#1855](/backlog/1855-model-usage-watch-keep-claude-s-use-of-the-agent-system-effi/) watch run (front B literature sweep, gap #3 — scheduled consolidation) and proposed by the human as "use the close skill as a self-improvement loop". Report: [we:reports/2026-06-27-program-model-usage-watch.md](../reports/2026-06-27-program-model-usage-watch.md).
