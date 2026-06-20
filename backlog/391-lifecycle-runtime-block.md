---
kind: story
size: 5
status: resolved
parent: "317"
dateOpened: "2026-06-12"
dateResolved: "2026-06-12"
graduatedTo: "block:lifecycle"
blockedBy: []
tags: [exercise-app, loan-origination, weblifecycle, lifecycle, block, conformance]
crossRef: { url: /backlog/353-lifecycle-workflow-state-standard/, label: "Lifecycle standard (#353, codified)" }
---

> **Resolved 2026-06-12 — shipped.** Two active blocks now satisfy the Web Lifecycle protocol +
> Status Indicator intent: **`lifecycle`** (`fui:blocks/lifecycle/LifecycleProvider.ts` —
> `DefaultLifecycleProvider` / `CustomLifecycleRegistry` / `registerLifecycle`, contract-faithful
> `available()`/`transition()` emitting `LifecycleEvent`) and **`status-indicator`**
> (`we:blocks/renderers/status-indicator/renderStatusIndicator.ts`). Both have block-descriptions + unit
> tests (10 new, all green). The loan app consumes them: `LOAN_LIFECYCLE` definition
> (`we:demos/loan-origination/domain/lifecycle.ts`) drives the provider, the trace panel shows the
> provider's available next moves for the underwriter, and every status chip (summary + trace) is a
> `statusIndicatorHTML` render. `we:conformance.json` now declares both → **`check:app-conformance` = 100%
> (7/7), 0 GAP, compliant** (was 71%). Remaining: the State/Finding *table columns* render plain pending
> the data-table cell-formatter gap ([#368]); audit ([#357]) can now consume the `LifecycleEvent`.

# Build the lifecycle runtime block (make the loan app conformant against Web Lifecycle)

The **Web Lifecycle** standard is now codified — the project `weblifecycle`, the `lifecycle` protocol
(draft, `we:src/_includes/project-weblifecycle.njk` §`protocol-lifecycle`), and the `status-indicator` intent
([#353], [#354], both resolved). The contract exists; **no runtime ships yet**, so the loan-origination
app ([#317](/backlog/317-exercise-app-loan-origination/)) still hand-rolls its status machine in
`we:demos/loan-origination/domain/seed.ts`. This is the next `/exercise-app` loop turn: build the reference
runtime so the app becomes the standard's first conformant consumer.

## Scope

- A reference **`CustomLifecycleProvider` + `CustomLifecycleRegistry`** (`window.customLifecycles`) and a
  declarative `LifecycleDefinition` loader, per the protocol's seam (`available()` / `transition()`,
  emitting the `LifecycleEvent`). Design-first: ship with a **conformance demo + tests** like every block.
- A **`status-indicator`** reference render (the intent's `tone`/`shape`/`affordance` dimensions),
  composing `live-region-status` for transition announcement.
- Register both in `fui:src/_data/blocks.json` (+ `block-descriptions/*.njk`), run `gen:inventory`.
- Refactor the loan app onto them: replace the bespoke status logic with the loan `LifecycleDefinition`
  (`draft → submitted → processing → underwriting → approved-with-conditions → clear-to-close | declined`),
  authorization delegated to a guard predicate. Move `lifecycle` from `candidateStandards` to a declared
  standard in `we:demos/loan-origination/conformance.json` with an `evidence` regex.

## Done when

- `npm run check:app-conformance -- --app=demos/loan-origination` shows `lifecycle` as **conformant**
  (was a Layer-1 gap after codification); score rises; no new untagged bypass.
- The block ships with its conformance demo + unit tests; `check:standards` clean.
- Drives **#380** (lifecycle phase) and composes with audit ([#357]).
