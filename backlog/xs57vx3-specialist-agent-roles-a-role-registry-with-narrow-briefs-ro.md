---
kind: story
size: 3
parent: "4305"
status: open
scope: ["we:skills-src/conveyor/dispatched-agent-system-prompt.md", "we:scripts/operations/deliver-item-wrapper.mjs", "we:scripts/verify-lane.mjs", "we:skills-src/conveyor/build-dispatch-daemon.mjs", "we:scripts/operations/dispatch-lane.mjs", "we:scripts/lib/daemon-jobs.mjs"]
dateOpened: "2026-09-28"
tags: []
---

# Specialist agent roles: a role registry with narrow briefs, routed by complexity — first role: test & soak-break author

Operator direction (2026-09-28 ~3:50 PM ET). Parent #4305 (configurable, combinable delivery and testing strategies) needs a strategy registry; this slices out its role-side counterpart.

### Roles as data
Model a role registry — brief path, model tier by complexity, provider eligibility under the probation gate — alongside #4305's strategy registry. Candidate roles, with today's own evidence: **test & soak-break author** (every daemon fix landed today skipped its soak break and took a waiver); **gate-red test fixer** (#4309's build went gate-red on subprocess-test timeouts); **proof collector** (runs the card's acceptance command before/after and writes the PR evidence); **mechanical-edit role** (model pins, renames — Haiku / Codex / agy-Gemini); **PR-body & statute-wording role**.

### How they are called (operator question, answered)
Mechanically, never as in-session subagents — an in-session subagent inherits the parent's session id and leaves no durable record, so nobody outside the session can see it ran. Instead: the builder (or its wrapper, we:scripts/operations/deliver-item-wrapper.mjs) writes a durable REQUEST marker for a role on its own lane, the same pattern we:scripts/verify-lane.mjs's `request` verb already uses toward the verify daemon. A dispatcher — a NEW launch kind inside the build daemon's tick/dispatch-lane (we:skills-src/conveyor/build-dispatch-daemon.mjs, we:scripts/operations/dispatch-lane.mjs) — starts the specialist as its OWN session with its own brief and model, hands the lane over, and hands it back when done.

### Observability
Every role run is a job record on the job-model core that just landed (#4125, we:scripts/lib/daemon-jobs.mjs): role, item, model, provider, start/end, outcome, tokens. Feed it to the run rating (#4304) and to Plateau /wip (we:backlog/4340-wip-shows-the-daemons-and-what-they-are-really-doing.md, the daemons panel / "running now") so the operator sees each specialist live.

### Phasing
Phase 1 (this card): instructions only — a brief file for the role, plus the builder brief (we:skills-src/conveyor/dispatched-agent-system-prompt.md) telling the builder WHEN to request this role. Phase 2: mechanical dispatch + job records (the REQUEST-marker + dispatch-lane launch kind above). Phase 3: routing by complexity and provider trials.

Start with the **test & soak-break author** role.

## Done when

1. **Executable** — TODO: a command that fails before this item lands and passes after.
