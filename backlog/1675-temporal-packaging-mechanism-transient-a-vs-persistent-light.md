---
kind: decision
parent: "1442"
status: resolved
dateOpened: "2026-06-23"
dateStarted: "2026-06-23"
dateResolved: "2026-06-23"
graduatedTo: none
preparedDate: "2026-06-23"
locus: frontierui
relatedProject: webcomponents
codifiedIn: docs/agent/block-standard.md
relatedReport: reports/2026-06-23-1442-slice-wave-4.md
tags: [packaging, custom-elements, block-model, conversion, decision, frontierui]
---

# temporal packaging mechanism: transient (A) vs persistent light-DOM (B)

Decide the custom-element packaging mechanism for the temporal block under #1442 against the codified §7 mechanism-selection rule. Reading the shipped FUI tree, temporal is realized today as behaviors riding native single-anchor inputs — no composite live-binding element exists — which is exactly the §7 item-7 transient signature, so this ratifies the shipped shape to (A). Resolves to one we-temporal conversion task.

## Grounding

Temporal does not ship a custom element today. The block is realized as a pure value-bridge helper plus three `CustomAttribute` behavior traits that enhance **native** date/time inputs — the #1381 "behaviors riding native elements" end-state, already in place. Concretely, fui:blocks/temporal/datetimeCompose.ts:11 is two pure string functions (`composeDatetimeLocal`/`splitDatetimeLocal`) with no DOM and no element. The three presentation surfaces are all `CustomAttribute` mixins on a surviving native input: fui:blocks/temporal/traits/CalendarGrid.ts:27 (`extends CustomAttribute`, enhances `<input type="date">`), fui:blocks/temporal/traits/Clock.ts:25 (enhances `<input type="time">`), and fui:blocks/temporal/traits/RangeCoordination.ts:21 (coordinates two date anchors).

Each named preset (we:src/_data/blocks/date-picker.json, we:src/_data/blocks/time-picker.json, we:src/_data/blocks/datetime-picker.json) pins the temporal core to **one** native anchor — `<input type="date">`, `<input type="time">`, `<input type="datetime-local">` — and the contract states the native input is the zero-JS fallback. The behaviors' reactivity is entirely attribute/event-shaped: fui:blocks/temporal/traits/CalendarGrid.ts:41 writes `input.value` then dispatches native `input`/`change` events; fui:blocks/temporal/traits/Clock.ts:117 does the same; fui:blocks/temporal/traits/RangeCoordination.ts:89 reports the pair via a bubbling `CustomEvent`. No surface sets object/function properties on a persistent JS ref post-mount.

Per §7 item 7 (we:docs/agent/block-standard.md): a behavior-free presentational control with a single native element to erase into → (A) transient → native; behaviors keep riding the surviving native element via `CustomAttribute`. The only surface §7 reserves for (B) — imperative non-serializable property writes on a persistent element ref — is empty here.

## Recommended path at a glance

| Block | Mechanism | Why |
|---|---|---|
| we-temporal | **(A) transient → native input** | single native anchor per preset; behaviors ride the surviving input; no composite live-binding ref surface |

## Fork 1 — temporal runtime packaging mechanism

A vs B are mutually-exclusive runtime shapes — a block either self-erases into a native element (A) or keeps a persistent wrapper to bind to (B); it cannot do both. The fork is real because the excluded branch (B) is flawed *for temporal specifically*: B's reason to exist is a persistent element holding a JS ref whose object/function properties a consumer sets post-mount (the wizard's `set graph(...)` shape). Temporal has no such surface — every preset binds to a single native input and all reactivity is attribute/event-shaped — and B would mean retaining an empty wrapper over an element that has a native single-element to erase into. Crux: does temporal have a single native element to erase into (→ A) or a composite value that is a live two-way-binding surface with no native single-element (→ B)? The shipped code answers the former: fui:blocks/temporal/datetimeCompose.ts:11 + the three native-input-enhancing traits.

- **(a) transient → native (A).** Authored as `<we-temporal …>` (or per-preset spellings), self-replaces with the native input the preset pins (`<input type="date|time|datetime-local">`), zero wrapper. Native form participation, validity, locale-aware value, and the no-JS fallback are kept free; the calendar-grid / clock / range-coordination behaviors ride the surviving native input as `CustomAttribute`s exactly as they do today. Reference pattern: fui:blocks/transient/TransientElement.ts:28. *Tradeoff:* the custom element is gone after replacement, so there is no post-render tag-inspection / persistent ref — but temporal's surface needs none.
- (b) persistent light-DOM (B). A `<we-temporal>` element persists in the DOM and owns a real light-DOM input, exposing a JS binding surface (e.g. an imperative `value`/`range` property a framework consumer sets post-mount). Reference pattern: fui:blocks/wizard/WizardElement.ts:25 (`class WizardElement extends HTMLElement` with `set graph(...)` at fui:blocks/wizard/WizardElement.ts:39 — the imperative object-property binding that justifies B). *Tradeoff:* keeps a persistent ref and is the shape an S2 deployment upgrades to (C), but it forgoes the zero-wrapper native erase for a surface temporal does not have — a wrapper retained for nothing. *Rejected* — temporal exposes no imperative object/function property surface and each preset has a single native element to erase into, so B retains an empty wrapper against §7 item 7.

**Default: (a) transient → native (A).** Temporal matches the §7 item-7 "behavior-free presentational control, single native element to erase into" signature exactly — it is already shipped as behaviors over native single-anchor inputs, with all reactivity attribute/event-shaped and no persistent-ref property surface. (A) ratifies the shipped shape and the #1381 end-state; (B) is the grouped/composite case (the §7 form-control worked example's group), which temporal is not — even the range preset coordinates two **native** date inputs via a `CustomAttribute` and reports an event, not an imperative composite-value ref.

Skeptic: SURVIVES — attacked via the range preset (date-range-picker pins granularity=range over **two** `<input type="date">` anchors), the strongest B case: a two-anchor composite looks like the §7 grouped-control → B example. Refuted by the code — fui:blocks/temporal/traits/RangeCoordination.ts coordinates the pair as a `CustomAttribute` on a wrapper `<div>`, writing native `.value`s (line 75) and reporting via a bubbling `CustomEvent` (line 89); it exposes no imperative composite-value JS property a consumer sets post-mount, and §7's group→B test turns on that live two-way-binding ref surface, not anchor count. So the single-control presets transiently erase to their native input, and a future range element (if elementized at all) is a separate per-preset call, not grounds to package the whole temporal block as B. No §7 principle is violated by (A); the default holds without amendment.

## Resolution (ratified 2026-06-23)

**(A) transient → native — ratified.** Temporal is packaged as a transient custom element: each preset registers a tag that self-replaces with the single native input it pins, and the CalendarGrid/Clock/RangeCoordination behaviors keep riding the surviving native input as `CustomAttribute`s. (B) persistent light-DOM is rejected — temporal exposes no imperative object/function property surface and each preset has a native single-element to erase into, so B would retain an empty wrapper against §7 item 7. The ruling ratifies the shipped shape and the #1381 "behaviors over native elements" end-state; it is governed by the already-codified §7 mechanism-selection rule (we:docs/agent/block-standard.md), so no standard amendment is needed (`codifiedIn` set; `graduatedTo: none`).

Build successor: **#1706** — convert temporal to we-temporal custom element (transient/A). Residual: a future standalone date-range *element*, if ever elementized, is a separate per-preset call (it does not reopen the block-level mechanism choice).
