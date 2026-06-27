---
kind: task
status: resolved
priority: low
locus: plateau-app
dateOpened: "2026-06-26"
dateStarted: "2026-06-27"
dateResolved: "2026-06-27"
graduatedTo: none
tags: [intent, motion, vocabulary]
---

# Reconcile motion intent vocabulary (standard vs runtime)

The standard motion intent (we:src/_data/intents/motion.json) uses natural | immediate | reduced; the runtime design-system manifest (plateau:src/design-system-creator/manifest.ts) and IntentProfile examples use full | reduced | none. Both share reduced (so the explorer's motion reality-measurement under prefers-reduced-motion is unblocked — surfaced in #1791), but the two vocabularies diverge on the other members. Reconcile to one canonical motion vocabulary across the standard and the runtime emitter.

## Progress (batch-2026-06-26-1806-1825)

Reconciled to the **standard's** vocabulary `natural | immediate | reduced` as canonical — the WE motion
intent (`we:src/_data/intents/motion.json`) is the source of truth (impl satisfies the standard; standards are
upstream), so the runtime emitter aligns to it rather than the reverse. The standard side needed **no change**;
all edits land in the plateau runtime, so the item's `locus` was corrected `webeverything → plateau-app`.

Changed (plateau): `INTENT_DEFAULT_OPTIONS.motion` `['full','reduced','none'] → ['natural','immediate','reduced']`
(`plateau:src/design-system-creator/manifest.ts`); the variant-simulator test fixtures + expected labels `full → natural`
(`plateau:src/dev-browser/variant-simulator/variant-simulator.test.ts`); the intent-inspector type doc-comment example
`full / reduced → natural / reduced` (`plateau:src/dev-browser/intent-inspector/types.ts`). `reduced` was already shared
(no change); the old `full → natural`, and `none` is dropped — the standard's `reduced` (semantic-motion-only,
respects `prefers-reduced-motion`) is the accessibility floor and the standard deliberately carries no hard-off
member (a separate standard change would add one if ever needed).
