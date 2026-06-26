---
kind: decision
status: open
dateOpened: "2026-06-26"
tags: [composition, blocks, slots, configuration, html-first]
---

# HTML-first composition strategies for re-skinning an a11y-complete block

A recurring real problem: designers bring many visual variations of one core component. Some are structural and warrant a new block; many are *mostly visual yet not purely CSS-achievable* — inject an icon, add a status badge, wrap a child in a popover, swap a sub-element. When we already have a navigation block that meets every a11y requirement, rebuilding it per variation is waste. React has a rich menu here (replace a sub-component, HOC/decoration, prop-merge, abstract-piece split, context config). **What is the HTML-first, standards-based set of strategies WE should offer for the same reuse?**

This decision should enumerate the candidate strategies and decide which WE supports as first-class (vs. leaves to userland), in a way that preserves the base block's a11y guarantees.

## The fork (candidate strategies to evaluate)

- **Slots** — named/default `<slot>`s for injecting icons/badges/popovers without forking the block.
- **Sub-component replacement** — declare a replacement element for an internal part (the `CustomLink` analog) via scoped registration / IDREF (#854) or a slot.
- **Behavior/decoration** — attach a CustomAttribute behavior to decorate an existing child (the HOC analog).
- **Context-driven configuration** — the same block behaves differently per app via an injected context/config (webinjectors / project-config layering).
- **Abstract-piece split** — factor reusable internals so a new block can recompose them.

Decide which of these are the sanctioned WE patterns, how they compose, and where the a11y contract is enforced. Relates to existing composition work (#023, #646, #715, #748) — confirm overlap before slicing the build.

## What you decide
Which strategies are first-class WE composition patterns (and which are out), plus the seam each uses. Resolves into the build slices for the chosen set.

_Converted from `we:plans/ui-configuration.md` (#1792 hidden-docs cleanup)._
