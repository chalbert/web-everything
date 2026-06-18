---
type: decision
workItem: story
size: 5
status: resolved
dateOpened: "2026-06-12"
dateStarted: "2026-06-14"
dateResolved: "2026-06-14"
graduatedTo: none
preparedDate: "2026-06-12"
tags: [candidate-standard, intent, emoji, sticker, reaction, decision]
relatedReport: reports/2026-06-12-expressive-symbols-reactions.md
crossRef: { url: /backlog/354-status-indicator-badge-intent/, label: "Sibling candidate — status-indicator / badge (#354)" }
---

# Decision — Expressive symbols & reactions: how to standardize emoji · sticker · reaction

No design exists yet. The `icon` intent ([we:intents.json:899](src/_data/intents.json#L899)) covers UI iconography; emoji rendering, sticker insertion, and reacting-to-content are whitespace. The six forks below are grounded in a prior-art survey (Unicode UTS #51, WAI-ARIA APG + the benchmark design systems), **published as [/research/expressive-symbols-reactions/](/research/expressive-symbols-reactions/)** (report via `relatedReport`). The load-bearing result: the only system shipping all of this first-class (Atlassian) **splits it into separate packages** — glyph rendering as provider, reaction as consumer — so the core fork's default is **separate standards, not one family**. Each fork carries a **bold** recommended default.

## Axis framing

The survey decomposes "expressive symbols & reactions" into four paradigms along a **provider → consumer** seam, each pinned to the real tree:

- **Expressive-glyph rendering** — the substrate. A *content* symbol (meaningful or decorative), distinct from the UI-affordance `icon` intent at [we:intents.json:899](src/_data/intents.json#L899) (whose axis is size/weight/style — see [we:intents.json:902-924](src/_data/intents.json#L902-L924)).
- **Picker surface** — selection UI. Overlaps the existing `droplist` ([fui:blocks.json:17](src/_data/blocks.json#L17)) / `autocomplete` ([fui:blocks.json:82](src/_data/blocks.json#L82)) blocks + the search `input` intent ([we:intents.json:1101](src/_data/intents.json#L1101)).
- **Sticker** — a custom-image expressive unit; renders identically to an emoji glyph.
- **Reaction interaction** — the consumer: affix a symbol to content (toggle + aggregate + roster), announced via `live-region-status` ([we:intents.json:155](src/_data/intents.json#L155)), visually adjacent to but semantically distinct from the `surface`-tokened badge of [#354](/backlog/354-status-indicator-badge-intent/) ([we:intents.json:997](src/_data/intents.json#L997)).

## Recommended path at a glance

| Fork | Recommended default | Main alternative | Confidence |
|---|---|---|---|
| 1 · Decomposition | **Separate standards (provider→consumer)** | One "expressive symbols" family | High |
| 2 · Glyph home | **New intent, sibling to `icon`** | Extend the `icon` intent | Med-high |
| 3 · Glyph defaults | **Meaningful name (intent-owned) · render strategy = inherited/extensible platform config, *no mandate*** (native-font flavor default) | Decorative default / WE-mandated render strategy | High |
| 4 · Picker | **Compose over droplist/autocomplete + `popover`** | New standalone emoji-picker block | Med |
| 5 · Reaction home | **Block + intent, `ReactionSummary` contract** | Intent only | Med-high |
| 6 · Reaction set | **Open config-driven named-set registry** (default-less core; convergent `sentiment` default; `allowAllEmojis` escape) | Single hardcoded quick-set / locked set / free picker | High |

Forks 1, 3, 6 are near-ratification (High); 2 and 5 carry a real but well-leaning call; **Fork 4 is the divergent one** (Med) — whether the picker earns its own block.

## Fork 1 — One family or separate standards?

**Crux:** model emoji/sticker/reaction as one "expressive symbols" intent family, or as distinct standards along the provider→consumer seam.

- **A — One family.** One intent covering rendering + reaction. *Tradeoff:* one home to find, but couples a rendering concern to an interaction concern that recur independently (you react with a vote arrow and no emoji; you render an emoji with no reaction).
- **B — Separate standards (provider→consumer).** Glyph rendering (substrate) → picker (composed) → reaction (consumer); sticker folds into glyph. *Merit:* each is independently composable and matches the only first-class precedent — Atlassian's `@atlaskit/emoji` ← `@atlaskit/reactions` split, where reactions *imports* the emoji provider but is never merged in.

**Recommended: B — separate.** The repo's standing bias is separation (burden of proof is on combining), and the prior art bundles nothing. *Rejected:* A — no surveyed system bundles reaction+emoji; combining buys no concrete benefit and blocks independent composition.

## Fork 2 — Glyph rendering: extend `icon`, or a new sibling intent?

**Crux:** does meaningful-symbol rendering live as a mode of the `icon` intent ([we:intents.json:899](src/_data/intents.json#L899)) or as its own intent?

- **A — Extend `icon`.** Add an emoji/expressive mode to `icon`. *Tradeoff:* one iconography home, but icon's dimensions are size/weight/style ([we:intents.json:902-924](src/_data/intents.json#L902-L924)) — emoji needs presentation, skin-tone, render-strategy, and an a11y meaningful/decorative axis, which would bloat icon with a foreign axis.
- **B — New sibling intent.** A `glyph` / `expressive-symbol` intent beside `icon`. *Merit:* every asset-owning design system separates UI icons (Octicons/SF Symbols/Material Symbols) from emoji sets (Fluent Emoji/Noto/Twemoji) — the separation is industry consensus, and it keeps `icon`'s axis (size/weight/style) uncontaminated by a foreign presentation/skin-tone axis.

**Recommended: B — new sibling intent.** Icon = UI affordance glyph; the new intent = content/meaningful symbol. *Sub-decision:* sticker is a **custom-image-glyph mode of this new intent** (Fork 1's "sticker folds in"), not a peer. *A11y divergence of the sticker mode:* a custom image has **no Unicode CLDR fallback name**, so its `aria-label` is genuinely **required**, not merely defaulted (Fork 3) — stricter than the emoji mode of the same intent.

## Fork 3 — Glyph defaults: accessible-name policy + render strategy

**Crux:** two settings the rendering intent touches — but at *different levels*: an a11y/UX default the intent owns, and a **technical render strategy WE does not mandate**.

- **A11y default.** **Meaningful** — wrap the glyph in `role="img"` + `aria-label`, **falling back to the Unicode CLDR short-name when the author supplies none** (never empty, never the raw codepoint); decorative (`aria-hidden="true"`) is the author's opt-in. *Note — emoji are not silent by default:* AT already announces a bare emoji's CLDR name (🎉 → "party popper"), so the real failure mode is the *wrong/verbose* name in context, not hidden meaning — the default **overrides** a possibly-wrong name, it doesn't rescue silence. The `role="img"` wrapper is also what makes **skin-tone modifiers and ZWJ sequences** (👍🏽, 👩‍👩‍👧) announce as one composed concept instead of separate component codepoints — the strongest concrete argument for this default. *Tradeoff:* a label is sometimes redundant, but an unlabelled meaningful glyph degrades to a possibly-wrong CLDR name (most-permissive-for-the-reader default). *Substrate gap:* there is **no existing accessible-name intent** in the repo (only `live-region-status` at [we:intents.json:155](src/_data/intents.json#L155)), so the new intent must **own this accessible-name dimension itself** — flagged as a candidate cross-cutting a11y-naming intent under *On resolution*.
- **Render strategy (NOT mandated — technical / platform-config).** Native-font vs an image set (Twemoji-style `<img alt>`) is a **technical choice with two legitimate end-states**, so WE mandates **no specific strategy**: it's a configurable dimension a project **inherits or extends from the platform settings** (per *Config-Extends-Platform-Default*), and being *technical* it belongs to the **Technical Configurator / platform technical config**, not a UX dimension on the intent (per *Intent-UX-only, technical→Configurator*). The standard stays **default-less** here. *Sensible platform-flavor default:* native-font (zero-cost, honours native-first) — but that's the **platform flavor's** default, not a standard mandate; image-set is a config override (cross-OS consistency at a runtime payload + vendor-asset cost).

**Recommended: meaningful name (intent default) + render strategy as inherited/extensible platform config (no mandate).** Surface skin-tone and text/emoji presentation as Unicode-vocabulary dimensions (variation selector VS15/VS16; emoji modifier base), not invented names. *Rejected:* decorative-by-default (hides meaning silently); **mandating any single render strategy in the standard** — it's a technical platform choice the project inherits/extends (the platform flavor defaults to native-font; projects override to image-set).

## Fork 4 — Picker: compose, or a new block? *(the divergent fork)*

**Crux:** is the symbol picker a new block, or a composition of existing surfaces?

- **A — New emoji-picker block.** A dedicated block. *Tradeoff:* self-contained, but reinvents popover + search + grid that `droplist` ([fui:blocks.json:17](src/_data/blocks.json#L17)) and `autocomplete` ([fui:blocks.json:82](src/_data/blocks.json#L82)) already own.
- **B — Compose.** A picker *surface* pattern: the `popover` attribute as container, the search `input` intent ([we:intents.json:1101](src/_data/intents.json#L1101)) + a category grid, reusing droplist/autocomplete. *Tradeoff:* requires specifying the **browse-grid ↔ search-listbox transform** (where a11y breaks, per the APG combobox pattern), but the emoji picker and sticker picker become two instances of one surface.

**Recommended: B — compose.** *Why divergent (Med):* only Atlassian ships a first-class picker component; everyone else defers to the OS picker or third parties — so there's real precedent for "not our primitive," but also a case that the browse↔search transform is intricate enough to deserve a named block. The call is whether that transform is *block-worthy* or just a documented composition. The intricate part is specifically the **APG pattern switch**: a 2-D **Grid** (arrow-key nav across the category grid) for browse vs a **Combobox/listbox** for search — different keyboard + focus models that must hand off cleanly.

*Two consumers reinforce composing.* The picker surface is consumed both at **runtime** (an end user picks an emoji to react/insert) and at **authoring time** (a dev/designer **shops** the icon+emoji+sticker catalog inside **Web Docs** ([#398](/backlog/398-build-the-web-docs-product-fui-open-primitives-plateau-app-o/)) to select an asset — the same `see`/`shop` paradigm as [#236](/backlog/236-validation-normalization-shopping-devtool/)/[#283](/backlog/283-validation-normalize-shop-leg-pick-tools-by-the-validation-y/)). One reusable surface with ≥2 instances is itself the case for compose over a bespoke block.

*Promotion trigger (pinned, not deferred-blind):* start composed; promote the transform to a thin block **only if** the Grid↔Combobox focus hand-off cannot be expressed as configuration over the existing `droplist`/`autocomplete` and needs bespoke focus-coordination logic. That is a testable condition at build time, not a re-litigation of this fork.

*One general surface, many specific picker contexts.* What this fork ratifies is the **general picker surface** (the reusable browse↔search composition) — **not** a single picker block. That surface is instantiated by **many specific picker blocks**, each its own later story, because the trigger, density, and container differ per context:
- **Full-page filtered collection** — a design/dev browses the whole catalog with facets/filters (this *is* the Web-Docs "shop" consumer above; the faceted full-page-collection pattern recurs beyond emoji).
- **In-editor inline / tooltip picker** — a `:`-trigger popover *inside a rich-text editor* (small, keyboard-driven, anchored to the caret). **Depends on standards that do not exist yet** (see spin-outs): there is no rich-text/`contenteditable` editing standard and no mention/trigger-character pattern in the repo today.
- **Reaction quick-picker** — the small popover the reaction bar opens for `allowAllEmojis` (Fork 6).
- *…and likely others* (form-field insert, command-palette-style insert).

These are captured as **separate later stories** under *On resolution* — the decision here is only that they all **compose the one general surface**, never each reinvent it.

*Out of scope here — spun out:* the expressive-**asset catalog** itself (which icon sets / emoji sets / sticker packs exist, rendered as a shoppable gallery in Web Docs) is a separate webdocs concern, `blockedBy` the new intent. The live `icon` intent already carries `name: string` with **no catalog of available names** ([we:intents.json:899](src/_data/intents.json#L899)) — so "what can I shop from" is unaddressed for icons today too; the catalog serves icon+emoji+sticker uniformly. Captured under *On resolution*.

## Fork 5 — Reaction: intent only, or block + intent? And the contract.

**Crux:** the reaction interaction is the highest-value paradigm — where does it live, and what is its data shape?

- **A — Intent only.** Declarative dimensions, no shipped behavior. *Merit con:* reaction *is* runnable behavior (toggle-your-own, aggregate, optimistic update), so an intent alone leaves every consumer to re-implement the mechanics inconsistently — the standard would under-specify the very thing that makes reaction a reaction.
- **B — Block + intent.** A reaction block (each reaction an `aria-pressed` toggle; count changes via `live-region-status` at [we:intents.json:155](src/_data/intents.json#L155)) backed by an intent for the declarative dimensions. *Merit:* the only shipped first-class precedent (Atlassian) is exactly this shape, and it lets the standard own the runnable mechanics once instead of leaving each consumer to redo them.

**Recommended: B — block + intent.** Adopt Atlassian's `ReactionSummary` as the **contract baseline**: `count` (aggregate) · `users[]` (who-reacted roster, with a display limit) · `reacted` (toggle-your-own) · `optimisticallyUpdated`. *Classification:* **not a protocol** — it's a data contract with no swappable-vendor/engine-interop story; making it a protocol would be lock-in for no interop gain. *Sync is separate:* the multi-user "others see your reaction" concern is a **composed real-time protocol** (webrealtime), never baked into the reaction contract. *vs #354:* a reaction count chip resembles a `surface`-tokened badge ([we:intents.json:997](src/_data/intents.json#L997)) but means "N people reacted," not "this state" — they compose, don't merge.

*A11y spec (load-bearing — was thin).* Three requirements the block must meet, not leave to consumers:
- **Composed accessible name** per toggle — emoji name + count + your-reacted-state ("thumbs up, 5 reactions, you reacted, activate to remove"), **not** a bare `aria-pressed` glyph (which reads only the CLDR name + "pressed").
- **Announcement policy** — announce **your own** toggle via `live-region-status` ([we:intents.json:155](src/_data/intents.json#L155)); **do not live-announce every remote count tick** — in a busy thread that floods the screen reader. Remote aggregates update silently and are read on focus.
- **Keyboard-reachable roster** — `users[]` surfaces as a focusable disclosure, not a hover-only card.

## Fork 6 — Reaction set policy default

**Crux:** what set of reactions is offered by default.

- **A — Locked fixed set.** GitHub's 8 (👍👎😄🎉😕❤️🚀👀). *Tradeoff:* simplest, most constrained; no escape hatch.
- **B — Free picker.** Any emoji. *Tradeoff:* most open, but no surveyed system defaults to this (decision fatigue, moderation surface).
- **C — Quick-set + escape hatch.** A constrained quick set with an `allowAllEmojis`-style prop opening the full picker (Atlassian). *Tradeoff:* a default to settle, but both the most-shipped and the most-permissive — the quick-set is convenience; the full picker stays reachable.

**Recommended: C, generalized to an open config-driven *set registry*.** Not a single hardcoded quick-set but an **open number of named reaction sets** defined in the **platform config we extend from** — per *Config-Extends-Platform-Default* (the core block/intent is **default-less**; the platform config holds the flavors) and *Intents-open-design* (standardize the set **meta-schema**, not a fixed list). The platform config ships named sets — e.g. `sentiment` (the convergent default), `votes` (👍👎), `github-8`, `facebook-7` — plus a `default` pointer; a **project extends that config** to add/override sets and choose its own default; `allowAllEmojis` stays the always-reachable full-picker escape hatch. This **subsumes the three branches**: A (locked set) = a project that ships one named set with no escape; B (free picker) = the `allowAllEmojis` mode; C's quick-set = the platform-default named set. *Rejected as the *framing*, not as configs:* A and B are reachable **configurations** of the open registry — they were only wrong as the *fixed standard*.

*Whose set — authority vs convention (members + the default named set):*
- **Emoji have an authority — the Unicode Consortium** (UTS #51; the **RGI** "Recommended for General Interchange" set; CLDR names + emoji-ordering) — the same body Fork 3 defers to. Every named set's members must be **RGI fully-qualified emoji** (so they render cross-platform), named via CLDR — one a11y path shared with Fork 3.
- **No body standardizes a *reaction* set** — reactions are a UX *convention*, and it has **converged**: a small sentiment-spanning set (👍 ❤️ 😂 😮 😢 😡, ± 👎/🎉) recurs across Facebook (7 reactions), Teams/Slack (~6), LinkedIn. So the platform config's **default named set** is **that convergent `sentiment` set, not GitHub's 8 chosen arbitrarily** — and being config, it's overridable, never hardcoded in the block.
- **Mobile convention validates the model directly:** **iOS 18 Tapbacks** ship exactly this — a fixed small set surfaced first **plus** any-emoji expansion.
- **Distinct concern:** a "frequently/recently used" row is **picker personalization (Fork 4)** — a per-user signal — not a named set in the registry; keep them separate.

## Ruling — 2026-06-14 (ratified)

1. **Decomposition → separate standards** (provider→consumer): glyph rendering → picker → reaction; sticker folds into glyph.
2. **Glyph home → new sibling intent** `expressive-symbol` (not extend `icon`); sticker = custom-image mode of it (label genuinely required — no CLDR fallback).
3. **Glyph defaults split by level** — a11y *name* is intent-owned: **meaningful** (`role="img"` + label, **CLDR-short-name fallback**), decorative is opt-in. **Render strategy is NOT mandated** — default-less core; a technical setting inherited/extended from the platform config (native-font is the platform-flavor default), surfaced via the Technical Configurator.
4. **Picker → compose** the one general picker surface (popover + search `input` + category grid over droplist/autocomplete); promote to a thin block only if the APG Grid↔Combobox focus hand-off can't be expressed as config. Many specific picker contexts compose this one surface.
5. **Reaction → block + intent** with the `ReactionSummary` contract (`count`·`users[]`·`reacted`·`optimisticallyUpdated`); **not a protocol**; multi-user sync is a composed webrealtime concern. A11y: composed accessible name + local-only announcement + keyboard roster.
6. **Reaction set → open config-driven named-set registry** (default-less core; platform config ships named sets incl. the convergent `sentiment` default; projects extend; `allowAllEmojis` escape). Members = Unicode RGI emoji, CLDR-named.

**Graduated to epic [#586](/backlog/586-expressive-symbols-reactions-build-the-ratified-standard-370/)** and these items:
- Core chain: **#587** expressive-symbol intent (substrate) → **#588** general picker surface · **#589** reaction block+intent (both `blockedBy` #587).
- Picker contexts: **#592** in-editor `:`-trigger picker (`blockedBy` #588, #590, #591) · **#593** Web Docs asset catalog/shop = full-page filtered picker (`blockedBy` #587, #588; relates #398).
- Technical Configurator: **#594** render-strategy domain (`blockedBy` #587) · **#595** reaction update-strategy option (`blockedBy` #589). *(Reaction sync transport → webrealtime domain, no new card.)*
- Independent whitespace surfaced (not blockers on this chain): **#590** rich-text/contenteditable editing standard · **#591** mention/trigger-character pattern · **#596** candidate cross-cutting accessible-name intent.

## On resolution

Each fork gains a dated ruling; the item then graduates to a **`blockedBy` chain in composition order** — glyph-rendering intent first (the substrate), then the picker (composed) and reaction (block + intent) as consumers, with sticker as a mode of the glyph intent. A prepared decision yields agent-ready builds, not code.

**Spin-outs identified (author at close-out, after ratification):**

*Picker contexts — each composes the one general picker surface (Fork 4), authored as its own story:*
- **Full-page filtered collection picker** — faceted full-page browse of the catalog. Largely the same surface as the Web-Docs shop below; capture the *filtered-collection* pattern as reusable beyond emoji.
- **In-editor inline / tooltip picker** — `:`-trigger caret-anchored popover inside a rich-text editor. `blockedBy` the two editing-standard gaps below — **do not** mark it Tier-A ready.
- **Reaction quick-picker popover** — the `allowAllEmojis` (Fork 6) expansion surface opened from the reaction bar; folds into the reaction build, flag if it grows.

*Editing-standard whitespace surfaced by the in-editor picker (neither exists in the repo today — `input-family`/`autocomplete`/`type-ahead` cover inputs + search-listbox, but no rich-text editor and no trigger-char pattern):*
- **Rich-text / `contenteditable` editing standard** — its own candidate standard (likely a `decision`), prerequisite for any in-editor inline picker. Not gated on this chain; this item just surfaces the gap.
- **Mention / trigger-character inline-picker pattern** (`@`, `:`) — the generic inline-trigger surface the in-editor emoji picker is one instance of. Capture as a sibling candidate standard.

*Technical Configurator domains/options — one card per documented technical setting (plateau-app; add a domain via seed + provider entry per the Technical Configurator pattern). These let a dev/project pick the inherited/extended platform setting; the platform-config **schema** itself ships with the intent/block build in the chain above:*
- **Expressive-symbol render strategy** (Fork 3) — Configurator domain: `native-font` | `image-set`, with a sub-option for the **asset vendor** (Twemoji / Noto / Fluent Emoji) when `image-set`. Default flavor = native-font; project inherits/extends.
- **Reaction update strategy** (Fork 5 `optimisticallyUpdated`) — Configurator option: `optimistic` | `pessimistic` (how the toggle reflects before server confirm).
- **Reaction sync transport** (Fork 5) — **not a new card here**: cross-ref to the **webrealtime** Configurator domain (the multi-user "others see your reaction" transport is that domain's option, composed in — never owned by the reaction contract).
- *Forward note:* any further technical setting a downstream build documents (e.g. a picker **search-match strategy** — substring / fuzzy / CLDR-keyword index — if Fork 4's build introduces one) gets its own Configurator option **at that point**; flagged here so it isn't missed.

*Other:*
- **Expressive-asset catalog / shop surface** — the icon+emoji+sticker gallery a dev/designer browses & selects from inside Web Docs (the Fork 4 *authoring* consumer); `blockedBy` the new `expressive-symbol` intent, under epic [#398](/backlog/398-build-the-web-docs-product-fui-open-primitives-plateau-app-o/). Serves icon+emoji+sticker uniformly — note the live `icon` intent has `name: string` with no catalog of available names today.
- **Candidate cross-cutting accessible-name intent** — surfaced by Fork 3's substrate gap (no a11y-naming intent exists). For now the new intent owns its accessible-name dimension; the cross-cutting intent is a separate idea item to capture, not a blocker on this chain.

## Progress

- **Status:** RESOLVED 2026-06-14 — six rulings ratified; graduated to epic #586 + builds #587-#589 (chain), consumers #592/#593, Configurator cards #594/#595, and independent spin-outs #590/#591/#596.
- **Branch:** docs/standard-authoring-workflow
- **Done:** a11y mechanics sharpened (Forks 2 sticker / 3 glyph / 5 reaction); Web Docs "shop" dual-consumer relationship folded into Fork 4; spin-outs recorded under *On resolution*. **Effort/cost stripped from fork tradeoffs** (Forks 1/2/3/5 — "more to build / a second entry / more entries / lighter / maintenance cost" were prioritization smuggled into the merit column; now merit-only per [we:backlog-workflow.md:244](../docs/agent/backlog-workflow.md#L244), which was extended to forbid the in-fork leak). **Fork 6 default-set membership grounded** — Unicode RGI + CLDR for emoji authority; reaction quick-set = the convergent cross-platform sentiment set (no org standardizes reactions), in platform config not hardcoded; iOS 18 Tapbacks cited as model-C precedent. Directions unchanged (1·B, 2·B, 4·compose, 5·block+intent). **Fork 3 split by level** — a11y *name* stays intent-owned (meaningful + CLDR fallback); the **render strategy is no longer mandated** — it's a technical platform-config setting the project inherits/extends (default-less core; native-font is the platform *flavor* default, not a standard mandate) per Config-Extends-Platform-Default + technical→Configurator. **Fork 6 generalized** — from a single quick-set to an **open config-driven named-set registry** (default-less core; platform config ships named sets incl. the convergent `sentiment` default; projects extend; `allowAllEmojis` escape) per Config-Extends-Platform-Default + Intents-open-design; subsumes the old A/B/C as configurations. **Fork 4 general-vs-specific pinned** — one general picker surface; the specific contexts (full-page filtered collection, in-editor tooltip picker, reaction quick-picker, …) are separate later stories. **Editing-standard gaps surfaced** — no rich-text/`contenteditable` editor standard and no mention/trigger-char pattern exist; both added as spin-outs (the in-editor picker is `blockedBy` them). **Technical Configurator cards recorded** — one per documented technical setting (render strategy + asset vendor; reaction update strategy) targeting plateau-app; reaction sync transport cross-ref'd to webrealtime, not a new card.
- **Next:** on the user's nod — resolve (`active → resolved` + `dateResolved`, ruling per fork), then author the `blockedBy` build chain (intent → picker + reaction) and the two spin-out items.
- **Notes:** no fork direction moved; amendments are a11y-mechanics + the authoring/shop consumer only.

**Graduated to** `none` — candidate-standard ratified — spawned build epic #586 (expressive-symbols-reactions) + chain #587–589, consumers #592/#593, configurator #594/#595.
