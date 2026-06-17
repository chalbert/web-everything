---
type: issue
workItem: story
size: 3
status: open
parent: "746"
relatedProject: webdocs
dateOpened: "2026-06-16"
crossRef: { url: /backlog/821-consume-mode-per-framework-wrapper-generator-block-cem-react/, label: "Wrapper generator (#821)" }
tags: [webdocs, cem, blocks, adapters, api-viewer]
---

# Enrich block CEM with tagName + attributes/properties/slots so wrappers/api-viewer get a real custom-element surface

The wrapper generator (#821) and every structural CEM consumer (api-viewer, Storybook, polyglot panel #753) need custom-element declarations, but src/_data/blocks.json carries no tagName/attributes/properties/slots — so gen-cem.mjs emits 0 custom-element declarations (class+events only) and the generator has no real block to wrap. Enrich blocks.json (or derive) with a tagName + attribute/property/slot surface so gen:cem projects real custom-element declarations. Open call: gen-cem never fabricates a tag (registryName is a DI class, not a tag) — decide the tag convention (e.g. `fui-<id>`) and whether the surface lives in WE blocks.json or is sourced from FUI. Unblocks real-block wrapping for #753.
