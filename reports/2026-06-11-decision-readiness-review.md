# Decision-readiness review — all 24 open `type: decision` items (2026-06-11)

> **Status: dated snapshot, not maintained.** Tracked by
> [#303 prepare-the-open-decisions-to-the-prepared-fork-shape](/backlog/303-prepare-the-open-decisions-to-the-prepared-fork-shape-rollou/)
> (`relatedReport`). The verdict table below reflects the **original audit**; live
> status is the `preparedDate` stamp on each item, not this file.
>
> **Refresh (2026-06-11, post-audit):** the pool is unchanged at **24 open
> decisions**; **9 are now prepared** (`preparedDate` set) — **#009, #011, #012,
> #014** (the audit's order-1/2 picks) and **#096, #101, #104, #105, #107** (the
> configurator cluster). **15 remain unprepped**; **0 have been resolved or
> reclassified** yet, so the headline "0/24 READY" now reads **9/24 stamped,
> in progress**. The reclassification list (#142, #090, #276, #170, #063) is still
> entirely open.

A batch audit of every open backlog decision against the **prepared-fork shape**
(Definition of Ready, `we:docs/agent/backlog-workflow.md` → *The prepared-fork shape*). Five
parallel review agents, clustered by subsystem. Read-only — no items were edited.

## Rubric (a decision is READY to ratify when its body has ALL of)

1. **Digest** declares grounding — no design exists yet, forks grounded in a prior-art survey
   **published as a `/research/` topic**, each fork carries a **bold** default.
2. **Axis-framing paragraph** — orthogonal axes, each pinned to concrete `file:line` refs.
3. **"Recommended path at a glance" table** — one row per fork (default · alternative · confidence).
4. **One `## Fork N` per fork** — crux+refs → options A/B with tradeoffs → **bold** default →
   *Rejected* branches with reason.
5. **Research published** — `we:researchTopics.json` entry + `research-descriptions/{id}.njk`,
   linked via `relatedReport`, and `preparedDate` set.

## Headline

- **0 / 24 READY.** No open decision is in the prepared shape.
- **0 / 24** have a per-topic `/research/` publication or a `preparedDate`.
- The shape is **proven but un-rolled-out**: the only two items ever prepared (#064 tree-select,
  #173 menu/menubar) were both prepared *and resolved today* — they are the template, not open work.
- Verdict split: **9 PARTIAL · 15 BARE.**
- The near-universal missing step is the **`relatedReport` → `/research/` topic graduation**: many
  items link the shared essay book report (`we:2026-06-06-front-end-platform-book.md`) rather than a
  per-topic survey; and none has the glance table or `preparedDate`.

## Verdict table

| # | slug | verdict | research | gap to prepared |
|---|------|---------|----------|-----------------|
| 009 | webpermissions *(6 deps)* | BARE | none | survey Permissions/Notifications/Push vs `feedback` intent; frame project-vs-intent + feedback boundary |
| 011 | webpersistence | BARE | none | survey persistence/offline; forks: storage abstraction / offline-first / optimistic sync / conflict resolution |
| 012 | webidentity | BARE | none | survey WebAuthn/Passkeys/FedCM/Credential-Mgmt; project+protocol shape + timing |
| 014 | webscroll | BARE | none | survey scroll/observation; project-vs-intent + prefetch/viewport subsumption + collection-ops scroll-trigger seam |
| 018 | dropdown-async-pagination | BARE | relatedReport only | survey dropdown-async; forks: cursor-vs-offset / load-earlier / windowing |
| 051 | jsx-event-style-toggle | PARTIAL | relatedReport only | has bold default — graduate report to `/research/`, add glance table + `## Fork 1` + preparedDate |
| 059 | pagination-focus-announcement | PARTIAL | relatedReport only | run owed WAI-ARIA APG / NN-g pass, publish topic, frame focus-target fork |
| 063 | native-anchor-field rename | PARTIAL | crossRef only | **binary/trivial** — state a bold default (rename vs keep); full research topic likely overkill |
| 124 | resource-directive-async | PARTIAL | relatedReport only | best axis decomposition — survey SolidJS `<Resource>`/`<Suspense>`+Loader; convert 4 axes to forks. *(blockedBy #070)* |
| 276 | compositewidget-escape | PARTIAL ⟶ resolved | none | **fork already decided** — next action is the port + Escape test, not prep |
| 096 | nl-to-configurator | BARE | relatedProject only | survey NL→requirement-axis; restructure CLI-vs-editor-cmd-vs-panel fork |
| 101 | auto-update-pipeline | BARE | essay report | survey change-management; home + gate-model forks → `## Fork`. *(blockedBy #102/#094)* |
| 104 | app-shell-compat-map | BARE | essay report | **least prepared** (no resolution) — survey micro-frontend/app-shell; author schema/home/eviction forks |
| 105 | tool-agnostic-chart-config | BARE | essay report | survey chart-grammar (Vega-Lite/Plotly/ECharts); restructure schema+scope forks |
| 107 | mock-proxy-dev-service | BARE | essay report | survey mock/proxy (MSW/Mockoon/Prism/WireMock/Pact); restructure schema/delivery forks |
| 109 | development-guide-pathway | BARE | essay report | survey content-model; 3 bold decisions → forks w/ configurator-seed `file:line` |
| 141 | dev-browser-vision | BARE | landscape report | graduate market-landscape to `/research/`; 4 still-open decisions → forks |
| 142 | ai-gen feature-candidates | BARE | landscape report | **not decision-shaped** — brainstorm inventory (task under #140); reclassify or reshape the one "which graduate" fork |
| 091 | web-docs-as-a-service | BARE | none | survey Storybook/Chromatic/managed-docs; 3 follow-ons → bold-defaulted forks |
| 083 | agent-file-lock-coordination | PARTIAL | none | strong bold-defaulted *Key decisions* — survey multi-agent locking; refactor bullets → `## Fork` + table |
| 090 | consultancy-revenue-streams | BARE | none | **not decision-shaped** — service catalog enumeration; reframe into actual decisions or reclassify |
| 166 | governance-persona-charter | PARTIAL | none | convert 4 *Open questions* → forks w/ bold defaults + table + research |
| 170 | plugs-duplicated | PARTIAL ⟶ resolved | none | **fork settled inline** — residual is the build (reconcile 13 files, wire alias), not prep |
| 178 | access-control-gate | PARTIAL | none | home fork resolved; survey CASL/route-guard/feature-flag; recast member-design forks. *(blockedBy #288)* |

## Cross-cutting findings

1. **Roll-out gap, not a quality gap.** The prepared shape is brand-new (today) and proven on two
   items; the 24 open decisions simply predate it. This is a backlog-wide upgrade program, not a
   handful of touch-ups.
2. **The graduation step is the bottleneck.** For most items the research *report* exists — what's
   missing is graduating it to a browsable `/research/` topic + linking it + setting `preparedDate`.
3. **Three items are mis-shaped as `decision`** and should be reclassified rather than prepped:
   - **#142** — an AI-generated brainstorm inventory (task under #140), not a fork.
   - **#090** — a service-catalog enumeration with no actual decision.
   - **#276 / #170** — their core fork is *already resolved inline*; they are now builds, not decisions.
4. **#063 is binary/trivial** — it needs a pick, not a research survey.

## Recommended prep order (by downstream leverage)

1. **#009 webpermissions** — 6 dependents, the single highest-leverage prep.
2. **#012 / #014 / #011** — the other `web*` gap-projects (each a clean greenfield survey).
3. **Configurator cluster** (#104 first — least prepared; then #105 / #107 / #096 / #101).
4. **Reclassify** #142, #090, #276, #170 out of `decision` before they distort the decision pool.

Prep is heavy (each ≈ a real prior-art survey + restructure), so realistically **1–3 items per
session**, not a single sweep.
