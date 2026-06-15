---
type: issue
workItem: epic
status: resolved
blockedBy: ["590"]
dateOpened: "2026-06-14"
dateResolved: "2026-06-15"
graduatedTo: "project:webediting"
tags: [candidate-standard, rich-text, contenteditable, editing, webediting, graduation, epic]
crossRef: { url: /backlog/590-candidate-standard-rich-text-contenteditable-editing/, label: "Ruling — #590 ratified all seven forks" }
---

# Graduate the rich-text editing standard (webediting project: surface capabilities, engine Protocol, blocks, intents, plugs)

Umbrella epic materializing the seven ratified forks from #590 into standards, in composition order. Sliced (2026-06-14, `/slice 618`, [report](/reports/2026-06-14-backlog-split-analysis/)) into **six child stories**, one per ratified layer: editing capabilities → `webediting` project + engine Protocol → `text-formatting`/`rich-text` intents → serializer/sanitizer plugs → editor Block → Technical Configurator cards. After the capabilities slice lands, intents / project+protocol / plugs fan out in parallel. Command vocabulary reuses `InputEvent.inputType`; collaboration is out of scope (cross-ref webrealtime). See the children for per-layer scope; the composition order below is the carved DAG.

## Composition order (the `blockedBy` chain to carve into child stories)

1. **Capabilities** — add `contenteditable` / `editcontext` / `sanitizer-api` / `highlight-api` ids to `capabilities.json` + tier them in `capabilityMatrix.json`.
2. **Engine Protocol + native default** — `CustomEditorEngine` contract + `CustomEditorEngineRegistry` (mirror `CustomPositioner`/`CustomPositioningRegistry`), native-first `contenteditable`+`InputEvent` default, **structured-node-tree** internal pivot; thin adapters bridge ProseMirror/Lexical/Slate/Quill. Stand up the new `webediting` project (`projects.json`) as the Protocol's home.
3. **Editor Block** — `blocks.json` + `block-descriptions/`; resolves the engine registry.
4. **Intents** — `text-formatting` (controls axis, composes `droplist`/`popover`/button) + `rich-text` (editable/multiline/read-only surface UX) in `intents.json`.
5. **Plugs** — `CustomSerializerRegistry` (default-less core, HTML flavor default) + `CustomSanitizerRegistry` (native `setHTML` + DOMPurify adapter, composed on the `insertFromPaste` path; confirm `webvalidation` ownership).
6. **Technical Configurator cards** (plateau-app) — engine choice, serialization format, substrate-negotiation policy.

Command vocabulary throughout is `InputEvent.inputType` (reused verbatim). Decorations use the CSS Custom Highlight API by default. Collaboration is **out of scope** — cross-ref [webrealtime](/projects/webrealtime/).

**Graduated to** `project:webediting` — all 6 slices resolved — #628 capabilities, #629 project+engine protocol, #630 intents, #631 plugs, #632 editor block, #633 configurator cards.
