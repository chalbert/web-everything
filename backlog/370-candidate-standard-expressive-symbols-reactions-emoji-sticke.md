---
type: decision
workItem: story
size: 5
status: open
dateOpened: "2026-06-12"
dateStarted: "2026-06-12"
preparedDate: "2026-06-12"
tags: [candidate-standard, intent, emoji, sticker, reaction, decision]
relatedReport: reports/2026-06-12-expressive-symbols-reactions.md
crossRef: { url: /backlog/354-status-indicator-badge-intent/, label: "Sibling candidate — status-indicator / badge (#354)" }
---

# Decision — Expressive symbols & reactions: how to standardize emoji · sticker · reaction

No design exists yet. The `icon` intent ([intents.json:899](src/_data/intents.json#L899)) covers UI iconography; emoji rendering, sticker insertion, and reacting-to-content are whitespace. The six forks below are grounded in a prior-art survey (Unicode UTS #51, WAI-ARIA APG + the benchmark design systems), **published as [/research/expressive-symbols-reactions/](http://localhost:3000/research/expressive-symbols-reactions/)** (report via `relatedReport`). The load-bearing result: the only system shipping all of this first-class (Atlassian) **splits it into separate packages** — glyph rendering as provider, reaction as consumer — so the core fork's default is **separate standards, not one family**. Each fork carries a **bold** recommended default.

## Axis framing

The survey decomposes "expressive symbols & reactions" into four paradigms along a **provider → consumer** seam, each pinned to the real tree:

- **Expressive-glyph rendering** — the substrate. A *content* symbol (meaningful or decorative), distinct from the UI-affordance `icon` intent at [intents.json:899](src/_data/intents.json#L899) (whose axis is size/weight/style — see [intents.json:902-924](src/_data/intents.json#L902-L924)).
- **Picker surface** — selection UI. Overlaps the existing `droplist` ([blocks.json:17](src/_data/blocks.json#L17)) / `autocomplete` ([blocks.json:82](src/_data/blocks.json#L82)) blocks + the search `input` intent ([intents.json:1101](src/_data/intents.json#L1101)).
- **Sticker** — a custom-image expressive unit; renders identically to an emoji glyph.
- **Reaction interaction** — the consumer: affix a symbol to content (toggle + aggregate + roster), announced via `live-region-status` ([intents.json:155](src/_data/intents.json#L155)), visually adjacent to but semantically distinct from the `surface`-tokened badge of [#354](backlog/354-status-indicator-badge-intent.md) ([intents.json:997](src/_data/intents.json#L997)).

## Recommended path at a glance

| Fork | Recommended default | Main alternative | Confidence |
|---|---|---|---|
| 1 · Decomposition | **Separate standards (provider→consumer)** | One "expressive symbols" family | High |
| 2 · Glyph home | **New intent, sibling to `icon`** | Extend the `icon` intent | Med-high |
| 3 · Glyph defaults | **Meaningful (`role="img"`) · native-font render** | Decorative default / image-set default | High |
| 4 · Picker | **Compose over droplist/autocomplete + `popover`** | New standalone emoji-picker block | Med |
| 5 · Reaction home | **Block + intent, `ReactionSummary` contract** | Intent only | Med-high |
| 6 · Reaction set | **Quick-set + `allowAllEmojis` escape hatch** | Locked fixed set / free picker | High |

Forks 1, 3, 6 are near-ratification (High); 2 and 5 carry a real but well-leaning call; **Fork 4 is the divergent one** (Med) — whether the picker earns its own block.

## Fork 1 — One family or separate standards?

**Crux:** model emoji/sticker/reaction as one "expressive symbols" intent family, or as distinct standards along the provider→consumer seam.

- **A — One family.** One intent covering rendering + reaction. *Tradeoff:* one home to find, but couples a rendering concern to an interaction concern that recur independently (you react with a vote arrow and no emoji; you render an emoji with no reaction).
- **B — Separate standards (provider→consumer).** Glyph rendering (substrate) → picker (composed) → reaction (consumer); sticker folds into glyph. *Tradeoff:* more entries, but each is independently composable and matches the only first-class precedent — Atlassian's `@atlaskit/emoji` ← `@atlaskit/reactions` split, where reactions *imports* the emoji provider but is never merged in.

**Recommended: B — separate.** The repo's standing bias is separation (burden of proof is on combining), and the prior art bundles nothing. *Rejected:* A — no surveyed system bundles reaction+emoji; combining buys no concrete benefit and blocks independent composition.

## Fork 2 — Glyph rendering: extend `icon`, or a new sibling intent?

**Crux:** does meaningful-symbol rendering live as a mode of the `icon` intent ([intents.json:899](src/_data/intents.json#L899)) or as its own intent?

- **A — Extend `icon`.** Add an emoji/expressive mode to `icon`. *Tradeoff:* one iconography home, but icon's dimensions are size/weight/style ([intents.json:902-924](src/_data/intents.json#L902-L924)) — emoji needs presentation, skin-tone, render-strategy, and an a11y meaningful/decorative axis, which would bloat icon with a foreign axis.
- **B — New sibling intent.** A `glyph` / `expressive-symbol` intent beside `icon`. *Tradeoff:* a second entry, but every asset-owning design system separates UI icons (Octicons/SF Symbols/Material Symbols) from emoji sets (Fluent Emoji/Noto/Twemoji) — the separation is industry consensus.

**Recommended: B — new sibling intent.** Icon = UI affordance glyph; the new intent = content/meaningful symbol. *Sub-decision:* sticker is a **custom-image-glyph mode of this new intent** (Fork 1's "sticker folds in"), not a peer.

## Fork 3 — Glyph defaults: accessible-name policy + render strategy

**Crux:** the two defaults the rendering intent must pick.

- **A11y default.** **Meaningful** — `role="img"` + `aria-label` required; decorative (`aria-hidden="true"`) is the author's opt-in. *Tradeoff:* a label is sometimes redundant, but silently-hidden meaning is the worse, harder-to-detect failure (most-permissive-for-the-reader default).
- **Render default.** **Native-font** rendering; an image set (Twemoji-style `<img alt>`) is an opt-in enhancement. *Tradeoff:* native is zero-cost but cross-OS-inconsistent; image-set is consistent but a payload + maintenance cost — opt-in matches the native-first doctrine.

**Recommended: meaningful + native-font**, both as above. Surface skin-tone and text/emoji presentation as Unicode-vocabulary dimensions (variation selector VS15/VS16; emoji modifier base), not invented names. *Rejected:* decorative-by-default (hides meaning silently); image-set-by-default (imposes payload + a vendor asset set on every consumer).

## Fork 4 — Picker: compose, or a new block? *(the divergent fork)*

**Crux:** is the symbol picker a new block, or a composition of existing surfaces?

- **A — New emoji-picker block.** A dedicated block. *Tradeoff:* self-contained, but reinvents popover + search + grid that `droplist` ([blocks.json:17](src/_data/blocks.json#L17)) and `autocomplete` ([blocks.json:82](src/_data/blocks.json#L82)) already own.
- **B — Compose.** A picker *surface* pattern: the `popover` attribute as container, the search `input` intent ([intents.json:1101](src/_data/intents.json#L1101)) + a category grid, reusing droplist/autocomplete. *Tradeoff:* requires specifying the **browse-grid ↔ search-listbox transform** (where a11y breaks, per the APG combobox pattern), but the emoji picker and sticker picker become two instances of one surface.

**Recommended: B — compose.** *Why divergent (Med):* only Atlassian ships a first-class picker component; everyone else defers to the OS picker or third parties — so there's real precedent for "not our primitive," but also a case that the browse↔search transform is intricate enough to deserve a named block. The call is whether that transform is *block-worthy* or just a documented composition. *Sub-decision deferred to build:* if composition proves too intricate, promote the transform to a thin block — but start composed.

## Fork 5 — Reaction: intent only, or block + intent? And the contract.

**Crux:** the reaction interaction is the highest-value paradigm — where does it live, and what is its data shape?

- **A — Intent only.** Declarative dimensions, no shipped behavior. *Tradeoff:* lighter, but reaction *is* runnable behavior (toggle-your-own, aggregate, optimistic update) — an intent alone leaves every consumer to re-implement the mechanics.
- **B — Block + intent.** A reaction block (each reaction an `aria-pressed` toggle; count changes via `live-region-status` at [intents.json:155](src/_data/intents.json#L155)) backed by an intent for the declarative dimensions. *Tradeoff:* more to build, but matches the one shipped precedent.

**Recommended: B — block + intent.** Adopt Atlassian's `ReactionSummary` as the **contract baseline**: `count` (aggregate) · `users[]` (who-reacted roster, with a display limit) · `reacted` (toggle-your-own) · `optimisticallyUpdated`. *Classification:* **not a protocol** — it's a data contract with no swappable-vendor/engine-interop story; making it a protocol would be lock-in for no interop gain. *vs #354:* a reaction count chip resembles a `surface`-tokened badge ([intents.json:997](src/_data/intents.json#L997)) but means "N people reacted," not "this state" — they compose, don't merge.

## Fork 6 — Reaction set policy default

**Crux:** what set of reactions is offered by default.

- **A — Locked fixed set.** GitHub's 8 (👍👎😄🎉😕❤️🚀👀). *Tradeoff:* simplest, most constrained; no escape hatch.
- **B — Free picker.** Any emoji. *Tradeoff:* most open, but no surveyed system defaults to this (decision fatigue, moderation surface).
- **C — Quick-set + escape hatch.** A constrained quick set with an `allowAllEmojis`-style prop opening the full picker (Atlassian). *Tradeoff:* a default to settle, but both the most-shipped and the most-permissive — the quick-set is convenience; the full picker stays reachable.

**Recommended: C — quick-set + `allowAllEmojis` escape hatch.** Honours most-flexible-default (the restriction is the author's opt-in, the full set is always reachable) while matching real usage. *Rejected:* A (no escape hatch — the restriction becomes the ceiling); B as a *default* (no system ships it; it's the opt-in extreme, not the default).

## On resolution

Each fork gains a dated ruling; the item then graduates to a **`blockedBy` chain in composition order** — glyph-rendering intent first (the substrate), then the picker (composed) and reaction (block + intent) as consumers, with sticker as a mode of the glyph intent. A prepared decision yields agent-ready builds, not code.
