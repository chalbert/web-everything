---
type: decision
workItem: story
size: 3
status: resolved
dateOpened: "2026-06-12"
dateResolved: "2026-06-12"
graduatedTo: "intent:master-detail"
parent: "356"
tags: [decision, master-detail, intent, layer-placement, exercise-app-discovery]
crossRef: { url: /backlog/356-master-detail-coordination-standard/, label: "Candidate standard (#356)" }
---

# Decision — Master-detail: standalone intent vs. new project

Surfaced finishing the loan app's ([#317](/backlog/317-exercise-app-loan-origination/)) last Layer-2
candidate, [#356](/backlog/356-master-detail-coordination-standard/). The item's own open question is the
fork: *"its own intent, or a documented composition pattern?"* — i.e. what **layer** master-detail
coordination occupies.

## The fork

The four prior exercise-app standards (lifecycle #353, status-indicator #354, audit #357, decision #355)
each became a **Project + Protocol** because each had a real **contract**: a provider seam
(`CustomLifecycleProvider`, `CustomAuditProvider`) or an interchange **schema** (`DecisionRecord`).
Master-detail has **none of those** — it is pure UX coordination between a collection and a coupled detail
region, and it *composes intents that already exist* in `intents.json`: `selection` (pick), `layout`
(region), `loader` (pending detail), `live-region-status` (announce), `focus-delegation` (focus flow),
`navigation` (deep-link).

| Option | Verdict |
|---|---|
| **A — Standalone intent** (no project), + a small coordinator block | **CHOSEN** |
| B — New Project + Protocol (mirror the prior four) | Rejected — no provider/schema/vendor-interop contract to standardize; a project would over-engineer it. |
| C — Documentation-only composition pattern (no block) | Rejected — the wiring is identical for every consumer, so it earns a reusable block; and the app can't be *conformant* to a pattern with no implementation. |

## Ruling (2026-06-12)

**Master-detail is a standalone `intent` + a small coordinator `block` — no project, no protocol.** This
is the *fork-existence / impl-is-not-a-standard* discipline: **not every gap is a project.** A deliberate
contrast to the prior four — judgment, not reflex.

- **Intent `master-detail`** (standalone, draft) — dimensions: `detailScope` (panel|inline|route),
  `focusFlow` (retain|advance), `selectionSync` (none|deep-link), `emptyState` (placeholder|collapse).
  Composes selection / layout / loader / live-region-status / focus-delegation / navigation.
- **Block `master-detail`** — `MasterDetailBehavior(masterEl, { itemSelector, detailEl, keyOf,
  renderDetail, focusFlow?, emptyState? })` that **composes the shipping `SelectionBehavior`** (owns the
  binding, not a reimplementation): on select → `renderDetail(key, detailEl)` (async-aware loading), aria
  (detail = labelled `role="region"`), focus flow, empty state. `implementsIntent: master-detail`,
  `composesIntents: [selection]`.
- **`selectionSync: deep-link`** is declared as a dimension; the reference block ships `none` and leaves
  URL sync to the consumer's router (compose, don't duplicate router logic).
- Codify + runtime in one turn (light) — keeps the loan app at 100%.

## Implementation (the plan of record)

- `src/_data/intents.json` — splice `master-detail`. `scripts/check-app-conformance.mjs` — repoint the
  `master-detail coordination` concept (`standardId: master-detail`, evidence `MasterDetailBehavior`).
- `blocks/master-detail/MasterDetailBehavior.ts` (+ `block-descriptions/master-detail.njk`, `blocks.json`
  entry, unit tests).
- `demos/loan-origination/app.ts` — replace the hand-wired `SelectionBehavior` + `current` tracking with
  `MasterDetailBehavior`; `conformance.json` — declare `master-detail`, widen `selection` evidence to also
  match `MasterDetailBehavior` (selection is now consumed *through* the coordinator).
- [#356](/backlog/356-master-detail-coordination-standard/) → resolved, `graduatedTo: master-detail`.

## Verification

- `gen:inventory` + `check:standards` → 0 errors (intent + block only; no project/protocol).
- `check:app-conformance` → `master-detail` conformant, `selection` still conformant, **100% (10/10), 0
  Layer-2 candidates left**. Live smoke test: row select still renders the detail via the coordinator,
  keyboard works, zero console errors.
