# Product-shell decomposition — prior-art survey for plateau-app product separation (#2476)

**Date**: 2026-07-14
**Point**: How mature multi-tool suites solve "one app, menu got too big" — the survey grounding #2476's thin-product-shell default.
**Research page**: `/research/product-shell-decomposition/`

---

## Question

plateau-app's sidebar has grown to ~26 nav items across 6 sections, with one *Tools* section holding 17
flat entries (`plateau-app:index.html:63-81`). Does the app become a **thin product shell** hosting
several separately-addressable products (each with its own route/menu home, extractable later), or just
regroup the flat menu into sections? And how coarse should the carve be — a few workflow-domain products
or many small ones? Sibling to #2446 (where the Plateau Loop's *code* lives); this decides the shell they
all share.

## Recommendation

**Thin product shell, coarse-grained.** The prior art is unanimous: every mature multi-tool suite solves
menu bloat the same way — a small top-level chooser picks a product, and the product owns its own
second-level menu (VS Code Activity Bar → View Containers → Views; Backstage App-shell + plugins;
single-spa root config; Atlassian app switcher). None keeps one flat list. The shell owns the frame
(chrome, top-level nav, routing, shared auth/theme) and never a product's internals; a surface is a
distinct product when it is self-contained, separately route-addressable, and could be extracted — a
tool/view/tab when it only makes sense inside another surface (Backstage's explicit standalone-plugin vs
card-in-Overview choice). Figma's Dev Mode gives the escape hatch: a surface over the *same underlying
object* ships as a **mode/lens**, not a new product. Coarse grain (a handful of workflow-domain products,
each holding several of today's tools) matches the two-level pattern and keeps the shell simple; a
one-tool-per-product carve just relabels the flat list.

## Statute reconciliation (folded into the item's forks)

- **#brand-on-distinctness** governs an *externally-marketed product brand* (structural test: ≥1 consumer
  depends on it without the parent). #2476's "products" are **internal shell surfaces** — a navigable
  bucket with its own route home for the logged-in operator, not a marketed brand or npm package. The two
  **compose**: carving an internal Explorer surface here does *not* mint a brand; that stays governed by
  #brand-on-distinctness (default fold; brand only on a standalone-external-consumer event). The item
  states this explicitly so ratification never reads "distinct products" as "distinct brands."
- **#devtools-placement** already blesses "a developer-operated surface a human runs … is a developer
  *product* → Plateau" and names "the #1577 explorer product." #2476 *operationalizes* that surface as a
  shell product — downstream of, not colliding with, the anchor.
- **#2446** decides the Loop's *code home*; #2476 decides plateau-app's *internal shell*. Orthogonal axes:
  the Loop appears as a shell product regardless of where its code lives, and the thin-shell default keeps
  extraction a route-move, not a rewrite — so #2476 can ratify while #2446 stays deferred.

## Naming (Explorer)

Autonomous-UI-testing tools name on behavior (Applitools *Autonomous*, Appvance *Bug Hunter*, TestSprite,
Virtuoso, Momentic) or an agent/persona metaphor (Explorbot). "Explorer" fits the persona cluster, is not
a taken flagship among them, and already matches the internal tool's name — so keeping **Explorer** as the
internal surface name is the low-lock-in default (renaming a nav label is cheap; it mints no brand).

## Flags

Figma's concrete switcher control and Atlassian's shared-shell claim come from blog/marketing framing, not
the primary docs fetched (directional, not load-bearing). Module Federation host/remote terms are
operational, not verbatim. JetBrains Toolbox/Gateway not fetched — Atlassian fills that slot.
