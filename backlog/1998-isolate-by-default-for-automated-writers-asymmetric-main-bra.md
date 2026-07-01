---
kind: story
size: 3
status: resolved
dateOpened: "2026-07-01"
dateStarted: "2026-07-01"
dateResolved: "2026-07-01"
graduatedTo: none
tags: []
---

# Isolate-by-default for automated writers + asymmetric main branch posture (human-writable, AI-observe-only)

Implements #1996 Forks 1+4. Automated writing sessions (agents / /workflow) always work in a clone and converge via lane/* + the integrator's auto-merge — main is convergence-only for automation; the human keeps direct commit/push to main as the single trusted writer. Near-term enforcement is convention + the existing commit/closeout guards (Rung 1); document the posture in we:AGENTS.md / we:docs/agent, and spec the later server-side bot-principal branch rule (agents push as a distinct GitHub principal under require-PR, human exempt). Full observe-only main stays a future flip.
