---
type: idea
workItem: story
size: 8
status: open
parent: "746"
blockedBy: ["821"]
locus: frontierui
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

Consumes the deterministic IR→emit generation-adapter core (**#547**, now resolved) — the same machinery as the MaaS server-origin generation (#463/#505/#507), surfaced for *component* targets. Conformance badges consume the cross-language conformance suite (**#506**, resolved). The "create your own adapter" path is mostly doc at this point, per the brainstorm.

## Emitter targets — verified absent, substrate decision filed (#810 → #811)

**Answered (2026-06-16, batch-2026-06-16).** #810 verified the emitter surface against the tree: forward
per-framework component emitters **do not exist**, and no existing neutral substrate forward-emits to them
(#547 is server-origin generation off `ServePathIR` — wrong axis; the upgrader `ComponentIR` is ingest-only
and emits the WE declarative form; `htmlToJsx` is a tree-level JSX *pane* mirror). So this panel is **not**
a "consume #547 for components" build — it's gated on choosing the forward-emit substrate first. That fork
is now **#811** (decide substrate + per-framework emitter architecture), and this item is `blockedBy: [811]`.
Once #811 resolves, the emitter build is a separate focused item. Large feature regardless; not a batch tail.

## Resolved + re-homed (2026-06-16, #811 ruling)

**#811 resolved** and its per-fork classification exposed a **layer seam** in this item, so it has been
re-homed and split (mirroring #755):

- **This item is the FUI-owned panel** — `locus: frontierui`. Per parent #746 ("the workbench lives in
  **FUI**; WE embeds it via the #701 `fuiDemo` iframe") and the docs-rendering boundary (WE never renders
  FUI block code), the panel UI + live-test sandbox + badge display are FUI's. WE has no Block Explorer
  implementation; building this panel in WE would cross the boundary.
- **The WE-owned substrate is split out to [#821](/backlog/821-consume-mode-per-framework-wrapper-generator-block-cem-react/)** —
  the consume-mode per-framework wrapper generator (block CEM → React/Vue/… wrapper source). That is the
  genuinely agent-ready slice #811 unblocked; this panel is now `blockedBy: [821]` (the old `blockedBy: 811`
  edge is dropped — #811 is resolved). #701 (the `fuiDemo` iframe) is already resolved, so it is not a
  blocker.
- **Author-mode** idiomatic-source transpilation stays the separate, deferred **#818** (`blockedBy: 753`,
  demand-gated behind this panel's consume-mode probe).

#811's ruling: ship **consume mode first** (CEM-driven wrappers, cheap) as the appetite probe;
author-mode source emit (#818) is gated on demonstrated appetite. Both modes are supported as panel output
tabs (Fork 1 dissolved — support-all-coherent).
