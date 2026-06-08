---
type: idea
workItem: story
size: 3
status: open
dateOpened: "2026-06-07"
tags: [block, tooltip, anchor, surface, hover, focus, aria, candidate, harvest]
relatedProject: webblocks
---

# Tooltip element — anchored transient descriptive surface

A **Tooltip** primitive: a small, transient, descriptive surface that appears on hover/focus of its trigger and is announced as the trigger's accessible description. It's referenced across the standard already — the Surface Intent lists tooltips at elevation 3–5, and the Typography Intent's truncation-recovery names a `title`/tooltip as the way to read a clipped label — but there is no block that delivers one.

It composes existing intents rather than introducing new paradigms:

- **Anchor Intent** — positions the tooltip against its trigger, with flip/shift at the viewport edge.
- **Surface Intent** — floating elevation + material of the bubble.
- A **hover/focus + delay** trigger contract and `aria-describedby` wiring (not `aria-label` — the tooltip *describes*, it doesn't name).

## Scope to design (via [design-first.md](../docs/agent/design-first.md))

- Native-first: start from the built-in `title` attribute and the Popover API (`popover=hint` where supported); ARIA-described custom bubble only when richer content/positioning is needed. Verify baseline.
- Trigger semantics: hover **and** keyboard focus parity, show/hide delays, dismiss on Escape, pointer-leave grace (WCAG 1.4.13 hoverable/persistent/dismissible).
- Distinguish from a **toggletip** (click-revealed, live-region announced) and from a non-modal **popover** with interactive content — tooltip content is non-interactive description.

> **Provenance:** surfaced during a final review of the legacy `plateau` repo, where `tooltip.md` was an empty stub. **Plateau is not a model and must not be consulted or copied** — build this fresh.
