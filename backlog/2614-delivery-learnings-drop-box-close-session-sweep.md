---
bornAs: xzabmtp
kind: story
size: 3
parent: "2612"
status: open
dateOpened: "2026-07-22"
tags: [conveyor, agent-memory, learnings]
---

# Delivery learnings drop-box + close-session sweep

A per-session append-only JSONL drop-box where every conveyor delivery agent (#2608) writes a structured learnings entry — friction hit, missing convention, doc/skill gap, improvement candidate — and which the /closing-session skill sweeps at session close. Capture is distributed (every agent, cheaply, in the moment); curation is centralized (one vetted close-out pass), because subagents cannot run a session close themselves — N micro-closes would land N unvetted duplicates.

## Schema — TENANT-READY from day one

The entry schema carries **generalized-lesson fields only**: no raw code, no diffs, no secrets, no absolute or repo-identifying paths. This is deliberate seam-shaping — the same schema later feeds the product feedback channel (#2610) when the console goes multi-tenant, where minimal-by-construction is a hard privacy requirement: if the schema has no field for it, it can't leak.

## The close-session sweep

At close, the /closing-session skill sweeps the drop-box:

1. **Scripted dedup clustering** (by file/topic) — deterministic, per [we:docs/agent/platform-decisions.md#deterministic-core-thin-judgment](docs/agent/platform-decisions.md#deterministic-core-thin-judgment);
2. the existing **red-team gate** over the deduped candidates;
3. survivors ride the normal memory-improvement lane → PR.

## Rationale

Distributed capture, centralized curation: the drop-box costs a delivery agent one JSONL append, and the session close already owns the vetting machinery (red-team + lane PR). Nothing is lost between agents, and nothing unvetted reaches agent memory.
