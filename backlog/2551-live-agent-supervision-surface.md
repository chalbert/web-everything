---
bornAs: x2rfm5x
shortTitle: "Agent-supervision surface"
kind: epic
size: 8
parent: "2527"
status: open
tags: [plateau-loop, console, supervision, steer, forensics, epic]
dateOpened: "2026-07-18"
---

# Live agent-supervision surface — steer, output tail, post-mortem

"Steer" is in G1's verb list and the runner already supports it (§3f-B), but there is NO UI for it — and the
board's failure detectors ([#2555]/[#2552]) surface stalled/stopped/failed lanes whose recover/stop verbs are
offered blind, with no forensics. This epic is the live half of the L3 build inspector: watch, steer, and
diagnose a running or dead build. Serves G1 (steer + review at the point of work).

## Scope
- **Steer composer** — send guidance to a running agent (delivered at the next turn boundary, never dropped;
  queued/reorderable), on the existing steer seam.
- **Live output tail** — the agent's reasoning / tool-calls / validation stream, with the plan-todo checklist
  (✓/⟳/○) updating live.
- **Post-mortem / forensics** — for stalled/stopped/failed/orphaned lanes: the last state, the diff-so-far, why
  it stalled, so recover / retry / reassign / discard / take-over is an informed choice, not blind.
- **Take-over / release** — assume a build (hold the lane) and hand it back, from the review surface.

## Acceptance
An operator can steer a running build, watch its live output, and — for a stalled/failed lane — see a
post-mortem before choosing a recovery verb. Wires to the real runner + lane state ([#2552]).
