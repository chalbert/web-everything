---
bornAs: x2rfm5x
shortTitle: "Agent-supervision surface"
kind: epic
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

## Slices
Sliced 2026-07-28 into three independently-deliverable stories (the four scope items above fold into three
surfaces; take-over/release rides the post-hoc review surface). No hard foundation edge — each is a
separate route on the `backlog-api` plugin plus a module under `plateau:src/backlog-view/`, so they
serialize on that shared file rather than on a work dependency.

1. **Steer composer** — the running-agent steer UI + `POST /build/steer` endpoint (runner `steer()` already
   exists; UI + route are the work).
2. **Live output tail** — expose `runner.observe()` over SSE and render the reasoning/tool/validation stream
   with the plan-todo checklist live.
3. **Post-hoc review (forensics + take-over)** — the post-mortem detail surface for stalled/failed/orphaned
   lanes (last state, diff-so-far, why-it-stalled) plus assume/hand-back a build, holding the lane.
