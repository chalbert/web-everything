# Categorical taxonomy provider — prep research (decision #1670)

**Date:** 2026-06-23 · **Decision:** [#1670](/backlog/1670-categorical-taxonomy-provider-one-registry-of-named-closed-c/)
· **Surfaced from:** the #1621 ratification review (badge mode-C migration).

## The question

An app has several **categorical vocabularies** — `kind` (story/epic/decision/task), `tier` (A/B/C),
`size` (sm/lg/xl), `status` (open/active/resolved). Each is a **closed named set**. The *same* vocabulary
is consumed across many surfaces — a status badge, a tag, the numbered `childCircle`, the `blockerChip`
link-pill, a filter chip, a row border — each of which today re-hardcodes the palette
(`we:src/_includes/backlog-badges.njk`, ~10 macros). How is a category defined **once** and consumed
**identically** everywhere, instead of N copies of "resolved-green"?

The stance going into prep (from the #1621 discussion): **one taxonomy provider** holding N named closed
sets, each value → presentation metadata (color via design token, icon, shape), consumed by any component
via `(set, value)`. Open sub-call: how `status` relates to the existing Web Lifecycle provider.

## Prior-art survey (how leading systems do it)

Surveyed Primer, Atlassian, Polaris, SLDS, Spectrum, Radix, Material 3, Ant, Chakra + the token standards
(W3C DTCG, Style Dictionary, Tokens Studio).

**Q1 — app-defined category colors.** Overwhelmingly a **closed named pick-list resolved through design
tokens**, never raw hex. Raw-color props are rare and quarantined as an explicit escape hatch: Primer ships
a *separate* `IssueLabelToken` with a `fillColor` hex purely for user-created issue labels (system
categories use the closed-enum `Label`); Ant's `Tag color` accepts hex but is explicitly un-vetted (WCAG
only guaranteed through engineered palettes). Atlassian `Tag` = a fixed ~22-value enum, *no* hex at all.
Polaris `Badge` tone is closed ("only create a new option if none exists"); its `Tag` exposes no color API.

**Q2 — single registry vs per-component.** The dominant pattern is a **single shared token/role layer that
every surface reads**, propagated from one root provider (Ant `ConfigProvider`, Chakra `createSystem`, MUI
`ThemeProvider`, Spectrum `<sp-theme>`, Radix `Theme` with cascading accent). Components take a *named* prop
(`tone`/`color`/`accentColor`/`colorPalette`) that resolves through that shared layer. **No surveyed system
ships a runtime registry mapping a domain `(set,value)` → presentation that multiple components query.** The
shared layer is always **NAME → token**, never **data-value → token**.

**Q3 — tokens vs runtime provider.** Unanimous: **design tokens / CSS custom properties consumed
declaratively**, never a JS registry queried at render. Tiered tokens (ref→sys→comp); theme/set switching
swaps which token set is *active* (CSS class / provider), not a JS map re-run. The token standards (DTCG,
Style Dictionary, Tokens Studio) are all **NAME → value** stores — and crucially, **the step from a domain
data value (`status === "resolved"`) to which token to use is unmodeled in every one of them; it is left to
application code.** Chakra's own Status docs literally hand-write `const statusMap: Record<Status,
ColorPalette> = {...}` — "the application determines which color palette to apply." DTCG `$extensions` is the
only spec-sanctioned slot to stash such a map.

**Q4 — status/lifecycle vs decorative category.** Most systems distinguish them, in two camps: (a) *separate
component / meaning owned elsewhere* — Primer `StateLabel` (lifecycle, matched icons) vs `Label`/`IssueLabelToken`;
Atlassian `Lozenge` vs `Tag`; Polaris `Badge` vs `Tag`; M3 reserved `error` role; Ant `Badge status` vs `Tag`;
(b) *same registry, segregated rule-bearing set* — Adobe Spectrum `StatusLight` (semantic value-set with fixed
meanings + contrast gates, distinct from its non-semantic decorative colors). Spectrum is the strongest direct
precedent for "one registry with segregation."

**Q5 — anti-patterns.** Never raw hex / never base tokens directly (Primer, SLDS, Ant); don't widen a closed
semantic enum with product taxonomy (Polaris); reserve status colors (Polaris/Atlassian); color alone never
carries status — pair label/icon (Atlassian, Spectrum); contrast/dark-mode guarantees only hold on
token-engineered scales (Radix 11/12, M3 `on-*`, Spectrum index); cap decorative categories (~8, Spectrum).

## Delta — what the survey did to the proposal

- **"One provider" — supported in spirit, reshaped in mechanism.** The single-shared-source instinct is
  universal, but no one ships a *runtime JS registry* for it. → realize the provider as a **declarative
  token-resolving layer**, not a render-time DI service. (This became **Fork 1**.)
- **"Provider holds vocabulary+metadata, tokens hold color" — strongly supported; it's the actual gap.**
  The `(value) → token-name` map is unmodeled everywhere and left to app code. A layer that owns it (plus
  icon/shape, which no token standard covers — DTCG `$extensions` is the only slot) is legitimately novel,
  not a reinvention. → keep, as a **Supported-by-default** core; color must always be a token reference.
- **"status in/out" — not binary; prior art splits, both have precedent.** → reframed **Fork 2**: lifecycle
  owns *which status values exist + their meaning*; the taxonomy provider holds/references only their
  *presentation row*, and if status sits in the provider it is a **segregated rule-bearing set** (Spectrum),
  never a flat peer of kind/tier (Primer/Atlassian/M3/Ant).

## Sources

Primer Label/Token: https://primer.style/components/label/ · https://primer.style/product/components/token/ ·
Atlassian Tag/Lozenge: https://atlaskit.atlassian.com/packages/design-system/tag · https://atlassian.design/foundations/color ·
Polaris Badge/Tag: https://polaris-react.shopify.com/components/feedback-indicators/badge · https://github.com/Shopify/polaris-react/discussions/6579 ·
SLDS hooks: https://developer.salesforce.com/docs/platform/lwc/guide/create-components-css-custom-properties.html ·
Radix color: https://www.radix-ui.com/themes/docs/theme/color · https://www.radix-ui.com/colors/docs/palette-composition/understanding-the-scale ·
Material 3: https://m3.material.io/styles/color/roles · https://m3.material.io/styles/color/advanced/adjust-existing-colors ·
Spectrum: https://react-spectrum.adobe.com/react-spectrum/Badge.html · https://react-spectrum.adobe.com/react-spectrum/StatusLight.html ·
Ant: https://ant.design/components/tag/ · https://ant.design/components/badge/ ·
Chakra: https://chakra-ui.com/docs/theming/semantic-tokens · https://chakra-ui.com/docs/components/status ·
DTCG: https://www.designtokens.org/TR/drafts/format/ · Style Dictionary: https://styledictionary.com/info/tokens/ ·
Tokens Studio: https://docs.tokens.studio/manage-tokens/token-sets/
