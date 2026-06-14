---
type: issue
workItem: epic
size: 13
status: open
blockedBy: ["590"]
dateOpened: "2026-06-14"
tags: [candidate-standard, rich-text, contenteditable, editing, webediting, graduation, epic]
crossRef: { url: /backlog/590-candidate-standard-rich-text-contenteditable-editing/, label: "Ruling — #590 ratified all seven forks" }
---

# Graduate the rich-text editing standard (webediting project: surface capabilities, engine Protocol, blocks, intents, plugs)

Materialize the seven ratified forks from #590 into standards, in composition order. Stand up a new `webediting` project owning the engine Protocol; add contenteditable/editcontext/sanitizer-api/highlight-api capability ids (+ capabilityMatrix tiers); define the `CustomEditorEngine` Protocol + registry (native-first contenteditable+InputEvent default, structured-node-tree pivot); add the editor Block; the `text-formatting` + `rich-text` intents; and the `CustomSerializerRegistry` (HTML flavor default) + `CustomSanitizerRegistry` (native setHTML + DOMPurify) plugs. Command vocabulary reuses `InputEvent.inputType`; collaboration is out of scope (cross-ref webrealtime). Decomposes into child stories per layer (the chain below).

## Composition order (the `blockedBy` chain to carve into child stories)

1. **Capabilities** — add `contenteditable` / `editcontext` / `sanitizer-api` / `highlight-api` ids to `capabilities.json` + tier them in `capabilityMatrix.json`.
2. **Engine Protocol + native default** — `CustomEditorEngine` contract + `CustomEditorEngineRegistry` (mirror `CustomPositioner`/`CustomPositioningRegistry`), native-first `contenteditable`+`InputEvent` default, **structured-node-tree** internal pivot; thin adapters bridge ProseMirror/Lexical/Slate/Quill. Stand up the new `webediting` project (`projects.json`) as the Protocol's home.
3. **Editor Block** — `blocks.json` + `block-descriptions/`; resolves the engine registry.
4. **Intents** — `text-formatting` (controls axis, composes `droplist`/`popover`/button) + `rich-text` (editable/multiline/read-only surface UX) in `intents.json`.
5. **Plugs** — `CustomSerializerRegistry` (default-less core, HTML flavor default) + `CustomSanitizerRegistry` (native `setHTML` + DOMPurify adapter, composed on the `insertFromPaste` path; confirm `webvalidation` ownership).
6. **Technical Configurator cards** (plateau-app) — engine choice, serialization format, substrate-negotiation policy.

Command vocabulary throughout is `InputEvent.inputType` (reused verbatim). Decorations use the CSS Custom Highlight API by default. Collaboration is **out of scope** — cross-ref [webrealtime](/projects/webrealtime/).
