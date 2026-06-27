---
kind: epic
ongoing: true
relatedReport: reports/2026-06-27-program-model-usage-watch.md
status: open
dateOpened: "2026-06-27"
tags: []
---

# Model-usage watch

Keeps Claude's use of the agent system efficient as the harness and our own workflows evolve. A standing program guarding how effectively Claude uses this repo's agent system across four surfaces — **subagent flow, context/memory, instructions, and skills**. Front A (conformance): are instructions/memories/skills coherent and earning their keep — stale or contradictory memories, unused skills, subagent returns that dump files instead of conclusions. Front B (currency): the Claude Code harness and models keep shipping new features (skills, hooks, workflow primitives, model tiers, context tooling) that make current usage stale; sweep releases and adopt. Currently L0 — metrics defined, not yet instrumented. Satisfies the four-part Program Test ([#1249](/backlog/1249-define-program-strictly-the-four-part-bar-for-a-perpetual-on/)).

## The two fronts

- **Front A — conformance (internal):** is our own agent setup coherent and earning its keep? Named metrics (definable now at L0):
  - **stale/contradictory memory count** — `memory/*.md` files referencing a file, flag, or skill that no longer exists, or that conflict with another memory. (`we:scripts/check-memory.mjs` is the natural host.)
  - **unused-skill count** — skills under `we:.claude/skills/` not invoked in the last *N* sessions (dead weight that still costs maintenance).
  - **subagent return hygiene** — sampled share of agent results that are *conclusions* vs raw file-dumps (the parent should keep the conclusion, not the file dump).
  - **instruction redundancy** — feedback memories that duplicate or have been superseded by a later one.
- **Front B — currency (external):** the harness moved and our usage is now stale. Discovery method (runnable by hand): each cycle, sweep the **Claude Code release notes / changelog** and the **claude-code-guide** lens for new primitives — skills, hooks, workflow/orchestration features, model tiers, context-management tools — and triage each: adopt & wire in · repoint an existing pattern · note as not-yet-worth-it. Models shipping new capability (cheaper tiers, larger context, better tool-use) is the same signal on the cost/routing axis (the Opus-orchestrates / Sonnet-executes routing).

## Maturity & status — L1 (skill-assisted)

Per the [Program Test](/backlog/1249-define-program-strictly-the-four-part-bar-for-a-perpetual-on/) all four parts hold. **Graduated L0→L1 on 2026-06-27** (first watch run, gained children). Front-A metrics now have a first real measurement; front B has a first manual sweep. Remaining L1→L2 work is scheduling the watch (the #367 pattern), not assumed. Original L0→L1 carve (now in flight as children):

1. **Instrument front A** — extend `we:scripts/check-memory.mjs` (or a sibling) to emit the stale/contradictory-memory and instruction-redundancy counts; add a skill-invocation tally from transcripts for the unused-skill metric.
2. **First front-A pass** — run the audit by hand once, file the concrete cleanups it surfaces (prune stale memories, de-dup instructions, retire unused skills) as batchable children.
3. **First front-B sweep** — review the Claude Code changelog since this card opened; file adopt/repoint items for primitives we're not yet using.
4. Wire cadence/trigger; graduate L1→L2 (scheduled) only after a manual track record.

## Cadence

- **Front A** — drift trigger: re-run on `/review-program 1855`, and whenever the memory-management policy's size thresholds are approached.
- **Front B** — external trigger: on a notable Claude Code release, else a monthly manual sweep.

## Why it's worth a program, not a one-off

"Improve model usage" has no Definition of Done — the harness, the models, and our own workflows all keep moving, so any audit is stale the moment it's filed. Tracking it as a standing program (refreshed via [/review-program](.claude/skills/review-program)) is how every other ongoing effort here is tracked (platform-standards watch #1257, gap-sweep #315, reference-liveness #192) — the backlog is the tracker, no new tooling required.

## Review log

- **2026-06-27 — opened (L0).** Program defined across the four surfaces; front-A metrics named, front-B discovery method named, cadence set.
- **2026-06-27 — first run (L0→L1).** Front A measured: memory index at the 22 KB ceiling, **5 orphaned memories** (gate red), 98 feedback + 44 project memories un-deduped. Front B swept via a `claude-code-guide` subagent — Workflow orchestrator / structured-output schemas / model-routing present but under-used; agent's version strings judged fabricated (a return-hygiene data point). Filed 4 children — #1863 reconcile orphans · #1864 memory prune/dedup · #1861 subagent return-hygiene contract · #1862 decision: Workflow vs serial batching. Report: `we:reports/2026-06-27-program-model-usage-watch.md`. **Next run:** re-measure memory metrics after #1863/#1864 (expect green); re-sweep Claude Code releases (idempotent); act on #1862's verdict re: structured-output adoption.
