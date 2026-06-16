# Mention / trigger-character inline picker — prior-art survey grounding decision #591

**Date**: 2026-06-14
**Point**: The generic inline-trigger pattern (`@`-mention, `:`-emoji, `#`-channel, `/`-command — an editable region that opens a picker mid-text on a trigger char) is genuine whitespace. The prior art says ship it as a **block + intent** (a runnable trigger-detection engine + declarative dimensions) that **composes** the general picker surface (#588) for results — and, the load-bearing split, keep it **detection-only / insertion-agnostic** so it works in a plain `<input>` today and composes the rich-text standard (#590) for token insertion later, without depending on it.
**Research page**: `/research/inline-trigger-mention-pattern/`
---

## Question

Web Everything has `input` / `autocomplete` / `type-ahead` (inputs + whole-field search-listbox) but **no mention / trigger-character pattern**: the surface that watches an editable region, detects a boundary-anchored trigger char, extracts the query, anchors a popover to the caret, routes results through a listbox, and on selection inserts back into the text. The in-editor `:`-emoji picker (#592) is one instance. Whitespace surfaced by [#370](/backlog/370-candidate-standard-expressive-symbols-reactions-emoji-sticke/) Fork 4. Decision item: [#591](/backlog/591-candidate-standard-mention-trigger-character-inline-picker/).

## Recommendation

A new **block + intent** standard — *not* a mode of the `autocomplete` block, *not* intent-only — that composes existing primitives rather than reinventing them:

- **Home & shape → block + intent** (Fork 1). The trigger-detection engine (boundary-anchored char match → query slice → caret anchor → result routing) is runnable behavior every prior-art system ships as code (ProseMirror/Tiptap `Suggestion` utility, GitHub `<text-expander>`, Lexical `useBasicTypeaheadTriggerMatch`); an intent alone would leave each consumer to re-implement the mechanics. The declarative dimensions (trigger set, boundary policy, query policy) are the intent.
- **Scope → detection-only / insertion-agnostic** (Fork 2, the divergent call). The standard emits the *resolved selection* (`{key, query, range, item}`) and lets the consumer commit it — the GitHub `<text-expander>` model (`text-expander-value` hands you `event.detail.value` to replace the query). It does **not** own the document mutation. This decouples it from any document model, so it works in `<input>`/`<textarea>`/`contenteditable` uniformly and composes the rich-text standard (#590) for atom/token insertion **without being blocked on it** — the opposite of ProseMirror's `Suggestion.command`, which couples insertion into the editor doc.
- **Everything else is *supported by default*, not a decision** — trigger set is an open config registry (`@`/`:`/`#`/`/` are conventions, project extends); boundary/query knobs (`startOfLine`, `allowedPrefixes`, `allowSpaces`, `minQueryLength`, `maxLength`) are dimensions with most-permissive defaults; caret anchoring composes the `anchor` intent via a **virtual/caret anchor element** (the `/research/virtual-elements/` topic); results compose the general picker surface (#588) / `autocomplete` combobox.
- **Forced invariants (ratify, not weigh)** — **virtual focus**: DOM focus stays in the editable region, the listbox is navigated via `aria-activedescendant` with the active option scrolled into view (WAI-ARIA APG editable-combobox-with-list-autocomplete); roving tabindex would steal focus from the text and is broken. Detection **suspends during IME composition**. The pattern is **not a protocol** — a deterministic transform with no swappable-vendor interop story.

## Key Findings

- **Two camps in the prior art = the scope fork (load-bearing).** **Detection-only:** GitHub `<text-expander>` is a framework-agnostic web component — `keys` attribute sets trigger chars, `text-expander-change` fires `{key, text}` when matched (you supply the menu), `text-expander-value` fires on select (you assign `event.detail.value` as the replacement). It never touches a document model. **Detection + insertion:** ProseMirror/Tiptap `Suggestion` and Lexical `LexicalTypeaheadMenuPlugin` bundle the commit (`Suggestion.command`, Lexical's menu) into the editor's document — powerful but coupled to that doc model. WE's separation bias + the need to stay unblocked on #590 → detection-only.
- **The trigger engine is universally a configured detection layer, not a bespoke per-trigger widget.** Tiptap `Suggestion`: `char`, `allowSpaces`, `startOfLine`, `allowedPrefixes` (null = any prefix), `minQueryLength`. Lexical `useBasicTypeaheadTriggerMatch(trigger, {minLength: 1, maxLength: 75, punctuation, allowWhitespace: false})`. GitHub `keys` + per-key `multiWord`. These are the same orthogonal dimensions → an open intent vocabulary, not invented terms.
- **Trigger chars are a UX *convention*, not a standardized set** — `@` people, `:` emoji, `#` channels/tags, `/` commands recur across Slack, Discord, Notion, GitHub. So the trigger set is an **open config registry** (per Config-Extends-Platform-Default + Intents-open-design), never a hardcoded enum.
- **A11y is the APG editable combobox, verbatim.** DOM focus stays on the editable region; AT focus moves in the listbox via `aria-activedescendant`; `aria-expanded`/`aria-controls`/`aria-autocomplete` on the textbox; JS must scroll the active option into view (browsers don't manage visibility for `aria-activedescendant`). No dedicated "mention" APG pattern exists — everyone reuses the combobox pattern.
- **Caret anchoring is the one genuinely new mechanic, and it composes existing intents.** The popover anchors to the caret — a *virtual element*, not a stable DOM node — so it composes the `anchor` intent (placement/collision/flip) over a virtual anchor (the `/research/virtual-elements/` topic). In `contenteditable` the DOM `Range.getBoundingClientRect()` gives the rect; in `<input>`/`<textarea>` a mirror-div caret-coordinate measurement is needed. Off-screen-near-edge bugs (Lexical #3834) confirm collision handling is load-bearing.
- **No native HTML primitive.** `<datalist>` autocompletes a *whole field*, not a mid-text trigger; the `combobox` role is the closest platform vocabulary. So this is necessarily an ARIA-composed widget; the native-first baseline degrades to a plain textbox with no inline suggestions.
- **Research did not reshape the framing into more forks — it collapsed most candidates to "support all."** Trigger set, boundary policy, query policy, caret anchoring, results UI are all "expose the axis / compose existing"; only **home-&-shape** and **scope-boundary** are genuine either/ors.

## Per-fork classification (the 7-question pass)

1. **Layer** — **Block + Intent**. Runnable trigger-detection engine (block) + declarative dimensions (intent). Not a protocol.
2. **Protocol or intent dimension?** Not a protocol — deterministic transform, no vendor-swap/interop story; making it one would be lock-in for no gain.
3. **Affects an intent → expose the whole axis** — trigger set, boundary, query policy all surface as config/dimensions, never baked.
4. **Fixed mechanic vs dimension** — insertion model & boundary policy are dimensions (both end-states legitimate); virtual focus + IME-suspend are fixed mechanics (invariants under any dimension value).
5. **DI-injectable?** The items-source (results provider) and the insertion-committer are **behavioral** → consumer-supplied / ambient, never hardcoded — this *is* the detection-only stance (Fork 2-A).
6. **Default = most permissive** — trigger set open; `allowedPrefixes` null = any; the restriction (`startOfLine`, `minQueryLength`) is the author's opt-in.
7. **Seam between intents** — sits at the seam between the editable region (`input` / #590 `contenteditable`) and the picker surface (#588), anchored via the `anchor` intent. Owns trigger→query→anchor→route; delegates results to #588, insertion to the consumer/#590, positioning to `anchor`.

## Files Created/Modified

| File | Action |
|---|---|
| `reports/2026-06-14-inline-trigger-mention-pattern.md` | created (this report) |
| `src/_data/researchTopics.json` | added `inline-trigger-mention-pattern` topic |
| `src/_includes/research-descriptions/inline-trigger-mention-pattern.njk` | created (full write-up) |
| `backlog/591-candidate-standard-mention-trigger-character-inline-picker.md` | rewritten into prepared-fork shape (`preparedDate`) |

## Sources

- [GitHub `<text-expander>` element](https://github.github.com/text-expander-element/) · [README](https://github.com/github/text-expander-element/blob/main/README.md)
- [Tiptap/ProseMirror Suggestion utility](https://tiptap.dev/docs/editor/api/utilities/suggestion)
- [Lexical `LexicalTypeaheadMenuPlugin`](https://lexical.dev/docs/api/modules/lexical_react_LexicalTypeaheadMenuPlugin) · [source](https://github.com/facebook/lexical/blob/main/packages/lexical-react/src/LexicalTypeaheadMenuPlugin.tsx)
- [WAI-ARIA APG — Editable Combobox With List Autocomplete](https://www.w3.org/WAI/ARIA/apg/patterns/combobox/examples/combobox-autocomplete-list/) · [Combobox Pattern](https://www.w3.org/WAI/ARIA/apg/patterns/combobox/)
- [MDN — ARIA combobox role](https://developer.mozilla.org/en-US/docs/Web/Accessibility/ARIA/Reference/Roles/combobox_role)
</content>
</invoke>
