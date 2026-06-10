---
type: idea
workItem: epic
size: 13
parent: "150"
status: open
dateOpened: "2026-06-09"
tags: [dev-experience, devtools, validation, linting, adapters, normalization, technical-configurator, dev-surface, no-lock-in]
relatedReport: reports/2026-06-07-dev-authoring-preferences-architecture-intents.md
relatedProject: webadapters
crossRef: { url: /backlog/150-dev-authoring-preferences-architecture-intents/, label: "Dev-prefs decision (#150)" }
---

# Validation normalization + shopping devtool (adapter-as-normalization-hub)

Spun out of [#150](/backlog/150-dev-authoring-preferences-architecture-intents/). The differentiated,
**zero-lock-in** answer for the lint/format/boundary overlap zone: not a new format, but a devtool that
**adapts to the validation tools you already use**. You can run it once and stop — the project keeps no
reference to it whatsoever (it only ever touches the incumbents' own config files).

## Shape

- **One adapter per incumbent** — eslint, oxlint, Sheriff, dependency-cruiser, custom — translating *into
  and out of* an internal normalized rule-model. The pivot is the tool's private memory; the project never
  authors in it.
- **See** — load existing configs → one unified list of every rule you have, each with an example of what
  it catches (auto-rendered catalog, like `/protocols/` and `/intents/`).
- **Re-export** — emit the equivalent config for a *different* tool (eslint → biome, etc.).
- **Shop** — browse which tools cover which rules; pick tools by the validation you want. This is a
  **Technical Configurator domain** (#150 Q6) — but gated on the configurator evolving well past its
  current POC, so treat it as directional, not an immediate build against today's configurator.

## The lossiness is the product

Cross-tool rule semantics are not 1:1 (eslint ≠ biome exactly; Sheriff's boundary model has no eslint
twin). Reframe as a **comparative view** — how each tool takes on the same concern, where they diverge,
what only one tool can express. Tag every mapping with a confidence/coverage level; the "no equivalent"
cells are the most valuable for shopping, not the embarrassing ones.

## Open (resolve at build time)

- v1 tool set + which rule classes to normalize first.
- Pivot model schema + confidence/coverage tagging.
- How `see`/`re-export`/`shop` surface (devtool view vs Configurator domain split).
- Honest handling of round-trip loss on re-export (best-effort, never promise lossless).

See the [adapter-as-normalization-hub] paradigm and the no-lock-in principle recorded from this decision.
