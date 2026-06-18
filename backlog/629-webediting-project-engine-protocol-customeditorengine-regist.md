---
type: issue
workItem: story
size: 3
parent: "618"
status: resolved
blockedBy: ["628"]
dateOpened: "2026-06-14"
dateStarted: "2026-06-14"
dateResolved: "2026-06-14"
graduatedTo: "project:webediting + protocol:editor-engine + plug:customeditorengine/customeditorengineregistry"
tags: []
---

# webediting project + engine Protocol — CustomEditorEngine registry, native-first contenteditable default

Stand up the new webediting project (we:src/_data/projects.json, mirror the webvalidation entry) as the home for the rich-text editing engine Protocol, register that Protocol in we:src/_data/protocols.json (ownedByProject: webediting; anchor section in the project partial), and add the CustomEditorEngine + CustomEditorEngineRegistry plugs to we:src/_data/plugs.json (mirror CustomPositioner/CustomPositioningRegistry at L293). Native-first contenteditable+InputEvent default; structured-node-tree internal pivot; thin ProseMirror/Lexical/Slate/Quill adapters. #590 Fork 2 (ratified). Blocked by #628 (surface caps). Renders on /projects/ + /protocols/.

## Progress

Blocker #628 resolved this batch (the editing-surface capabilities), so this stood up the webediting standard surface:

- **Project** `webediting` in [we:src/_data/projects.json](/src/_data/projects.json) (mirroring webvalidation) + icon `src/assets/icons/webediting.svg` + the project partial [we:src/_includes/project-webediting.njk](/src/_includes/project-webediting.njk) (Mission + the Editor Engine Protocol section with the `protocol-editor-engine` anchor).
- **Protocol** `editor-engine` ("Editor Engine") in [we:src/_data/protocols.json](/src/_data/protocols.json) — `ownedByProject: webediting`, native-first contenteditable+InputEvent default (editcontext upgrade) over a structured-node-tree pivot, library adapters behind one contract; explicitly *not* the formatting UX (#630) or serializer registry (#631). #590 Fork 2.
- **Plugs** `customeditorengine` (base contract — `attach()` + capability negotiation) + `customeditorengineregistry` (`window.customEditorEngine` injector-chain registry), mirroring CustomPositioner/CustomPositioningRegistry, each with a plug-description partial.
- Gate: `check:standards` 0 errors · /projects/webediting/ + /plugs/customeditorengine/ render (200); the protocol surfaces at /projects/webediting/#protocol-editor-engine (protocols have no standalone page — the established convention). Commit → webeverything.
