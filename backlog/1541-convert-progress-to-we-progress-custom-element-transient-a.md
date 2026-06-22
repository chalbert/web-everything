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
tags: [packaging, custom-elements, block-model, conversion, progress, frontierui]
---

# Convert progress to we-progress custom element (transient A)

Register the progress block as a we-progress custom element via the transient (A) mechanism, mirroring the shipping reference at fui:blocks/transient/TransientElement.ts. Behavior-free presentational control per the #1381 packaging guideline (we:docs/agent/block-standard.md §7). Flat application, no fork.

## Progress

- `fui:blocks/progress/ProgressElement.ts` — `we-progress` extends `TransientElement` (Mechanism A), mirroring `we-meter`/`we-badge`. `resolveTag` → `div`; `decorate` reads the native `<progress>` vocabulary (value/max/valuetext/label/presentation) into a `ProgressConfig` and delegates to `createProgress`, adopting its output onto the root. Omitting `value` preserves the native **indeterminate** state. Self-replaces, zero `we-progress` wrapper.
- `fui:blocks/progress/registerProgress.ts` — `registerProgress(tag = 'we-progress')` (overridable, idempotent, bare standard name #841). Exported from the barrel.
- Unit test `ProgressElement.test.ts` (4): self-replacement to `fui-progress` + native `<progress>`, indeterminate-when-value-omitted, `valuetext` → `aria-valuetext`, circular SVG `role=progressbar` ring. 9/9 progress unit tests green; FUI `check:standards` 0 errors.
