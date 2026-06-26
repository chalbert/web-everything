---
kind: story
size: 3
parent: "1783"
status: resolved
dateOpened: "2026-06-26"
dateStarted: "2026-06-26"
dateResolved: "2026-06-26"
graduatedTo: conformance-vectors/binding.ts (SynchronousConformanceBinding)
tags: []
---

# WE clock-optional synchronous ConformanceBinding variant

Make the #899 ConformanceBinding usable by a facts→verdict (synchronous, no-DOM) standard without temporal machinery. we:conformance-vectors/schema.ts:21-27 already models synchronous vectors (clock offset omitted = synchronous); only we:conformance-vectors/binding.ts:24-39 forces a required clock field. Make clock optional (or ship a no-op SynchronousClock), confirm the schema/validator synchronous path, and add a synchronous-binding test alongside we:conformance-vectors/__tests__/. Generic foundation — no subsystem-specific code.

## Progress (resolved 2026-06-26)

Factored the clock out rather than nulling it (the skeptic-preferred "sibling interface", #1784):
- **`we:conformance-vectors/binding.ts`** — added `SynchronousConformanceBinding` (clock-free base: `dispatch` + `observe`); re-derived `ConformanceBinding extends SynchronousConformanceBinding` (adds `clock`) so the temporal contract is structurally unchanged (backward-compatible — FUI `fui:blocks/deck/deckConformance.ts` / the plateau runner unaffected); made `ConformanceBindingFactory<B extends SynchronousConformanceBinding = ConformanceBinding>` generic so a synchronous standard parameterises it as `ConformanceBindingFactory<SynchronousConformanceBinding>`.
- **`we:conformance-vectors/__tests__/synchronous-binding.test.ts`** — a facts→verdict demo (loan-policy) proving a synchronous vector suite validates (no `atMs`), a clock-free binding round-trips `dispatch`→`observe('verdict')`, and `'clock' in binding === false`. 3 tests; full `we:conformance-vectors/` suite 14/14 green; `tsc --noEmit` clean; `check:standards` 0 errors.
- The runner-side consumption (accept the base, no-op for synchronous) is `we:#1790`'s (Slice B), gated on the runner-home decision `we:#1788`.
