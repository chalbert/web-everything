---
type: idea
workItem: story
size: 3
status: resolved
blockedBy: ["057"]
dateOpened: "2026-06-03"
dateStarted: "2026-06-11"
dateResolved: "2026-06-11"
graduatedTo: stepper
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

## Delivery (2026-06-11)
Vocabulary settled (#057 resolved → `persistence` grounding), so authored the
standard as the **`stepper`** block (`status: draft`, `type: Component`,
`implementsIntent: navigation`):

- **`src/_data/blocks.json`** — the `stepper` entry with `intentDimensions`
  `{ structure: linear, history: replace, scroll: top, transition: directional,
  guard: confirm, persistence: session }` — the value-combination the navigation
  vocabulary was missing, and the block that **exercises the `session` persistence
  value** (satisfying the #057 review condition that kept it in the dimension).
- **`src/_includes/block-descriptions/stepper.njk`** — the detail-page description
  (dimension table, standards alignment, progression model, the configurable
  persistence axis, composition).
- **`AGENTS.md`** — inventory regenerated (`npm run gen:inventory`) for the +1 block.

Design choices recorded in the entry: **locked progression is the default** (what
distinguishes a Wizard from Tabs; `withFreeStepNavigation` opts out); **persistence
is exposed as the configurable axis** (`session` default, `url` via
`withResumableState`, `memory`) since it's the one dimension a linear flow
legitimately varies across; `guard: confirm` default (mid-flow data loss is the
common failure). Name: **Stepper** (the component term) realizing the **Wizard**
flow — both surfaced, neither dropped. Implementation is a separate downstream build
(the block is `draft`, no `sourcePath`).
