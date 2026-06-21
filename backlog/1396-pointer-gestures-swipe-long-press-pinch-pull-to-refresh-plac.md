---
kind: decision
size: 3
parent: "099"
status: open
dateOpened: "2026-06-21"
tags: [decision, book-candidate, gestures, pointer, touch, interaction, gap]
---

# Pointer gestures — swipe / long-press / pinch / pull-to-refresh: placement

Candidate latent standard surfaced by the verb-axis lens
([#1390](/backlog/1390-interaction-paradigm-inventory-verb-axis-gap-lens-find-missi/)): a recognized-gesture
vocabulary — swipe, long-press, pinch, rotate, pull-to-refresh, two-finger pan — over Pointer Events with
a11y-equivalent fallbacks. The `interaction` intent already owns input *modality* (pointer / touch /
spatial) but **not specific gestures**, so the genuine question is **extend `interaction` with a gesture
dimension vs a new `gesture` intent**. Keyboard / pointer-equivalent parity is non-negotiable (a gesture
must never be the only path). Refs:
[we:src/_data/intents/interaction.json](../src/_data/intents/interaction.json) (`concept`); pinch overlaps
zoom/pan ([#1393](/backlog/1393-zoom-pan-a-surface-viewport-scale-translate-standard-placeme/)), swipe
overlaps carousel paging. Substrate to check: Pointer Events, `touch-action`, no native gesture-recognizer.
**Needs `/prepare`.** Unsure ⇒ decision; costs nothing.
