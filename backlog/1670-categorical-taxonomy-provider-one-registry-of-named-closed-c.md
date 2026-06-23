---
kind: decision
status: open
dateOpened: "2026-06-23"
tags: [tag-intent, design-tokens, provider, taxonomy, cross-surface]
---

# Categorical taxonomy provider: one registry of named closed category sets, consumed cross-surface by tag/badge/circle/etc.

Surfaced reviewing #1621/#1669: an app's categorical vocabularies (kind, tier, size, status) are closed lists reused across many surfaces — badge, tag, the numbered childCircle, filter chips, borders, links — not a tag/badge feature. Propose ONE taxonomy provider holding N named closed category sets, each value mapping to presentation metadata (design-token color, icon, shape), consumed by any component via (set, value): defined once, shared everywhere, simple. Severity tones stay the shared webtheme palette (#1427/#1458 statute); category identity is project tokens via DTCG extends. Open sub-fork: how status relates to the existing Web Lifecycle provider. Reshapes #1669/#1621/#1598/#1208 into consumers.

> **Status: open, awaiting review** (emerged from the #1621 ratification discussion, 2026-06-23 — not yet
> prepared; no `preparedDate`). Captured here so the design isn't lost; the forks below state the current
> stance for review, not a ratified ruling.

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
taxonomy provider  (a single registry / project config)
  kind:   { story:{tone|token, icon?, shape?}, epic:{…}, decision:{…}, task:{…} }   ← closed list
  tier:   { A:{…}, B:{…}, C:{…} }                                                   ← closed list
  size:   { sm:{…}, lg:{…}, xl:{…} }                                                ← closed list
  status: { open:{…}, active:{…}, resolved:{…} }                                    ← closed list
```

Consumers name a set + value, blind to the rest:

```
<we-tag set="size" value="xl">          <we-badge set="status" value="active">
childCircle → resolve(status, value)     filterRow → enumerate(set="kind")
```

This satisfies the three requirements that drove it:
- **Defined once** — each closed list lives in one place (the provider), not re-hardcoded per macro.
- **Shared** — badge, tag, circle, link, filter chip all resolve the same `status` set; no "resolved-green"
  defined twice.
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

## Fork — how does `status` relate to the existing Web Lifecycle provider?

`status` is special: the **Web Lifecycle** protocol (`we:src/_data/protocols/lifecycle.json`) already owns
"what states exist" **plus their transitions/rules** (Status Indicator "reads the same lifecycle
provider"). Pure-presentation sets (kind/tier/size) have no such behavioural owner. So:

- **(i) Taxonomy provider holds presentation only; status presentation *references* the lifecycle provider.**
  *(recommended)* Behaviour-bearing sets keep their authority in their own protocol (lifecycle is the single
  source for what states exist + legal transitions); the taxonomy provider references them for presentation.
  Avoids defining "what statuses exist" in two places, while still giving one consumption surface.
- **(ii) The single taxonomy provider is the unification point; lifecycle-backed sets register *into* it.**
  Simpler one-stop registry, but risks duplicating/forking the lifecycle's authority over states.

**Current lean: (i).** Confidence **medium-high** on the single-provider model overall; the (i)/(ii) seam
is the genuine open sub-call. Confirm against `[[feedback_runtime_di_vs_devtools_provider_seam]]` — the
provider is true runtime-DI only where a running surface *consults* it (enumerating sets to build filter
chips/legends, resolving a value's icon); for static per-value styling, DTCG tokens resolve declaratively
with no registry consulted.

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
