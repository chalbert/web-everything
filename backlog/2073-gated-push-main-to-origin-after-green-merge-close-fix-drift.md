---
kind: story
size: 3
status: active
blockedBy: []
dateOpened: "2026-07-01"
dateStarted: "2026-07-02"
tags: [git, workflow, orchestrator, closeout, push, constellation]
---

# Gated `pushIfGreen` — publish `main` to origin after a green merge/close (stop origin/main drifting)

Nothing in the batch/lane/close flow ever pushes `main`, so `origin/main` silently drifts — observed **185 commits behind** local `main` after `batch-2026-07-01-1965-2052`. The parallel orchestrator round-trips local `main` through the remote as throwaway `lane/_base` + `lane/*` refs (which it deletes), and lands merges on the **local** primary checkout only; the serial `/batch` and close paths commit locally and deliberately never push (a leftover of the pre-2026-06-29 never-push stance, now lifted). Result: GitHub looks frozen, no off-machine backup, no CI trigger, and a new machine/clone can't see any of it.

**Fix — one shared `pushIfGreen(repo)` helper, called from both the workflow integrator and the serial/close commit path.** Rules:
- **Green-gate precondition** — push a repo's `main` only when that repo's gate is green (`we:npm run check:standards` for WE/frontierui, `build` for plateau-app). Never publish a red state (e.g. the current duplicate-`#2068` gate).
- **Fast-forward only**, never `--force`. One local `main` serializes all merges (the integrator is a mutex), so pushes are ff appends.
- **Per-repo across the constellation** (#96): WE + frontierui + plateau-app each push their own `main` after their own gated merge.

**Cadence (recommended default): push once at close if green**, not per-merge — the close skill (`we:.claude/skills/closing-session`) already commits session work and is the natural green checkpoint; per-merge is chattier and can briefly publish a mid-batch state. Make cadence a config knob if per-merge liveness is later wanted.

**Explicitly out of scope — do NOT route all edits through lanes.** The lane machinery (clone → push `lane/_base` → reset → work → push `lane/*` → merge) exists solely to isolate **concurrent disjoint** work; a serial or interactive edit has no concurrency to isolate, so lanes would add two network round-trips + clone provisioning for zero correctness gain. Generalize the **push**, not the **lane** — lanes stay parallel-only.

## Boundaries
- Push is gated on green + ff-only; a red gate leaves `origin` untouched and is reported (the drift is recoverable — a later green close pushes it).
- Respects the standing guards: pushing `main` is allowed (never-push lifted 2026-06-29, see the never-push-guard-removed memory note); branch-create / broad-stage guards stay.
- Surfaced by the first multi-lane run (memory note: parallel-orchestrator-first-real-multilane-run); sibling to the carried-item reopen fix #2072.
