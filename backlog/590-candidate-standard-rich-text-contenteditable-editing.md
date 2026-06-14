---
type: decision
workItem: story
size: 5
status: resolved
dateOpened: "2026-06-14"
dateStarted: "2026-06-14"
dateResolved: "2026-06-14"
graduatedTo: none
preparedDate: "2026-06-14"
tags: [candidate-standard, rich-text, contenteditable, editing, intent, protocol, decision]
relatedReport: reports/2026-06-14-rich-text-editing.md
crossRef: { url: /backlog/370-candidate-standard-expressive-symbols-reactions-emoji-sticke/, label: "Origin — #370 Fork 4 surfaced this gap" }
---

# Decision — Rich-text / contenteditable editing: how WE standardizes the editor

No design exists yet. The repo has no rich-text/contenteditable/WYSIWYG editing standard — only `input` ([intents.json:1108](src/_data/intents.json#L1108)) and `type-ahead` ([intents.json:1439](src/_data/intents.json#L1439)) cover single-line text + search (whitespace surfaced by [#370](/backlog/370-candidate-standard-expressive-symbols-reactions-emoji-sticke/) Fork 4). The seven forks below are grounded in a prior-art survey **published as [/research/rich-text-editing/](/research/rich-text-editing/)** (report via `relatedReport`). The load-bearing result: **the web ships no monolithic editor** — only orthogonal primitives — and leaves the **document model** to incompatible vendor engines, so WE decomposes editing into **separate composable standards**, with the model as the **one Protocol** (the only swappable-vendor axis). Each fork carries a **bold** default; only Fork 2 needs real judgment.

## Axis framing

The survey decomposes "rich-text editing" into orthogonal axes along a **surface → engine → formatting → serialization** seam, each pinned to the real tree and to the platform primitive that fixes its layer:

- **Editing surface** — the substrate keystrokes/IME land on. `contenteditable` (Baseline 2015) is the floor; EditContext (Chromium 121, *not* Baseline) is a capability-upgrade. None of these are in `capabilities.json` yet (only `popover`/`anchor-positioning`/`field-sizing`/… exist — see [capabilities.json](src/_data/capabilities.json)), so they are **net-new capabilities**.
- **Document model** — the data. *No platform standard* — every engine differs (ProseMirror schema, Lexical nodes, Slate tree, Quill Delta, ADF). This is the swappable-vendor axis → a Protocol mirroring `CustomPositioningRegistry` ([plugs.json:293](src/_data/plugs.json#L293)).
- **Operation vocabulary** — the commands. W3C Input Events already standardizes them as `InputEvent.inputType` (`formatBold`, `insertOrderedList`, …); `execCommand` is deprecated. Reuse, don't coin.
- **Formatting UX** — the toolbar/controls. A declarative axis composing the `droplist` ([blocks.json:17](src/_data/blocks.json#L17)) / `autocomplete` ([blocks.json:82](src/_data/blocks.json#L82)) blocks + the `popover` capability.
- **Paste / sanitization** — ingestion. HTML Sanitizer `setHTML` (emerging) is the native primitive; a cross-cutting security concern (any HTML sink needs it), so a standalone plug, not an editor method.
- **Serialization** — the output boundary (HTML / Markdown / portable JSON). A config-extends-platform-default registry, default-less core.
- **Decorations** (CSS Custom Highlight API, Baseline 2024) and **collaboration** (Yjs/CRDT, cross-ref [webrealtime](src/_data/projects.json) — `projects.json:325`) are **not forks** — supported-by-default and out-of-scope respectively (see Context).

## Recommended path at a glance

| Fork | Recommended default | Main alternative | Confidence |
|---|---|---|---|
| 1 · Decomposition | **Separate composable standards (surface→engine→formatting→serialization)** | One monolithic "rich-text editor" component | High |
| 2 · Document model | **Engine-provider Protocol + adapters** (`CustomEditorEngine`, native-first contenteditable+InputEvent default) | Baked single model / no swap protocol | Med |
| 3 · Editing surface | **contenteditable floor + EditContext capability-upgrade, auto-negotiated** | Mandate one substrate (EditContext drops Safari/FF) | Med-high |
| 4 · Command vocabulary | **Reuse `InputEvent.inputType` verbatim** | Coin WE command names | High |
| 5 · Formatting UX home | **Separate `text-formatting` intent, composed by the editor** | Fold the toolbar into the editing intent | Med-high |
| 6 · Serialization output | **Open `CustomSerializerRegistry`, HTML flavor default** | Mandate one output format | High |
| 7 · Paste / sanitization | **Standalone sanitization plug (native `setHTML` + DOMPurify adapter), composed on paste** | Own sanitization inside the editor | Med-high |

Forks 1, 4, 6 are near-ratification (High). 3, 5, 7 lean clearly (Med-high). **Fork 2 is the real call** (Med) — does the document model become a Protocol now? — and its *internal pivot-model shape* (structured tree vs flat Delta) is the **divergent-across-libraries** sub-call (the #64-Fork-4 analogue).

## Fork 1 — One monolithic editor, or separate composable standards?

**Crux:** model rich-text editing as one "rich-text editor" component, or as separate standards along the surface→engine→formatting→serialization seam.

- **A — One component.** A single `rich-text-editor` standard owning surface + model + toolbar + paste + output. *Tradeoff:* one home to find, but couples concerns that recur independently — you sanitize HTML with no editor; you render a formatting toolbar over a code editor; you serialize a doc model server-side with no UI — and no surveyed library is built this way.
- **B — Separate composable standards.** Surface (Capability) → engine (Protocol) → formatting (Intent) → serialization (registry) → sanitization (Plug), each composable alone. *Merit:* matches the universal "headless engine vs UI" split (ProseMirror's `model`/`state`/`view`/`transform` packages; Lexical's headless core + nodes), and the `/intents` + `CustomPositioningRegistry` composition idiom WE already uses.

**Recommended: B — separate.** The standing bias is separation (burden of proof on combining), and the entire editor field is architecturally layered; no general design system ships a monolithic editor at all. *Rejected:* A — combining buys no concrete benefit and forecloses composing each axis (a sanitizer, a serializer, a toolbar) outside an editor.

## Fork 2 — Document model: an engine-provider Protocol, or a baked model?

**Crux:** is the document model a **Protocol** independent engines satisfy (so a project swaps ProseMirror ⇄ Lexical ⇄ the native default behind one contract), or a single baked WE model with libraries as optional enhancements?

- **A — Baked single model.** WE defines one document model; libraries, if used at all, are bolted on. *Tradeoff:* simplest to specify, but forecloses the interop the whole field demonstrates — every serious editor has its own incompatible model, and a project that outgrows the native default (e.g. needs ProseMirror for collab) would have to abandon the standard rather than swap a provider.
- **B — Engine-provider Protocol + adapters.** A `CustomEditorEngine` contract + `CustomEditorEngineRegistry` (mirroring `CustomPositioner`/`CustomPositioningRegistry`, [plugs.json:293-306](src/_data/plugs.json#L293-L306)); the native-first default drives `contenteditable` + `InputEvent`; thin adapters bridge ProseMirror/Lexical/Slate/Quill. The editor block resolves the registry — the app ships *one* engine, never bundles per-vendor. *Merit:* this is the exact "many vendors must interoperate or swap engines" condition design-first §Q2 reserves a Protocol for, and the adapter-as-normalization-hub philosophy (a lossy internal pivot the project never sees raw) fits editor models precisely.

**Recommended: B — engine-provider Protocol.** Editors are the textbook swappable-vendor axis, and WE already proved the pattern for positioning. *Rejected:* A — a baked model re-invents one engine and forecloses the swap that is the only reason to standardize the model layer at all. *(The "ship native-only first, add the Protocol later" worry is **prioritization, not a fork** — the on-merit end-state is the Protocol; build sequencing is normal burndown ordering.)*

**Sub-decision (the divergent call) — internal pivot-model shape.** The normalized WE model is a **structured node tree** (block + inline nodes + marks — the ProseMirror/Lexical/Slate/ADF consensus). The alternative is a **flat op-list** (Quill Delta), which wins for change-tracking/OT but is awkward for nested documents. **Ratified default: structured tree, confidence Med-high** (upgraded from the prepared "Low — divergent" at ratification). Two reasons resolve what looked like an even split: (1) the **normalization-hub lens** — a structured tree is the *superset* (a flat Delta doc is a degenerate tree, so ingesting Quill loses nothing, while flattening a nested ADF/ProseMirror doc loses structure), so the pivot should be the most-expressive common model for lossless ingest from the richest engines; and (2) Delta's **only real advantage — OT/change-tracking — is out of scope here**, cross-ref'd to [webrealtime](/projects/webrealtime/) (see Out of scope). With its sole counterweight removed, structured-tree wins cleanly rather than narrowly.

## Fork 3 — Editing surface: mandate one, or capability-negotiate?

**Crux:** which substrate does the editor edit on — and is it fixed or negotiated?

- **A — Mandate EditContext.** Cleanest model-decoupling and best IME story. *Tradeoff:* Chromium-only (Chrome/Edge 121, Jan 2024) — **drops Safari and Firefox entirely**; not Baseline. A mandated EditContext substrate is a broken end-state for a cross-browser standard.
- **B — contenteditable floor + EditContext capability-upgrade, auto-negotiated.** `contenteditable` (Baseline since 2015) is the universal floor; where `editcontext` is present the engine upgrades to it for IME/decoupled input; graceful degradation otherwise. *Merit:* most-permissive default (the floor works everywhere, the restriction/upgrade is opt-in/auto), and it mirrors the **webrealtime transport-negotiation pattern** ([projects.json:325](src/_data/projects.json#L325)) — declare the capability, let the provider pick the best available.

**Recommended: B — capability-negotiated, contenteditable floor.** `contenteditable` (+ `editcontext`, `sanitizer-api`, `highlight-api`) are added to `capabilities.json` and tiered in `capabilityMatrix.json`. *Rejected:* A — mandating a Chromium-only surface fails the cross-browser invariant.

## Fork 4 — Command vocabulary: reuse the platform's, or coin WE's?

**Crux:** name editing operations (bold, insert-list, undo) with WE-specific commands, or reuse the standardized `InputEvent.inputType` vocabulary.

- **A — Coin WE command names.** A `we-*` command set. *Tradeoff:* full control, but re-invents a vocabulary the platform already standardizes, diverging from `beforeinput` and every editor that listens to it.
- **B — Reuse `InputEvent.inputType` verbatim.** W3C Input Events already enumerates `insertText` / `insertParagraph` / `insertOrderedList` / `deleteContentBackward` / `historyUndo` / the `format*` family — the canonical command set on `beforeinput`. *Merit:* native-first; the same "borrow the platform's official vocabulary" rule already applied to `aria-sort` / `Intl.Collator`; commands map 1:1 to the events the surface already fires.

**Recommended: B — reuse `InputEvent.inputType`.** *Rejected:* A — coining a parallel vocabulary is lock-in for zero gain when the platform set is complete and already wired to `beforeinput`.

## Fork 5 — Formatting UX: its own intent, or folded into the editing intent?

**Crux:** does the toolbar/controls UX (which `format*` ops are exposed, placement, overflow) live as a dimension of the editing intent, or as its own `text-formatting` intent the editor composes?

- **A — Fold into the editing intent.** One `rich-text` intent with a formatting dimension. *Tradeoff:* one home, but the formatting-controls axis recurs without an editor (a markdown preview's format bar, a comment box's bold/italic affordances) and couples a controls concern to the editing-surface concern.
- **B — Separate `text-formatting` intent.** A declarative intent owning the controls axis, composed by the editor (and reusable elsewhere); the toolbar composes `droplist`/`popover`/button. *Merit:* separation bias — a concept that recurs without its neighbour earns its own home — and it keeps the editing intent's axis (editable/multiline/read-only) uncontaminated by a controls vocabulary.

**Recommended: B — separate `text-formatting` intent.** *Rejected:* A — folding couples two independently-recurring axes for no composition benefit.

## Fork 6 — Serialization output: mandate one format, or open registry?

**Crux:** does the standard mandate one output format (HTML? Markdown? portable JSON?), or expose serialization as an open setting.

- **A — Mandate one format.** Pick HTML (or Markdown, or a portable JSON like ADF) as *the* output. *Tradeoff:* simple, but every consumer has a different boundary need (HTML for display, Markdown for storage, ADF/Delta for portability/OT), so a single mandate is wrong for most of them.
- **B — Open `CustomSerializerRegistry`, platform flavor default.** Default-less core + an open serializer registry; the "sensible default" (HTML — web-native, round-trips with contenteditable) lives in the **platform flavor**, not the standard. *Merit:* this is the **Config-Extends-Platform-Default** shape — a locked format and a free-for-all both become *configurations* of the registry, and the fork shrinks to "what's the flavor default," a one-line ratify (the #370-Fork-6 pattern).

**Recommended: B — open registry, HTML flavor default.** *Rejected:* A — mandating one output format on a default-less standard contradicts Config-Extends-Platform-Default and serves only one consumer's boundary.

## Fork 7 — Paste & sanitization: standalone plug, or editor-owned?

**Crux:** is HTML sanitization an editor-internal method, or a standalone standard the editor composes on paste.

- **A — Editor-owned.** The editor block sanitizes pasted HTML itself. *Tradeoff:* convenient, but sanitization is a cross-cutting **security** primitive — *any* HTML sink needs it (a comment renderer, a CMS preview, a markdown-to-HTML pipeline), not just editors — so burying it inside the editor hides a reusable concern.
- **B — Standalone sanitization plug.** A `CustomSanitizerRegistry` (native `Element.setHTML()` default — its config *further restricts* a safe-by-default baseline — + a DOMPurify adapter as the production floor while `setHTML` is still emerging), composed by the editor on the `insertFromPaste` path. *Merit:* separation bias (recurs without an editor → own home), native-first default, and an escapable single lock (adapter-swappable).

**Recommended: B — standalone plug, composed on paste.** *Rejected:* A — owning sanitization inside the editor duplicates a security primitive every HTML sink needs. *(Ownership: the plug likely lives under a security/validation neighbour — `webvalidation` exists at [projects.json:168](src/_data/projects.json#L168) — to be confirmed at graduation; default is a dedicated sanitization seam either way.)*

---

## Ruling (ratified 2026-06-14)

**All seven forks ratified at their bold defaults.** WE decomposes rich-text editing into separate composable standards along the surface→engine→formatting→serialization seam — no monolithic editor.

1. **Decomposition** → B: separate composable standards.
2. **Document model** → B: engine-provider Protocol (`CustomEditorEngine` + `CustomEditorEngineRegistry`, mirroring `CustomPositioningRegistry`), native-first `contenteditable`+`InputEvent` default, thin adapters for ProseMirror/Lexical/Slate/Quill; app ships one engine. The "native-only first" sequencing is prioritization, not a branch. **Internal pivot-model: structured node tree, Med-high** (upgraded from Low — the normalization-hub superset argument + OT being out-of-scope remove Delta's only counterweight; see Fork 2 sub-decision).
3. **Editing surface** → B: `contenteditable` floor + `editcontext` capability-upgrade, auto-negotiated.
4. **Command vocabulary** → B: reuse `InputEvent.inputType` verbatim.
5. **Formatting UX** → B: separate `text-formatting` intent, composed by the editor.
6. **Serialization** → B: open `CustomSerializerRegistry`, HTML flavor default (default-less core).
7. **Paste/sanitization** → B: standalone `CustomSanitizerRegistry` plug (native `setHTML` + DOMPurify adapter), composed on the `insertFromPaste` path; ownership (likely `webvalidation`) confirmed at graduation.

**Graduates to:** a new `webediting` project owning the engine Protocol (ratified as part of Fork 2). Graduation is a `blockedBy` chain in composition order (capability ids → engine Protocol + native default → editor Block → `text-formatting`/`rich-text` intents → serializer + sanitizer plugs), captured as the spin-off build item below.

## Context

**Per-fork layer classification (the architecture mapping that pre-answers most sub-forks):**

| Element | Layer | Home |
|---|---|---|
| Editing surface (contenteditable/EditContext/Sanitizer/Highlight) | **Capability** (net-new ids) | `capabilities.json` + `capabilityMatrix.json` |
| Document model / engine | **Protocol + adapters** | `CustomEditorEngine` + registry; owned by proposed new `webediting` project |
| The editor element | **Block** | `blocks.json` + `block-descriptions/` |
| Formatting toolbar/controls | **Intent** (`text-formatting`) | `intents.json` |
| Editable-surface UX (editable/multiline/read-only) | **Intent** (`rich-text`) | `intents.json` |
| Serialization | **Config-extends-platform-default** registry | `CustomSerializerRegistry` plug + flavor default |
| Paste sanitization | **Plug** | `CustomSanitizerRegistry` (native `setHTML` + DOMPurify adapter) |

**Supported by default (not decisions):**
- **Decorations** — the engine renders non-destructive marks (search highlights, spellcheck squiggles, remote-collaborator cursors/selections) via the **CSS Custom Highlight API** (Baseline 2024) rather than wrapper `<span>`s. Not a fork — used by default.
- **IME / composition** — handled by the editing surface (EditContext's reason to exist); a capability concern, not a separate fork.

**Out of scope (cross-referenced):**
- **Collaboration** (multi-cursor, presence/awareness, CRDT/Yjs) is a transport+sync concern, **non-fungible** with the editing surface — it belongs to [webrealtime](/projects/webrealtime/) (collaborative cursors are already named in its scope, [projects.json:325](src/_data/projects.json#L325)). Cross-ref and defer, exactly as [#370](/backlog/370-candidate-standard-expressive-symbols-reactions-emoji-sticke/) cross-ref'd sync-transport.

**At graduation** (after ratification, via a `blockedBy` chain in composition order): Capability ids → engine Protocol + native default → editor Block → `text-formatting` / `rich-text` intents → serializer + sanitizer plugs. **Technical Configurator cards** (plateau-app) for engine choice, serialization format, and substrate-negotiation policy; collaboration transport cross-ref'd to webrealtime. The proposed new `webediting` project (owning the engine Protocol) is itself ratified as part of Fork 2.

**Prepared:** all seven forks are at the Definition of Ready (options + tradeoffs + bold default, grounded in [/research/rich-text-editing/](/research/rich-text-editing/)). The call belongs to `/next decision`.
