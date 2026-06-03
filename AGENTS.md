# AGENTS.md — Web Everything

**Canonical agent instructions.** Read by Claude, Copilot, Cursor, and any other agent.
`CLAUDE.md` and `.github/copilot-instructions.md` are stubs that point here. This file is the
**always-loaded router** — keep it small. Detail lives in `docs/agent/` and is read on demand.

## Mental model
**Web Everything** defines browser-aligned standards to unify the web ecosystem. Two layers:
- **Plugs** (`plugs/`) — core primitives that patch/extend browser APIs (CustomStore, CustomAttribute, InjectorRoot). Exposed on `window` in **plugged mode**; tree-shakeable in **unplugged mode**.
- **Blocks** (`blocks/`) — reusable implementations built on plugs (SimpleStore, OnEventAttribute, CallParser). Imported directly.

[Frontier UI](../frontierui/) is the **reference implementation** of these standards. This repo is canonical for shared terminology, naming, **protocols** (conformance contracts owned by a Project, surfaced via `/protocols/`), and **intents** (UX preference vocabularies, surfaced via `/intents/`). Frontier UI points back here.

## The website IS the spec
`src/_data/*.json` + `src/_includes/*-descriptions/*.njk` are the **source of truth**. Implementation follows documented API. If it isn't documented, document it first. These specs are large — **query one entry at a time** (grep/jq), never load whole.

## Hard rules (always apply)
1. **Design-first**: document in JSON/njk before implementing. Respect `designDecisions`; discuss before overriding one.
2. **Naming is enforced**: traits `with[Capability]` (never `use*`), registries `Custom[Name]Registry`, injector domains start with `@`, event attrs `on:event`. Full list → [conventions.md](docs/agent/conventions.md).
3. **New terms** introduced by any block/plug/intent **must** be added to `src/_data/semantics.json` (term-first).
4. **Tests required**: 80% coverage minimum. Unit/integration `*.test.ts` (Vitest), E2E `*.spec.ts` (Playwright).
5. **Demo edits**: keep the `text/plain#demo-js-source` and the running `type="module"` sections of `demos/declarative-spa.html` in sync.

## Definition of Done (run before finishing)
- Changed an API? Update its `.njk` description **and** its `src/_data/*.json` entry.
- Introduced a term? Add it to `semantics.json`.
- Wrote a `reports/*.md` report? It's **outside the 11ty build** — expose it: promote it to a `/research/` topic, or mirror it with a **backlog pointer item** (`relatedReport`, no body). `check:standards` fails on a hidden report (see [backlog-workflow.md](docs/agent/backlog-workflow.md) → "Three homes — nothing stays hidden").
- Added/removed a block, plug, or intent? Run `npm run gen:inventory` (refreshes the generated summary below — never edit it by hand).
- Run `npm run check:standards` — it must pass (it also fails if the inventory is stale).
- Run affected tests (`npx vitest run <path>`); for broad changes, `npm test`.
- Learned something durable (new pattern, gotcha, decision)? Add it to the **specific** `docs/agent/*.md` file it belongs to — not here.

## Where to look (read on demand)

| Task | Read |
|------|------|
| Naming, glossary, code style, icons | [docs/agent/conventions.md](docs/agent/conventions.md) |
| Writing/changing tests, web cases | [docs/agent/testing.md](docs/agent/testing.md) |
| Plugs/blocks, injectors, registries, parsers, debugging | [docs/agent/architecture.md](docs/agent/architecture.md) |
| Adding a block/plug/intent/adapter, doc requirements, the standard-authoring method | [docs/agent/design-first.md](docs/agent/design-first.md) (Claude: `/new-standard` triggers it) |
| Processing `plans/` → research pages, reports | [docs/agent/research-workflow.md](docs/agent/research-workflow.md) |
| Capturing ideas/issues/decisions/reviews, report open questions → `/backlog/` (one md file per item in `backlog/`) | [docs/agent/backlog-workflow.md](docs/agent/backlog-workflow.md) |
| Dev environment & scripts | `DEV_GUIDE.md` |
| Canonical specs (per-entry) | `src/_data/{blocks,plugs,intents,protocols,semantics,references}.json`; backlog = `backlog/*.md` |

## Repository inventory
<!-- AUTO-GENERATED:inventory — run `npm run gen:inventory`; do not edit by hand -->
- **Plugs** 41 — 31 active · 8 concept · 2 experimental
- **Blocks** 27 — 13 active · 7 concept · 7 draft
- **Intents** 28 — 9 concept · 19 draft
- **Glossary terms** 140 · **Research topics** 18 (18 open)
- **Projects** 25: webadapters, webanalytics, webbehaviors, webblocks, webcases, webcomponents, webcontexts, webdirectives, webdocs, webevents, webexpressions, webinjectors, webintents, webintl, webmanifests, webplugs, webportals, webpositioning, webregistries, webreliability, webresources, webstates, webtraces, webtraits, webvalidation
<!-- /AUTO-GENERATED:inventory -->

## Commands
```bash
npm start                 # Vite (3000) + 11ty (8080); browse http://localhost:3000
npm test                  # unit + integration (Vitest)
npm run test:integration  # E2E (Playwright; needs npm start)
npm run check:standards   # consistency & convention checks — part of Definition of Done
npx @11ty/eleventy        # build docs site (verify page count after adding research)
```
