---
kind: epic
parent: "150"
status: open
dateOpened: "2026-06-09"
dateStarted: "2026-06-11"
tags: [dev-experience, devtools, validation, linting, adapters, normalization, technical-configurator, dev-surface, no-lock-in]
relatedReport: reports/2026-06-07-dev-authoring-preferences-architecture-intents.md
relatedProject: webadapters
crossRef: { url: /backlog/150-dev-authoring-preferences-architecture-intents/, label: "Dev-prefs decision (#150)" }
---

# Validation normalization + shopping devtool (adapter-as-normalization-hub)

Spun out of [#150](/backlog/150-dev-authoring-preferences-architecture-intents/) (the [project-protocol-bar](docs/agent/platform-decisions.md#project-protocol-bar) rule). The differentiated,
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

## Progress

**`see` leg shipped (2026-06-11).** The epic was scoped to its first, genuinely-buildable leg —
`see` — with `re-export` and `shop` spun out as children. Delivered:

- **Pivot model + knowledge base** — `we:scripts/validation-normalize/knowledge.mjs`: tool-agnostic
  `concerns`, a cross-tool `mappings` table graded by confidence (`exact`/`partial`/`approx`), and
  the implicit `none` grade where a tool has *no equivalent* (the valuable shopping cells).
- **Adapters** — `we:adapters/eslint.mjs` + `we:adapters/oxlint.mjs`, each `ingest(config)` →
  normalized rules. They only ever read the incumbent's own config (zero lock-in).
- **Merge engine** — `we:normalize.mjs` joins ingested configs against the knowledge base into a
  comparative model (one cell per concern×tool, with `active`/`severity` from the loaded project),
  plus a `summarize()`. Entry point `we:index.mjs` exposes `see(configsByTool)`.
- **Catalog page** — `/validation-rules/` (`we:src/validation-rules.njk` + `we:src/_data/validationRules.js`)
  auto-renders the comparative table from fixture configs, highlighting divergences and no-equivalent
  cells. Nav entry added under Explore; Vite proxy allowlist updated.
- **Tests + authoring note** — 9 vitest cases (`we:__tests__/normalize.test.mjs`) green;
  `we:scripts/validation-normalize/README.md` documents the pivot model + how to add an adapter.

Resolutions of the four "resolve at build time" forks (POC defaults):

- **v1 tool set / first rule classes** → ESLint + Oxlint; six concerns spanning exact matches,
  a partial (`hook-deps`), and a no-equivalent (`import-boundaries`, Oxlint side) to demonstrate the
  comparative value.
- **Pivot schema + confidence tagging** → concern + graded mapping (above), discovered against a
  working `see` view rather than on paper.
- **surface split** → devtool view for now (`see`); Configurator domain deferred to the `shop` child.
- **round-trip loss** → not applicable to `see` (read-only); the honest-loss requirement is carried
  into the `re-export` child.

Deferred legs spun out: **#282** (re-export) and **#283** (shop, gated on the Technical
Configurator maturing). Epic resolved down to the shipped `see` devtool.
