# Design-First — The Website IS the Spec

> Tier-1 reference. Read before adding or changing any block, plug, or intent.

The documentation website (`src/_data/*.json` + `src/_includes/*-descriptions/*.njk`) is the **source of truth**. Implementation follows the documented API — if something isn't documented yet, **document it first**, then implement.

## The method (every standard)

Author **every** standard the same way. Four steps, research → plan, *before* any `*.json`/`.njk` is written:

1. **Research prior art.** Browser standards (MDN / WHATWG / W3C — current, draft, proposal), established libraries (e.g. Floating UI, Mousetrap), framework patterns (React, Vue, Angular, Solid), and the benchmarks tracked in `references.json` (MD3, Carbon, Radix, Fluent, Apple HIG, WAI-ARIA). **Reuse established terminology** — don't coin a new term when the platform already has one.
2. **Verify overlap & relationship.** Grep the existing registries **one entry at a time** (`intents.json`, `blocks.json`, `plugs.json`, `adapters.json`, `projects.json`, `semantics.json`). Classify the new thing against what exists:
   - **duplicates** → stop; extend the existing entry instead.
   - **extends / specializes** an existing standard → note the parent.
   - **composes-with** an existing standard → cross-reference both ways (e.g. positioning composes with Web Portals for top-layer).
   - **net-new** → proceed.
   Watch for phantom references — a name used by an adapter/registry/glossary term but defined nowhere (define it, don't re-invent it).
3. **Determine semantics (term-first).** Identify the terms the standard introduces. Every new term **must** be added to `semantics.json` (AGENTS.md hard rule 3). Flag collisions with existing terms (e.g. *virtual element* already means comment markers in Web Directives — pick a distinct name).
4. **Plan, then design-first.** Write a plan naming **which layer(s)** to create (see cheat-sheet) *and* the plugs/implementations that follow. Draft the spec **with open questions** and iterate in **plan mode** before writing anything. Then implement and run the **Definition of Done** (AGENTS.md): `gen:inventory` if you added a block/plug/intent, `check:standards`, affected tests.

### Which layer? (taxonomy cheat-sheet)

| If the thing is… | It's a… | Lives in |
|---|---|---|
| A cross-cutting domain / mission | **Project** | `projects.json` (+ `project-*.njk`) |
| A declarative UX/UI profile (the "what") | **Intent** | `intents.json` |
| A reusable implementation (the "how") | **Block** | `blocks.json` (+ `block-descriptions/{id}.njk`) |
| A patch/extension to a browser primitive | **Plug** | `plugs.json` (+ `plug-descriptions/{id}.njk`) |
| A bridge to a third-party library | **Adapter** | `adapters.json` (+ `adapter-descriptions/{id}.njk`) |

A standard often spans layers: an **intent** declares it, a **block** implements it (`implementsIntent`), an **adapter** bridges a library to it. Plan the whole set in step 4.

## Before implementing
1. Check if it's documented in `src/_data/blocks.json` / `plugs.json` / `intents.json`.
2. Read the design in `src/_includes/{block|plug}-descriptions/{id}.njk`.
3. Follow the documented API; consult the `designDecisions` field for rationale. If you disagree with a decision, **discuss with the user before changing it**.

## Data files (canonical specs — query per-entry, don't load whole)

| File | Holds |
|------|-------|
| `blocks.json` | Block registry: id, type, status, traits, webStandards, events, designDecisions, implementsIntent |
| `intents.json` | UX protocols: dimensions, contract description, designSystemResearch, lifecycle events |
| `plugs.json` | Core primitive specs: exports, usage, designDecisions |
| `semantics.json` | Glossary — see [conventions.md](./conventions.md) |
| `references.json` | External benchmarks by category |
| `traits.json` · `adapters.json` · `projects.json` · `demos.json` | Supporting registries |

## Research before designing a new block
- **Web standards**: MDN, WHATWG, W3C (current, draft, proposal).
- **Framework patterns**: React, Vue, Angular, Solid, etc.
- **Terminology**: reuse established terms from standards and major frameworks.

## Adding a block
1. Add entry to `blocks.json` (id, name, status, type, summary, exports, sourcePath, dependsOn, `webStandards`, `designDecisions`, optional `frameworkComparison`).
2. Create `src/_includes/block-descriptions/{id}.njk` with: overview, **Web Standards Alignment** table, **Framework Research** table (if applicable), features, usage, API reference, exports.
3. Add any new terms to `semantics.json`.

## Adding a plug
1. Add entry to `plugs.json`. 2. Create `src/_includes/plug-descriptions/{id}.njk`. 3. Update `plugs/bootstrap.ts` if it becomes a global.

## Adding an intent
Intents are **JSON-only** — there is no `intent-descriptions/` njk dir; the spec renders from an inline HTML `description` field.
1. Add entry to `intents.json`:
   - `id`, `name`, `status` (lifecycle — see below), `summary` (one line).
   - `dimensions` — named axes, each `{ description, values: [...] }`. The dimensions ARE the protocol's vocabulary.
   - `description` — inline HTML contract (the `<h3>` + `<ul>`/`<table>`/`<pre>` blocks: behavior contract, interface `type`s, provisioning/consumer examples).
   - Optional: `events` (lifecycle events the intent emits), `designSystemResearch` / `uxResearch` (benchmark comparison), `researchGaps` (open questions).
2. Add any new terms to `semantics.json`.
3. Link implementing blocks back via `implementsIntent: "{id}"` in `blocks.json`.

## Table formats (njk)
```html
<h3>Web Standards Alignment</h3>
<table><tr><th>Standard</th><th>Status</th><th>How We Adopt It</th></tr>
  <tr><td><a href="https://...">API</a></td><td>Baseline 2024</td><td>…</td></tr></table>

<h3>Framework Research</h3>
<table><tr><th>Framework</th><th>Key Patterns Adopted</th></tr>
  <tr><td><a href="https://...">React Router</a></td><td>Loaders, outlets, useParams</td></tr></table>
```

## Block types & status
- **Types**: Store · Parser · Behavior · Directive · Component · Module.
- **Status — one canonical lifecycle for blocks AND plugs** (and intents, demos, resources, states):
  `concept` (planned, ~10%) → `draft` (partial, ~50%) → `experimental` (works, unstable, ~60%) → `active` (ready, 100%).
  - ❌ Do **not** use `implemented`, `stable`, `done`, `planned`, `wip` — these are deprecated synonyms; `check:standards` rejects them. (`implemented` → `active`.)
  - Research topics use a separate axis: `open` / `resolved`.
  - `poc` exists only at the coarser **project** level (`projects.json`), not for blocks/plugs.

## Reference benchmarks (keep Intents comprehensive supersets)
Material Design 3 · Carbon (IBM) · Radix UI · Fluent 2 · Apple HIG · WAI-ARIA. Tracked in `references.json`.

## Documentation Standards (11ty/Nunjucks)
- Content lives in `src/_data/*.json`; render with `.njk`. Use `{% highlight "typescript" %}` for code; keep snippets short to avoid horizontal overflow.
- Project page = high-level mission + grid of cards; sub-spec pages = dedicated detail pages.
