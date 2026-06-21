# Content annotation — highlight / comment-on-selection placement survey

Prior-art survey grounding decision [#1408](/backlog/1408-content-annotation-highlight-comment-on-selection-standard-p/)
(verb-axis straggler of [#1390](/backlog/1390-interaction-paradigm-inventory-verb-axis-gap-lens-find-missi/)).
Per design-first step 1, prior art is gathered before the forks are framed so the dimensions reuse
platform vocabulary.

## The concern

Select a span of content and attach something to it — highlight, comment, footnote, suggestion — anchored
so it survives re-render and (ideally) edits. Pervasive (docs, PDFs, review tools, e-readers). The card
asks: is this a WE standard *at all*, and if so its shape — an `annotation` intent (anchor + payload +
overlay), a behavior over text selection, or out-of-scope.

## Native grounding

- **CSS Custom Highlight API** — paint a `Range` with **no DOM mutation**: `new Highlight(range)` →
  `CSS.highlights.set('comment', hl)` → style via `::highlight(comment)`. Generalizes `::selection` /
  `::spelling-error` to arbitrary author ranges; cross-browser as of mid-2025 (Firefox 140 landed it).
  Highlight *rendering* is a solved platform problem.
- **W3C Web Annotation Data Model** (2017 Recommendation) — the canonical anchoring vocabulary: an
  Annotation has a `body` (payload) + a `target` carrying **Selectors** — `TextQuoteSelector` (`exact` +
  `prefix`/`suffix`, content-addressed, survives shifts), `TextPositionSelector` (char offsets, brittle),
  `RangeSelector`, `FragmentSelector` — composed via `refinedBy`, typically stored as *multiple selectors
  at once* for robustness.
- **Range / Selection / StaticRange** — the bridge: user selection → `Range` → (a) paint via Highlight
  API, (b) serialize to W3C selectors for durable storage.
- **Scroll-to-Text-Fragment** (`#:~:text=prefix-,exact,-suffix`, Chrome/Safari/Firefox) — the platform
  already shipped *quote-based anchoring* at the URL layer, plus `::target-text` styling. Strong evidence
  quote anchoring is a first-class native direction.

## Finding 1 (load-bearing) — the anchoring/selector model is the standard, and robust-to-edit anchoring is the unowned residual

[Hypothesis](https://web.hypothes.is/blog/fuzzy-anchoring/) (the reference client) stores each target as a
*bundle* of selectors (Range + TextPosition + TextQuote) and, on load, tries them in order, falling back
to **fuzzy text search** over the quote; an annotation with no resolvable quote becomes an **orphan**.
`TextQuoteSelector` is the foundation. This is exactly what WE owns nothing for: a *durable,
re-render-and-edit-surviving anchor contract*, distinct from both selection (transient) and rich-text
(in-model). Rendering is native; **anchoring robustness is the hard, recurring, unowned problem.**

## Finding 2 — editor-side annotations split on a real axis: marks (in-model) vs decorations (overlay)

ProseMirror/CodeMirror/Remirror converged that comments/highlights modeled as **marks** become part of the
document (positions auto-map through edits, ride undo/collab), whereas **decorations** are an external
overlay. Takeaway: inside an editable surface the anchor can be an in-model mark; over read-only/foreign
content (PDF, published HTML) it must be a selector-anchored external overlay. The annotation contract sits
*above* this mark-vs-decoration impl choice (a `rich-text-editor` engine concern).

## Finding 3 — reference clients + products converge on the W3C model

[RecogitoJS](https://recogito.github.io/) / Annotorious emit and consume W3C Web Annotation JSON
(`target`/`selector`/`body`/`motivation: highlighting | commenting | tagging`); Google Docs / Notion /
Medium all implement the same conceptual shape (select → anchor → attach payload → overlay → reconcile on
mutation). There *is* a canonical vocabulary to adopt, not a design space to invent.

## WE-tree decomposition

- **[we:src/_data/intents/selection.json](../src/_data/intents/selection.json)** — *form/choice* selection
  (`model`, `variant: range` is a numeric slider range), **not** text-range-to-anchor.
- **[we:src/_data/intents/rich-text.json](../src/_data/intents/rich-text.json)** — editable/read-only
  flowed-content surface; `requiresCapabilities` includes `highlight-api`; it decorates ranges *without
  mutating the model* for spellcheck / collaboration cursors — **editor-internal, transient** decoration,
  not a span-anchored persisted payload.
- **[we:src/_data/capabilities/highlight-api.json](../src/_data/capabilities/highlight-api.json)** — the
  Custom Highlight API capability already recorded.
- No intent/block models a span-anchored payload (grep confirms).

**The precise unowned residual:** a **durable span anchor + payload contract** — (1) capture a `Range`, (2)
serialize it to a *robust* W3C selector set, (3) re-resolve to a live Range later incl. fuzzy fallback +
orphan state, (4) carry an arbitrary payload (highlight / comment / footnote / suggestion). Selection gives
the transient Range; rich-text gives in-model editing + ephemeral decoration. **Nothing models the
persisted anchor or the payload binding.** Rendering (Custom Highlight API) and the popover UI (existing
popover/anchor intents) are already covered.

## Recommended placement

- **Fork 1 — in-scope vs out-of-scope:** **in-scope** (~88%). "Out-of-scope / app-specific" is the broken
  branch — it contradicts a native substrate (Custom Highlight API), a W3C Recommendation defining the
  exact vocabulary, `#:~:text=` shipping quote-anchoring into the URL layer, and pervasiveness. The only
  app-specific part is the comment-thread *product* UI, which composes existing intents.
- **Fork 2 — shape:** an **`annotation` (content-annotation) intent** owning the anchor model (W3C selector
  vocabulary) + payload/body + overlay disposition, composing `selection` (capture), `rich-text` (in-model
  mark path when editable), `anchor`/popover (payload UI), and the `highlight-api` capability (paint)
  (~80%). "Fold into `rich-text`" is the broken branch — annotation must work over read-only/foreign
  content (PDF, published HTML) where there is no editable model; binding it to rich-text excludes the
  majority of real targets. A FUI behavior block realizes it (intent + block coexist — not a fork).
- **Fork 3 (dimension, not a fork) — `anchorStrategy`:** `quote | position | bundle`, most-flexible
  default **`bundle`** (most robust, Hypothesis default).

Seams: anchoring (W3C selectors — the load-bearing unowned seam) vs highlight rendering (Custom Highlight
API, native) vs payload/comment UI (composes popover/anchor/rich-text/selection); in-editor mark vs
external overlay is a `rich-text-editor` engine concern *below* the annotation intent. Orphaned-annotation
state is a first-class outcome of failed re-anchoring; `motivation` payload kinds are an open enum.
