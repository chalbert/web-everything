---
kind: decision
status: resolved
dateOpened: "2026-06-23"
dateStarted: "2026-06-23"
dateResolved: "2026-06-23"
graduatedTo: none
codifiedIn: "docs/agent/platform-decisions.md#categorical-taxonomy"
preparedDate: "2026-06-23"
relatedReport: reports/2026-06-23-categorical-taxonomy-provider.md
tags: [tag-intent, design-tokens, provider, taxonomy, cross-surface]
---

# Categorical taxonomy provider: one registry of named closed category sets, consumed cross-surface by tag/badge/circle/etc.

Surfaced reviewing #1621/#1669: an app's categorical vocabularies (kind/tier/size) are closed lists reused across many surfaces — badge, tag, childCircle, filter chips, borders, links — not a tag feature. Propose a category meta-schema of N named closed sets, each value → presentation metadata (colour token, icon, shape), consumed via (set, value). UPDATE 2026-06-23: Fork 1 DISSOLVED into ratified #1682 — no new provider/registry; categories are one JS-first token family (`--cat-*`) synced to CSS. Open here: the meta-schema + Fork 2 (status stays lifecycle/Status-Indicator-owned, OUT of the taxonomy). Reshapes #1669/#1621/#1598/#1208 into consumers.

**Prepared 2026-06-23.** Grounded in the real tree + a prior-art survey of how leading design systems model
app-defined categorical vocabularies, published as the `/research/` topic
[categorical-taxonomy-provider](/research/categorical-taxonomy-provider/) (session report:
[we:reports/2026-06-23-categorical-taxonomy-provider.md](../reports/2026-06-23-categorical-taxonomy-provider.md)).
The survey **reshaped the framing**: the original single "status in/out" sub-fork became two forks — it
added the **mechanism** fork (the "one provider" instinct is right, but no system ships a runtime
`(set,value)` registry → make it a declarative token-resolving layer) and refined the **status-home** fork
(not binary — lifecycle owns meaning, the provider holds presentation as a segregated rule-bearing set). The
core contribution (provider owns the value→token/icon/shape map) is the documented industry whitespace.
Each `## Fork N` carries a bold default already attacked by a skeptic sub-agent (`Skeptic:` line).

**RATIFIED 2026-06-23.** Fork 1 dissolved into #1682 (JS-first token SoT); Fork 2 ruled **(2c)** — `status`
is excluded from the taxonomy, owned end-to-end by lifecycle + the Status Indicator intent. Codified at
`we:docs/agent/platform-decisions.md#categorical-taxonomy`. Consumers: #1669, #1598, #1208.

> **Update 2026-06-23 (discussion) — Fork 1 DISSOLVED; this item now `blockedBy` #1682.** Discussing Fork 1's
> "declarative token-resolving layer vs runtime DI registry" surfaced that the real question is *what holds and
> resolves a token value at runtime* — and that CSS-custom-properties-as-source-of-truth fails off-DOM / pre-attach
> JS consumers (constructor compute, worker/canvas, `console %c`; browser-validated). The answer is the injector
> WE **already ships** (`we:plugs/webinjectors/`), **not** a new provider. That generalises beyond categories to
> all theme tokens, so it was lifted into its own decision **#1682** (*theme tokens are JS-first, one-way synced
> to CSS*) with implementation **#1683**. **Fork 1 here no longer has two branches** — category vocabularies are
> simply one JS-first token family (`--cat-*`) carried by the injector and synced to CSS, *per #1682*. What
> remains open in THIS item is **Fork 2** (where `status` lives) plus how the taxonomy consumes #1682. **#1682
> is now ratified** (codified at `we:docs/agent/platform-decisions.md#tokens-js-first`), so this is now a thin
> consumer ruling.

## Recommended path at a glance

| Fork | Recommended default | Main (rejected) alternative | Confidence |
|------|--------------------|-----------------------------|------------|
| ~~**Fork 1** — provider realization~~ **→ DISSOLVED into #1682** | category vocabularies are **one JS-first token family (`--cat-*`) carried by the injector, synced to CSS** — *no new provider*; per #1682 (JS-first SoT, one-way CSS sync) | ~~(1a) declarative layer · (1b) runtime DI registry~~ — both superseded: CSS can't be the SoT (off-DOM), and the DI already exists (`webinjectors`) | resolved by #1682 |
| **Fork 2** — `status` home | **(2c)** status is **NOT** a provider set — lifecycle protocol + Status Indicator intent own it end-to-end; provider holds only `kind`/`tier`/`size` | (2a) provider holds status presentation as a segregated set · (2b) flat peer | **High** — skeptic REFUTED (2a)→(2c); `realizesIntent: status-indicator` settles it |

## What you have to decide

How an app's **categorical vocabularies** (kind, tier, size, status, …) are defined and consumed across
the many surfaces that style by them — so a category like `status: resolved` is defined **once** and read
identically by every surface, instead of each component (and each njk macro) re-hardcoding the palette.
Today `we:src/_includes/backlog-badges.njk` hardcodes ~10 macros' worth of per-category colours inline,
and the *same* status/kind/tier vocabulary independently colours badges, the numbered `childCircle`
link-circles, the `blockerChip` link-pills, and the filter row — each with its own copy of the palette.

## The model (current stance for review)

**One taxonomy provider holding N named closed category sets; each value carries presentation metadata;
any component consumes by `(set, value)`.**

```
taxonomy provider  (a single registry / project config — behaviour-free decorative/categorical sets only)
  kind:   { story:{token, icon?, shape?}, epic:{…}, decision:{…}, task:{…} }   ← closed list
  tier:   { A:{…}, B:{…}, C:{…} }                                              ← closed list
  size:   { sm:{…}, lg:{…}, xl:{…} }                                          ← closed list
  ── status is NOT here (Fork 2 ruling): owned by the lifecycle protocol +
     presented by the Status Indicator intent; consumers share that component.
```

Each row emits two artifacts from one source (Fork 1 amendment): colour → design tokens (CSS custom
properties, declarative); icon/shape/label → an enumerable manifest (a primary channel). Consumers name a
set + value, blind to the rest:

```
<we-tag set="kind" value="story">        border → var(--cat-tier-A-bg)   (declarative, no registry)
filterRow → manifest.enumerate("kind")   legend → manifest.iconFor("kind","epic")
```

This satisfies the three requirements that drove it:
- **Defined once** — each closed list lives in one place (the provider), not re-hardcoded per macro.
- **Shared** — badge, tag, circle, link, filter chip all resolve the same `kind`/`tier` set; no "story-blue"
  defined twice. (status is shared too, but via the Status Indicator component — Fork 2.)
- **Simple** — *one* provider, not one per category type; a new set (`size`) is added to the provider with
  zero component changes.

## Code example (Fork 1a, end-state)

**One source row per `(set, value)`** — project config, behaviour-free closed sets only; colour is a token
*reference*, icon/shape are the app-owned metadata no token standard models:

```jsonc
// project taxonomy config — one registry, N closed sets (config-extends-platform-default)
{
  "kind": {
    "story":    { "token": "--cat-kind-story",    "icon": "book",   "shape": "rounded" },
    "epic":     { "token": "--cat-kind-epic",     "icon": "layers", "shape": "rounded" },
    "decision": { "token": "--cat-kind-decision", "icon": "gavel" },
    "task":     { "token": "--cat-kind-task",     "icon": "check" }
  },
  "tier": { "A": { "token": "--cat-tier-A" }, "B": { "token": "--cat-tier-B" }, "C": { "token": "--cat-tier-C" } }
}
```

That single row emits **both** artifacts (single-source generation, can't drift): colour → DTCG tokens →
CSS custom properties (light/dark + contrast from the token machinery); icon/shape/label → the manifest.

**Styling is declarative everywhere — no render-time registry:**

```html
<we-tag set="kind" value="story">                  <!-- → style="background: var(--cat-kind-story-bg)" -->
<span class="childCircle" data-cat="kind:epic">    <!-- one parameterized rule keys off --cat-* -->
```

**A custom / runtime-added set is queried declaratively too** (the resolved amendment — *not* a blocker for
the static path): registering a dynamic set emits inline custom properties, so the **same `var()` read**
works with no rebuild. Imperative `resolve()` is never the styling path — only enumeration is runtime.

```js
// app registers a dynamic set (e.g. GitHub issue labels); provider sets the custom properties — no rebuild
taxonomy.register("label", { bug: { color: "#d73a4a" }, docs: { color: "#0075ca" } });
// → --cat-label-bug-bg / --cat-label-docs-bg on :root (or a scope element)
```
```html
<we-tag set="label" value="bug">   <!-- identical declarative read: var(--cat-label-bug-bg) -->
```

**The runtime manifest is for enumeration only** (build filter chips, draw a legend, resolve an icon) — the
genuinely-runtime cases, never styling:

```js
manifest.enumerate("kind")        // → ["story","epic","decision","task"]   build the filter row
manifest.iconFor("kind", "epic")  // → "layers"                              legend / icon-bearing surfaces
```

## Supported by default (grounded in the standard layer — not the fork)

- **Colour resolves through design tokens, not the provider directly.** WE already ships the
  `design-tokens` protocol (`we:src/_data/protocols/design-tokens.json` — W3C DTCG; runtime = native CSS
  custom properties; **a consuming project overrides via DTCG `extends`**). So per-category colour =
  project tokens (e.g. `--cat-kind-story-*`); the provider holds the **vocabulary + non-colour metadata**
  (icon presence, shape, label) and *references* tokens for colour.
- **Severity vs. category is already ratified.** #1427/#1458 statute
  (`we:docs/agent/platform-decisions.md`, "Tone extension"): the shared `--tone-*` palette in webtheme is
  **severity-family only** (`neutral·danger·success·warning·info·critical`); non-severity **`categorical`**
  identity colour is explicitly **intent-local**, never in the shared palette. So category identity colours
  legitimately live in *project* tokens, not the shared severity palette.
- **Theme is a skin only.** Which tone/icon a category maps to is *app config* (the provider), swappable
  independently of the theme; the theme renders tones→colour + geometry. (See the #1621 discussion: tone
  and icon-presence are **not** theming concerns.)
- **This is a token/provider concern, not a `we-tag` feature.** `we-tag` (#1669), `we-badge`, the circles,
  and the link-pills are all *consumers*; the category system sits above them.
- **Closed named sets, never raw hex (survey-unanimous).** Every surveyed system resolves a category through a
  *closed* named vocabulary backed by tokens; raw-colour props are a quarantined escape hatch (Primer's
  separate `IssueLabelToken` for user labels; Ant `Tag color`, explicitly un-vetted). WE keeps the closed-set
  discipline — a value resolves to a token, not an author-supplied hex.
- **The provider owns the `(set,value) → (token, icon, shape)` map — this is the contribution.** The survey
  found this map is **unmodeled in every token standard** (DTCG / Style Dictionary / Tokens Studio are
  NAME→value stores; the data-value→token-name step is left to app code — Chakra hand-writes `statusMap`). So
  a layer owning it is legitimately novel, not a reinvention. Colour is always a token *reference*; icon/shape
  are the genuine app extension no token standard covers (DTCG `$extensions` is the only spec slot if ever
  pushed into token files).
- **Accessibility cautions ride the design (survey Q5):** colour alone never carries a category — pair a
  label/icon; reserve status colours; lean on the token machinery's contrast/dark-mode guarantees (they hold
  only on engineered scales); cap a decorative set's size (~8, colour-blind-ordered).

## Fork 1 — DISSOLVED into #1682 (no longer a fork)

**This fork no longer has two coherent branches.** It was framed as *declarative token-resolving layer (1a)
vs runtime DI registry (1b)*. The 2026-06-23 discussion collapsed it:

- **CSS can't be the source of truth.** Both branches assumed the resolved colour lives in CSS custom
  properties and JS reads them via `getComputedStyle`. Browser-validated false for the consumers that matter:
  a **detached** element resolves an inherited/scoped var to `""` (no pre-attach / constructor read), and
  there is **no element at all** for a worker/OffscreenCanvas, a `console.log("%c", …)`, SSR, or a test. So a
  whole class of real consumers cannot be served by CSS-as-SoT.
- **The DI already exists — don't build a new one.** The "runtime registry" branch (1b) is unnecessary
  *because WE already ships the injector* (`we:plugs/webinjectors/` + `webcontexts`). The right model is
  **JS-first source of truth (the injector), one-way synced to CSS custom properties** for the paint path —
  which is **not** "resolve per pill at render": paint stays declarative `var(--cat-*)`, only *compute* reads
  the injector.

That answer **generalises beyond categories to all theme tokens** (colour, layout, spacing, fonts, radii), so
it was lifted into its own decision **#1682** (*theme tokens are JS-first, one-way synced to CSS*) with the
build in **#1683**. The historical 1a/1b reasoning + survey live in the
[session report](../reports/2026-06-23-categorical-taxonomy-provider.md) and #1682.

**What this leaves for #1670:** category vocabularies are **one JS-first token family** — `kind`/`tier`/`size`
sets whose `(set, value)` rows carry `{ token-ref, icon, shape }`, carried by the injector and synced to
`--cat-*` per #1682. There is no new "taxonomy provider" mechanism; the *contribution* shrinks to **the
category meta-schema + closed-set discipline** layered on #1682's token runtime. The remaining live question
in this item is **Fork 2** (below) + the thin "how categories consume #1682" consumer shaping. **#1682 is now
ratified** (`we:docs/agent/platform-decisions.md#tokens-js-first`), so this is a fast consumer ruling.

> The `## Code example` and `## The model` sections above predate this dissolution — read them as the category
> *meta-schema* (closed sets, `(set,value) → {token,icon,shape}`), not as a standalone provider/registry. The
> *runtime* is #1682's injector, not a new layer.

## Fork 2 — `status`: lifecycle-owned meaning + provider-rendered presentation

*Fork-existence (the broken branch):* treating `status` as a **flat decorative peer of `kind`/`tier`** is
broken — the **Web Lifecycle** protocol (`we:src/_data/protocols/lifecycle.json`) already owns which status
values exist *and their transitions/rules* (Status Indicator "reads the same lifecycle provider"), so a flat
peer **duplicates/forks that authority** and drops the reserved-colour + pair-with-label discipline the survey
shows status demands. The coherent branches are about *where status's presentation lives*, given its meaning
is lifecycle-owned.

**Crux:** kind/tier/size are pure presentation (no behavioural owner); `status` has one (the lifecycle). The
survey splits: meaning-owned-elsewhere (Primer `StateLabel`, Atlassian `Lozenge`, M3 reserved `error`, Ant
`Badge status`) vs one-registry-with-segregation (Adobe `StatusLight`).

- **(2c) status presentation lives in the Status Indicator intent (reading the lifecycle); status is NOT a
  taxonomy-provider set.** *(recommended — flipped from (2a) by the skeptic pass)* The taxonomy provider holds
  only the pure-presentation sets (`kind`/`tier`/`size`); `status` is owned end-to-end by the lifecycle
  protocol (`we:src/_data/protocols/lifecycle.json`, `realizesIntent: status-indicator` + its
  `CustomLifecycleProvider`) and presented by the Status Indicator intent/component. Cross-surface reuse for
  status comes from **sharing the component**, not smuggling its colour row into a sibling registry.
- **(2a) Lifecycle owns meaning; the provider holds status *presentation* as a segregated rule-bearing set.**
  *Rejected on the skeptic pass* — re-creates the two-place join it claims to avoid (status values in the
  lifecycle protocol, status presentation in the provider → a render-time join), and the lifecycle protocol
  *already* assigns status presentation to the Status Indicator intent. Adobe Spectrum
  (one-registry-with-segregation) is outweighed by the repo's own committed architecture.
- **(2b) status as a flat peer of kind/tier in the provider.** *Rejected* — survey-unanimous against; forks
  lifecycle authority; loses status discipline.

**Recommended default: (2c).** Confidence **high** (raised after grounding) — the lifecycle protocol's
`realizesIntent: status-indicator` settles where status presentation lives.

`Skeptic: REFUTED → flipped (2a)→(2c).` Verified against the file: the lifecycle protocol
(`we:src/_data/protocols/lifecycle.json`) already makes status presentation the Status Indicator intent's job
(`realizesIntent: status-indicator`), so (2a) would split status presentation (provider) from its values
(lifecycle) — the exact two-place join #1670 exists to kill. And the "one consumption surface" (2a) sold is
illusory: every real status consumer already special-cases it with lifecycle-aware logic (`epicStatusBadge`'s
derived `all slices done`/`open slices`; `reasonPill`'s `parked`+reason sub-vocabulary; `statusBadge`'s
`preparing`→"Prepping"; `blockerChip`'s cleared/blocking glyph) — none is a flat `resolve(status, value)`. So
status is **out** of the provider; the provider is purely the behaviour-free decorative/categorical sets —
exactly the Tag intent's `categorical` territory.

## Classification (per-fork pass)

- **Which layer?** The category *meta-schema* (a named closed set of values → presentation metadata) is a WE
  **standard** concern; the *contents* (an app's actual kind/tier/size lists + token mappings) are **project
  config** (config-extends-platform-default); the *consumption* is **FUI** components (#1669 et al). Colour
  values are the `design-tokens` protocol.
- **Protocol or intent dimension?** Closest to a **protocol** (a cross-component contract + provider, like Web
  Lifecycle), not a single intent dimension — multiple intents (Tag, Status Indicator) and non-intent surfaces
  (circles, borders, links) consume it.
- **Expose the whole axis / most-permissive default?** Yes — the set vocabulary is **open** (an app adds
  `size` without touching components), per the intents-open-design principle (standardize the meta-schema,
  not the lists) + most-flexible-default.
- **Fixed mechanic or dimension? DI-injectable?** A dimension (apps define their own sets); DI-injectable
  *where consulted at runtime* (Fork 1a's manifest), declarative otherwise.
- **Seam between intents?** This is the shared substrate Tag and Status Indicator both resolve against — the
  seam is real, which is why it's a provider/protocol, not a per-intent feature.

## Consumers / downstream (each becomes a consumer of this decision)

- **#1669** (FUI `we-tag` block) — consumes the provider by `(set, value)`; its category-consumption API is
  shaped by this decision (so `blockedBy` #1670).
- **#1621** — Fork 1's taxonomy half is *subsumed* by this: taxonomy surfaces consume the provider, not a
  `we-tag` "categorical tone" in isolation. #1621's status half + Fork 2 + delivery sub-fork are unaffected.
- **#1598 / #1208** — the taxonomy-surface migration consumes the provider; the status-surface migration
  does not depend on it.

## Lineage

Emerged from the #1621 ratification review (2026-06-23): reviewing the `tag` intent
(`we:src/_data/intents/tag.json`) → the #1319 Status-Indicator/Tag/Notification-Marker decomposition →
the realisation that categorical styling is cross-surface and provider/token-shaped, not a tag feature.
Relates to #1427/#1458 (tone tokens), the `design-tokens` protocol, and the Web Lifecycle protocol. The
gating gap that hid this is tracked by #1668.
