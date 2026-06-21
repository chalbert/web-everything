---
kind: epic
status: active
parent: "314"
ongoing: true
dateOpened: "2026-06-11"
dateStarted: "2026-06-11"
relatedReport: reports/2026-06-11-exercise-app-loan-origination-requirements.md
tags: [exercise-app, financial, loan-origination, requirements, validation, business-rules]
crossRef: { url: /backlog/314-flagship-exercise-apps/, label: "Flagship exercise apps (#314)" }
---

# Exercise app A (loan / mortgage origination)

Candidate **A** (financial) from the flagship-exercise-apps epic ([#314](/backlog/314-flagship-exercise-apps/)).
Derive a full, complex requirements set for a **loan / mortgage origination platform** and
scope the build into slices. The app spans a **borrower wizard** (apply, upload docs, e-sign),
**eligibility & affordability rules** (DTI, LTV, income & employment verification), an
**underwriter workbench** (conditions, decisioning, counter-offers), and **product/rate
selection**. Fidelity to real lending law is optional — requirements only need to be full and
complex enough to push the platform. This story ends when the requirements are documented well
enough to scope the build; the build itself graduates to its own slices.

## What to derive

- **Actors & roles:** borrower, loan processor, underwriter (+ permissions per role).
- **Borrower journey:** multi-step application, document checklist & upload, save-and-resume across days, e-sign.
- **Rules:** affordability (DTI), loan-to-value (LTV), income/employment verification, credit thresholds — expressed as codifiable rules.
- **Underwriter workbench:** conditions list, decisioning (approve / decline / refer / counter), audit trail.
- **Products & pricing:** product/rate selection with eligibility-driven options.

## Surfaces it stresses (per #314 matrix)

Validation + requirement-as-code (primary), business-rule / proof-of-compliance (primary),
webidentity / webpermissions (primary), webpersistence / save-and-resume (primary), file-upload
intents, collection-ops (conditions & doc checklists), Technical Configurator (product & rate).

## Requirements source strategy

Derive from first principles, lightly anchored to a public reference (e.g. a generic mortgage
application flow / URLA-style field set) — complex but not a research rabbit hole.

## Done when

A requirements doc exists (actors, journeys, rules catalog, data model, role/permission map) that is
detailed enough to break the build into agent-ready slices.

## Progress

- **2026-06-11** — Requirements derived in [the requirements report](/reports/2026-06-11-exercise-app-loan-origination-requirements.md):
  scope, actors & field/action/state permission model, lifecycle state machine, nine functional modules
  (M1 wizard → M9 audit), rules-as-code catalog, data model, and a platform-surface map. Four open
  decisions captured there (co-edit conflict strategy, rules expression format, self-serve vs LO entry,
  pipeline dataset scale) with recommendations. **This story's deliverable (the requirements) is done**;
  remaining is to spin the slices below into their own build items.

## Settled decisions (2026-06-11)

1. **Co-edit conflict** → last-writer-wins + a visible "X also editing" banner.
2. **Rules engine** → JSON predicate DSL, shared by the affordability engine (M6) and the product
   configurator (M5); rules are editable data, versioned.
3. **Entry point** → support borrower self-serve **and** LO co-edit from the start (the state/permission
   model already covers it).
4. **Pipeline dataset** → seed **5k** applications to actually stress windowing/pagination.

**Home/shell**: built as a self-contained app under `demos/loan-origination/` on the standard's own
**declarative-SPA router + loader** shell — the app dogfoods the standard (that's the exercise).

## Build log

- **2026-06-11 — S0 (foundation) done & verified.** App home scaffolded at
  [`demos/loan-origination/`](/demos/loan-origination/index.html). Framework-agnostic domain core:
  entity types, the **rules-as-data engine** (JSON predicate DSL + AUS-style aggregation + per-rule
  proof-of-compliance trace), product catalog + rate sheet + LLPA pricing, derived underwriting facts,
  a **deterministic 5k-application seed**, and the **mock provider seam** (credit / AUS / verification /
  e-sign / doc-classify). A thin vanilla harness proves it end-to-end: 5k apps generated + evaluated in
  ~19 ms, with a believable finding spread (**~42% approve-eligible / 23% refer / 14% refer-w-caution /
  21% ineligible**) and a clickable proof-of-compliance trace per loan. tsc-clean; verified live on :3000.
  (Found & fixed a seed/facts bug where an empty-guard `.concat([0])` poisoned `minMonthsOnJob` to 0.)
  Next: S1 permissions, then S2 lifecycle, then S3 the 1003 wizard on the SPA shell.
- **2026-06-11 — Visual register set to enterprise-finance.** Researched real LOS incumbents (ICE
  Encompass / Calyx — dense, conservative, "stuck in the 2000s") and the modern-enterprise references
  (Fluent / Salesforce Lightning). Restyled the S0 page from the original dark/dev-tool look to a
  **light, dense, corporate** register (navy chrome, module tabs, gridlined zebra pipeline, panels with
  title bars, snapshot ribbon, status bar) implemented as a **theme-token layer** (`theme-enterprise`
  in `we:app.css`) over unchanged structure — so the same components reskin for a later modern-SaaS app.
  Banking is explicitly **not** modern-SaaS. App complexity/simplicity to be reassessed after more build.

## Child stories — WE-surface consumption slices

One card per Web Everything surface the demo drives (the live status is the conformance benchmark + the
demo page's blockers view). WE-owned block/intent *enhancements* surfaced along the way stay as standalone
items, cross-referenced.

- **#371** — consume Router *(resolved)*
- **#372** — consume Data Table + build its behavior *(resolved → data-table active)* · surfaced [#368] formatter
- **#373** — consume Pagination + build its behavior *(resolved → pagination active)* · surfaced [#369] coordinator
- **#374** — consume a Selection runtime *(resolved → built the new `selection` block)*

**Loan app: 100% Layer-1 conformance** (router · data-table · pagination · collection-operations · selection).

### Functional phase cards (the S0–S11 build plan)

The app's feature phases, beyond the pipeline's WE-surface consumption above. Each, when built, drives WE
surfaces (validation, stepper, permissions, persistence, files, configurator, lifecycle, audit) — most of
which are unbuilt, so these are the next gap-discovery veins.

- **#378** — S0/S7 domain model + rules-as-code engine *(resolved — the foundation)*
- *(S10 pipeline = the WE-surface cards #371–#374 above, resolved)*
- **#379** — S1 permissions (field/action/state) · **#380** — S2 lifecycle state machine
- **#381** — S3 1003 borrower wizard · **#388** — S4 save-and-resume drafts · **#383** — S5 document checklist
- **#384** — S6 product/rate configurator · **#385** — S8 underwriter workbench
- **#386** — S9 disclosures + e-sign · **#387** — S11 notifications + audit trail

### Program tooling

The conformance benchmark + loop + blockers view this epic is measured by is tracked at **#377**
(under the program epic #314), not as app work.

## WE surfaces this app drives (live tracker)

Per-demo block tracking is the **conformance benchmark** (`npm run check:app-conformance`), not manual
bookkeeping. Current read (consumption slices are carved as child stories as we work each surface):

| Surface | Status | Notes |
|---------|--------|-------|
| router (block) | **conformant** | module bar + deep-links; first enterprise consumer |
| data-table (block) | **conformant** | **advanced draft→active** this program; pipeline is first consumer |
| collection-operations (intent) | **conformant** | via the active data-table block |
| pagination (block) | **conformant** | **advanced draft→active**; windows the 5k book (Prev/Next + range) |
| selection (block) | **conformant** | **built a new `selection` block** (SelectionBehavior); row→trace master-detail |
| Candidate standards | filed | #353 lifecycle · #354 status-badge · #355 trace · #356 master-detail · #357 audit |

## Build log — loop turns

- **2026-06-12 — Built a new `selection` block (WE) + reached 100% conformance.** The `selection` intent had
  no shipping implementation (no reference renderer to wrap), so built one from the contract:
  `SelectionBehavior` (list selection — `aria-selected`, roving `tabindex`, click + Arrow/Home/End/Enter/Space,
  `selection-change`; single & multiple models), registered as an **active** block with a `.njk` description,
  with unit tests. The loan pipeline's row→trace master-detail now runs through it (live: click + arrow keys
  move the selection and update the trace). **Loan app → 100% Layer-1 conformance (5/5).** Master-detail
  *coordination* across re-renders remains the seam ([#356]/[#369]).
- **2026-06-12 — Built the pagination behavior (WE) + windowed the 5k pipeline.** Same shape as data-table:
  the block declared `PaginationBehavior`/`registerPagination` but never shipped them; built both over the
  verified `renderPagination` (delegates goto/prev/next/load-more, clamps via total, emits
  `pagination-change`, `<page-nav>` element) with unit tests; flipped **pagination draft→active**. The loan
  pipeline now windows all 5,000 (Prev/Next + "Showing 51–100 of 5000") through the block. Conformance
  **60% → 80%**. Fixed a real bug found by the live consumer (renderer emits **1-based** `data-page` +
  `prev`/`next` actions, and cursor mode omits `data-page`). Filed a composition gap: data-table + pagination
  have no coordinator, so sort is page-local not collection-wide ([#369]).
- **2026-06-12 — Built the data-table behavior (WE) + made the app its first consumer.** The block
  declared `DataTableBehavior`/`registerDataTable` but never shipped them; built both over the verified
  `renderDataTable` (click-to-sort + polite announce + `<data-table>` element), with unit tests; flipped
  **data-table draft→active**. Refactored the loan pipeline off its hand-rolled `<table>` onto
  `<data-table>`. Conformance **20% → 60%** (router + data-table + collection-operations). Surfaced &
  filed a real block gap: data-table has no per-column **cell formatter** ([#368]) — currency renders raw,
  no chips. Also refined the benchmark: an intent is conformable when an **active block implements it**.
- **2026-06-11 — Adopted the Router block** (module nav + deep-links); router → conformant (0%→20%).

## Conformance baseline & WE gap queue (2026-06-11)

First `npm run check:app-conformance` run on S0 = **23%** (built almost entirely off-platform). The
benchmark's ranked queue, mapped to the WE work it implies:

**Active-bypasses (FAIL — refactor S0 onto shipping blocks; the surfaces already exist):**
- `innerHTML` rendering → `for-each` + interpolation blocks.
- `addEventListener` → `on:*` event-behaviors + handler-expression-parser.
- module-var state → `stores` (SimpleStore) + injector.
- manual show/hide → `view` block.
- `.ts` + HTML literals → `.tsx` mirror dialect.
  *(These are the next `/exercise-app` turn — cheap pure debt, no new WE item needed.)*

**Draft-surface gaps (implement in WE; existing backlog targets for the `PLATFORM-GAP` tags):**
- hand-rolled `<table>` → data-table / data-grid block: **#123, #131, #132, #115, #036**.
- windowing w/o pagination → pagination + collection-operations: **#006, #036, #061**.
- ad-hoc selection → selection (droplist family): **#023, #021, #024**.
- hardcoded colors → theme/surface token system: **#010**.

The loop ([we:docs/agent/exercise-app-workflow.md](/docs/agent/exercise-app-workflow.md), `/exercise-app`)
burns this down: each turn fills the top gap in WE, S0 consumes it, rescan. S0's value is this queue,
not the running app.

## Proposed build slices

Agent-ready slices drawn from the requirements report. Each becomes its own build item (`parent: "317"`
or `"314"`) when we commit to building. Ordered by dependency; **S0–S2 are the foundation** everything
else builds on.

| # | Slice | Modules | Size | Depends on |
|---|-------|---------|:----:|-----------|
| S0 | Domain model + mock provider seam + 5k-row seed data | data model, M9 substrate | 5 | — |
| S1 | Identity, roles & field/action/state permission model | permissions | 5 | S0 |
| S2 | Application lifecycle state machine + guards | lifecycle | 3 | S0, S1 |
| S3 | Borrower 1003 wizard (steps, repeating sections, conditional/cross-field validation) | M1 | 8 | S2 |
| S4 | Save-and-resume drafts + co-edit conflict handling | M3 | 5 | S3 |
| S5 | Document checklist (rules-driven) + DnD/clipboard upload | M2 | 5 | S2 |
| S6 | Product catalog + rate sheet + configurator (constraint graph) | M5 | 8 | S0 |
| S7 | Rules-as-code engine + proof-of-compliance trace | M6 | 8 | S6 |
| S8 | Underwriter workbench (conditions + decisioning) | M7 | 5 | S7 |
| S9 | Disclosures + e-sign + TRID clock | M4 | 3 | S2 |
| S10 | Role-scoped pipeline (sort/filter/saved-views/bulk) + pagination at scale | M8 | 5 | S1 |
| S11 | Notifications + audit-trail UI | M9 | 3 | S2 |

A **thin demonstrable spine** is S0 → S1 → S2 → S3 → S10: a borrower can fill the 1003, it persists,
and it shows on a role-scoped pipeline. The rules/configurator/underwriting depth (S6→S7→S8) is the
highest-value exercise of the standard and can follow once the spine renders.
