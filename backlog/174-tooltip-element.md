---
kind: story
size: 3
status: resolved
dateOpened: "2026-06-07"
dateStarted: "2026-06-10"
dateResolved: "2026-06-10"
graduatedTo: block:tooltip
tags: [block, tooltip, anchor, surface, hover, focus, aria, candidate, harvest]
relatedProject: webblocks
---

# Tooltip element — anchored transient descriptive surface

A **Tooltip** primitive: a small, transient, descriptive surface that appears on hover/focus of its trigger and is announced as the trigger's accessible description. It's referenced across the standard already — the Surface Intent lists tooltips at elevation 3–5, and the Typography Intent's truncation-recovery names a `title`/tooltip as the way to read a clipped label — but there is no block that delivers one.

It composes existing intents rather than introducing new paradigms:

- **Anchor Intent** — positions the tooltip against its trigger, with flip/shift at the viewport edge.
- **Surface Intent** — floating elevation + material of the bubble.
- A **hover/focus + delay** trigger contract and `aria-describedby` wiring (not `aria-label` — the tooltip *describes*, it doesn't name).

## Scope to design (via [we:design-first.md](../docs/agent/design-first.md))

- Native-first: start from the built-in `title` attribute and the Popover API (`popover=hint` where supported); ARIA-described custom bubble only when richer content/positioning is needed. Verify baseline.
- Trigger semantics: hover **and** keyboard focus parity, show/hide delays, dismiss on Escape, pointer-leave grace (WCAG 1.4.13 hoverable/persistent/dismissible).
- Distinguish from a **toggletip** (click-revealed, live-region announced) and from a non-modal **popover** with interactive content — tooltip content is non-interactive description.

> **Provenance:** surfaced during a final review of the legacy `plateau` repo, where `we:tooltip.md` was an empty stub. **Plateau is not a model and must not be consulted or copied** — build this fresh.

## Progress

- **Status:** resolved → `block:tooltip`.
- **Done (authored fresh, design-first):**
  - `fui:blocks.json` — new `tooltip` Component (status draft): summary, `composesIntents: [anchor, surface, typography]`, and 4 design decisions (describes-not-names / native-first ladder / hover+focus parity + WCAG 1.4.13 / tooltip≠toggletip≠popover).
  - `we:block-descriptions/tooltip.njk` — overview, the native-first **three-rung ladder** as a feature-inventory table (`title` → `popover="hint"` → custom ARIA bubble) with disposition + tier, the WCAG 1.4.13 trigger contract (hoverable / persistent / dismissible), an Altitude-1 HTML substrate example, and an explicit "what a tooltip is *not*" (toggletip / popover / essential-info) section.
  - `we:semantics.json` — two new terms: **Tooltip** and **Toggletip** (per AGENTS rule 3).
  - Page route + webblocks catalog wire automatically from `fui:blocks.json` (pagination + auto-list); no nav edits needed. `gen:inventory` regenerated (35 blocks); `check:standards` green (0 errors).
- **Native-first stance:** built-in `title` + Popover API `popover="hint"` are the default substrate; a custom bubble and Floating-UI positioning are opt-in upper rungs, never the baseline.
- **Leftovers:** toggletip is named out-of-scope and cross-referenced but not yet its own block; reference implementation in Frontier UI is the standard-vs-impl follow-on (not part of authoring this standard).
