---
type: idea
workItem: story
size: 5
status: resolved
parent: "746"
blockedBy: ["727", "809", "815"]
dateOpened: "2026-06-16"
dateStarted: "2026-06-17"
dateResolved: "2026-06-17"
graduatedTo: frontierui/workbench/mount.ts (rendered-component inspectors + event log)
relatedProject: webdocs
crossRef: { url: /backlog/092-provider-consumer-graph-platform-manager/, label: "Provider↔consumer graph (#092)" }
tags: [webdocs, block-explorer, devtools, a11y, inspector, provider-graph, html-first]
---

# Block Explorer inspection devtools — "why this token", source/ARIA pane, event log, wiring graph

Give the Block Explorer a set of devtools-style inspectors that make the block's runtime legible. **"Why this token"**: click an element and trace back to the design-system token + intent that produced it (computed→source). **Source/ARIA pane**: the HTML-first markup, toggling intent attributes vs resolved ARIA (axe inline), proving the intent→platform-vocab mapping. **Event/protocol log**: watch events fire as you interact. **Wiring graph**: the provider↔consumer edges (#092) the block participates in, as an interactive graph.

## Build

- "Why this token" inspector: element → contributing token + intent, traced from the resolved styles back to the source manifest/intent.
- Source/ARIA pane: rendered markup + intent-attrs ⟷ resolved-ARIA toggle + inline axe results.
- Event/protocol log: capture and display the block's emitted events / protocol messages during interaction.
- Wiring graph: render the provider↔consumer edges (share the graph data with anatomy #748 and #092).

## Acceptance

- [ ] Clicking an element reveals the token + intent that produced its styling.
- [ ] The source pane toggles intent attributes vs resolved ARIA and surfaces axe findings.
- [ ] Interacting with the block populates the event log.
- [ ] A fixture exercises at least the "why this token" and ARIA-pane inspectors.

## Notes

Hard-blocked on **#727** (the live render to inspect). The wiring graph shares data with the anatomy view (#748) and the platform-manager provider↔consumer graph (#092) — one graph model, surfaced two ways, not duplicated.

**Split at the layer seam (#809).** This item straddles two homes and is built as two halves:
- **FUI workbench (FUI-locus, blockedBy #815):** the *rendered-component* inspectors — ARIA-as-rendered pane, computed-style reads, source view, event/protocol log. Same-origin host-side DOM inside the FUI workbench; no manipulation protocol.
- **WE-docs overlay (WE-locus, `@webeverything`):** the *WE-standards* panels — "why this token" provenance trace (#747/#364), the intent→ARIA mapping proof, and the #092 provider↔consumer graph. These are WE-standard data and stay a WE overlay rendered *around* the embedded workbench; they do **not** travel to third-party embedders. A small focus/selection sync (workbench → overlay: which element/token is selected) is a build detail here, not a new manipulation protocol. If the two halves want independent scheduling, carve them into separate items at build time.

## Progress

Resolved 2026-06-16 (locus: frontierui — the half built here). Per the #809 layer split, this story carried the **FUI-workbench rendered-component inspectors half**; the **WE-docs standards-overlay half** is carved to **#832** (its substrate #747/#364/#092 is all resolved, so it's ready).

FUI half (`fui:frontierui/workbench/mount.ts` + `we:registry.ts`), all host-side DOM, no protocol:
- **Source pane** — the rendered tree's markup (host-side `outerHTML`) + live attributes.
- **ARIA pane** — the resolved roles + `aria-*` the intent attributes produce, host + key descendants (the intent→platform-vocab mapping made legible).
- **Computed pane** — key computed styles (display, the token-driven listbox max-height/overflow, input value/aria-expanded).
- **Event / protocol log** — captures the block's bubbling events host-side as you interact (registry `events` field; auto-complete declares its `filter`/`change`/`selectionchange`/… set), newest-first, with a Clear button and a compact detail summary.
- e2e: a new `#755` spec asserts the ARIA pane + the event log capture/clear; the existing inspect test updated to the Source/Computed tabs. All 5 workbench specs pass; `tsc --noEmit` + `check:standards` green.
