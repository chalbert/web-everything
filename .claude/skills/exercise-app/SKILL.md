---
name: exercise-app
description: Drive one turn of the flagship exercise-app loop — the apps exist to advance Web Everything, not to be products. Use when the user wants to "work on the exercise app", "continue the loan/insurance/etc app", "drive the next gap", "run the app conformance loop", or progress one of the #314 flagship apps. Scans the app against the platform benchmark, picks the top WE gap, fills it IN WE (the app is secondary), then has the app consume it. Pass an app id (e.g. `loan-origination`) to target it; otherwise the most recently touched exercise app.
---

# Exercise-app loop — one turn

This skill is a **trigger and pointer** — the full objective, loop, gap protocol, and benchmark rubric live
in *[exercise-app-workflow.md](../../../docs/agent/exercise-app-workflow.md) → full doc*. Read it before
acting. North star: WE is the deliverable, the app is a forcing function — when app progress and platform
progress conflict, platform wins.

## Step 0 — first turn on an app: scaffold the epic (the #317 shape)

If the target app is still a child story of #314 (not yet `workItem: epic`), scaffold it first per
*exercise-app-workflow.md → Epic scaffolding* — this makes every app get built like the loan app (#317), the
reference. In short: promote to a storied `epic`, derive a requirements report, create the two child-card
tracks, link [#377](../../../backlog/377-conformance-loop-tooling.md) tooling, seed the WE-surfaces tracker,
and register the demo in `demos.json` with an `epic` field. Then run the loop below.

## Quick path — one loop turn is five steps

1. **Scan** — `npm run check:app-conformance -- --app=demos/<id> --json` → score + ranked WE work queue.
2. **Pick the top gap** — active-bypasses first (cheap pure debt), then the highest-leverage draft surface.
   State the WE deliverable for this turn explicitly (P3): it is primary; the app change is secondary.
3. **Fill it IN WE** — the actual deliverable:
   - Active-bypass → refactor the app onto the shipping block (for-each / on:* / stores / view / tabs / interpolation).
   - Draft contract → activate the block/intent the proper way: its `src/_data/*.json` entry + `.njk`
     description, runtime, conformance demo + tests (design-first; see
     [demo-workflow.md](../../../docs/agent/demo-workflow.md)).
   - Uncodified → `/new-standard` before any bespoke build.
   - Out of scope for this turn? Tag the scaffold `// PLATFORM-GAP: #NNN` against a filed backlog item — never silent.
4. **App consumes it** — make the app the surface's first real consumer; log friction as new gaps.
5. **Rescan + verify** — re-run `check:app-conformance`; the score must go up with no new untagged bypass.
   File this turn's surfaced gaps to the backlog (the WE queue). `/loop /exercise-app` self-paces.

## Hard rules

- Don't polish the app, broaden domain logic, or hand-roll UX to "finish a feature" — that spends effort on
  the secondary thing.
- A slice is not done on an app-only change. Done = a WE surface activated/codified (with its conformance
  demo + tests) or a tracked, tagged gap.
