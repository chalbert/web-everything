---
type: idea
workItem: epic
status: resolved
dateOpened: "2026-06-12"
dateResolved: "2026-06-16"
graduatedTo: none
tags: [project, webreporting, reporting, adapters, conformance, normalization]
crossRef: { url: /backlog/314-flagship-exercise-apps/, label: "Exercise-app conformance tooling (#314)" }
---

# Web Reporting — a unified report substrate + format adapters

A candidate WE **project** (`webreporting`) for unified reporting: one **normalized report model** plus
reusable **renderers** (finding lists, coverage matrices, tables, burndown/trend charts, score cards) so
reports from *different sources* render through the **same UI**, and **adapters** that ingest (and emit)
**common report formats**. The point is reuse: the same report view serves many producers, and an adapter —
not a bespoke viewer — bridges each external format.

## Why now

We are generating a fast-growing set of reports that today each roll their own output: `check:standards`,
`check:app-conformance` (its conformance **and** missing-standard-discovery layers), `check:readiness`,
the conformance burndown, and the capability-manifest report. Plus, the exercise-app tooling is meant to
run against **real external apps** later — whose reports arrive in foreign formats. Without a shared
substrate these diverge in shape, styling, and export. Web Reporting is the **output layer** the
exercise-app conformance loop tooling, a future Web Compliance project, and external sources
all render through.

## The pipeline (each phase → one or more child stories)

| Phase | Produces | Notes |
|---|---|---|
| **1 · Report model** | a normalized schema (sources, sections, findings, severities, scores, series) every producer targets — the single thing renderers and adapters agree on | The canonical pivot. If this is a Protocol (below), this schema **is** the protocol contract. Natural first slice — everything else consumes it. |
| **2 · Renderers** | reusable views over the model — **findings table + coverage matrix** (v1); trend/burndown + score card (later) | Auto-render from the model the way `/protocols/` & `/intents/` catalogs do. |
| **3 · Ingest adapters** | `external format → report model` — **SARIF, JUnit, coverage** first; SonarQube, lint/audit JSON next | The lossy-normalization hub: ingest each foreign format bottom-up into the pivot. |
| **4 · Export adapters** | `report model → common formats` for interop out | Lower priority than ingest; SARIF/JUnit export covers the common CI consumers. |
| **5 · Producer migration** | existing `check:*` reporters emit the model + render through the shared renderers | `check:standards`, `check:app-conformance`, `check:readiness`, the burndown, the capability-manifest — adapt incrementally; don't gate v1 on rewriting them. |

## Design decisions (leaning — resolved on pickup of #431)

- **Project + Protocol, or project + intent?** Multi-vendor report-format interop (SARIF, JUnit, SonarQube
  all exchange the same kind of artifact) is a genuine protocol story — an escapable, impl-swappable
  contract.
  **Leaning: a Project that owns one Protocol** — the normalized report model is the protocol's canonical
  schema; ingest/export adapters are the bridge. An intent is UX-only and doesn't fit a data-interchange
  contract.
- **Absorb the existing reporters, or adapt them?** **Leaning: adapt, incrementally (phase 5).** Point each
  reporter at the model as a producer and replace its bespoke rendering with shared renderers over time;
  the burndown/readiness *logic* stays, only its output shape migrates. Don't block v1 on rewriting five
  reporters.
- **Minimum renderer set for v1.** **Findings table + coverage matrix** — those cover `check:standards`
  (findings) and `check:app-conformance` (coverage). Trend/burndown and score card follow once a producer
  emits series data.

## Relationships

- **Web Conformance** tooling (this is where `check:app-conformance` results render).
- **Web Compliance** (the hard-rule/gate project, [#351]) — its audit/gate results are just another source.
- Distinct from a *catalog* page: catalogs render a registry; reporting renders **findings/results** over time.

## Why an epic (storied) — sliced 2026-06-12

Five independently-deliverable phases, now carved into child stories (points live on the children):

- **#431** report model + `webreporting` Project + Protocol — root, no blockers (the natural first slice).
- **#432** v1 renderers (findings table + coverage matrix) — `blockedBy 431`.
- **#433** v1 ingest adapters (SARIF · JUnit · coverage) — `blockedBy 431`.
- **#434** export adapters (model → SARIF/JUnit) — `blockedBy 431`.
- **#435** producer migration (point the `check:*` reporters at the model) — `blockedBy 431, 432`.

#431 is workable first; everything else consumes it. **#439** (Web Compliance's audit trail) also
`blockedBy 431` — the report model is the shared protocol both projects emit through.
