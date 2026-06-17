---
type: idea
workItem: story
size: 3
status: resolved
parent: "746"
blockedBy: ["749"]
dateOpened: "2026-06-16"
dateStarted: "2026-06-17"
dateResolved: "2026-06-17"
graduatedTo: "frontierui/workbench/mount.ts (Share panel — permalink serialize/restore + export-as-code, reusing the #749 switcher state)"
relatedProject: webdocs
tags: [webdocs, block-explorer, permalink, share, export, reproducibility]
---

# Shareable permalink + export-as-code — reproduce the exact configured view, or copy the block as code

Make any configured state of the Block Explorer **reproducible and shareable**. A **permalink** encodes the full view — active design-system manifest (+ overrides), activated traits, axis-slider values, viewport/container size, dark/RTL state — into a URL that reproduces *exactly* what's on screen when opened. And an **export-as-code** action copies the currently-configured block as ready-to-paste code (markup + the design-system import), or opens it in the conformance playground. This is cheap, high-leverage shared infrastructure: it serves bug reports (paste a link that reproduces the issue), teaching, and the demo-first iteration loop.

## Build

- Serialize the explorer's state (manifest ref + overrides, traits, slider values, viewport, native-state toggles) into a compact URL param; deserialize on load to restore the view.
- Export-as-code: emit markup + the design-system import for the current configuration; copy-to-clipboard + "open in playground".

## Acceptance

- [x] Opening a permalink restores the exact configured view (design system, traits, sliders, viewport, state).
- [x] Export-as-code produces a runnable snippet for the current configuration.

## Progress

Done — built into the FUI workbench (`frontierui/workbench/mount.ts`), reusing the #749 switcher's state. A new **Share** chrome panel:

- **Copy permalink** — `serializeState()` encodes the full view into URL params: `block`, `ds` (active design system), `traits`, `axes` (density/radius/contrast slider values), `scheme`/`hc`/`fc` (native state), `rtl`/`locale`, `cq` (container sim). On mount a restore block parses `location.search` and re-applies — traits first (so the re-render applies them pre-connect), then the design system, then axes + native-state + RTL/locale + container — reproducing the exact view. Clipboard write + echoes the URL.
- **Export as code** — `exportAsCode()` emits a ready-to-paste snippet: a `<style> :root { --wb-*… }` block of the active design-system tokens (#747 shape) + the configured element's markup (authoring attributes; ARIA/role/tabindex stripped). Clipboard + echo.

Verified: `tsc --noEmit` (strict) clean; a new e2e (`a permalink round-trips … #754`) + all 9 workbench e2e specs pass on the live `:3001` (Carbon + RTL + radius=12 → permalink encodes `ds=carbon-like`/`rtl=1`/`radius=12`; opening it fresh restores `data-ds`/`dir`/the slider; export emits the Carbon tokens + `<auto-complete …>`); FUI `check:standards` 0 err/0 warn. The serialization is the reusable payload for the theme creator's "share this design system" (#751) and the dev-browser hand-off (#410).

## Notes

Hard-blocked on **#749** — the serialized state model is the switcher's state, so it must exist first. The same serialization is reused by the theme creator (#751, "share this design system") and is the natural payload for handing a configured block to the dev-browser (#410).
