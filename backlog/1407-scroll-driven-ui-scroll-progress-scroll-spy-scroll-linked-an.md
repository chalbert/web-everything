---
kind: decision
size: 3
parent: "099"
status: open
dateOpened: "2026-06-21"
tags: [decision, book-candidate, scroll, scroll-driven, scroll-spy, gap, interaction]
---

# Scroll-driven UI — scroll-progress / scroll-spy / scroll-linked animation: placement

Verb-axis straggler (completeness sweep of [#1390](/backlog/1390-interaction-paradigm-inventory-verb-axis-gap-lens-find-missi/)):
UI driven by scroll *position / progress* — scroll-spy (highlight the active section in nav), scroll-linked
animation (progress bars, reveals, parallax), sticky-on-scroll. WE owns `viewport-presence` (enter/leave
observation) and `animation-orchestration` (intra-element build-ins), but **neither owns continuous
scroll-progress as a driver**.

**Decision:** a new intent vs an extension of `viewport-presence` (which already owns the observe
vocabulary) vs a composition pattern. Native-first substrate to check: CSS Scroll-driven Animations
(`scroll-timeline` / `view-timeline`), Intersection Observer. Refs:
[we:src/_data/intents/viewport-presence.json](../src/_data/intents/viewport-presence.json),
[we:src/_data/intents/animation-orchestration.json](../src/_data/intents/animation-orchestration.json).
**Needs `/prepare`.** Unsure ⇒ decision; costs nothing.
