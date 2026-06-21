---
kind: story
size: 3
parent: "1396"
status: open
blockedBy: ["1396"]
dateOpened: "2026-06-21"
tags: []
---

# gesture intent spec — mint we:src/_data/intents/gesture.json composing interaction

Author the new gesture intent (placement ratified in #1396): open gesture vocabulary (tap·double-tap·long-press·pan·swipe·pinch·rotate·two-finger-pan·edge-swipe·pull-to-refresh, author-extensible), gated to pointer/touch modality, composing the Interaction Intent. Carries the forced a11y-parity invariant (WCAG 2.1 SC 2.5.1 — every binding declares a single-pointer/keyboard equivalent; + 2.5.2 cancellation, 2.5.4 motion-actuation). Per-element/plural shape (mirrors focus-delegation/hover-intent). UX-only — recognizer engine + effect seams stay out (see blocked children).
