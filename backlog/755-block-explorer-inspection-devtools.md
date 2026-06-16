---
type: idea
workItem: story
size: 5
status: open
parent: "746"
blockedBy: ["727", "809"]
dateOpened: "2026-06-16"
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
