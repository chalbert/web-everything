---
kind: story
size: 3
status: open
blockedBy: []
parent: "1585"
relatedProject: webaudit
dateOpened: "2026-06-22"
dateStarted: "2026-06-22"
tags: []
---

# Technical Configurator card: tunable design-knowledge tier-weights (plateau-app)

The #1588 Fork-3 residual the ruling names as its own card: a plateau-app Technical Configurator domain that lets a project retune the design-knowledge tier weights and add custom source-kinds/modifiers over the WE meta-schema default flavor. Config-extends-platform-default in UI form — the frozen meta-schema is the comparable spine; only the numbers and additions flex. Add as a Configurator domain via seed + provider entry once the #1591 meta-schema + default flavor exists.

## Pre-flight (batch-2026-06-22-1580-1579-1030-1564) — SURFACE-MODEL FORK; the "Configurator domain" premise doesn't fit

#1591 (the meta-schema) is **resolved**, so the stated `blockedBy` is cleared — but grounding the plateau
Technical Configurator (`plateau:src/technical-configurator/types.ts` + `plateau:src/technical-configurator/provider.ts`)
shows the card's stated approach **does not fit the actual model**. A Configurator `Domain` is
`{ axes[], strategies[] }` and the tool is a **requirements → strategy-SELECTION** ranker (`rankStrategies`
scores each strategy's per-axis value against the user's required values). "Tunable tier-weights + add custom
kinds/modifiers" is **numeric config-EDITING**, not strategy selection — there are no rival strategies to rank
and no capability axes to require. Forcing it into the `seed-*.ts` + `provider` domain pattern is a category
mismatch.

**Fork to decide before building (surface approach):**
- **(a) A dedicated weight-tuning editor** — a small plateau panel (mirroring the vision-review / review-harness
  "edit + preserve-both" pattern) that loads the WE `credibilityWeighting` default flavor and lets a project
  override tier numbers + add kinds/modifiers (config-extends-default in UI form). Smallest, fits the data.
- **(b) Extend the Technical Configurator** with a new non-selection "tuning" domain kind — a bigger change to
  the Configurator's `Domain`/UI model, reused if other numeric-config cards appear later.

Recommend (a) (the Configurator is a selection tool; don't dilute its model for one tuning card). Carry-forward
reason: **fork** (stop-rule 4) — this broke the cascade; the #1591 chain otherwise landed. Needs a surface
decision (a /prepare or a quick ruling), then a re-scope, before it's agent-ready. Left `open`.
