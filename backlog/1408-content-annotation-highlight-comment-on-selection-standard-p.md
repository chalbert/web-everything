---
kind: decision
size: 3
parent: "099"
status: resolved
dateOpened: "2026-06-21"
dateStarted: "2026-06-21"
dateResolved: "2026-06-21"
graduatedTo: none
codifiedIn: "docs/agent/platform-decisions.md#intents-ux-only"
tags: [decision, book-candidate, annotation, highlight, selection, gap]
relatedReport: reports/2026-06-21-content-annotation-anchor-payload.md
preparedDate: "2026-06-21"
---

# Content annotation — highlight / comment-on-selection standard: placement

Verb-axis straggler (completeness sweep of [#1390](/backlog/1390-interaction-paradigm-inventory-verb-axis-gap-lens-find-missi/)):
select a span of content and attach something to it — highlight, comment, footnote, suggestion — anchored
so it survives re-render and (ideally) edits ([prior-art survey](/research/content-annotation-anchor-payload/)).
A pervasive pattern (docs, PDFs, review tools, e-readers) WE owns nothing for.

The axis the prep pins to the real tree: the **anchoring/selector model is the standard**, and
**robust-to-edit anchoring is the unowned residual**. Highlight *rendering* is a solved native problem
(CSS Custom Highlight API — `new Highlight(range)` → `CSS.highlights` → `::highlight()`, cross-browser
mid-2025), and the W3C **Web Annotation Data Model** already defines the canonical vocabulary (`body` +
`target` carrying `TextQuoteSelector` / `TextPositionSelector` / `RangeSelector`, stored as a bundle for
robustness); the platform even shipped quote-anchoring into the URL layer (`#:~:text=`). Reference clients
(Hypothesis — bundle-of-selectors + fuzzy fallback + **orphan** state; RecogitoJS) and products (Google
Docs/Notion/Medium) all converge on it. WE owns neither piece:
[we:src/_data/intents/selection.json](../src/_data/intents/selection.json) is form/choice selection (its
`range` variant is a numeric slider), and [we:src/_data/intents/rich-text.json](../src/_data/intents/rich-text.json)
decorates ranges *without mutating the model* for spellcheck/collab — transient, editor-internal, no
persisted anchor and no payload. The unowned residual is a **durable span anchor + payload contract**:
capture a `Range`, serialize to a robust W3C selector set, re-resolve later (incl. fuzzy fallback + orphan),
carry an arbitrary payload. Rendering ([we:src/_data/capabilities/highlight-api.json](../src/_data/capabilities/highlight-api.json))
and the popover UI (existing `anchor`/popover intents) are already covered.

### Triage context

- **Kind**: Intent (+ FUI block) · **Native grounding**: CSS Custom Highlight API; W3C Web Annotation Data Model (Selectors); Range/Selection; Scroll-to-Text-Fragment (`#:~:text=`)
- **Native-first**: ◆ medium (adopt the W3C selector vocabulary + Highlight API) · **Gap**: ◆ medium · **Effort**: ◆ medium · **Surfaced by**: #1390 (verb-axis straggler); overlaps #1404 (production-teardown lens)

### Recommended path at a glance

Ratify all rows, or override just the one you'd change. **Confidence** says where judgment is actually needed.

| Fork | Ratified | Main alternative | Confidence |
|---|---|---|---|
| **1 · in or out of scope** | **in-scope as a WE standard** | out-of-scope / app-specific *(rejected — native substrate + W3C model + pervasiveness)* | **~88%** — Custom Highlight API + W3C Recommendation + `#:~:text=` |
| **2 · shape** | **SPLIT** — an **`annotation` intent** (UX) composing a separate **durable-range-anchor contract** (technical) it references like `highlight-api` | unified single intent that *owns* the anchor model *(rejected — intent-UX-only)*; fold into `rich-text` *(rejected — excludes read-only/foreign/PDF)* | **~80%** — anchor machinery is technical, not UX |
| **3 · `anchorStrategy`** *(dimension, homed on the anchor contract)* | expose `quote \| position \| bundle`, default **`bundle`** | mandate one *(rejected — less robust)* | **~75%** — both legitimate; most-flexible default |

## Fork 1 — is this a WE standard at all?

*Fork-existence:* the excluded branch is **"out-of-scope / app-specific,"** and it is **broken** — a
recurring cross-cutting UX pattern with (a) a native substrate (Custom Highlight API, baseline mid-2025),
(b) a W3C Recommendation defining the exact selector vocabulary, (c) `#:~:text=` shipping quote-anchoring
into the URL layer, and (d) pervasiveness across docs/PDF/e-reader/review is the textbook WE intent. The
only genuinely app-specific part is the comment-thread *product* UI, which composes existing intents — not
a reason to exclude the contract.

**Fork 1 (a) — in-scope (recommended, ~88%).**

**Fork 1 (b) — out-of-scope / app-specific (rejected).** The broken branch above.

*The residual (~12%):* the contract could be seen as "just W3C Web Annotation re-exported" — but WE's value
is the *intent framing* (anchor + payload + overlay composing selection/rich-text/popover) and the
native-mapping (Range ↔ selectors ↔ Highlight API), which the W3C model does not give as a UX contract.

## Fork 2 — shape: annotation intent vs behavior vs fold-into-rich-text

*Fork-existence:* the excluded branch is **"fold into `rich-text`,"** and it is **broken** — annotation
must work over **read-only and foreign content** (published HTML, PDFs, e-readers) where there is no
editable model and no rich-text surface; binding the anchor model to rich-text would strand the majority of
real targets (Hypothesis/Recogito annotate static pages and PDFs). Intent vs behavior-block, by contrast,
*coexist* (WE's standing pattern) — that is not a fork; both ship.

**Fork 2 (a) — an `annotation` (content-annotation) intent owning the anchor model + payload + overlay
disposition, composing `selection` / `rich-text` (in-model mark when editable) / `anchor`+popover /
`highlight-api` (recommended, ~80%).** A FUI behavior block realizes it.

**Fork 2 (b) — a pure behavior block, no intent (rejected as sole home).** Under-models the cross-cutting
UX axis; correct only as the *impl half* of (a).

**Fork 2 (c) — fold into `rich-text` (rejected).** The broken branch above.

*The residual (~20%):* naming/scope overlap with rich-text's existing decoration language — draw the seam
crisply: rich-text = *ephemeral in-editor* decoration; annotation = *durable, payload-bearing,
target-agnostic* anchor.

## Fork 3 — anchor selector strategy *(dimension, not a fork)*

Both `quote` (robust, content-addressed), `position` (fast, brittle) and `bundle` (both, reconciled at
write) are legitimate end-states, so the axis is a configurable dimension. **Most-flexible default =
`bundle`** (most robust, Hypothesis default); the restriction is the author's opt-in.

## Ruling — 2026-06-21 (RATIFIED)

- **Fork 1 → in-scope** as a WE standard (~88%; no objection).
- **Fork 2 → SPLIT** (~80%) — *not* the prepared unified single-intent default. Two composable homes:
  - an **`annotation` intent** (UX-only): select → attach payload (highlight | comment | tag | suggestion)
    → overlay; composes `selection` / `rich-text` / `anchor`+popover / `highlight-api`.
  - a **durable-range-anchor contract** (technical capability): `Range` → serialize to a W3C selector
    bundle → re-resolve with fuzzy fallback + orphan detection. Target-agnostic; the `annotation` intent
    **composes** it (references, doesn't own) — the same seam the card already accepts for `highlight-api`.
- **Fork 3 → `anchorStrategy` (`quote | position | bundle`, default `bundle`)** homes on the
  **durable-range-anchor contract** as *its* dimension — not an annotation-intent knob. (No objection on
  the default value; this call settled only its location.)

**Decisive ground (the split):** *intent-UX-only* — the serialize / re-resolve / fuzzy / orphan machinery
is technical, so it cannot live on a UX intent; it must be a separate contract the intent composes. Reuse
beyond annotation (deep-linking, citations, `#:~:text=`-style scroll-to-text, durable test selectors) and
separation-bias (burden on combining) confirm the seam but are not load-bearing — even with zero external
reuse, the unified default would still park technical code on a UX intent.

**Red-team (W3C counter, rejected):** the Web Annotation Data Model bundles `target`+`selector`+`body` as
one object, so the split looks like diverging from the upstream vocab the card adopts wholesale. This
conflates the **serialization vocabulary** (stays a W3C-conformant bundle — see "Supported by default")
with the **runtime ownership seam** (where the split lives). The emitted annotation JSON is unchanged; the
split only decides which WE artifact owns the resolve machinery. The platform itself already split
quote-anchoring out of annotation into `#:~:text=` — precedent for the anchor's standalone value. Attack
fails; the only thing it earns is the explicit note that **W3C vocab is adopted wholesale at the
serialization layer** so the build does not fork the wire format.

*Residual ~20%:* if the anchor contract proves to have a single consumer forever and intent-UX-only were
read loosely, the unified single-intent default would be simpler — weighted low because intent-UX-only is
a hard rule.

---

### Supported by default (not forks)

- **Highlight rendering via CSS Custom Highlight API** — native, no DOM mutation; span-wrapping fallback
  where unsupported (capability already recorded).
- **W3C Web Annotation selector vocabulary adopted wholesale** (`target`/`selector`/`body`/`motivation`) —
  native-first, don't re-mint.
- **Payload/comment/popover UI composes existing intents** (`anchor` tethering, popover, `rich-text` body,
  `selection` capture) — no new payload-UI standard.
- **Orphaned-annotation state** is a first-class outcome of failed re-anchoring (Hypothesis precedent).
- **`motivation` payload kinds** (highlighting | commenting | tagging | suggestion/footnote) — an open enum
  per WE's open-system intent bias.
- **Intent contract + FUI behavior-block realization coexist** at different layers.

### Seams

- **Anchoring (W3C selectors)** — the load-bearing unowned seam: Range → serialized selector bundle →
  re-resolution (incl. fuzzy + orphan). Editor- and target-agnostic; the genuinely hard recurring problem.
- **Highlight rendering** — native (Custom Highlight API + `::highlight()`); WE only references the
  capability.
- **Payload/comment UI** — composition (popover/anchor/rich-text/selection); the comment-thread *product*
  is app-level and stays out.
- **In-editor mark vs external overlay** — an impl / Technical-Configurator seam *below* the annotation
  intent (a `rich-text-editor` engine concern).

### Realizing work (post-ratification, separately prioritized)

Per the ratified split, the build is **two homed entities** (file each via `/new-standard`, separately
prioritized — not part of this placement call):

1. **durable-range-anchor contract** (foundational; the `annotation` intent depends on it) — `Range` ↔ W3C
   selector-bundle serialization, re-resolution (fuzzy fallback + orphan), and the `anchorStrategy`
   (`quote | position | bundle`, default `bundle`) dimension. Adopts the W3C selector vocab wholesale at
   the wire layer. Target-agnostic; reusable beyond annotation.
2. **`annotation` intent JSON** (+ FUI behavior block + demo: highlight + comment over read-only HTML) —
   UX: select → attach `motivation` payload → overlay disposition; *composes* the anchor contract +
   `selection` / `rich-text` / `anchor`+popover / `highlight-api`. Owns no anchor machinery.

The anchor contract's `we:contract.ts` is its own foundational slice (the intent/FUI block can't import it
until it lands) — see the contract-ts-is-a-separate-slice rule.
