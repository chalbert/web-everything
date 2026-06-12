---
type: idea
workItem: epic
size: 3
parent: "099"
status: open
dateOpened: "2026-06-06"
childlessReason: untriaged
tags: [book, candidates, intents, blocks, standards, form-controls, notifications, responsive, logging, tracking, nomenclature, deprecation, triage]
relatedReport: reports/2026-06-06-front-end-platform-book.md
crossRef: { url: /backlog/099-evergreen-app-vision/, label: "Evergreen app / book map (#099)" }
---

# Book — further candidate standards not yet itemized (triage list)

A holding item for the **remaining ideas** in the archived "Front-End Platform" essay (`reports/2026-06-06-front-end-platform-book.md`) that are plausibly worth their own standard but were *not* promoted to individual backlog items in the first mining pass (which produced #099–#107). This keeps them tracked instead of buried in the book, without prematurely creating a dozen thin items. **Triage each below: promote to its own item, fold into an existing entity, or drop.**

## Candidates (with the book section they come from)

| Candidate | Book section | Likely home / note |
|---|---|---|
| **Form controls inventory** — datepicker, timepicker, inputs (text/number/currency/phone/mask), toggles, radios, checkboxes; the detailed datepicker feature list | *Interactive components / Types of controls / Datepicker* | Each a candidate **block** with a ready feature inventory; datepicker is the most fleshed-out. Cross-check against existing droplist/autocomplete/multi-select blocks before adding. |
| **Notifications & messages** — toasts/snackbar/popup; dismissable, levels, blocking vs non-blocking; modal messages | *Notifications / Messages* | Candidate **intent** (UX policy) and/or block. Pairs with the loading/waiting intent (#106). |
| **Constraint-based / container-query responsive** — FlexRow-style layout, `ResizeObserver`, container vs media queries | *Responsive design / Responsive layout* | Candidate **intent** or `webpositioning` facet; borrow Plateau FlexRow + container-query vocabulary. |
| **Logging standard** — log levels, namespace/scope, prefer no hierarchy | *Logging* | Likely a `webtraces` facet (aligns with the existing traces project). |
| **Tracking / analytics standard** — navigation/interaction/goal events, reporters | *Tracking* | Maps to the existing **webanalytics** project; fold in rather than new. |
| **Nomenclature & file-structure standards** — naming, casing, extensions (`.constants.ts`, `.actions.ts`), granular-import, private-module (`#`), module manifest | *Nomenclature / Granular Import / Private module / Module Manifest Standard* | Tooling/authoring conventions; niche. Module-manifest ties to MaaS dynamic loading (#081). |
| **Component deprecation / versioning strategy** — flag → new-version → legacy-lib, adapters to preserve support, v2 components | *Deprecation strategy* | Cross-cuts adapters + #102 changelog manifest; candidate protocol or doc. |
| **Doc-coverage / AI doc generation** — extract docs from code, "doc coverage" tool | *Documenting* | Partly covered by webdocs (#091); the *coverage metric* is the new bit. |
| **App health dashboard / platform directory** — per-app health rating, standard-adherence score, status | *Platform directory / Dashboard* | Largely **#092** (relationship graph) + a health-score view; extend #092 rather than new. |

## How to use this item

Don't build from here directly. When one of these becomes relevant, **promote it to its own backlog item** (dev-ready, with the book section as `relatedReport`) and strike it from this list; delete this item once the list is empty. Several already have a clear "fold into existing" answer (tracking → webanalytics, app dashboard → #092) — resolve those by cross-referencing, not by creating siblings.
