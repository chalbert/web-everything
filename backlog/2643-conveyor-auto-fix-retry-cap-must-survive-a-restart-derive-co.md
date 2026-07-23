---
bornAs: x0gf9jy
kind: story
size: 3
parent: "2612"
status: open
scope: ["we:skills-src/conveyor/", "we:scripts/conveyor/"]
dateOpened: "2026-07-23"
tags: []
---

# Conveyor auto-fix retry cap must survive a restart (derive count from the PR, not in-session)

Surfaced by the jury review of #2630 (PR #702, standards-conformance lens). The conveyor's auto-fix retry cap (3 attempts before a stuck PR is handed to a human) is counted in a session-side `fixAttempts[pr]` map (`we:skills-src/conveyor/SKILL.md` §3c). But §5 (same change) states the only allowed in-session state is "which background jobs are live," and #2612's invariant is *state rides labels/PR only*. So a conveyor restart (or a fresh conveyor) after a PR has burned its 3 attempts starts from an empty map — the next `review:changes` bounce auto-fixes again from zero and **the cap never binds**, the exact unbounded fix↔bounce loop the cap exists to prevent. Fix: derive the attempt count from the PR's own durable re-arm comments (each auto-fix already posts one), not from in-session memory, so the cap survives a restart and no parallel state store is kept.
