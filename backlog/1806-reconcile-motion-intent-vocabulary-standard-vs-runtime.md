---
kind: task
status: open
priority: low
locus: webeverything
dateOpened: "2026-06-26"
tags: [intent, motion, vocabulary]
---

# Reconcile motion intent vocabulary (standard vs runtime)

The standard motion intent (we:src/_data/intents/motion.json) uses natural | immediate | reduced; the runtime design-system manifest (plateau:src/design-system-creator/manifest.ts) and IntentProfile examples use full | reduced | none. Both share reduced (so the explorer's motion reality-measurement under prefers-reduced-motion is unblocked — surfaced in #1791), but the two vocabularies diverge on the other members. Reconcile to one canonical motion vocabulary across the standard and the runtime emitter.
