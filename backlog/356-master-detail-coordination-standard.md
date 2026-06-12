---
type: idea
workItem: story
size: 3
status: resolved
dateOpened: "2026-06-12"
dateResolved: "2026-06-12"
graduatedTo: master-detail
tags: [candidate-standard, exercise-app-discovery, master-detail, layout, selection]
crossRef: { url: /backlog/409-decision-master-detail-intent-vs-project/, label: "Layer decision (#409)" }
---

> **Resolved 2026-06-12 — codified AND runtime shipped.** Per decision
> [#409](/backlog/409-decision-master-detail-intent-vs-project/): master-detail is a **standalone
> `master-detail` intent + a coordinator block — NOT a new project** (no provider/schema; it composes
> selection / layout / loader / live-region-status / focus-delegation / navigation). The **`master-detail`
> block** (`blocks/master-detail/MasterDetailBehavior.ts`, active, 5 unit tests) COMPOSES the shipping
> selection block: on select it renders the detail (async-aware Loader seam), wires the detail as a
> labelled `role="region"`, applies focus flow + empty state, emits `detail-change`. The loan app consumes
> it (the hand-wired `SelectionBehavior` is gone); selection is now consumed *through* the coordinator.
> **`check:app-conformance` = 100% (10/10), 0 Layer-2 candidates left** — the loan app's discovered-standards
> board is clear.

# Candidate standard — Master–detail (list→detail) coordination

Missing standard surfaced building the loan-origination app ([#317](/backlog/317-exercise-app-loan-origination/)).
The pipeline list drives a **detail/trace panel**: selecting a row updates the detail, with keyboard
operation and a11y wiring. The `selection` intent covers *picking an item*, but **nothing standardizes the
master–detail composition** — the coordination between a collection and a coupled detail region (which is
selected, how focus/announcement flows, URL/deep-link of the selected item, empty/loading states). It is a
foundational enterprise layout (inbox, pipeline, admin tables) that recurs everywhere.

## What a standard would cover

- The **coordination contract** between a list (selection) and a detail region: selected-item binding,
  focus management, `aria` wiring (the detail as a labelled region), deep-link of the selection, empty state.
- Composition with `selection`, `collection-operations`, and the data-table block.

## Relations & open questions

- Built on `selection` + `layout` (concept) intents — is this its own intent, or a documented composition pattern?
- Relationship to the router (deep-linking the selected detail).
