---
type: decision
workItem: story
size: 5
status: active
dateOpened: "2026-06-12"
dateStarted: "2026-06-14"
preparedDate: "2026-06-12"
tags: [candidate-standard, intent, emoji, sticker, reaction, decision]
relatedReport: reports/2026-06-12-expressive-symbols-reactions.md
crossRef: { url: /backlog/354-status-indicator-badge-intent/, label: "Sibling candidate — status-indicator / badge (#354)" }
---

# Decision — Expressive symbols & reactions: how to standardize emoji · sticker · reaction

No design exists yet. The `icon` intent ([intents.json:899](src/_data/intents.json#L899)) covers UI iconography; emoji rendering, sticker insertion, and reacting-to-content are whitespace. The six forks below are grounded in a prior-art survey (Unicode UTS #51, WAI-ARIA APG + the benchmark design systems), **published as [/research/expressive-symbols-reactions/](/research/expressive-symbols-reactions/)** (report via `relatedReport`). The load-bearing result: the only system shipping all of this first-class (Atlassian) **splits it into separate packages** — glyph rendering as provider, reaction as consumer — so the core fork's default is **separate standards, not one family**. Each fork carries a **bold** recommended default.

## Axis framing

The survey decomposes "expressive symbols & reactions" into four paradigms along a **provider → consumer** seam, each pinned to the real tree:

- **Expressive-glyph rendering** — the substrate. A *content* symbol (meaningful or decorative), distinct from the UI-affordance `icon` intent at [intents.json:899](src/_data/intents.json#L899) (whose axis is size/weight/style — see [intents.json:902-924](src/_data/intents.json#L902-L924)).
- **Picker surface** — selection UI. Overlaps the existing `droplist` ([blocks.json:17](src/_data/blocks.json#L17)) / `autocomplete` ([blocks.json:82](src/_data/blocks.json#L82)) blocks + the search `input` intent ([intents.json:1101](src/_data/intents.json#L1101)).
- **Sticker** — a custom-image expressive unit; renders identically to an emoji glyph.
- **Reaction interaction** — the consumer: affix a symbol to content (toggle + aggregate + roster), announced via `live-region-status` ([intents.json:155](src/_data/intents.json#L155)), visually adjacent to but semantically distinct from the `surface`-tokened badge of [#354](/backlog/354-status-indicator-badge-intent/) ([intents.json:997](src/_data/intents.json#L997)).

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
- **B — Separate standards (provider→consumer).** Glyph rendering (substrate) → picker (composed) → reaction (consumer); sticker folds into glyph. *Merit:* each is independently composable and matches the only first-class precedent — Atlassian's `@atlaskit/emoji` ← `@atlaskit/reactions` split, where reactions *imports* the emoji provider but is never merged in.

**Recommended: B — separate.** The repo's standing bias is separation (burden of proof is on combining), and the prior art bundles nothing. *Rejected:* A — no surveyed system bundles reaction+emoji; combining buys no concrete benefit and blocks independent composition.

## Fork 2 — Glyph rendering: extend `icon`, or a new sibling intent?

**Crux:** does meaningful-symbol rendering live as a mode of the `icon` intent ([intents.json:899](src/_data/intents.json#L899)) or as its own intent?

- **A — Extend `icon`.** Add an emoji/expressive mode to `icon`. *Tradeoff:* one iconography home, but icon's dimensions are size/weight/style ([intents.json:902-924](src/_data/intents.json#L902-L924)) — emoji needs presentation, skin-tone, render-strategy, and an a11y meaningful/decorative axis, which would bloat icon with a foreign axis.
- **B — New sibling intent.** A `glyph` / `expressive-symbol` intent beside `icon`. *Merit:* every asset-owning design system separates UI icons (Octicons/SF Symbols/Material Symbols) from emoji sets (Fluent Emoji/Noto/Twemoji) — the separation is industry consensus, and it keeps `icon`'s axis (size/weight/style) uncontaminated by a foreign presentation/skin-tone axis.

**Recommended: B — new sibling intent.** Icon = UI affordance glyph; the new intent = content/meaningful symbol. *Sub-decision:* sticker is a **custom-image-glyph mode of this new intent** (Fork 1's "sticker folds in"), not a peer. *A11y divergence of the sticker mode:* a custom image has **no Unicode CLDR fallback name**, so its `aria-label` is genuinely **required**, not merely defaulted (Fork 3) — stricter than the emoji mode of the same intent.

## Fork 3 — Glyph defaults: accessible-name policy + render strategy

**Crux:** the two defaults the rendering intent must pick.

- **A11y default.** **Meaningful** — wrap the glyph in `role="img"` + `aria-label`, **falling back to the Unicode CLDR short-name when the author supplies none** (never empty, never the raw codepoint); decorative (`aria-hidden="true"`) is the author's opt-in. *Note — emoji are not silent by default:* AT already announces a bare emoji's CLDR name (🎉 → "party popper"), so the real failure mode is the *wrong/verbose* name in context, not hidden meaning — the default **overrides** a possibly-wrong name, it doesn't rescue silence. The `role="img"` wrapper is also what makes **skin-tone modifiers and ZWJ sequences** (👍🏽, 👩‍👩‍👧) announce as one composed concept instead of separate component codepoints — the strongest concrete argument for this default. *Tradeoff:* a label is sometimes redundant, but an unlabelled meaningful glyph degrades to a possibly-wrong CLDR name (most-permissive-for-the-reader default). *Substrate gap:* there is **no existing accessible-name intent** in the repo (only `live-region-status` at [intents.json:155](src/_data/intents.json#L155)), so the new intent must **own this accessible-name dimension itself** — flagged as a candidate cross-cutting a11y-naming intent under *On resolution*.
- **Render default.** **Native-font** rendering; an image set (Twemoji-style `<img alt>`) is an opt-in enhancement. *Tradeoff:* native renders cross-OS-inconsistent; an image-set is consistent but imposes a runtime payload (and a vendor asset set) on every consumer — opt-in matches the native-first doctrine.

**Recommended: meaningful + native-font**, both as above. Surface skin-tone and text/emoji presentation as Unicode-vocabulary dimensions (variation selector VS15/VS16; emoji modifier base), not invented names. *Rejected:* decorative-by-default (hides meaning silently); image-set-by-default (imposes payload + a vendor asset set on every consumer).

## Fork 4 — Picker: compose, or a new block? *(the divergent fork)*

**Crux:** is the symbol picker a new block, or a composition of existing surfaces?

- **A — New emoji-picker block.** A dedicated block. *Tradeoff:* self-contained, but reinvents popover + search + grid that `droplist` ([blocks.json:17](src/_data/blocks.json#L17)) and `autocomplete` ([blocks.json:82](src/_data/blocks.json#L82)) already own.
- **B — Compose.** A picker *surface* pattern: the `popover` attribute as container, the search `input` intent ([intents.json:1101](src/_data/intents.json#L1101)) + a category grid, reusing droplist/autocomplete. *Tradeoff:* requires specifying the **browse-grid ↔ search-listbox transform** (where a11y breaks, per the APG combobox pattern), but the emoji picker and sticker picker become two instances of one surface.

**Recommended: B — compose.** *Why divergent (Med):* only Atlassian ships a first-class picker component; everyone else defers to the OS picker or third parties — so there's real precedent for "not our primitive," but also a case that the browse↔search transform is intricate enough to deserve a named block. The call is whether that transform is *block-worthy* or just a documented composition. The intricate part is specifically the **APG pattern switch**: a 2-D **Grid** (arrow-key nav across the category grid) for browse vs a **Combobox/listbox** for search — different keyboard + focus models that must hand off cleanly.

*Two consumers reinforce composing.* The picker surface is consumed both at **runtime** (an end user picks an emoji to react/insert) and at **authoring time** (a dev/designer **shops** the icon+emoji+sticker catalog inside **Web Docs** ([#398](/backlog/398-build-the-web-docs-product-fui-open-primitives-plateau-app-o/)) to select an asset — the same `see`/`shop` paradigm as [#236](/backlog/236-validation-normalization-shopping-devtool/)/[#283](/backlog/283-validation-normalize-shop-leg-pick-tools-by-the-validation-y/)). One reusable surface with ≥2 instances is itself the case for compose over a bespoke block.

*Promotion trigger (pinned, not deferred-blind):* start composed; promote the transform to a thin block **only if** the Grid↔Combobox focus hand-off cannot be expressed as configuration over the existing `droplist`/`autocomplete` and needs bespoke focus-coordination logic. That is a testable condition at build time, not a re-litigation of this fork.

*Out of scope here — spun out:* the expressive-**asset catalog** itself (which icon sets / emoji sets / sticker packs exist, rendered as a shoppable gallery in Web Docs) is a separate webdocs concern, `blockedBy` the new intent. The live `icon` intent already carries `name: string` with **no catalog of available names** ([intents.json:899](src/_data/intents.json#L899)) — so "what can I shop from" is unaddressed for icons today too; the catalog serves icon+emoji+sticker uniformly. Captured under *On resolution*.

## Fork 5 — Reaction: intent only, or block + intent? And the contract.

**Crux:** the reaction interaction is the highest-value paradigm — where does it live, and what is its data shape?

- **A — Intent only.** Declarative dimensions, no shipped behavior. *Merit con:* reaction *is* runnable behavior (toggle-your-own, aggregate, optimistic update), so an intent alone leaves every consumer to re-implement the mechanics inconsistently — the standard would under-specify the very thing that makes reaction a reaction.
- **B — Block + intent.** A reaction block (each reaction an `aria-pressed` toggle; count changes via `live-region-status` at [intents.json:155](src/_data/intents.json#L155)) backed by an intent for the declarative dimensions. *Merit:* the only shipped first-class precedent (Atlassian) is exactly this shape, and it lets the standard own the runnable mechanics once instead of leaving each consumer to redo them.

**Recommended: B — block + intent.** Adopt Atlassian's `ReactionSummary` as the **contract baseline**: `count` (aggregate) · `users[]` (who-reacted roster, with a display limit) · `reacted` (toggle-your-own) · `optimisticallyUpdated`. *Classification:* **not a protocol** — it's a data contract with no swappable-vendor/engine-interop story; making it a protocol would be lock-in for no interop gain. *Sync is separate:* the multi-user "others see your reaction" concern is a **composed real-time protocol** (webrealtime), never baked into the reaction contract. *vs #354:* a reaction count chip resembles a `surface`-tokened badge ([intents.json:997](src/_data/intents.json#L997)) but means "N people reacted," not "this state" — they compose, don't merge.

*A11y spec (load-bearing — was thin).* Three requirements the block must meet, not leave to consumers:
- **Composed accessible name** per toggle — emoji name + count + your-reacted-state ("thumbs up, 5 reactions, you reacted, activate to remove"), **not** a bare `aria-pressed` glyph (which reads only the CLDR name + "pressed").
- **Announcement policy** — announce **your own** toggle via `live-region-status` ([intents.json:155](src/_data/intents.json#L155)); **do not live-announce every remote count tick** — in a busy thread that floods the screen reader. Remote aggregates update silently and are read on focus.
- **Keyboard-reachable roster** — `users[]` surfaces as a focusable disclosure, not a hover-only card.

## Fork 6 — Reaction set policy default

**Crux:** what set of reactions is offered by default.

- **A — Locked fixed set.** GitHub's 8 (👍👎😄🎉😕❤️🚀👀). *Tradeoff:* simplest, most constrained; no escape hatch.
- **B — Free picker.** Any emoji. *Tradeoff:* most open, but no surveyed system defaults to this (decision fatigue, moderation surface).
- **C — Quick-set + escape hatch.** A constrained quick set with an `allowAllEmojis`-style prop opening the full picker (Atlassian). *Tradeoff:* a default to settle, but both the most-shipped and the most-permissive — the quick-set is convenience; the full picker stays reachable.

**Recommended: C — quick-set + `allowAllEmojis` escape hatch.** Honours most-flexible-default (the restriction is the author's opt-in, the full set is always reachable) while matching real usage. *Rejected:* A (no escape hatch — the restriction becomes the ceiling); B as a *default* (no system ships it; it's the opt-in extreme, not the default).

*Whose set — authority vs convention (the default's membership, sharpened):*
- **Emoji have an authority — the Unicode Consortium** (UTS #51; the **RGI** "Recommended for General Interchange" set; CLDR names + emoji-ordering) — the same body Fork 3 defers to. The quick-set's members must therefore be **RGI fully-qualified emoji** (so they render cross-platform), named via CLDR — one a11y path shared with Fork 3.
- **No body standardizes a *reaction* set** — reactions are a UX *convention*, and it has **converged**: a small sentiment-spanning set (👍 ❤️ 😂 😮 😢 😡, ± 👎/🎉) recurs across Facebook (7 reactions), Teams/Slack (~6), LinkedIn. So the shipped default is **that convergent set, not GitHub's 8 chosen arbitrarily** — and it lives in the **platform config** (overridable per *Config-Extends-Platform-Default*), never hardcoded in the block.
- **Mobile convention validates C directly:** **iOS 18 Tapbacks** ship exactly model C — a fixed small set surfaced first **plus** any-emoji expansion.
- **Distinct concern:** a "frequently/recently used" row is **picker personalization (Fork 4)** — a per-user signal — not the reaction default-set definition; keep them separate.

## On resolution

Each fork gains a dated ruling; the item then graduates to a **`blockedBy` chain in composition order** — glyph-rendering intent first (the substrate), then the picker (composed) and reaction (block + intent) as consumers, with sticker as a mode of the glyph intent. A prepared decision yields agent-ready builds, not code.

**Spin-outs identified (author at close-out, after ratification):**
- **Expressive-asset catalog / shop surface** — the icon+emoji+sticker gallery a dev/designer browses & selects from inside Web Docs (the Fork 4 *authoring* consumer); `blockedBy` the new `expressive-symbol` intent, under epic [#398](/backlog/398-build-the-web-docs-product-fui-open-primitives-plateau-app-o/). Serves icon+emoji+sticker uniformly — note the live `icon` intent has `name: string` with no catalog of available names today.
- **Candidate cross-cutting accessible-name intent** — surfaced by Fork 3's substrate gap (no a11y-naming intent exists). For now the new intent owns its accessible-name dimension; the cross-cutting intent is a separate idea item to capture, not a blocker on this chain.

## Progress

- **Status:** active — six rulings + spin-outs amended into the item; **awaiting ratification** before resolve + graduation.
- **Branch:** docs/standard-authoring-workflow
- **Done:** a11y mechanics sharpened (Forks 2 sticker / 3 glyph / 5 reaction); Web Docs "shop" dual-consumer relationship folded into Fork 4; spin-outs recorded under *On resolution*. **Effort/cost stripped from fork tradeoffs** (Forks 1/2/3/5 — "more to build / a second entry / more entries / lighter / maintenance cost" were prioritization smuggled into the merit column; now merit-only per [backlog-workflow.md:244](../docs/agent/backlog-workflow.md#L244), which was extended to forbid the in-fork leak). **Fork 6 default-set membership grounded** — Unicode RGI + CLDR for emoji authority; reaction quick-set = the convergent cross-platform sentiment set (no org standardizes reactions), in platform config not hardcoded; iOS 18 Tapbacks cited as model-C precedent. Directions unchanged (1·B, 2·B, 3·meaningful+native-font, 4·compose, 5·block+intent, 6·C).
- **Next:** on the user's nod — resolve (`active → resolved` + `dateResolved`, ruling per fork), then author the `blockedBy` build chain (intent → picker + reaction) and the two spin-out items.
- **Notes:** no fork direction moved; amendments are a11y-mechanics + the authoring/shop consumer only.
