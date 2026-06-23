---
kind: decision
status: open
dateOpened: "2026-06-23"
tags: []
---

# Semantic layout-type taxonomy — identify every distinct layout role (a11y + design POV); 1 FUI impl per role, style variants via plateau

Establish the canonical taxonomy of semantically-distinct **layout roles** WE must cover, surveyed from
both an **accessibility POV** (landmark/region semantics, reading & focus order, responsive reflow) and a
**design POV** (the recurring composition patterns). The goal: name each distinct role once, so FUI provides
exactly **one implementation per role** and per-project visual differences ride **presentational variants +
plateau assembler presets** over that single role — never new components. This decision rules the **role
taxonomy**, not the variant model (that half is already codified). Once ratified it seeds per-role mint
items (intent/block per role) under FUI.

## What you have to decide

Which semantically-distinct layout roles is WE's canonical set — and how is "distinct role" defined so the
list is principled, not a vote?

## Why this isn't already covered

Today WE ships only a concept-stage `layout` intent (we:src/_data/intents/layout.json — app-shell region
mechanics: shell/pane/dock, push/overlay/rail) plus scattered point intents
(`resizable`/`arrangeable`/`overview-grid`/`slide-layout-template`). There is **no map of the full role
set** — no answer to "what are all the layout primitives a dev needs" surveyed systematically. Candidate
roles to confirm/reject (design-POV seed, from Every Layout + CSS layout patterns): stack, cluster,
sidebar, switcher, cover, center, grid (auto-fit/auto-fill), frame, reel, imposter, app-shell,
split/resizable, masonry, dockable, slide-layout.

## The style-variant half is already settled — scope guard

The "many identical-semantic items with various styles, handled via plateau" half is **already codified**,
so this card must NOT re-open it:

- **One semantic contract, presentational variants as an open-numbered axis** —
  we:docs/agent/platform-decisions.md#open-numbered-variants (1 intent/role; visual treatments are an open
  `variant` axis off it, never new components).
- **Plateau-owned assembler** mints the styled presets over that single role (assembler open-core, #775).

So "1 FUI impl per role + style variants via plateau" is the *consequence* of the taxonomy, not an open
question — this decision only needs to settle **the role set + the distinctness criterion**.

## Prior-art review (part of prep)

Survey layout components/primitives in leading systems — **Every Layout** (the primitive set), Tailwind,
MUI, Radix/Chakra, Material, Carbon, Open UI — to ground which roles are genuinely universal vs
library-specific styling. Materialize as a `reports/…md` + `/research/` topic at prep.

## Lineage

Surfaced 2026-06-23 alongside #1653 (the dockable layout-tree Protocol → `weblayout` host). Related point
intents already shipped: `resizable` (#1384), `arrangeable`, `slide-layout-template` (#1191), `overview-grid`.
