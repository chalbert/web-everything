---
type: idea
workItem: story
size: 5
status: active
parent: "314"
dateOpened: "2026-06-12"
dateStarted: "2026-06-12"
tags: [exercise-app, conformance, tooling, benchmark, conformity]
crossRef: { url: /backlog/317-exercise-app-loan-origination/, label: "First consumer: loan app (#317)" }
---

# Exercise-app conformance & loop tooling

The tooling that runs the flagship exercise-app program ([#314](/backlog/314-flagship-exercise-apps/)) —
the **conformity layer** the apps are measured against. Built and in use (status `active`: refined as the
apps surface needs, per the program's "improve the tools as needed" mandate).

Delivered:
- **`scripts/check-app-conformance.mjs`** (`npm run check:app-conformance`) — the strict, two-layer
  benchmark. **Layer 1 conformance** (per standard the app touches: conformant / reimplemented / gap /
  claimed-unused, keyed to the registry — an intent is conformable when an active block implements it).
  **Layer 2 missing-standard discovery** (concepts with no standard → candidate standards). Manifest-driven
  for our apps (`demos/<id>/conformance.json`); designed for manifest-less inference against real apps.
- **`/exercise-app` skill** + **`docs/agent/exercise-app-workflow.md`** — the platform-first loop
  (scan → fill top gap in WE → app consumes → rescan) and the conformance-vs-compliance definition.
- **`src/_data/demoBlockers.js`** — the per-demo blockers view on the demo detail pages.

## Relationships & open work

- Feeds **Web Reporting** ([#350]) — the benchmark output is a report source; a burndown view belongs there.
- Seeds **Web Compliance** ([#351]) — `--strict` is the conformance→compliance gate.
- Remaining refinements: stronger Layer-2 inference, real-app (manifest-less) mode, burndown tracking.
