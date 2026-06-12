# Expressive symbols & reactions — prior-art survey grounding decision #370

**Date**: 2026-06-12
**Point**: A web-platform standard for emoji / sticker / reaction is genuine whitespace; the prior art says decompose it into **separate** standards — a glyph-rendering substrate (intent), a picker surface (block, composed), and a reaction interaction (block + intent, the consumer) — with sticker folded into glyph rendering as a custom-image mode.
**Research page**: `/research/expressive-symbols-reactions/`
---

## Question

Web Everything has an `icon` intent (UI iconography) but no standard for **expressive symbols or reactions**: emoji rendering, sticker insertion, and reacting-to-content (avatar/badge/tag were skipped as styling idioms). Should this be one "expressive symbols" family or several standards, and what does each cover? Decision item: [#370](/backlog/370-candidate-standard-expressive-symbols-reactions-emoji-sticke/).

## Recommendation

**Separate, with a provider→consumer seam** — the decomposition the only system that ships all of this first-class (Atlassian) actually uses:

- **Glyph rendering** → a **new intent** sibling to `icon` (not an extension): meaningful-vs-decorative a11y, Unicode skin-tone + presentation, native-font-vs-image-set render strategy. Sticker = a *custom-image-glyph* mode here, not a fourth peer.
- **Picker surface** → **composed**, not a new primitive: a searchable popover grid over the existing `droplist`/`autocomplete` blocks + the `popover` attribute + the search input — specifying the browse-grid ↔ search-listbox transform (where a11y breaks).
- **Reaction interaction** → a **block + intent**, the *consumer* of glyph rendering: each reaction an `aria-pressed` toggle, aggregate count, a who-reacted roster, optimistic update, count changes announced via `live-region-status`. Adopt Atlassian's `ReactionSummary` (`count` · `users[]` · `reacted` · `optimisticallyUpdated`) as the contract baseline.
- **Reaction set default** → a **constrained quick-set + `allowAllEmojis` escape hatch** (Atlassian's model — both the most-shipped and the most-permissive; GitHub's locked-8 is the rigid extreme).

Nothing here is a **protocol** — there is no swappable-vendor / engine-interop story, so reaching for one would be lock-in for no interop gain.

## Key Findings

- **Separate, not bundled (load-bearing).** Atlassian splits `@atlaskit/emoji` (glyph + `EmojiPicker`) from `@atlaskit/reactions`; `reactions` *imports* `EmojiProvider` from `emoji` but is never merged in. GitHub mirrors it conceptually (reactions = a constrained consumer of the emoji set). No surveyed system bundles reaction + emoji into one primitive.
- **Reuse platform vocabulary, don't invent.** Glyph a11y: `role="img"` + `aria-label` (meaningful) vs `aria-hidden` (decorative). Unicode UTS #51: *variation selector* (VS15/VS16), *emoji modifier base* (skin tone / Fitzpatrick), *ZWJ sequence*. Picker: `popover` attribute + combobox/listbox APG. Reaction: `aria-pressed` toggle + ARIA live region; "Reactions" / "who-reacted roster".
- **Render strategy.** Native-font (platform-consistent, free, cross-OS inconsistent) vs image set (Twemoji `<img alt>`: consistent, payload cost). Native-first default, image-set opt-in.
- **Sticker is rare.** Only Apple HIG models it first-class; elsewhere it's "custom emoji" (uploaded image). Model as a custom-image-glyph mode, deprioritize as its own standard.
- **Reaction contract exists.** Atlassian `ReactionSummary` is a ready reference: count + users[] roster + reacted toggle + optimistic update + `TOOLTIP_USERS_LIMIT`.
- **All asset-owning systems separate UI icons from emoji** (Octicons/SF Symbols/Material Symbols vs Fluent Emoji/Noto/Twemoji) — evidence the glyph-rendering intent is a *sibling* of `icon`, not a mode of it.

## Files Created/Modified

| File | Action |
|---|---|
| `reports/2026-06-12-expressive-symbols-reactions.md` | created (this report) |
| `src/_data/researchTopics.json` | added `expressive-symbols-reactions` topic |
| `src/_includes/research-descriptions/expressive-symbols-reactions.njk` | created (full write-up) |
| `backlog/370-candidate-standard-expressive-symbols-reactions-emoji-sticke.md` | rewritten into prepared-fork shape (`type: decision`, `preparedDate`) |

## Citations

- Unicode UTS #51 — https://www.unicode.org/reports/tr51/ (variation selectors, emoji modifier base, ZWJ sequences)
- MDN `aria-hidden` / `img` role — decorative vs meaningful glyph exposure
- WAI-ARIA APG — Button (toggle, `aria-pressed`) and Combobox patterns
- Open UI Combobox explainer — https://open-ui.org/components/combobox.explainer/
- Nolan Lawson, "Building an accessible emoji picker" — browse-menu ↔ search-listbox transform
- `@atlaskit/reactions` + `@atlaskit/emoji` — the two-package split and `ReactionSummary` contract
- Apple HIG — iMessage apps and stickers (only first-class sticker model)
- GitHub reactions locked 8-set (community discussion #3082)
