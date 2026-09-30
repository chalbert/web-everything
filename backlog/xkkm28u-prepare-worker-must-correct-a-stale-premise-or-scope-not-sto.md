---
kind: story
size: 2
status: open
scope: ["we:skills-src/conveyor/prepare-item-worker-brief.md", "we:skills-src/conveyor/prepare-item-agent-brief.md"]
dateOpened: "2026-09-30"
tags: []
---

# Prepare worker must correct a stale premise or scope, not stop

Live 2026-09-30: three of three Codex prepare runs (#4397, #4383, #4398) stopped with could-not-prepare because the card's premise or scope was stale (code moved: e.g. the catch now lives in laneLivenessGate at we:scripts/lib/lane-salvage.mjs:371). Root cause: we:skills-src/conveyor/prepare-item-worker-brief.md:10 says "If scope needs correction ... report could-not-prepare and stop", which contradicts what prepare is for (check the premise against main and correct the scope). Every stale card therefore bounces and never gets prepared. Fix: the brief tells the worker to correct factual drift in the card itself (moved code, stale file:line, missing test paths, narrower/wider scope) and record what changed; stop with could-not-prepare only for a genuine judgment call / design fork, or when the goal is already delivered (then report already-done with the commit). Mirror in we:skills-src/conveyor/prepare-item-agent-brief.md. Proof: re-run prepare on #4397/#4383/#4398 and show stamped cards with corrected scope.

## Done when

1. **Executable** — TODO: a command that fails before this item lands and passes after.
