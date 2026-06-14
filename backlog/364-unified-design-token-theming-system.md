---
type: decision
workItem: story
size: 8
parent: "315"
status: resolved
dateOpened: "2026-06-12"
dateStarted: "2026-06-12"
dateResolved: "2026-06-12"
graduatedTo: "project:webtheme"
preparedDate: "2026-06-12"
relatedReport: reports/2026-06-12-design-token-theming-system.md
tags: [gap-analysis, design-tokens, theming, native-first, color-scheme, intents, dtcg]
relatedProject: webintents
crossRef: { url: /research/design-token-theming-system/, label: "Design-token survey" }
---

# Unified design-token / theming system

## Ruling (2026-06-12) — RESOLVED

Decided in session `364-unified-design-token-theming-system`. All four forks ratified:

- **Fork 1 (home): RATIFIED — new Web Project `webtheme`.** The deferred technical half of #010, a peer of
  `webintents`, owning the token taxonomy + DTCG↔CSS mapping + the platform default token set. Sub-decision
  ratified: ships a **complete default token set**; consuming projects override via `extends`
  (config-extends-platform-default).
- **Fork 2 (format): RATIFIED — adopt DTCG 2025.10 as authoring/interchange, compile to native CSS runtime.**
  Conform to the now-stable W3C standard (the one legitimate Protocol per Q2); don't coin a WE-native schema.
- **Fork 3 (taxonomy + #010 seam): RATIFIED — 3-tier, semantic tier owned by the existing intents.** Tokens
  own **primitive + component**; the intents (`surface.elevation`, `density`, `typography`, `motion`,
  theme-color's `scheme`/`contrast`/`accent`) remain the **semantic** tier. No parallel semantic vocabulary.
  Authoring the theme-color intent itself stays #010's separate `/new-standard` build, which this feeds.
- **Fork 4 (scheme + accent derivation): RATIFIED — A′ (derive + contrast-validation gate).** Native
  derivation (`light-dark()` / relative-color / `color-mix`) **validated against WCAG/APCA per step**, so
  accessibility is by-default; curated scales are a brand-precision override, not the accessibility safety
  net. A follow-up research pass (MD3 HCT auto-contrast + Adobe Leonardo) moved this from low to **med-high**
  and refuted the prep's original "derivation can't guarantee contrast" premise — see References.

**Graduation:** spin-off `blockedBy` chain in dependency order — `webtheme` project + DTCG↔CSS mapping (Forks
1–2) → primitive + component token tiers + platform default set (Fork 3) → scheme/accent runtime +
curated-override path (Fork 4). `graduatedTo: webtheme`.

---

**Prepared decision — ratified 2026-06-12 (was: ready to ratify).** No design exists yet; this is the **design-token *project*** that
[#010](/backlog/010-gap-3-theme-color-intent/) deferred as *"the technical half — token elaboration, not
an intent dimension."* The four forks below are grounded in a prior-art survey published as
[`/research/design-token-theming-system/`](/research/design-token-theming-system/) (session report
`reports/2026-06-12-design-token-theming-system.md`) covering the native CSS substrate + the
`references.json` benchmark design systems. Each fork carries a **bold** recommended default; the survey
*dissolved* a latent fork (does the token project re-name semantic roles? — no, intents already do) and
*sharpened* the real one (Fork&nbsp;4, accent derivation). Gap #4 `design-tokens-theming` from the
[#347](/backlog/347-capability-mapping-gap-detection/) coverage sweep.

## The axis

WE already owns the **semantic tier** of a token system as Intents — `surface`
([intents.json:997](src/_data/intents.json#L997)) names elevation (a `0-5` semantic scale) + texture;
`density` ([intents.json:20](src/_data/intents.json#L20)), `typography`
([intents.json:960](src/_data/intents.json#L960)), `motion` ([intents.json:3](src/_data/intents.json#L3)),
and the still-unauthored theme-color intent (#010 resolved its dimensions `scheme`/`contrast`/`accent`
but it is **not yet in [intents.json](src/_data/intents.json)**) name the rest. What WE lacks is the
**concrete-value layer** those semantic roles resolve into — the primitive scales (spacing, radius,
elevation/shadow, type ramp, color palette) and the per-component overrides. The benchmark systems are
unanimous that this layer is a **primitive → semantic → component** taxonomy (MD3 ref/sys/comp; Fluent
global/alias; Spectrum; Radix scales→aliases; Apple dynamic system colors). The concern decomposes into
four orthogonal axes: **home** (what layer is the token project), **format** (how tokens are authored +
made portable), **taxonomy + seam** (the tiers, and which tier the existing intents own), and **theming**
(how schemes + accent scales are produced). The runtime substrate is *not* a fork — native-first settles
it: CSS custom properties + `@property` + `light-dark()`/`color-scheme` + relative-color/`color-mix`, all
Baseline since 2024.

### Per-fork classification (the 7-question pass, recorded)

- **Layer (Q1):** not a Block (no single runnable UX), not an Intent (concrete values, not UX-"what" —
  [intent-UX-only](/research/design-token-theming-system/) is codified). It is a **Project** owning a
  data model + a native-substrate mapping → **Fork 1**.
- **Protocol or not (Q2):** the token *format* has a real swappable-vendor interop story (DTCG ⇄ Style
  Dictionary ⇄ Figma) — the one place a Protocol is warranted. But WE should **adopt the external
  standard (DTCG)** rather than coin one (minimize-lock-in) → **Fork 2**.
- **Expose the whole axis (Q3) / fixed-vs-dimension (Q4):** the tier taxonomy is a fixed mechanic (every
  system has it); the *theming* axis (scheme, accent derivation) has legitimate end-states on both
  branches → a configurable dimension → **Fork 4**.
- **DI-injectable (Q5) / most-permissive default (Q6):** the platform ships a **complete default token
  set**; a project overrides via `extends` (config-extends-platform-default doctrine) — the permissive
  default is "native-runtime, themeable at runtime" → folded as Fork 1's sub-decision.
- **Seam between intents (Q7):** the semantic tier *is* the intents; tokens sit beneath them. Standing
  bias **separate + decouple** → tokens own primitive + component, intents keep semantic → **Fork 3**.

## Recommended path at a glance

| Fork | Recommended default | Main alternative | Confidence |
|---|---|---|---|
| **1 · Home / layer** | New **Web Project** (`webtheme`), the deferred technical half | Capability tiered per impl | High |
| **2 · Format** | Adopt **DTCG 2025.10** as authoring/interchange, compile to native CSS runtime | Coin a WE-native token schema | High |
| **3 · Taxonomy + #010 seam** | **3-tier** (primitive · semantic · component); **semantic tier owned by the existing intents** | Token project re-names all three tiers itself | Med-high |
| **4 · Scheme + accent derivation** | **A′ — derived default + contrast-validation gate** (native derivation, WCAG/APCA-checked; curated scales = brand-precision override) | bare-A (accessibility opt-in) · B (curated-by-default, Radix 12-step) | **Med-high** (was low; follow-up research on MD3 HCT + Adobe Leonardo moved it) |

## Fork 1 — What layer is the token system?

**Crux:** #010 named "a full design-token *project*" as the deferred technical half. Classification (Q1)
rules out Block + Intent: there is no single runnable UX and the layer carries *concrete values*, not the
declarative "what" intents own. The realistic homes:

- **A. New Web Project — `webtheme` (or `webtokens`).** A peer of `webintents`
  ([projects.json](src/_data/projects.json) lists 26 projects; no token/theme project exists yet) owning
  the token taxonomy, the DTCG↔CSS mapping, and the platform default token set. Matches #010's "design-token
  *project*" language and keeps the concern out of the intents.
- **B. A Capability**, tiered per impl in the capabilityMatrix. Fits "platform feature, varies per impl,"
  but a token *system* is a standard with a data model + format — heavier than a capability flag.
- **C. Fold into the theme-color intent (#010).** *Rejected* — violates intent-UX-only: tokens are
  concrete values, exactly what #010's resolution said is *not* an intent dimension.

**Recommended default: A — a new Web Project, working name `webtheme`.** It is what #010 deferred, it sits
cleanly beside `webintents`, and it gives the concrete-value layer a home without polluting the intents.
*Sub-decision (high confidence, settled by config-extends-platform-default + native-first doctrine):* the
project ships a **complete default token set** (native-first values); a consuming project overrides by
**`extends`-ing** that default rather than defining tokens from scratch.

*Rejected:* B (under-powered for a format-bearing standard), C (intent-UX-only violation).

## Fork 2 — Token authoring / interchange format

**Crux:** how tokens are *declared* and made portable. The survey's strongest signal: the **W3C Design
Tokens Community Group reached its first stable format (DTCG 2025.10) on 2025-10-28**, a vendor-neutral
JSON format (`$type`/`$value`, `{group.token}` aliasing) with 10+ tool implementations (Style Dictionary,
Tokens Studio, Figma, Terrazzo).

- **A. Adopt DTCG 2025.10** as the authoring/interchange format; compile it to the native CSS substrate
  (custom properties + `@property`) as the runtime tier. WE conforms to an external standard with a real
  swappable-vendor story (the one legitimate Protocol per Q2) instead of coining its own.
- **B. Coin a WE-native token JSON schema.** *Rejected* — reinvents a now-stable W3C standard; lock-in
  for zero interop gain (minimize-lock-in: a protocol is the single escapable lock, never coined casually).
- **C. CSS custom properties *are* the source of truth, no JSON layer.** *Rejected as source* (kept as the
  runtime output) — loses the multi-tool / multi-platform portability DTCG exists to provide.

**Recommended default: A — adopt DTCG 2025.10 as the interchange format, native CSS as the runtime tier.**
DTCG is the escapable interop lock; CSS custom properties are the always-present runtime. This is also the
native-first-of-formats choice: align to the platform standard, don't fork it.

## Fork 3 — Tier taxonomy + the relationship to the #010 intent

**Crux:** how many tiers, and — the heart of "relationship to the theme-color intent" — **which tier owns
the semantic roles.** The field is unanimous on **primitive → semantic → component** (MD3 ref/sys/comp,
Spectrum global/alias/component; Fluent collapses to global/alias). The WE-specific reframe the survey
surfaced: WE *already* names semantic roles as Intents — `surface.elevation` (a `0-5` scale,
[intents.json:997](src/_data/intents.json#L997)), `density`, `typography`, `motion`, theme-color's
`scheme`/`contrast`/`accent`. They **are** WE's semantic/system tier.

- **A. 3-tier, semantic tier owned by the existing intents.** Tokens own the **primitive** scale (raw
  spacing/radius/elevation/color values) + the **component** tier (per-component overrides); the
  **semantic** tier stays the intents. The intent's `accent` ref resolves *into* a primitive token; no
  parallel vocabulary is coined.
- **B. The token project defines all three tiers itself**, including a fresh semantic naming. *Rejected* —
  duplicates the intents' semantic vocabulary, re-couples what is already separated, and would have intents
  and tokens disagree on role names (violates separate-and-decouple + intent-UX-only).
- **C. 2-tier (global/alias), component implicit** (Fluent's shape). Viable but loses the component-override
  tier MD3/Spectrum ship; foldable into A by treating component overrides as an optional layer.

**Recommended default: A — 3-tier, with the semantic tier owned by the existing intents; tokens own
primitive + component.** This is the structural answer to "relationship to #010": the intent stays the
semantic "what," the token project supplies the concrete values it resolves to. *Sub-decision:* authoring
the theme-color intent itself (still absent from `intents.json`) remains #010's separate `/new-standard`
build — this project provides the values that intent's `accent` points into, and should land after it.

## Fork 4 — Scheme + accent-derivation model

**Crux:** how light/dark/contrast schemes and accent/state scales are *produced*. This is the one fork the
libraries genuinely diverge on, so it carries the real judgment. The native substrate (Baseline since
2024) does it at runtime with no build step: `light-dark()` + `color-scheme` for schemes,
`prefers-contrast` for contrast, relative color syntax (`oklch(from …)`) + `color-mix()` to derive a whole
scale from a single accent. **But Radix ships deliberately hand-curated 12-step scales** instead of
auto-deriving, because naive derivation can miss WCAG contrast at specific steps.

- **A. Native-runtime default + curated-scale opt-in.** Default to native derivation (`light-dark()` /
  relative-color / `color-mix`) — most-permissive, zero build step, runtime-themeable — and let a brand
  *override* specific steps with hand-curated values where contrast must be guaranteed.
- **B. Curated explicit per-scheme scales as the default** (Radix's choice). Guarantees contrast at every
  step but is heavier, less native, and requires authoring a full scale per scheme up front.
- **C. Native-only, no curation escape hatch.** *Rejected* — accessibility risk: forecloses the WCAG-fix
  Radix exists to provide.

- **A′ (recommended). Native/derived default *with a contrast-validation gate*; curated scales as a
  brand-precision override.** Derive scales natively (`light-dark()` / relative-color / `color-mix`) but
  **validate each step against WCAG/APCA and auto-correct or flag where a step fails** — so accessibility is
  *by default*, not opt-in. Curated scales become a brand-precision override, not the accessibility safety
  net. This dissolves the A-vs-B tension rather than trading one doctrine (most-permissive/native-first) for
  the other (accessibility-by-default).

**Recommended default: A′ — derived default + contrast-validation gate.** The original prep leaned bare-A
("curated as opt-in") at **low confidence**, on the single data point that *Radix hand-curates because naive
derivation misses WCAG*. A follow-up research pass (2026-06-12) closed that one-sidedness and **raised the
confidence to med-high**: **[Material Design 3's HCT tonal palettes](https://m3.material.io/styles/color/system/how-the-system-works)
auto-derive *with* a built-in contrast model** (tone `T` is perceptual luminance; the algorithm pairs tones
for guaranteed 3:1 / 7:1, and "every color in the M3 colorScheme meets WCAG"), and
**[Adobe Leonardo](https://github.com/adobe/leonardo)** ships contrast-ratio-first scale generation as open
source. So *derivation + a contrast gate* is the mainstream accessible-derivation pattern, not a hope — Radix
is one of two mature strategies, not the divergence. Bare-A (accessibility opt-in) and bare-B (curate-by-
default, heavier, less native) are both rejected: A′ keeps zero-author-burden + native + runtime-themeable
*and* accessibility-by-default. **Confidence: med-high** (was low — the follow-up research moved it).

---

## References

Grounded in the [prior-art survey](../reports/2026-06-12-design-token-theming-system.md) (published as
[`/research/design-token-theming-system/`](/research/design-token-theming-system/)). External sources, by fork:

**Format (Fork 2) — DTCG**
- [DTCG — first stable version announcement (2025-10-28)](https://www.w3.org/community/design-tokens/2025/10/28/design-tokens-specification-reaches-first-stable-version/)
- [Design Tokens Format Module 2025.10](https://www.designtokens.org/tr/2025.10/format/) · [Style Dictionary DTCG support](https://styledictionary.com/info/dtcg/)

**Native CSS substrate (Forks 1, 4) — Baseline 2024–25**
- [web.dev — Color themes with Baseline CSS](https://web.dev/articles/baseline-in-action-color-theme) · [MDN `light-dark()`](https://developer.mozilla.org/en-US/docs/Web/CSS/color_value/light-dark) · [MDN `color-scheme`](https://developer.mozilla.org/en-US/docs/Web/CSS/Reference/Properties/color-scheme)
- [Open Props](https://open-props.style/) — the open CSS-custom-property token set; closest prior art to Fork 1's "native-first default token set"

**Tier taxonomy (Fork 3) — benchmark systems**
- [Material Design 3 — Design tokens](https://m3.material.io/foundations/design-tokens/overview) · [Adobe Spectrum — Design tokens](https://spectrum.adobe.com/page/design-tokens/) · [Fluent 2 — Design tokens](https://fluent2.microsoft.design/design-tokens)
- [Radix Themes — Color](https://www.radix-ui.com/themes/docs/theme/color) · [Apple HIG — Color](https://developer.apple.com/design/human-interface-guidelines/color)

**Scheme + accent derivation (Fork 4) — the decisive evidence** *(added by the 2026-06-12 follow-up pass that moved Fork 4 from low to med-high)*
- [Material Design 3 — how the color system works (HCT tonal palettes, auto-contrast)](https://m3.material.io/styles/color/system/how-the-system-works) · [material-color-utilities](https://github.com/material-foundation/material-color-utilities) — derivation *with* a built-in WCAG contrast model (refutes "derivation can't guarantee contrast")
- [Adobe Leonardo](https://github.com/adobe/leonardo) ([leonardocolor.io](https://leonardocolor.io/)) — open-source contrast-ratio-first scale generation = the A′ pattern shipping in the wild
- [Radix — hand-curated 12-step scales](https://www.radix-ui.com/colors) — the curation camp (one of two strategies, not the divergence)

---

*Graduation (on ratification):* this prepared decision yields agent-ready builds via a `blockedBy` chain
in dependency order — establish the `webtheme` project + DTCG↔CSS mapping (Forks 1–2) → primitive +
component token tiers + platform default set (Fork 3) → scheme/accent runtime + curated-override path
(Fork 4). It does **not** produce code itself. Authoring the theme-color intent (#010) is a parallel
`/new-standard` build this project feeds.
