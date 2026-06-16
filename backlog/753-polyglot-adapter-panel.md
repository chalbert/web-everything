---
type: idea
workItem: story
size: 8
status: open
parent: "746"
blockedBy: ["547"]
dateOpened: "2026-06-16"
relatedProject: webdocs
crossRef: { url: /backlog/507-maas-deterministic-generation-adapter-derive-idiomatic-nativ/, label: "Generation-adapter (#507)" }
tags: [webdocs, block-explorer, adapters, polyglot, generation, conformance, ingest]
---

# Polyglot adapter panel — generate the component across frameworks/languages, live-test it, link to authoring your own

Expose the **adapters** in the Block Explorer: a panel that generates this block for each supported target (React/Vue/Svelte/Angular/native WC, plus enterprise .NET/Java/Go from the polyglot line #463/#505/#507) and lets the viewer live-test the generated output in an embedded sandbox — proving fidelity, not just showing code. Each target shows a conformance badge from the deterministic gate. Add "create your own adapter" (doc + scaffold) and a reverse/ingest demo: paste an incumbent component (e.g. a MUI button) → ingest adapter normalizes it to the neutral contract → re-emit as a WE block, showing the normalization-hub value in one move.

## Build

- Output tabs per target consuming the generation-adapter core (#547): emit the component for each supported framework/language.
- Live-test each generated output in an embedded sandbox; show a conformance badge per target (deterministic conformance gate, #506).
- "Create your own adapter": doc + scaffolding template entry.
- Reverse/ingest demo: paste incumbent component → ingest adapter → neutral contract → re-emit as a WE block.

## Acceptance

- [ ] The panel generates the block for ≥2 targets and live-tests each with a conformance badge.
- [ ] The "create your own adapter" doc + scaffold is reachable.
- [ ] The reverse-ingest demo round-trips at least one incumbent component to a WE block.

## Notes

Hard-blocked on **#547** (the deterministic IR→emit generation-adapter core) — the component panel consumes the same machinery as the MaaS server-origin generation (#463/#505/#507), surfacing it for *component* targets. Conformance badges consume the cross-language conformance suite (#506). The "create your own adapter" path is mostly doc at this point, per the brainstorm.
