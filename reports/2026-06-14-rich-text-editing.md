# Rich-text / contenteditable editing — prior-art survey & fork grounding

**Date**: 2026-06-14
**Point**: The web has *no* monolithic "rich-text editor" platform standard — it ships orthogonal primitives (the editing **surface**, an **operation vocabulary**, **sanitization**, **decorations**) and leaves the **document model** to incompatible vendor engines. So WE should standardize rich-text editing as *separate, composable* standards along a substrate → engine → formatting → serialization seam — not one editor component — with the document model as an **engine-provider Protocol** (the one place "many vendors interoperate / swap engines" is genuinely true).
**Backlog item**: [we:backlog/590-candidate-standard-rich-text-contenteditable-editing.md](../backlog/590-candidate-standard-rich-text-contenteditable-editing.md)
**Research page**: `/research/rich-text-editing/`

---

## Question

Whitespace surfaced by [#370](../backlog/370-candidate-standard-expressive-symbols-reactions-emoji-sticke.md) Fork 4: the repo has no rich-text / contenteditable / WYSIWYG editing standard — only the `input` intent ([we:intents.json:1108](../src/_data/intents.json#L1108)) and `type-ahead` ([we:intents.json:1439](../src/_data/intents.json#L1439)) cover single-line text + search. How does WE standardize rich-text editing — the editing substrate, the document model, the format/command vocabulary, the toolbar UX, paste/sanitization, and serialization — and where does each piece live in the constellation (intent / block / protocol / capability / plug)?

## Recommendation (the prepared default, not a ratified ruling)

**Decompose, don't monolith.** No first-class precedent ships rich-text editing as one component; every serious library is architecturally layered (ProseMirror's `model`/`state`/`view`/`transform` packages; Lexical's headless `core` + `nodes`; the universal "headless engine vs UI" split). So WE standardizes it as **separate composable standards** along the seam the platform itself draws:

| Axis (orthogonal concern) | Platform primitive | WE layer | Prepared default |
|---|---|---|---|
| **Editing surface** (where keystrokes land, IME) | `contenteditable` (Baseline 2015) · EditContext API (Chromium 121+, *not* Baseline) | **Capability** (tiered) | contenteditable **floor** + EditContext **capability-upgrade**, auto-negotiated (the webrealtime transport pattern) |
| **Document model** (the data; engine) | *none — vendor-specific* (ProseMirror schema · Lexical nodes · Slate tree · Quill Delta/Parchment · ADF) | **Protocol + adapters** | `CustomEditorEngine` contract + registry; native-first default drives contenteditable+InputEvent; adapters bridge the libs |
| **Operation vocabulary** (the commands) | `InputEvent.inputType` / `beforeinput` (W3C Input Events, Baseline) | reuse, no new vocab | reuse `formatBold` / `insertOrderedList` / … verbatim |
| **Formatting UX** (toolbar/controls) | — (composed of buttons/popovers) | **Intent** (`text-formatting`) | separate intent, composed by the editor; toolbar composes droplist/popover |
| **Paste / sanitization** (ingestion) | HTML Sanitizer API / `Element.setHTML()` (emerging; Firefox-nightly only) | **Plug** (registry + adapter) | native `setHTML` default, DOMPurify adapter — a standalone sanitization seam the editor composes |
| **Serialization** (output boundary) | HTML (native) · Markdown · portable JSON (ADF/Delta) | **Config-extends-platform-default** registry | default-less `CustomSerializerRegistry`; platform flavor default = HTML |
| **Decorations** (non-destructive marks) | CSS Custom Highlight API (Baseline 2024) | supported by default | engine uses Highlight API for collab cursors / search / spellcheck without DOM mutation |
| **Collaboration** (multi-cursor sync) | CRDT (Yjs) + awareness | **out of scope** | cross-ref [webrealtime](../src/_data/projects.json) — non-fungible with editing, like #370 cross-ref'd sync-transport |

The load-bearing finding: **the document model is the only axis with a genuine swappable-vendor story**, and therefore the only one that earns a Protocol (design-first §"which layer" Q2: a Protocol is justified *only* when many vendors must interoperate or swap engines). Every other axis is either a native primitive WE reuses (surface, commands, decorations), a thin composition (formatting UX, sanitization), or an open config setting (serialization). This mirrors [#370](../backlog/370-candidate-standard-expressive-symbols-reactions-emoji-sticke.md)'s provider→consumer split and the `CustomPositioningRegistry` precedent ([we:plugs.json:293](../src/_data/plugs.json#L293)) exactly.

## Key findings

### 1 — There is no monolithic editing standard; the platform ships primitives

- **`contenteditable`** is the only Baseline editing surface (widely available since July 2015; `plaintext-only` became Baseline 2025-03). It is notoriously inconsistent across browsers for *structured* editing — every serious editor intercepts `beforeinput` and manages its own model rather than trusting the DOM the browser produces.
- **EditContext API** (Chrome/Edge 121, Jan 2024) decouples text input (IME composition, emoji picker, on-screen keyboards) from the DOM, letting an editor own its model cleanly. **Not Baseline** — Chromium-only; no Safari/Firefox. So it is a *progressive upgrade*, not a floor.
- **`document.execCommand`** — the legacy formatting API — is **deprecated** and was never reliable; no modern editor uses it. Its *replacement* is not a new command API but the **`InputEvent.inputType`** vocabulary on `beforeinput`.

### 2 — The standardized operation vocabulary already exists: `InputEvent.inputType`

W3C [Input Events](https://w3c.github.io/input-events/) enumerates the exact editing-operation set as `beforeinput`/`input` `inputType` values — `insertText`, `insertParagraph`, `insertOrderedList`, `insertUnorderedList`, `deleteContentBackward`, `historyUndo`/`historyRedo`, and the `format*` family (`formatBold`, `formatItalic`, `formatUnderline`, `formatStrikeThrough`, `formatJustifyCenter`, `formatIndent`, `formatBackColor`, `formatSetBlockTextDirection`, …). This *is* the platform's command vocabulary. Native-first: WE reuses it verbatim rather than coining `we-bold` names — the same "borrow the platform's official vocabulary" rule already applied to `aria-sort` / `Intl.Collator`.

### 3 — Every engine has an incompatible document model — this is the swappable-vendor axis

| Engine | Document model | Schema | Output format |
|---|---|---|---|
| **ProseMirror** | structured node tree, strict **schema** (nodes + marks) | enforced | ProseMirror doc JSON / HTML |
| **Lexical** (Meta) | node-based, immutable EditorState | node registry | JSON / HTML; optimized for 100k+ words |
| **Slate** | nested JSON tree (domain-model-first) | optional | custom JSON |
| **Quill** | **Parchment** (blots) + flat **Delta** op-list | blot registry | Delta JSON / HTML |
| **TipTap** | (ProseMirror under the hood) | ProseMirror schema | HTML / JSON |
| **CKEditor 5** | custom model + Operational Transform | model schema | HTML |
| **Atlassian** | **ADF** (Atlassian Document Format) — block + inline nodes, JSON | ADF schema | ADF JSON |
| **Microsoft roosterjs** | DOM-as-model (lighter) | none | HTML |

The field splits two ways: a **structured node tree** (ProseMirror / Lexical / Slate / ADF — block + inline nodes + marks) vs a **flat op-list** (Quill Delta). The tree shape is the broad consensus for documents; Delta wins for change-tracking/OT. This is exactly the "many vendors, real swap value, no interop today" condition that warrants a **normalization-hub Protocol**: a `CustomEditorEngine` contract whose native-first default drives contenteditable+InputEvent, with thin adapters bridging ProseMirror/Lexical/etc. — *one* engine resolved through the injector chain, never bundled per-vendor. The internal pivot model (the lossy WE shape the project never sees raw) leans tree-shaped, with the tree-vs-Delta choice flagged **low-confidence / divergent across libraries** (the #64-Fork-4 analogue).

### 4 — Sanitization is a cross-cutting security primitive, not an editor-only concern

The **HTML Sanitizer API** (`Element.setHTML()`) is the native primitive for cleaning untrusted/pasted HTML; its config *further restricts* a safe-by-default baseline (unsafe nodes are always stripped). But it is **emerging** — Firefox-nightly only as of late 2025 — so DOMPurify remains the production floor. Crucially, *any* HTML sink needs sanitization, not just editors (the "a concept that recurs without its neighbour earns its own home" test). So it is a **standalone sanitization plug** (`CustomSanitizerRegistry`: native `setHTML` default + DOMPurify adapter) the editor *composes* on the `insertFromPaste` path — not an editor-internal method.

### 5 — Decorations & collaboration are composed, not forked

- **CSS Custom Highlight API** (Baseline 2024) renders non-destructive ranges (search highlights, spellcheck squiggles, remote collaborators' cursors/selections) *without* mutating the DOM — the modern replacement for wrapper `<span>`s. The engine uses it by default; not a decision.
- **Collaboration** (Yjs/CRDT + the awareness protocol for ephemeral cursor/presence state) is a transport+sync concern, **non-fungible** with the editing surface — it belongs to [webrealtime](../src/_data/projects.json) (collaborative cursors are already named in its scope). Cross-ref and defer, exactly as [#370](../backlog/370-candidate-standard-expressive-symbols-reactions-emoji-sticke.md) cross-ref'd sync-transport to webrealtime.

### 6 — Design-system precedent confirms the split

No general design system (MD3, Carbon, Fluent base) ships a first-class rich-text editor — they stop at `textarea`/`input`. The first-class implementations are **product-platform** editors (Atlassian's ProseMirror-based editor + ADF; Microsoft's roosterjs in Outlook; CKEditor; Meta's Lexical), and *all* of them separate a headless engine/model from the UI shell. The architecture consensus *is* decomposition.

## Architecture mapping (per-fork layer classification)

Running design-first §"which layer" + the 7-question per-fork classification on each axis:

- **Editing surface → Capability.** `contenteditable` (Baseline), `editcontext` (Chromium), plus `sanitizer-api` and `highlight-api` are net-new `we:capabilities.json` ids (none exist today — confirmed by grep). Tiered per impl in `we:capabilityMatrix.json`; the editor declares `requiresCapabilities`. Default = most-permissive floor (`contenteditable`) + capability-gated upgrade.
- **Document model / engine → Protocol** (owned by a **new `webediting` project** — rich-text editing is cross-cutting and attracts its own registries/plugs/blocks, passing the design-first "could it apply outside a host's domain?" test). `CustomEditorEngine` contract + `CustomEditorEngineRegistry`, native-first default, library adapters. *Litmus passed:* genuine multi-vendor swap story → Protocol, not a baked model.
- **Editor → Block.** The runnable element wiring surface + engine + `beforeinput` command handling. Ships code → Block.
- **Formatting UX → Intent** (`text-formatting`): declarative toolbar/controls axis (which `format*` ops are exposed, toolbar placement/overflow) — UX "what" only. Composes droplist/popover/button. Separate from the editing intent (separation bias).
- **Editing UX → Intent** (`rich-text` / `text-editing`): declarative "editable multiline surface" contract (editable, multiline, placeholder, read-only) — UX only; output format is *technical* → Configurator, never a UX dimension.
- **Serialization → Config-extends-platform-default** registry (`CustomSerializerRegistry` plug): default-less core, open registry, platform flavor default = HTML. Collapses "which format" to "what's the flavor default" — a one-line ratify (the #370-Fork-6 pattern).
- **Sanitization → Plug** (`CustomSanitizerRegistry`: native `setHTML` + DOMPurify adapter). Standalone, composed on paste.
- **At graduation:** Technical Configurator cards for engine choice, serialization format, and substrate-negotiation policy; collaboration transport cross-ref'd to webrealtime.

## Web-standards alignment

| Standard | Status | How WE adopts it |
|---|---|---|
| [contenteditable](https://developer.mozilla.org/en-US/docs/Web/Guide/HTML/Editable_content) | Baseline 2015 (`plaintext-only` 2025) | The editing-surface floor; capability `contenteditable`. |
| [EditContext API](https://developer.mozilla.org/en-US/docs/Web/API/EditContext_API) | Chromium 121 (not Baseline) | Capability-gated upgrade for IME/decoupled input; graceful degradation to contenteditable. |
| [Input Events (`inputType`)](https://w3c.github.io/input-events/) | Baseline | The reused operation vocabulary — `format*` / `insert*` / `delete*` / `history*`, verbatim. |
| [HTML Sanitizer API (`setHTML`)](https://wicg.github.io/sanitizer-api/) | Emerging (FF-nightly) | Native default of the sanitization plug; DOMPurify adapter as the production floor. |
| [CSS Custom Highlight API](https://developer.mozilla.org/en-US/docs/Web/API/CSS_Custom_Highlight_API) | Baseline 2024 | Non-destructive decorations (search/spellcheck/remote cursors); used by default. |
| [Selection API](https://developer.mozilla.org/en-US/docs/Web/API/Selection) / Range | Baseline | Selection/range model the engine reads. |

## Files created/modified

| File | Action |
|---|---|
| `we:reports/2026-06-14-rich-text-editing.md` | Created (this report) |
| `we:src/_data/researchTopics.json` | Added `rich-text-editing` topic entry |
| `we:src/_includes/research-descriptions/rich-text-editing.njk` | Created research write-up |
| `we:backlog/590-candidate-standard-rich-text-contenteditable-editing.md` | Rewritten to prepared-fork shape; `preparedDate` set |

## Sources

- [EditContext API — MDN](https://developer.mozilla.org/en-US/docs/Web/API/EditContext_API) · [Introducing EditContext — Chrome for Developers](https://developer.chrome.com/blog/introducing-editcontext-api) · [contenteditable plaintext-only Baseline — web.dev](https://web.dev/blog/contenteditable-plaintext-only-baseline)
- [Input Events Level 2 — W3C](https://w3c.github.io/input-events/) · [InputEvent.inputType — MDN](https://developer.mozilla.org/en-US/docs/Web/API/InputEvent/inputType)
- [HTML Sanitizer API — WICG](https://wicg.github.io/sanitizer-api/) · [Why the Sanitizer API is just setHTML() — Frederik Braun](https://frederikbraun.de/why-sethtml.html)
- [Lexical vs Slate vs ProseMirror architecture — jkrsp](https://jkrsp.com/blog/lexical-vs-slate-vs-prosemirror-architecture/) · [Which rich text editor framework should you choose in 2025 — Liveblocks](https://liveblocks.io/blog/which-rich-text-editor-framework-should-you-choose-in-2025) · [Headless vs WYSIWYG — Nutrient](https://www.nutrient.io/blog/headless-vs-wysiwyg/)
- [Atlassian Document Format](https://developer.atlassian.com/cloud/jira/platform/apis/document/structure/) · [microsoft/roosterjs](https://github.com/microsoft/roosterjs) · [CKEditor collaborative editing](https://ckeditor.com/)
- [CSS Custom Highlight API — MDN](https://developer.mozilla.org/en-US/docs/Web/API/CSS_Custom_Highlight_API) · [Yjs collaborative editing / awareness — Liveblocks](https://liveblocks.io/blog/which-rich-text-editor-framework-should-you-choose-in-2025)
