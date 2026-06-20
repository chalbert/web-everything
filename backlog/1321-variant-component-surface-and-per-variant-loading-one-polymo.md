---
kind: decision
status: open
blockedBy: ["1318"]
dateOpened: "2026-06-20"
tags: []
---

# Variant component surface and per-variant loading (one polymorphic block vs per-variant elements)

Surfaced by #1318. WE ratified the `variant` axis as an intent contract rendered via a plain attribute (we:button[variant]) consumed by CSS — but HOW a block packages it is an FUI-locus call: bare <button variant> + CSS (no wrapper), vs per-variant custom elements (<ghost-button>, the Material Web shape), vs an autonomous element wrapping a real button. Decide the surface weighing: DevX (refactor friction, dynamic binding, autocomplete), the open-numbered axis (favours an open attribute value set over an unbounded tag namespace), 'load only what is needed' (per-variant style/code loading), layout (modern CSS lets a bare <button> be a flex/grid container; wrappers add encapsulation but cost), and a11y (role=button is necessary-but-insufficient; only a real <button> gives keyboard/focus/disabled/form free — most devs will not re-implement it, arguing native-first). locus: frontierui.
