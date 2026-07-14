---
bornAs: xmsi6p9
kind: task
parent: "2445"
status: resolved
blockedBy: ["2448"]
dateOpened: "2026-07-13"
dateStarted: "2026-07-14"
dateResolved: "2026-07-14"
tags: []
---

# Re-anchor BLAST_RADIUS escalation when the delivery engine leaves WE

Sibling to #2448. #2448 re-anchored the gate-self (human) trust chain to travel on extraction via basename matching, but the agent-reviewable BLAST_RADIUS set in we:scripts/lib/review-escalation.mjs is still WE-path literals (scripts/ prefix, agent-skills dir, etc). When the engine's non-gate-self-but-blast-radius files (we:scripts/pr-land.mjs, we:scripts/lane-pool.mjs, the drain skill) relocate to plateau-app or a package, they stop tripping blast-radius, so an escalation-worthy change no longer forces even an agent review. Lower-stakes than the human gate (#2448) but owed for the same reason: make the blast-radius surface travel with the extraction.

**Delivered by** WE PR #498.
