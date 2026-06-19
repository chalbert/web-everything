---
type: idea
workItem: task
parent: "991"
status: resolved
dateOpened: "2026-06-19"
dateStarted: "2026-06-19"
dateResolved: "2026-06-19"
graduatedTo: none
tags: []
---

# Verify webediting epics (#940 open, #618 resolved) child coverage vs the spec

webediting has an open epic #940 (engine adapters) plus resolved epic #618 and slices #628-633, but no plug/block impl yet. Confirm the children cover the full spec surface (we:src/_includes/project-webediting.njk: contenteditable/EditContext, CustomEditorEngine seam, serializer/sanitizer plugs, text-formatting + rich-text intents); surface any missing slice.

## Outcome (batch-2026-06-18)

Read the spec (`we:src/_includes/project-webediting.njk`) — it is deliberately engine-scoped ("Web
Editing owns the *engine*… not editor UX"); collaboration / undo-redo / IME / paste-handling are **not**
in the spec surface, so they are not gaps. Mapped every spec area to a tracked item — **coverage is
complete, the resolutions were correct, no missing slice to surface:**

- contenteditable / EditContext editing-surface capabilities → #628 (resolved).
- CustomEditorEngine seam / Editor Engine Protocol → #629 (resolved; native-first contenteditable default).
- serializer / sanitizer plugs (CustomSerializerRegistry + CustomSanitizerRegistry) → #631 (resolved).
- text-formatting + rich-text editable-surface intents → #630 (resolved).
- editor Block + Technical Configurator cards → #632 / #633 (resolved).
- engine adapters (ProseMirror / Lexical / Slate / Quill) → epic **#940 (correctly open)**: Quill #960 ✓,
  Slate #969 ✓ (+ demo-wiring #989 open), Lexical #961 open, ProseMirror #962 open. All four named
  engines are already sliced; nothing missing.

`#940` is appropriately open (3 adapter slices remain). The "no plug/block impl yet" premise in the task
title is **stale** — #631 (plugs) and #632 (block) shipped. No new item created.
