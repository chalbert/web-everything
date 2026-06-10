---
type: decision
workItem: story
size: 3
status: open
blockedBy: ["057"]
dateOpened: "2026-06-03"
tags: [navigation, intent, wizard, stepper, linear, block, gap]
relatedReport: reports/2026-06-03-navigation-intent-vocabulary.md
relatedProject: webblocks
crossRef:
  url: /intents/navigation/
  label: Navigation Intent
---

# Realize the `linear` navigation structure (Wizard / Stepper block)

The Navigation Intent's `structure` axis names three values, but only two are realized by blocks: `hierarchical` (router) and `lateral` (tabs). `linear` — sequential, locked-progression steps (a Wizard / Stepper) — has the vocabulary but no implementing block.

A linear block is the one that most exercises the new dimensions in combination: `structure: linear` + `history: replace` (steps overwrite rather than stack) + `guard: confirm` (don't lose progress on leave) + a `persistence` decision (is the current step deep-linkable / resumable?) + `aria-current="step"`. Net-new scope — author it via `/new-standard` (blocks.json entry + `block-descriptions/{id}.njk`) when the vocabulary settles. Until then this is a tracked gap, not committed work.
