---
type: decision
status: open
dateOpened: "2026-06-06"
tags: [jsx, adapters, renderer, custom-elements]
relatedReport: reports/2026-06-03-jsx-adapter-feature-mapping.md
relatedProject: webadapters
crossRef: { url: /adapters/jsx-adapter/, label: JSX Adapter }
---

# Decide whether to recover the JSX renderer's auto-define tracking from the plateau prototype

The old `plateau/src/blocks/renderers/jsx-renderer.ts` tracked "undetermined" elements/attributes/comments in WeakMaps so an AutoDefineService could auto-register custom elements discovered in a JSX-rendered tree. The current `blocks/renderers/jsx/JSXRenderer.ts` rewrite deliberately dropped this — it creates plain DOM and leaves registration to the author.

Current recommendation: leave it dropped for the mirror-dialect POC (authors register elements explicitly, matching how HTML works). Alternative held open: reintroduce a lightweight auto-define pass so a JSX tree self-registers its custom elements. This is a sibling to the `injector-domain-concept-carry-forward` decision — both ask whether a plateau concept should be carried into Web Everything.
