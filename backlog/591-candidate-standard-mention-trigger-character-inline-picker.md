---
type: decision
workItem: story
size: 3
status: resolved
dateOpened: "2026-06-14"
dateStarted: "2026-06-14"
dateResolved: "2026-06-14"
graduatedTo: none
preparedDate: "2026-06-14"
tags: [candidate-standard, intent, block, mention, decision]
relatedReport: reports/2026-06-14-inline-trigger-mention-pattern.md
crossRef: { url: /backlog/588-build-the-general-picker-surface-composed-browse-search/, label: "Composes — general picker surface (#588)" }
---

# Candidate standard — mention / trigger-character inline picker (@, :)

No design exists yet. The generic inline-trigger surface — an editable region that detects a boundary-anchored trigger char (`@`/`:`/`#`/`/`), extracts the query, anchors a popover to the **caret**, and routes results through a listbox — is whitespace (`input`/`autocomplete`/`type-ahead` cover whole-field search, not mid-text triggers). Surfaced by [#370](/backlog/370-candidate-standard-expressive-symbols-reactions-emoji-sticke/) Fork 4; the in-editor `:`-emoji picker ([#592](/backlog/592-in-editor-inline-tooltip-emoji-picker-trigger/)) is one instance. **Two genuine forks** — *home & shape* and *scope boundary* — are grounded in a survey **published as [/research/inline-trigger-mention-pattern/](/research/inline-trigger-mention-pattern/)** (report via `relatedReport`), each with a **bold** default. The rest collapses to *support-all* + two invariants.

## Axis framing

The survey decomposes the inline-trigger pattern into orthogonal axes, each pinned to the real tree. Only the first two are genuine either/ors; the rest are *exposed axes / composed primitives*, listed under **Supported by default**.

- **Home & shape** (Fork 1) — does the pattern live as a mode of the `autocomplete` block ([blocks.json:82](src/_data/blocks.json#L82)), or as its own standard, and if its own, intent-only or **block + intent**? The trigger-detection engine is runnable behavior beside the declarative dimensions.
- **Scope boundary** (Fork 2, divergent) — does the standard own the *insertion* (commit into a document model), or stop at *detection* and emit the resolved selection for the consumer to commit? This decides whether it depends on the rich-text standard ([#590](/backlog/590-candidate-standard-rich-text-contenteditable-editing/)).
- **Trigger set & boundary/query policy** — trigger chars, `startOfLine`, `allowedPrefixes`, `allowSpaces`, `minQueryLength`, `maxLength`. Open config + dimensions (mirrors the `type-ahead` intent's matching/reset/wrap dimensions at [intents.json:1439](src/_data/intents.json#L1439)).
- **Caret anchoring** — the popover tethers to the caret (a *virtual element*), composing the `anchor` intent ([intents.json:1204](src/_data/intents.json#L1204)).
- **Results UI** — a filtered listbox, composing the general picker surface ([#588](/backlog/588-build-the-general-picker-surface-composed-browse-search/)) / `autocomplete` ([blocks.json:82](src/_data/blocks.json#L82)) / `type-ahead` ([blocks.json:109](src/_data/blocks.json#L109)) blocks.
- **A11y** — APG editable combobox over the editable region (`input` at [intents.json:1108](src/_data/intents.json#L1108)), match counts via `live-region-status` ([intents.json:155](src/_data/intents.json#L155)).

## Ruling — RATIFIED 2026-06-14

- **Fork 1 → C (new block + intent).** A runnable trigger-detection block backed by an intent for the declarative dimensions, composing the general picker surface ([#588](/backlog/588-build-the-general-picker-surface-composed-browse-search/)). A and B disqualified, not dispreferred (A folds detection into a menu block; B under-specifies the runnable engine). *Not a protocol.*
- **Fork 2 → A (detection-only / insertion-agnostic).** The standard emits the resolved selection (`{key, query, range, item}`) and stops; the consumer commits. Token insertion is a consumer concern — the standard ships reference adapters for `text` (default) and `token` (composes [#590](/backlog/590-candidate-standard-rich-text-contenteditable-editing/)) but owns neither commit. Keeps #591 decoupled from #590 (composed, not blocked).
- **Support-all axes + forced invariants** ratified as inherited (below the divider) — trigger-set registry, most-permissive dimension defaults, caret/`anchor` composition, picker-surface composition; virtual focus (APG editable combobox), IME-composition suspension, not-a-protocol.
- **Graduates to** a build chain: the trigger block + intent (composing #588), with the two insertion-mode reference adapters as follow-on slices. Spun off as [#620](/backlog/620-build-the-inline-trigger-detection-block-intent/), `blockedBy` #588.

## Recommended path at a glance

| Fork | Recommended default | Main alternative | Confidence |
|---|---|---|---|
| 1 · Home & shape | **New block + intent** (composes #588) | Mode of `autocomplete` / intent-only | High |
| 2 · Scope boundary | **Detection-only / insertion-agnostic** | Detection + insertion (couples to a doc model) | Med-high *(divergent)* |

Fork 1 is near-ratification (separation bias + unanimous prior art ships a detection engine). **Fork 2 is the real call** — the prior art splits into two camps (GitHub `<text-expander>` detection-only vs ProseMirror `Suggestion.command` insertion-coupled), and it determines whether #591 is decoupled from #590.

## Examples

**What the pattern is, concretely** — four everyday instances, all the same engine with a different trigger char and result set:

- **`@`-mention** in a comment field → people picker. Type `Great work @nic` — at `@` a popover anchored to the caret lists users; selecting commits `@nicolas `.
- **`:`-emoji** mid-sentence → the in-editor emoji picker ([#592](/backlog/592-in-editor-inline-tooltip-emoji-picker-trigger/)). `Shipped it :tada` → `:` opens the emoji listbox; select inserts 🎉.
- **`/`-command** at line start → Notion/Slack-style command menu (`startOfLine: true`, `allowSpaces: false`).
- **`#`-reference** → channel/tag/issue picker (`#det` → issue #591).

**Why Fork 2 is the real call** — the same `@`-mention, written under each branch. Detection-only (A) emits the resolved selection and the consumer commits; detection+insertion (B) owns the commit and so must know the document model:

```html
<!-- Fork 2-A · detection-only — works in a plain <textarea>, knows no doc model -->
<inline-trigger trigger="@" for="comment">
  <textarea id="comment"></textarea>
</inline-trigger>
<script>
  el.addEventListener('trigger-resolve', e => {
    // e.detail = { key: '@', query: 'nic', range: {start, end}, item }
    // consumer owns the commit — here, plain text into the textarea:
    commitText(e.detail.range, `@${e.detail.item.handle} `)
    // a #590 rich-text consumer would instead commit a token node — same event, different adapter
  })
</script>
```

```js
// Fork 2-B · detection + insertion — the standard commits, so it must assume a doc model
new InlineTrigger({
  trigger: '@',
  command: (editor, item) => editor.insertNode(mentionToken(item)),
  //                          ^ couples #591 → #590; a bare <textarea> has no `editor`
})
```

The A snippet runs in any editable region today and *composes* #590 (token adapter) without depending on it; the B snippet cannot run in a plain `<textarea>` at all. That asymmetry is the decoupling payoff the recommendation rests on.

## Fork 1 — Home & shape: where does the pattern live?

**Crux:** is the inline-trigger pattern a mode of an existing block, or its own standard — and if its own, intent-only or block + intent?

- **A — Mode of the `autocomplete` block** ([blocks.json:82](src/_data/blocks.json#L82)). *Rejected:* couples a text-region-watching/detection concern into a menu block; no surveyed system folds them; violates the separation bias.
- **B — Intent-only separate standard.** Declares the dimensions, ships no engine. *Rejected:* the trigger engine (boundary match → query slice → caret anchor → route) is genuinely runnable behavior, so intent-only leaves every consumer to re-implement the mechanics inconsistently — it under-specifies the thing that makes the pattern a pattern.
- **C — New block + intent.** A runnable trigger-detection block (the "Suggestion utility" equivalent) backed by an intent for the declarative dimensions, composing the general picker surface ([#588](/backlog/588-build-the-general-picker-surface-composed-browse-search/)) for results. *Merit:* matches all prior art — ProseMirror/Tiptap `Suggestion`, GitHub `<text-expander>`, Lexical `useBasicTypeaheadTriggerMatch` all ship a detection engine + config; lets the standard own the mechanics once.

**Recommended: C — new block + intent.** Same shape the reaction standard took ([#370](/backlog/370-candidate-standard-expressive-symbols-reactions-emoji-sticke/) Fork 5): runnable mechanics as a block, declarative dimensions as an intent. *Classification:* **not a protocol** — a deterministic transform with no swappable-vendor/engine-interop story; making it one would be lock-in for no gain.

## Fork 2 — Scope boundary: detection-only, or detection + insertion? *(the divergent fork)*

**Crux:** on selection, does the standard *commit* the choice into the text (owning the document mutation), or does it *emit the resolved selection* and let the consumer commit?

- **A — Detection-only / insertion-agnostic.** The standard emits the resolved selection (`{key, query, range, item}`) and stops; the consumer supplies the replacement. *Merit:* the GitHub `<text-expander>` model — `text-expander-value` hands you `event.detail.value` to assign. Knows nothing about document models, so it works in `<input>`/`<textarea>`/`contenteditable` **uniformly**, and composes the rich-text standard ([#590](/backlog/590-candidate-standard-rich-text-contenteditable-editing/)) for atom/token insertion **without depending on it** — keeping #591 decoupled and unblocked.
- **B — Detection + insertion.** The standard also owns the commit (plain-text replace, or atom/token node). *Merit con:* the ProseMirror `Suggestion.command` / Lexical model — to insert a token it must know the document model, coupling #591 to #590 and forcing a doc-model assumption onto plain `<input>` consumers that don't have one.

**Recommended: A — detection-only / insertion-agnostic.** The separation bias plus the concrete decoupling payoff: detection-only is the layer that is reusable across every editable surface, and it is precisely what lets this item be *independent of the #370 chain and of #590*. Token insertion is then a **consumer concern** (the rich-text standard #590 commits a token; a plain input commits text) — the standard ships reference adapters for both insertion modes but owns neither commit. *Rejected:* B couples the trigger layer to a document model it shouldn't know about.

---

## Supported by default (not decisions)

These are *support-all / expose-the-axis / compose-existing* — recorded so the build inherits them, not weighed by the decider:

- **Trigger set → open config registry.** `@` (people), `:` (emoji), `#` (channels/tags), `/` (commands) are UX *conventions* no body standardizes (Slack/Discord/Notion/GitHub converge). Per Config-Extends-Platform-Default + Intents-open-design: the platform flavor ships the convention chars; a project extends them; the standard hardcodes no enum.
- **Boundary / query policy → dimensions, most-permissive defaults.** `startOfLine`, `allowedPrefixes` (null = any), `allowSpaces`, `minQueryLength`, `maxLength` — the orthogonal knobs every engine exposes (Tiptap `Suggestion`; Lexical `{minLength: 1, maxLength: 75, allowWhitespace}`). The restriction is the author's opt-in.
- **Insertion modes → both supported** (downstream of Fork 2-A). `text` (works in any editable region — the default) and `token` (composes #590's document model). The standard provides reference adapters for both; the consumer chooses.
- **Caret anchoring → composes the `anchor` intent** ([intents.json:1204](src/_data/intents.json#L1204)) via a **virtual/caret anchor element** ([/research/virtual-elements/](/research/virtual-elements/)). `Range.getBoundingClientRect()` in `contenteditable`; a mirror-div caret measurement in `<input>`/`<textarea>`. Collision (flip/shift) is load-bearing, not cosmetic.
- **Results UI → composes the general picker surface** ([#588](/backlog/588-build-the-general-picker-surface-composed-browse-search/)) / `autocomplete` ([blocks.json:82](src/_data/blocks.json#L82)); never reinvented.

## Forced invariants (ratify, not weigh)

- **Virtual focus.** DOM focus stays in the editable region; the listbox is navigated via `aria-activedescendant` with the active option scrolled into view — the WAI-ARIA APG *Editable Combobox With List Autocomplete* pattern. Roving tabindex would steal focus from the text and is broken. The only correct a11y model.
- **Suspend detection during IME composition** (don't fire mid-composition — Lexical #7985).
- **Not a protocol** (classification Q2) — deterministic transform, no vendor-swap interop.

## Context — relationships & composition seam

- **Origin:** [#370](/backlog/370-candidate-standard-expressive-symbols-reactions-emoji-sticke/) Fork 4 named the in-editor `:`-emoji picker as one *specific picker context* and surfaced this generic gap.
- **Composes:** the general picker surface [#588](/backlog/588-build-the-general-picker-surface-composed-browse-search/) (results), the `anchor` intent (positioning), the `virtual-elements` topic (caret anchor), `input`/`autocomplete`/`type-ahead`.
- **Decoupled from #590 by design (Fork 2-A):** the rich-text/`contenteditable` standard ([#590](/backlog/590-candidate-standard-rich-text-contenteditable-editing/)) is *composed* for token insertion, **not** depended-on — so #591 is not `blockedBy` #590, and works in plain inputs today.
- **Consumed by:** [#592](/backlog/592-in-editor-inline-tooltip-emoji-picker-trigger/) (the in-editor `:`-trigger emoji picker), which is correctly `blockedBy` #588, #590, #591 — it needs all three; #591 itself needs none of them resolved to be *decided*.
- **On resolution:** each fork gains a dated ruling; the item graduates to a `blockedBy` build chain — the trigger block + intent (composing #588), with the two insertion-mode reference adapters as follow-on slices. The build is `blockedBy` #588; the decision is not.

## Progress

- **Status:** RESOLVED 2026-06-14 — both forks ratified (Fork 1 → C block + intent; Fork 2 → A detection-only). Graduated to build [#620](/backlog/620-build-the-inline-trigger-detection-block-intent/) (`blockedBy` #588).
- **Branch:** docs/standard-authoring-workflow
- **Done:** prior-art survey (GitHub `<text-expander>`, ProseMirror/Tiptap `Suggestion`, Lexical typeahead, WAI-ARIA APG editable combobox) → published as `/research/inline-trigger-mention-pattern/` (researchTopics.json entry + njk write-up) + session report `reports/2026-06-14-inline-trigger-mention-pattern.md`. Item rewritten to prepared-fork shape, then added an **Examples** section (four instances + the Fork 2-A vs 2-B code asymmetry). Both forks ratified — see `## Ruling`.
- **Next:** work the build [#620](/backlog/620-build-the-inline-trigger-detection-block-intent/) once #588 (general picker surface) lands.
- **Notes:** key decoupling finding — detection-only keeps #591 independent of #590 (composed, not blocked). The build is `blockedBy` #588; the decision needed nothing resolved.
</content>
