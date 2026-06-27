# Presentation-trait style vocabulary — prior art + architecture prep (decision #1884)

**Date:** 2026-06-27
**Decision:** [#1884](../backlog/1884-presentation-trait-style-vocabulary-intents-parallel-style-a.md) —
mint the style sibling of intents: a declarative open vocabulary for the presentation/surface axis
(`rounded`, `shadowed`, `bordered`, `hover`…), each resolving to one CSS property or a multi-prop recipe,
with declared interaction logic between traits.
**Seeded by:** the `we-card` docs dogfood — [#1871](../backlog/1871-which-project-include-card-surfaces-migrate-to-we-card-and-h.md)
(card-surface migration) / [#1608](../backlog/1608-migrate-project-include-catalog-tiles-cards-to-fui-blocks-ca.md)
(catalog-tile migration) — where reducing bespoke `.section-card` CSS to "native element + consumed standard"
exposed that **WE has no standard for the style axis**.
**Home:** `relatedProject: webtheme` (the token/style project that already owns the DTCG→native-CSS layer, #364).

## The question

WE ships `intents` as a first-class **open UX vocabulary** with a standardized meta-schema
([we:src/_data/intents/*.json](../src/_data/intents/), the intents-are-UX-only ruling in
[we:docs/agent/platform-decisions.md](../docs/agent/platform-decisions.md) §intents-ux-only).
On the style side it ships only **theme tokens** — single values (`--radius-md`, `--shadow-lg`) projected
one-way from the JS-first injector ([we:src/_data/weSiteTheme.js:1-50](../src/_data/weSiteTheme.js#L1-L50)).
There is **nothing between tokens and a finished component**: no standard that says "this surface is rounded
+ shadowed + has a shine-on-hover," composed from named, declared, interacting style pieces. So the Plateau
assembler papers the gap with **hand-authored CSS blobs**: `we:src/_data/assemblerPresets/hovercard.json`
ships a literal `.hovercard-card { border-radius: 12px; box-shadow: 0 16px 40px …; transition: … }`
([we:src/_data/assemblerPresets/hovercard.json:68-70](../src/_data/assemblerPresets/hovercard.json#L68-L70)).
That raw CSS *is* component-implementation leaking into products. #1884 asks: what is the missing standard —
its **name**, its **scope boundary** (vs layout/spacing and vs intents/UX), and its **meta-schema +
resolution model** (how a trait declares its CSS/recipe and its interactions, how a resolver composes a set)?

## The three-tier model (to validate, not pre-ratified)

Mirroring the intents architecture and the WE→FUI→plateau constellation:

| Tier | What | Owns | Incumbent analogue |
|---|---|---|---|
| 1. **Tokens** (values) | primitive (`--radius-md`) + DTCG **composite** types (`shadow`, `border`, `typography`, `transition`, `gradient`) | product/flavor values; WE ships the contract | Open Props (primitives) + DTCG (composites) |
| 2. **Presentation traits** (the new standard) | open vocabulary + meta-schema: `rounded`, `shadowed`, `bordered`, `hover` — each → 1 CSS prop **or** a recipe, **declaring interactions** with others | **WE** owns vocabulary + resolution contract (type-only); **FUI** owns the recipe→CSS engine | Tailwind utilities / Chakra style-props + Panda/v-e/Stitches recipes |
| 3. **Flavors / recipes** (compositions) | bound trait-value sets = a register; the **assembler composes these** instead of emitting raw CSS | product/flavor | a Panda "recipe" / a shadcn registry style |

This keeps `intents` UX-pure (validates the intents-ux-only statute): style gets its own axis rather than
leaking presentational concerns into intents.

## Prior-art survey — the paradigms

The survey is decisive on a structural point and on the resolution model. **No incumbent occupies WE's exact
slot** (an *open, standardized-meta-schema vocabulary for the presentation axis, with declared inter-trait
interaction, that WE owns as a contract and FUI resolves*), but each contributes a reusable paradigm.

### A. The atomic "one prop = one token-bound declaration" layer

- **Tailwind utilities** — the canonical atomic model: *one utility = one CSS declaration tied to a token
  scale*, with a **semantic size scale** (`rounded-sm/md/lg/xl/full`, `shadow-sm/md/lg`) and **variant
  prefixes that compose** orthogonally: `hover:`, `focus:`, `md:`, `dark:`, stacking left-to-right
  (`md:hover:rounded-full`). Custom values escape the scale via `rounded-[2vw]`
  ([tailwindcss.com/docs/border-radius](https://tailwindcss.com/docs/border-radius)). **Harvest:** the
  *named value scale* (`md`/`lg`/`full`) and the *orthogonal modifier-prefix* model — a trait carries a
  scale, and pseudo-state/media are *modifiers on* a trait, not separate traits.
- **Chakra style-props** — props map **directly to CSS properties** (`rounded`→`border-radius`,
  `shadow`→`box-shadow`, `borderWidth`→`border-width`) and **resolve against the theme token scale**
  (`theme.radii`, `theme.shadows`); pseudo-states are first-class as `_hover`/`_focus`/`_active` prop objects
  ([chakra-ui.com style-props](https://v2.chakra-ui.com/docs/styled-system/style-props)). **Harvest:** the
  explicit *prop→CSS-property map* + *value-resolves-through-token-scale* — exactly WE's tier-1→tier-2 seam
  (a trait names a CSS target and a token family; the product supplies the value).

### B. The primitive-values layer (tier 1)

- **Open Props** — *just CSS custom properties*, the sub-utility primitives: `--radius-2`, `--shadow-3`,
  `--border-size-2`, `--gradient-30`, `--ease-3`. Deliberately non-prescriptive, no classes or recipes —
  the values a trait *consumes* ([open-props.style](https://open-props.style/)). **Harvest:** confirms
  tier 1 is "values only," and that WE's traits should *reference* token names, never inline values — the
  same one-way-projection the JS-first injector already enforces.

### C. The recipe / variant engine — the interaction model (tier 2's resolution contract)

This is the cluster that grounds the **declared interaction logic between traits**. All three converge on the
*same four-key shape*:

- **Panda CSS recipes** — `{ base, variants, compoundVariants, defaultVariants }`. **Compound variants** are
  the key paradigm: extra CSS applied *only when multiple variant dimensions intersect*
  (`size:'sm' && variant:'outline'` → border styling), merged at resolve time via `getCompoundVariantCss` —
  *"only the matching combo merges."* Responsive props (`size:{ base:'sm', md:'lg' }`) work in config recipes.
  Atomic (`cva`, all-variants-upfront) vs config (`defineRecipe`, just-in-time, shareable in presets) is the
  emit-strategy axis ([panda-css.com/docs/concepts/recipes](https://panda-css.com/docs/concepts/recipes)).
- **vanilla-extract recipes** — identical `{ base, variants, compoundVariants, defaultVariants }` shape;
  compound variants "apply extra styles" when a combination is selected; build-time class generation
  ([vanilla-extract.style recipes](https://vanilla-extract.style/documentation/packages/recipes/)).
- **Stitches variants** — same `variants` + `compoundVariants` + `defaultVariants`; responsive variants via
  per-breakpoint objects with an `@initial` base ([stitches.dev/docs/variants](https://stitches.dev/docs/variants)).

**Harvest (decisive for fork 3):** the *compound-variant* construct is precisely the "declared interaction
between traits" #1884 needs (`rounded` clips `hover=shine`; `elevated` implies `shadow`+`bg`). The industry
has *already standardized* the data shape for this: a `base`, per-dimension `variants` (= traits), a
`compoundVariants` array (= the inter-trait interaction rules), and `defaultVariants` (= the flavor's
defaults). WE's tier-3 flavor is literally a config-recipe; WE's tier-2 trait is a single named `variant`
dimension; the inter-trait interaction rule is a `compoundVariant` entry.

### D. The composite-token layer — multi-prop grouping (tier 1 ↔ tier 2 bridge)

- **DTCG composite token types** ground the "1 CSS prop **or** a recipe" duality. The spec defines composite
  types whose value is a structured object grouping sub-values:
  **shadow** (`color`+`offsetX`+`offsetY`+`blur`+`spread`), **border** (`color`+`width`+`style`),
  **typography** (`fontFamily`+`fontSize`+`fontWeight`+`lineHeight`+`letterSpacing`),
  **transition** (`duration`+`delay`+`timingFunction`), **gradient** (array of color stops), **strokeStyle**
  ([designtokens.org format draft](https://www.designtokens.org/tr/drafts/format/)). FUI's injector already
  carries `shadow` as a composite-ish family ([we:src/_data/weSiteTheme.js:43-48](../src/_data/weSiteTheme.js#L43-L48)).
  **Harvest:** a trait whose target is a *composite* token (`shadowed` → the `shadow` composite, `bordered` →
  the `border` composite) is already a "recipe" at the token layer — so the "1 prop vs recipe" line is not a
  trait-design choice, it falls out of whether the trait targets a primitive or a composite token. This
  *narrows* the meta-schema: a trait declares **a target (CSS prop or composite token) + a token family for
  its value scale + optional interaction rules**, and recipe-ness is derived.

### E. The semantic-vs-presentational defense (scope boundary, vs intents)

- **ARIA / MDN** — there is **no native presentational-appearance vocabulary**. `aria-disabled` exposes
  *semantic state only* and **explicitly leaves styling to the developer as a separate concern** — *"the
  element will also need styling adjustments, which developers must handle separately"*
  ([MDN aria-disabled](https://developer.mozilla.org/en-US/docs/Web/Accessibility/ARIA/Reference/Attributes/aria-disabled));
  `role="presentation"`/`role="none"` *remove* semantics, they don't add appearance
  ([W3C APG hiding semantics](https://www.w3.org/WAI/ARIA/apg/practices/hiding-semantics/)).
- **CSS `appearance`** controls *native widget rendering only* and **"does not affect non-widgets"** — it is
  not a general presentational-styling vocabulary
  ([MDN appearance](https://developer.mozilla.org/en-US/docs/Web/CSS/appearance)).

**Harvest (decisive for fork 2 + the intents-separation defense):** the platform standardizes *semantic
state* (ARIA) and *native-control rendering* (`appearance`) but has **left the presentational-appearance axis
entirely unstandardized** — every design system reinvents it (Tailwind classes, Chakra props, DS recipes).
That is exactly the gap WE fills, and it is *structurally distinct* from intents (which describe UX/semantics,
the ARIA-adjacent axis). The boundary the platform itself draws — state/semantics vs appearance — is the same
boundary #1884 draws between intents and presentation traits. This is the strongest available defense of "the
style axis stays separate from intents/UX": **the web platform already separates them.**

## In-tree precedents (this pattern is established here)

- **The meta-schema-not-the-list discipline already exists.** The intents-ux-only statute says intents
  *standardize the meta-schema, not the list* — custom intents must coexist conflict-free
  ([we:docs/agent/platform-decisions.md](../docs/agent/platform-decisions.md) §intents-ux-only). The
  presentation-trait vocabulary inherits this verbatim: WE standardizes the trait meta-schema and a
  recommended core set; products extend the list.
- **The "axis local to its owner, value-set intent-specific" precedent.** The action-emphasis-axis prep
  (`we:src/_data/researchTopics/action-emphasis-axis.json`) found WE keeps presentational *treatment* axes
  (`emphasis: fill|outline|ghost|link`, `variant: outlined|filled|borderless` on Input Intent) **local to the
  owning intent** with intent-specific value sets, *not* flattened into one shared cross-cutting axis. **This
  is the counter-pressure on the new vocabulary:** purely-*semantic* treatment selectors (a button's
  emphasis) stay on their intent; the presentation-trait axis is for the **surface-physics** layer
  (shape/elevation/border/gloss) that is genuinely cross-cutting and *not* tied to any one component's
  semantics. The boundary is "does the value carry UX meaning (→ intent dimension) or is it pure surface
  finish (→ presentation trait)?"
- **`intent.dimensions[].values` is the meta-schema shape to reuse.** Intents already declare an open axis as
  `dimensions: { texture: { values: [...] }, interaction: { values: [...] } }`
  ([we:src/_data/intents/surface.json:7-22](../src/_data/intents/surface.json#L7-L22)). A presentation trait
  is the *same* shape narrowed to one dimension + a CSS target + interaction rules.

## The WE semantic delta vs each incumbent

| Incumbent | What it gives | What it lacks that WE adds |
|---|---|---|
| Tailwind | atomic prop+scale+modifier model | not an *open vocabulary with a meta-schema*; classes are an impl, not a contract; no declared inter-utility interaction |
| Chakra props | prop→CSS map + token resolution | React-coupled; runtime, not a portable type-only contract; interactions ad-hoc per component |
| Open Props | the primitive token values | values only — no vocabulary/recipe layer at all (that's the point) |
| Panda / v-e / Stitches | the **recipe/compound-variant data shape** (the interaction engine) | a *recipe is closed per component*; not an open, named, cross-component *vocabulary*; engine-coupled, not a WE-owned contract resolved by FUI |
| DTCG composites | multi-prop token grouping | tokens only — no notion of an applied, interacting *trait* above the token |
| ARIA / `appearance` | semantic state / native rendering | the presentational-appearance axis itself — *unoccupied*, which is WE's slot |

**WE's delta = the union slot none of them fills:** an *open, standardized-meta-schema vocabulary for the
presentation axis* (Tailwind's atoms + intents' openness), *with declared inter-trait interaction* (the
recipe engines' compound-variants, but cross-component and named), *split across the constellation* (WE owns
the type-only contract, FUI the resolver, product the values, the assembler the composition) — so the
assembler composes named traits instead of emitting raw CSS.

## The three forks, brought to DoR

### Fork 1 — NAME of the axis

The name must (a) not collide with the existing **`traits`** (the droplist component/behavior/provider model,
`we:src/_data/traits.json`, and the **`webtraits` project** `we:src/_data/projects/webtraits.json`), (b) read
as "surface finish," (c) pair naturally with tier-3 "flavors/registers."

| Candidate | One-line tradeoff |
|---|---|
| `finishes` | material-finish metaphor (`rounded`/`shadowed`/`glossy`); pairs with *flavors*; no collision; mild "completion" connotation — **recommended** |
| `facets` | neutral, but collides hard with **faceted search** in the UI domain (a filtering concept WE will surface) |
| `aspects` | generic and AOP-loaded ("aspect-oriented"); reads as cross-cutting weaving, the wrong mental model |
| `surfaces` | clear, but **collides with the existing `surface` intent** (`we:src/_data/intents/surface.json`) and with CSS terminology |
| `treatments` | accurate ("surface treatment") but verbose and overlaps the action-emphasis "treatment" wording already in use |

**Recommended default: `finishes`** (single trait = a `finish`). Reasoning: the *material-finish* metaphor is
exactly the surface-physics scope (a finish is what you apply to a surface — gloss, bevel, edge, shadow); it
**pairs cleanly with the tier-3 `flavors`** vocabulary the item already uses (a flavor binds a set of
finishes); it does **not collide** with `traits`/`webtraits` (droplist), the `surface` intent, or
faceted-search; and unlike `aspects`/`facets` it carries no loaded CS connotation. Confidence: **medium-high**
— the only residual is the faint "finished/complete" reading, which the surface-physics framing dispels in
context.

### Fork 2 — SCOPE boundary

**Surface appearance only** — shape (`rounded`), border (`bordered`), elevation (`shadowed`/`elevated`),
gloss/material (`glossy`/`glass`), and **interaction-feedback** (`hover`/`pressed` *as a finish*, i.e. the
pseudo-state recipe, not the UX semantics). **Spacing routes OUT** to the layout/region system: `spaced=md`,
gap, stack/cluster are *layout* (the `weblayout` intents `stack`/`cluster`/`box`), not finishes — a finish is
what a surface *looks like*, not how much room it occupies or how it arranges children.

**The boundary is clean and is the platform's own boundary** (survey finding E): the platform separates
*semantic state* (ARIA), *layout* (flow/grid/flexbox), and *appearance* (paint properties). Finishes own the
**paint/surface-physics** band only; UX-meaning treatment selectors (button emphasis) stay on their intent
(the action-emphasis precedent); layout/spacing stays in the layout system. Confidence: **high** — three
in-tree-and-platform boundaries all agree.

### Fork 3 — META-SCHEMA + resolution model

Grounded in the recipe-engine convergence (survey C) + DTCG composites (survey D) + the intent
`dimensions[].values` shape. A **finish** declares:

```
{
  "id": "rounded",
  "target": "border-radius",        // a CSS property, OR a DTCG composite token type ("shadow"/"border")
  "tokenFamily": "radius",          // the token scale its value resolves through (tier 1)
  "scale": ["sm","md","lg","full"], // the named value scale (Tailwind/Chakra paradigm); default member
  "default": "md",
  "states": ["hover","focus"],      // optional pseudo-state modifiers (Tailwind hover: / Chakra _hover)
  "interactions": [                 // the compound-variant paradigm (Panda/v-e/Stitches)
    { "when": { "hover": "shine" }, "requires": "overflow-clip", "note": "rounded clips the shine" }
  ]
}
```

**Resolution contract** (WE owns it type-only; FUI implements):

1. **Compose order** — finishes apply in a declared cascade order (box-model → paint → state), so later
   finishes deterministically win on the same CSS property (mirrors recipe `base` then `variants`).
2. **Conflicts** — two finishes targeting the same CSS property resolve by declared precedence (last-wins
   within a flavor; an explicit `!` author override beats the flavor).
3. **Interactions** — the `interactions[]` array *is* the compound-variant set: an entry fires only when its
   `when` combination is active and merges its extra CSS (the `getCompoundVariantCss` "only the matching
   combo merges" model). This is where `elevated ⟹ shadow+bg` and `rounded clips hover=shine` live.
4. **Pseudo-states** — `states[]` map to `:hover`/`:focus` (Tailwind prefix / Chakra `_hover`); the resolver
   emits the nested rule.
5. **Media queries** — value-as-breakpoint-object (`rounded:{ base:"sm", md:"lg" }`), the Panda/Stitches
   responsive-variant model.

**Recommended default:** adopt the **recipe four-key shape** (`base`/`variants`/`compoundVariants`/
`defaultVariants`) as the *flavor* (tier-3) contract, with each **finish = one named variant dimension** and
each **interaction = one compoundVariant entry** — i.e. reuse the industry-converged data shape rather than
coin a novel one (native-first / no-invented-jargon). The "1 CSS prop vs recipe" duality is **derived** from
whether `target` is a primitive property or a DTCG composite, so it is not a separate authoring decision.
Confidence: **medium-high** — three independent engines converge on this exact shape, and DTCG grounds the
composite half; the residual is purely *emit strategy* (atomic-all-variants vs config-just-in-time), which is
an FUI engine concern, not a WE-contract concern.

## How the survey reshaped the forks

- **DISSOLVED a sub-fork inside fork 3:** "does a trait resolve to 1 CSS prop *or* a multi-prop recipe?" is
  **not** an authoring fork — it falls out of whether the trait targets a primitive property or a DTCG
  *composite* token (survey D). The meta-schema carries one `target`; recipe-ness is derived. One fewer knob.
- **ADDED a scope sub-boundary (refines fork 2):** the action-emphasis precedent surfaces a *third* band the
  original framing under-specified — **UX-meaning treatment selectors** (button emphasis `fill|outline|ghost`)
  are **not finishes**; they stay as *intent dimensions* on their owning intent. So fork 2's boundary is now
  three-way (intents/UX-treatment ⟂ finishes/surface-physics ⟂ layout/spacing), not the two-way
  (finishes ⟂ spacing) the item posed. This is the sharpest line and the one most likely to be contested.
- **STRENGTHENED (not a new fork) the intents-separation defense:** the platform itself separates semantic
  state (ARIA) from appearance (CSS paint, with `appearance` quarantined to native widgets) — so "finishes
  stay separate from intents" is *native-aligned*, not a WE invention (survey E).

## References

- Tailwind utilities — [border-radius](https://tailwindcss.com/docs/border-radius)
- Open Props — [open-props.style](https://open-props.style/)
- Chakra UI — [style props](https://v2.chakra-ui.com/docs/styled-system/style-props)
- Panda CSS — [recipes & variants](https://panda-css.com/docs/concepts/recipes)
- vanilla-extract — [recipes](https://vanilla-extract.style/documentation/packages/recipes/)
- Stitches — [variants & compound variants](https://stitches.dev/docs/variants)
- DTCG — [format spec composite types](https://www.designtokens.org/tr/drafts/format/)
- W3C ARIA APG — [hiding semantics / role=presentation](https://www.w3.org/WAI/ARIA/apg/practices/hiding-semantics/) ·
  MDN — [aria-disabled](https://developer.mozilla.org/en-US/docs/Web/Accessibility/ARIA/Reference/Attributes/aria-disabled) ·
  [CSS appearance](https://developer.mozilla.org/en-US/docs/Web/CSS/appearance)
- Internal: [#1884](../backlog/1884-presentation-trait-style-vocabulary-intents-parallel-style-a.md) ·
  [#1871](../backlog/1871-which-project-include-card-surfaces-migrate-to-we-card-and-h.md) ·
  [#1608](../backlog/1608-migrate-project-include-catalog-tiles-cards-to-fui-blocks-ca.md) ·
  [action-emphasis-axis prep](../src/_data/researchTopics/action-emphasis-axis.json) ·
  [assembler hovercard preset](../src/_data/assemblerPresets/hovercard.json) ·
  [theme injector](../src/_data/weSiteTheme.js)
