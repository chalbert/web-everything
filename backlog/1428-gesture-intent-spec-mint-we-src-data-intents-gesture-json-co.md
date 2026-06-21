---
kind: story
size: 3
parent: "1396"
status: resolved
blockedBy: []
dateOpened: "2026-06-21"
dateStarted: "2026-06-21"
dateResolved: "2026-06-21"
graduatedTo: "we:src/_data/intents/gesture.json"
tags: []
---

# gesture intent spec — mint we:src/_data/intents/gesture.json composing interaction

Author the new gesture intent (placement ratified in #1396): open gesture vocabulary (tap·double-tap·long-press·pan·swipe·pinch·rotate·two-finger-pan·edge-swipe·pull-to-refresh, author-extensible), gated to pointer/touch modality, composing the Interaction Intent. Carries the forced a11y-parity invariant (WCAG 2.1 SC 2.5.1 — every binding declares a single-pointer/keyboard equivalent; + 2.5.2 cancellation, 2.5.4 motion-actuation). Per-element/plural shape (mirrors focus-delegation/hover-intent). UX-only — recognizer engine + effect seams stay out (see blocked children).

## Progress

- Minted we:src/_data/intents/gesture.json (auto-renders at /intents/gesture/ via we:src/intent-pages.njk —
  no manual nav entry needed). `status: concept` (recognizer impl deferred to blocked children, like
  interaction).
- Dimensions: open-numbered `vocabulary` (tap·double-tap·long-press·pan·swipe·pinch·rotate·
  two-finger-pan·edge-swipe·pull-to-refresh, author-extensible) + optional `direction` for path
  gestures (most-permissive default = unconstrained).
- The WCAG 2.5.1/2.5.2/2.5.4 a11y-parity requirement is authored as a FIXED invariant in prose, NOT a
  dimension (per the placement ruling). Composition seam to interaction (gated pointer/touch) + the
  recognition↔effect seams (#1393 pinch, carousel swipe, data-transfer/reorder drag, command long-press)
  named in the description. Recognizer engine = DI/Configurator card (deferred), mirroring hover-intent.
- Cleared the stale `blockedBy: ["1396"]` edge (#1396 resolved).
