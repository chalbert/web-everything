---
name: feedback_intent_ux_only_technical_to_configurator
description: "Intents are UX-only; technical strategy choices go to Plateau's Technical Configurator as a domain"
metadata: 
  node_type: memory
  type: feedback
  originSessionId: 58e2899b-f1e0-494b-ad30-6cc8bc9b8acd
---

When authoring a standard, the **Intent layer is UX-only** — it expresses *what the user wants*, never how it is computed. It must carry **no technical references**: no implementation functions (e.g. comparator fns), no client/server execution flags, no registries. Everything in the intent must be **configurable** enough to describe *any* UX preference (e.g. the pipeline order is data, not a constant).

The **technical** half of the same concern is materialised separately as a **domain in Plateau's Technical Configurator** (`plateau-app/src/technical-configurator/`): a `seed-{domain}.ts` (axes = outcome questions, strategies = approaches with per-strategy `compromises` = pros/cons) + one line in `provider.ts` + presets. This is the decision-tool home for "which implementation strategy, and its advantages/disadvantages." Worked examples: change-tracking, file-upload, sorting-strategy.

**Vocabulary rule:** use language closest to the official web standard. Borrow the platform's own words verbatim where they exist — e.g. `aria-sort` (ascending/descending/none) for sort direction, `Intl.Collator` option names (sensitivity/numeric/caseFirst/ignorePunctuation) for text comparison; fall back to the nearest cross-platform standard (SQL aggregate names, SQL NULLS FIRST/LAST) only where the web has none.

**Why:** keeps the UX standard stable and implementation-agnostic, lets technical strategies evolve independently, and aligns with [[feedback_native_first_default]]. **How to apply:** when a concern has both a UX-preference axis and an implementation-choice axis, split them — UX → intent (`intents.json`), technical → a Configurator domain. First materialised for the collection-operations intent (gap #10 sorting). Relates to [[feedback_authoring_standard_workflow]], [[project_technical_configurator]], [[feedback_materialization_pattern_codified]].

**a11y/WCAG conformance *level* is a conformance-config value, NOT an intent (#1791):** a declared WCAG tier (A/AA/AAA) is a technical *conformance target* — a product-set platform-config value over a WE schema ([[project_config_surface_three_layer_carve]]), emitted on the conformance channel (the #1689 DeclaredRule `kind:conformance`+`tier`), never a `data-intent-*` attribute, and measured **absolutely** (axe), not declared-relative. So an "intent-conformance" oracle measures **UX intents only** (density/motion); a11y is a sibling conformance lane. Density/motion *touch* a11y (touch-target size → WCAG 2.5.8; `reduced` → prefers-reduced-motion) but the relationship is indirect — the intent is the UX choice, the a11y consequence is a side-effect. Tell: if a "level"/"tier"/"compliance" word wants to ride the intent layer, it's the category error — re-home it to conformance-config.

**At decision graduation, card each documented technical setting (#370):** when a ratified decision documents a technical (impl) choice — a render strategy, an update strategy, a transport — spin out **one Technical Configurator card per setting** (plateau-app; seed + provider entry) so a project can pick its inherited/extended platform value. The platform-config **schema** ships with the intent/block build; the **Configurator UI** is its own card. **Cross-ref an existing Configurator domain instead of duplicating** (e.g. reaction real-time sync transport → the webrealtime domain, not a new card). Codified in `backlog-workflow.md` decision-authoring section. Worked example: #370 → #594 render-strategy domain + #595 reaction update-strategy option; sync transport cross-ref'd to webrealtime. Pairs with [[feedback_config_extends_platform_default]] (the default-value/set/strategy fork → config-driven open default).
