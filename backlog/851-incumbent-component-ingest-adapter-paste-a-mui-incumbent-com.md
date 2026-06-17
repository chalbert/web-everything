---
type: idea
workItem: story
size: 5
status: open
dateOpened: "2026-06-17"
tags: []
---

# Incumbent-component ingest adapter — paste a MUI/incumbent component, normalize to the neutral CEM contract, re-emit as a WE block

The reverse/ingest half of the polyglot adapter story and the #753 reverse-ingest prerequisite (verified absent today). A forward generator exists (#821, CEM → React/Vue wrapper), but nothing ingests an INCUMBENT component (e.g. a MUI button): `htmlToJsx` is a JSX-pane mirror and the upgrader `ComponentIR` ingests the WE declarative form, not third-party components. Build the ingest adapter — parse an incumbent's API surface (props/events/slots) into the neutral CEM-shaped contract (the lossy internal pivot, never project-facing; the adapter-as-normalization-hub direction), then re-emit as a WE block. The substrate #753 criterion 3 round-trips through. WE-owned (normalization-hub / forward-adapter family, #463). Locus webeverything.
