---
kind: decision
status: open
blockedBy: ["1318"]
dateOpened: "2026-06-20"
tags: []
---

# Variant component surface and per-variant loading (one polymorphic block vs per-variant elements)

Surfaced by #1318. WE ratified the `variant` axis as an intent contract rendered via a plain attribute (we:button[variant]) consumed by CSS — but HOW a block packages it is an FUI-locus call: bare <button variant> + CSS (no wrapper), vs per-variant custom elements (<ghost-button>, the Material Web shape), vs an autonomous element wrapping a real button. Decide the surface weighing: DevX (refactor friction, dynamic binding, autocomplete), the open-numbered axis (favours an open attribute value set over an unbounded tag namespace), 'load only what is needed' (per-variant style/code loading), layout (modern CSS lets a bare <button> be a flex/grid container; wrappers add encapsulation but cost), and a11y (role=button is necessary-but-insufficient; only a real <button> gives keyboard/focus/disabled/form free — most devs will not re-implement it, arguing native-first). locus: frontierui.

## Constraint: per-variant wrapper elements must remain an allowed choice

*(Direction set in the #1318 discussion.)* This decision picks the **recommended / default** surface —
it must **not forbid** the per-variant (or per-level) wrapper-component shape, e.g.
`<md-filled-button>` / `<md-primary-button>` (the Material Web shape). That packaging is an **allowed
choice**, per most-flexible-default (we:docs/agent/platform-decisions.md) and minimize-lock-in: WE
mandates the *contract surface* (the `variant` axis, #1318), not the *packaging*, and a wrapping
element can reflect the attribute down to a real `<button>`. So the decision space is "what do we
recommend / ship as the floor," **with the wrapper-element option preserved as a first-class
alternative** an author/implementer may opt into — never ruled out. The native-first arguments
(a11y-for-free, no-wrapper layout) shape the *default*, not the *permission*.
