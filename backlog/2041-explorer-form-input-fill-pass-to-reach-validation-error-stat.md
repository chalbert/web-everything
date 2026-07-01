---
kind: story
size: 5
parent: "1522"
locus: plateau-app
status: resolved
dateOpened: "2026-07-01"
dateStarted: "2026-07-01"
dateResolved: "2026-07-01"
tags: []
---

# Explorer: form-input fill pass to reach validation/error states

Inputs are clicked, never filled, so form-validation and dead-error states are unreachable. Type into text/email/number inputs and submit so validation and error states become observable.

## Resolution
Shipped in plateau-app `tools/explorer/`: a new `fill` candidate kind. The driver now emits one `fill` candidate per text-entry field (`text/email/number/search/tel/url/password/untyped input`, `textarea`, `contenteditable`), fires it by typing a type-appropriate, deliberately-invalid probe (bad email/url, out-of-range number, over-`maxlength` string) and submitting the owning form — `requestSubmit()` when the form is valid, else a synthetic cancelable `submit` + `invalid` so a JS-validated error UI still surfaces (native constraint validation otherwise suppresses the real submit on a bad probe). App-agnostic (keyed off the platform input taxonomy, never an app class), deterministic (fixed probe per type), best-effort. A new `form-validation` browser-lane fixture proves it end-to-end: its `console.error` dead-error state is reachable ONLY once the field is filled and the form submitted.

## Lineage
Surfaced 2026-07-01 in the first #1522 (Explorer CLI autonomy) goal-completeness pass — form-validation was an unfiled issue-class (inputs are clicked, never filled). Report: [we:reports/2026-07-01-program-explorer-cli-autonomy.md](../reports/2026-07-01-program-explorer-cli-autonomy.md).
