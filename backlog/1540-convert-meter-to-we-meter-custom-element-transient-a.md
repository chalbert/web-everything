---
kind: story
size: 2
parent: "1442"
status: resolved
dateOpened: "2026-06-22"
dateStarted: "2026-06-22"
dateResolved: "2026-06-22"
locus: frontierui
relatedProject: webcomponents
relatedReport: reports/2026-06-22-1442-slice-wave-2.md
tags: [packaging, custom-elements, block-model, conversion, meter, frontierui]
---

# Convert meter to we-meter custom element (transient A)

Register the meter block as a we-meter custom element via the transient (A) mechanism, mirroring the shipping reference at fui:blocks/transient/TransientElement.ts. Behavior-free presentational control per the #1381 packaging guideline (we:docs/agent/block-standard.md §7). Flat application, no fork.

## Progress

- `fui:blocks/meter/MeterElement.ts` — `we-meter` extends `TransientElement` (Mechanism A), mirroring the shipped `we-badge`/`we-card`. `resolveTag` → `div` (the `fui-meter` root); `decorate` reads the native `<meter>` vocabulary + presentation/zones off the element into a `MeterConfig` and **delegates to `createMeter`**, adopting the factory output onto the resolved root — so the declarative element and the factory emit identical structure (no second renderer). Self-replaces, leaving zero `we-meter` wrapper.
- `fui:blocks/meter/registerMeter.ts` — `registerMeter(tag = 'we-meter')` (consumer-overridable, idempotent, bare standard name per #841). Exported from the meter barrel.
- Unit test `fui:MeterElement.test.ts` (4): self-replacement to `fui-meter` + native `<meter>` (config attrs not copied literally), native vocabulary (min/max/low/high/optimum), `valuetext` → `aria-valuetext`, radial SVG `role=meter` gauge + semantic zone. 9/9 meter unit tests green; FUI `check:standards` 0 errors.
