---
kind: decision
status: open
dateOpened: "2026-06-23"
dateStarted: "2026-06-23"
preparedDate: "2026-06-23"
relatedReport: reports/2026-06-23-categorical-taxonomy-provider.md
tags: [tag-intent, design-tokens, provider, taxonomy, cross-surface]
---

# Categorical taxonomy provider: one registry of named closed category sets, consumed cross-surface by tag/badge/circle/etc.

Surfaced reviewing #1621/#1669: an app's categorical vocabularies (kind/tier/size) are closed lists reused across many surfaces — badge, tag, childCircle, filter chips, borders, links — not a tag feature. Propose ONE taxonomy provider holding N named closed sets, each value → presentation metadata (design-token colour, icon, shape), consumed via (set, value): defined once, shared, simple. Prepared: the provider is a declarative token-resolving layer, not a runtime DI service (Fork 1); status stays lifecycle/Status-Indicator-owned and OUT of the provider, which holds only kind/tier/size (Fork 2). Severity tones stay the shared webtheme palette (#1427/#1458). Reshapes #1669/#1621/#1598/#1208 into consumers.

**Prepared 2026-06-23.** Grounded in the real tree + a prior-art survey of how leading design systems model
app-defined categorical vocabularies, published as the `/research/` topic
[categorical-taxonomy-provider](/research/categorical-taxonomy-provider/) (session report:
[we:reports/2026-06-23-categorical-taxonomy-provider.md](../reports/2026-06-23-categorical-taxonomy-provider.md)).
The survey **reshaped the framing**: the original single "status in/out" sub-fork became two forks — it
added the **mechanism** fork (the "one provider" instinct is right, but no system ships a runtime
`(set,value)` registry → make it a declarative token-resolving layer) and refined the **status-home** fork
(not binary — lifecycle owns meaning, the provider holds presentation as a segregated rule-bearing set). The
core contribution (provider owns the value→token/icon/shape map) is the documented industry whitespace.
Each `## Fork N` carries a bold default already attacked by a skeptic sub-agent (`Skeptic:` line). Still
**open** — this is prepared for ratification, not a ruling.

## Recommended path at a glance

| Fork | Recommended default | Main (rejected) alternative | Confidence |
|------|--------------------|-----------------------------|------------|
| **Fork 1** — provider realization | **(1a, amended)** declarative **token-resolving layer** — colour → CSS custom properties; icon/shape/label → an enumerable **manifest (a primary channel)**; compile to tokens not per-value classes; runtime manifest canonical | (1b) runtime DI registry components query at render | **High** — skeptic SURVIVES-WITH-AMENDMENT |
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

## Fork 1 — Provider realization: declarative token-resolving layer vs runtime DI service

*Fork-existence (the broken branch):* a **runtime JS registry that every component queries at render**
(`provider.resolve(set, value)`) to get its colour is broken for the static-styling majority — **no surveyed
system does it** (the shared layer is always declarative tokens, NAME→value); it forfeits the token
machinery's light/dark + contrast guarantees, and adds a render-time dependency to a board of hundreds of
inert pills. So the two branches genuinely differ on an end-state mechanism.

**Crux:** the same need has two surfaces — *static styling* (paint this pill) wants declarative tokens; *dynamic
enumeration* (build the filter chips from the live `kind` set, draw a legend, resolve a value's icon) wants a
queryable list. The fork is which is the *primary* shape.

- **(1a) Declarative token-resolving layer.** *(recommended)* The provider is project config that **compiles**
  each `(set, value)` to design tokens (the `design-tokens` protocol, via DTCG `extends`) + a stable class
  (`cat-kind-story`); surfaces resolve declaratively through CSS custom properties — zero runtime registry for
  styling. A **thin enumerable manifest** exposes the closed sets + per-value metadata (icon/shape) for the
  genuinely-runtime cases only. This is runtime-DI *exactly where a surface consults it* and declarative
  everywhere else — the runtime-DI-vs-devtools-provider seam test applied per-use, not globally.
- **(1b) Runtime DI registry service.** Components call `resolve(set, value)` at render for everything.
  *Rejected* — unprecedented in the survey; forfeits token guarantees; render-time cost on every pill.

**Recommended default: (1a), amended.** Confidence **high** — the prior art is unanimous that cross-surface
colour is declarative tokens, and the value→token map is the app-owned layer this provider supplies.

`Skeptic: SURVIVES-WITH-AMENDMENT.` The attack ("the manifest isn't thin — icon/shape/label aren't
CSS-expressible, so *most* of the named surfaces (`childCircle`, `blockerChip`, filter row, legend) hit it on
every render, so the static/runtime split is mis-drawn") landed, but didn't flip to (1b) — colour genuinely
benefits from staying in CSS custom properties (cascade, dark-mode, no FOUC, no render cost, contrast
guarantees), so a render-time `resolve()` is strictly worse for colour. Amendments folded in:
1. **Two first-class channels, not "thin manifest."** (a) colour → compiled CSS custom properties
   (declarative, the cascade does the work); (b) icon/shape/label → an **enumerable manifest that is a
   primary, expected-on-every-non-trivial-render channel**, not an escape hatch. Don't under-build it.
2. **Compile to tokens, *not* also to per-value classes.** A `cat-kind-story` class per value is dead weight
   on top of the custom property — a surface applies `style="background: var(--cat-kind-story-bg)"` (or one
   parameterized class + `data-cat`). The class explosion (set×value) is the real cost; drop it.
3. **The runtime manifest is canonical; class/token *compilation* is a build-time optimization for the
   static subset.** So a dynamic / user-added set (GitHub-issue-label case) degrades to "manifest lookup +
   inline custom property" with no rebuild — keeps the meta-schema honest as a *standard*, not a build-only
   artifact.
4. **Single-source generation** — the `(set,value)→(token,icon,shape)` row is the one source; it emits both
   the token artifact and the manifest, so they can't drift.

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
