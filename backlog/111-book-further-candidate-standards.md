---
type: idea
workItem: epic
size: 2
parent: "099"
status: resolved
dateOpened: "2026-06-06"
triagedDate: "2026-06-13"
dateResolved: "2026-06-13"
graduatedTo: none   # triage epic — decomposed into cards #467-#470 (re-parented to #099); no entity spawned
tags: [book, candidates, blocks, standards, form-controls, responsive, deprecation, doc-coverage, triage]
relatedReport: reports/2026-06-06-front-end-platform-book.md
crossRef: { url: /backlog/099-evergreen-app-vision/, label: "Evergreen app / book map (#099)" }
---

# Book — further candidate standards (triaged to real gaps)

Holding item for the **remaining ideas** in the archived "Front-End Platform" essay
(`we:reports/2026-06-06-front-end-platform-book.md`) not promoted in the first mining pass
(#099–#107). **Triaged 2026-06-13** against the live backlog: most candidates turned out to
be already homed (built, drafted, or folded into a project), and the real gaps were promoted to
their own cards. **This epic is RESOLVED** — every surviving candidate now has a tracking item
(below). The full book inventory is kept for reference; don't re-mine it cold.

## Promoted to their own cards (real gaps)

Each surviving gap now has a dedicated tracking item, parented under the book-map epic
[#099](/backlog/099-evergreen-app-vision/) (not this holder, so closing it leaves no orphaned work).
This epic carries no further work.

| Gap | Card | Kind | Home |
|---|---|---|---|
| **Responsive / container-query layout** — FlexRow-style layout, `ResizeObserver`, container vs media queries | **#467** | decision (placement) — *being prepared* | new `weblayout` project vs responsive intent vs fold into `webpositioning` |
| **Form-control block inventory** — datepicker, timepicker, text/number/currency/phone/mask inputs, toggle/switch, radio, checkbox | **#468** | idea / epic | `webblocks` (slice into per-control blocks) |
| **Doc-coverage metric** — % of exports documented/extracted | **#469** | idea / story | `webdocs` follow-on (#091 resolved) |
| **Component deprecation lifecycle** — flag → new-version → legacy-lib, support-preserving adapters | **#470** | idea / story | companion to #102 (changelog) + #191 (codemods) |

## Already homed — resolved during triage (reference)

Closed out by cross-referencing existing work; **not** active candidates:

- **Notifications & messages** → #358 (notification block, *resolved*) + #456 (`webnotifications`) + #459 (system-notification intent) + #460 (notification-marker intent); modal/blocking messages → #376 (dialog family).
- **Tracking / analytics** → `webanalytics` project (status: **draft**, Segment-spec vocabulary).
- **Logging** → folded into `webtraces` project (concept); log-levels/namespace are a facet of that charter, not a separate item.
- **Nomenclature / file-structure conventions** → folded into `webcompliance` (#436/#437). WE doesn't *mandate* naming — it ships a default vocabulary (the common language) that projects/companies customize, and compliance enforces adherence to the resolved project/company/platform settings (per *config-extends-platform-default*). Not a standalone standard; the module-manifest piece ties to MaaS (#081).
- **App health dashboard / platform directory** → #092 (provider↔consumer graph, *resolved*) + #104 (app-shell compatibility map) + #446 (platform map) + #402 (plateau platform manager).

## Original book inventory (reference — pre-triage)

The first-pass mining table, preserved verbatim with a disposition column. Each row's verdict is
recorded in the sections above; this is the raw map back to the book.

| Candidate | Book section | Disposition |
|---|---|---|
| **Form controls inventory** — datepicker, timepicker, inputs (text/number/currency/phone/mask), toggles, radios, checkboxes; the detailed datepicker feature list | *Interactive components / Types of controls / Datepicker* | **Promoted → #468** (form-control block inventory) |
| **Notifications & messages** — toasts/snackbar/popup; dismissable, levels, blocking vs non-blocking; modal messages | *Notifications / Messages* | **Homed** — #358, #456, #459, #460, dialog #376 |
| **Constraint-based / container-query responsive** — FlexRow-style layout, `ResizeObserver`, container vs media queries | *Responsive design / Responsive layout* | **Promoted → #467** (placement decision) |
| **Logging standard** — log levels, namespace/scope, prefer no hierarchy | *Logging* | **Homed** — folded into `webtraces` |
| **Tracking / analytics standard** — navigation/interaction/goal events, reporters | *Tracking* | **Homed** — `webanalytics` (draft) |
| **Nomenclature & file-structure standards** — naming, casing, extensions, granular-import, private-module (`#`), module manifest | *Nomenclature / Granular Import / Private module / Module Manifest* | **Homed** — folded into `webcompliance` (#436/#437) as a customizable ruleset (default vocabulary + project/company/platform overrides); not a mandate |
| **Component deprecation / versioning strategy** — flag → new-version → legacy-lib, adapters to preserve support, v2 components | *Deprecation strategy* | **Promoted → #470** (deprecation lifecycle); versioning already homed #088/#102/#191/#389/#390 |
| **Doc-coverage / AI doc generation** — extract docs from code, "doc coverage" tool | *Documenting* | **Promoted → #469** (coverage metric; generation = #091) |
| **App health dashboard / platform directory** — per-app health rating, standard-adherence score, status | *Platform directory / Dashboard* | **Homed** — #092, #104, #446, #402 |

## Status

**Resolved 2026-06-13.** Triage is complete: every book candidate is either already homed in an
existing item/project (see *Already homed*) or promoted to its own card (#467–#470). No further
work hangs off this epic — it remains as the reference map back to the book. Work the promoted
cards directly.
