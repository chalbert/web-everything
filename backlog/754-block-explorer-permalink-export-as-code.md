---
type: idea
workItem: story
size: 3
status: open
parent: "746"
blockedBy: ["749"]
dateOpened: "2026-06-16"
relatedProject: webdocs
tags: [webdocs, block-explorer, permalink, share, export, reproducibility]
---

# Shareable permalink + export-as-code — reproduce the exact configured view, or copy the block as code

Make any configured state of the Block Explorer **reproducible and shareable**. A **permalink** encodes the full view — active design-system manifest (+ overrides), activated traits, axis-slider values, viewport/container size, dark/RTL state — into a URL that reproduces *exactly* what's on screen when opened. And an **export-as-code** action copies the currently-configured block as ready-to-paste code (markup + the design-system import), or opens it in the conformance playground. This is cheap, high-leverage shared infrastructure: it serves bug reports (paste a link that reproduces the issue), teaching, and the demo-first iteration loop.

## Build

- Serialize the explorer's state (manifest ref + overrides, traits, slider values, viewport, native-state toggles) into a compact URL param; deserialize on load to restore the view.
- Export-as-code: emit markup + the design-system import for the current configuration; copy-to-clipboard + "open in playground".

## Acceptance

- [ ] Opening a permalink restores the exact configured view (design system, traits, sliders, viewport, state).
- [ ] Export-as-code produces a runnable snippet for the current configuration.

## Notes

Hard-blocked on **#749** — the serialized state model is the switcher's state, so it must exist first. The same serialization is reused by the theme creator (#751, "share this design system") and is the natural payload for handing a configured block to the dev-browser (#410).
