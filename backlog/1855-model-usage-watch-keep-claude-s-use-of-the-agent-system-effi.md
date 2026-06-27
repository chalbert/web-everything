---
kind: epic
ongoing: true
size: 5
status: open
dateOpened: "2026-06-27"
tags: []
---

# Model-usage watch — keep Claude's use of the agent system efficient as harness + workflows evolve

A standing program guarding how effectively Claude uses this repo's agent system across four surfaces — **subagent flow, context/memory, instructions, and skills**. Front A (conformance): are instructions/memories/skills coherent and earning their keep — stale or contradictory memories, unused skills, subagent returns that dump files instead of conclusions. Front B (currency): the Claude Code harness and models keep shipping new features (skills, hooks, workflow primitives, model tiers, context tooling) that make current usage stale; sweep releases and adopt. Currently L0 — metrics defined, not yet instrumented. Satisfies the four-part Program Test ([#1249](/backlog/1249-define-program-strictly-the-four-part-bar-for-a-perpetual-on/)).

## The two fronts

- **Front A — conformance (internal):** is our own agent setup coherent and earning its keep? Named metrics (definable now at L0):
  - **stale/contradictory memory count** — `memory/*.md` files referencing a file, flag, or skill that no longer exists, or that conflict with another memory. (`we:scripts/check-memory.mjs` is the natural host.)
  - **unused-skill count** — skills under `we:.claude/skills/` not invoked in the last *N* sessions (dead weight that still costs maintenance).
  - **subagent return hygiene** — sampled share of agent results that are *conclusions* vs raw file-dumps (the parent should keep the conclusion, not the file dump).
  - **instruction redundancy** — feedback memories that duplicate or have been superseded by a later one.
- **Front B — currency (external):** the harness moved and our usage is now stale. Discovery method (runnable by hand): each cycle, sweep the **Claude Code release notes / changelog** and the **claude-code-guide** lens for new primitives — skills, hooks, workflow/orchestration features, model tiers, context-management tools — and triage each: adopt & wire in · repoint an existing pattern · note as not-yet-worth-it. Models shipping new capability (cheaper tiers, larger context, better tool-use) is the same signal on the cost/routing axis (the Opus-orchestrates / Sonnet-executes routing).

## Maturity & status — currently L0

Per the [Program Test](/backlog/1249-define-program-strictly-the-four-part-bar-for-a-perpetual-on/) all four parts hold, at **L0 / aspirational**: the goal, both fronts, and the front-A metrics are *defined* but not yet *instrumented*. L0→L1 carve (near-term slices to file as children):

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

- **2026-06-27 — opened (L0).** Program defined across the four surfaces; front-A metrics named, front-B discovery method named, cadence set. No sweep run yet — first run is the L0→L1 carve above. **Next run:** instrument front A (#1 above), then first manual pass on each front.
