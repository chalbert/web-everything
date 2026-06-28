---
name: project_component_substrate_boundary
description: Every per-component design question is one question — which substrate owns it: WE contract / FUI primitive / product component; a component is delivered as a composed web component, NEVER a classname;
metadata:
  node_type: memory
  type: project
  originSessionId: 18c9313a-e757-4229-bd70-33e84dd750dd
---

#1886 ruling (reopened + re-ratified 2026-06-28): **every "how do we build component X" question reduces to one — which substrate owns the responsibility.** Fix the boundary once and the 100s of downstream calls (does a card have a title? what namespace? section or article? where does the heading go?) become **mechanical placements, not decisions.**

- **WE — standard:** the *contract* only — semantic identity + the minimal invariant. **Under-specifies on purpose** (any "a card has a title" claim is contradicted by the next design). Owns no concrete structure / optional parts / look values.
- **FUI — implementation:** the *primitive* — the reusable, product-agnostic mechanism (transient root-binding, root resolution, tokenized base style hook, slot/prop machinery). `we-card`→`<article>`, `we-section-card`→`<section>`. No title/footer/menu opinion.
- **Product — composition:** *concrete, semantically-named, namespaced components* composing primitives into what THIS product needs (title, footer, items, menus, behaviors). Lives in the product's own frontend (e.g. the WE website: `standard-card` = `we-card` + title + …), **not** WE/FUI — `we-*` is reserved for the standard+primitive layer; the product owns its namespace via a config knob (default empty).

**A component is delivered as a composed web component — never a classname.** At both the FUI-primitive and product layers the deliverable is a custom element (own tag, multiple elements, props, slots, behaviors); a bare `<x class="…">` is only the degenerate look-only *runtime residue* of a transient primitive. Native-first survives as a constraint *on the composition* (compose the correct native root internally; don't reinvent a sufficient native primitive).

**Why:** the user overturned my prepared #1886 default on the merits — it had reduced a card's delivery to "native element + a style class," and chasing that surfaced the real, general principle. Generalizes far beyond the card (the worked example).

**How to apply:** for ANY component question, first place the responsibility on a substrate, don't decide it ad-hoc. Title/heading/footer = product-component concern (never push into WE/FUI). Different semantic value ⇒ different element (a `<section>` is not an `<article>`). When the FUI-vs-product line blurs, the tie-breaker is [[feedback_reusable_to_neutral_home]] (product-agnostic+reusable ⇒ FUI primitive; product-specific ⇒ product). Related: [[reference_repo_constellation]], [[project_managed_offering_constellation_layering]], [[feedback_native_first_default]], [[feedback_impl_is_not_a_standard]].

**Codified:** the canonical rule is `docs/agent/platform-decisions.md#identity-semantic-look-composable` (the statute is source-of-truth; the `#1886` above is provenance, not the reference).
