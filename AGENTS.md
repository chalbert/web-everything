# AGENTS.md — Web Everything

**Canonical agent instructions.** Read by Claude, Copilot, Cursor, and any other agent.
`CLAUDE.md` and `.github/copilot-instructions.md` are stubs that point here. This file is the
**always-loaded router** — keep it small. Detail lives in `docs/agent/` and is read on demand.

## Mental model
**Web Everything** defines browser-aligned standards to unify the web ecosystem. Two layers:
- **Plugs** (`plugs/`) — core primitives that patch/extend browser APIs (CustomStore, CustomAttribute, InjectorRoot). Exposed on `window` in **plugged mode**; tree-shakeable in **unplugged mode**.
- **Blocks** (`blocks/`) — reusable implementations built on plugs (SimpleStore, OnEventAttribute, CallParser). Imported directly.

**Reach ambition:** the standards are *contracts*, not a JS lock-in. The browser/JS runtime is the first realization, not the only one — the goal extends to making contracts realizable in **any server runtime** (.NET, Java, Go…) so the standard reaches the **enterprise** tier where those stacks live. The lever is **forward (generation) adapters**: one internal source of truth projected *outward* into ecosystem-native code — the inverse of the bottom-up **ingest** adapter (incumbent → internal pivot). *Direction under exploration, not yet ratified* — see decision #463 (polyglot MaaS origin), gated on the canonical JS origin #461.

[Frontier UI](../frontierui/) is the **reference implementation** of these standards. This repo is canonical for shared terminology, naming, **protocols** (conformance contracts owned by a Project, surfaced via `/protocols/`), and **intents** (UX preference vocabularies, surfaced via `/intents/`). Frontier UI points back here.

> **`../plateau/` is the abandoned single-repo prototype** — superseded by this repo + Frontier UI + plateau-app. New implementation work lands in **Frontier UI**, never plateau. You *may* read plateau as a **non-authoritative reference** when nothing more recent exists (a behavioral sketch to adapt), but it is **not a model**: it predates current decisions and may contradict them, so anything taken from it must be re-derived against the live spec/conventions and called out as plateau-sourced — never copy its architecture wholesale. (`plateau-app` is a live product and is fine.)

## The website IS the spec
`src/_data/*.json` + `src/_includes/*-descriptions/*.njk` are the **source of truth**. Implementation follows documented API. If it isn't documented, document it first. These specs are large — **query one entry at a time** (grep/jq), never load whole.

## Hard rules (always apply)
1. **Design-first**: document in JSON/njk before implementing. Respect `designDecisions`; discuss before overriding one.
2. **Naming is enforced**: traits `with[Capability]` (never `use*`), registries `Custom[Name]Registry`, injector domains start with `@`, event attrs `on:event`. Full list → [conventions.md](docs/agent/conventions.md).
3. **New terms** introduced by any block/plug/intent **must** be added to `src/_data/semantics.json` (term-first).
4. **Tests required**: 80% coverage minimum. Unit/integration `*.test.ts` (Vitest), E2E `*.spec.ts` (Playwright).
5. **Demo edits**: keep the `text/plain#demo-js-source` and the running `type="module"` sections of `demos/declarative-spa.html` in sync.
6. **Browser-support floor is Baseline-2024**: assume modern primitives exist (FACE/`ElementInternals`, popover, `:state()`, `:user-invalid`, anchor positioning). Below Baseline-2024 is **out of scope** — don't shim it by default. Polyfills are an **opt-in enhancement layer** (a plug/trait the consumer adds), never a baseline assumption, so specs stay single-substrate. Decision [#031](backlog/031-polyfill-baseline-floor.md); substrate detail in `reports/2026-06-02-native-platform-substrate.md`.

## Definition of Done (run before finishing)
- Changed an API? Update its `.njk` description **and** its `src/_data/*.json` entry.
- **Added or changed a standard's feature?** Its conformance demo must reflect the **full** feature set — add a shared **fixture/case** for it (demos are fixture-driven, so one fixture updates the demo *and* its unit tests at once). A shipped feature with no demo case is **not done**. See [demo-workflow.md](docs/agent/demo-workflow.md).
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
| Capturing ideas/issues/decisions/reviews, report open questions → `/backlog/` (one md file per item in `backlog/`; every item needs a `workItem` story/epic/task + Fibonacci `size` on stories/unstoried-epics — feeds the `/backlog/` burndown) | [docs/agent/backlog-workflow.md](docs/agent/backlog-workflow.md) → "Agile sizing" |
| Picking the next item to work on (dev-ready first) | [docs/agent/backlog-workflow.md](docs/agent/backlog-workflow.md) → "Selecting the next item to work on" (Claude: `/next-backlog-item` triggers it; `/next decision` surfaces the one call to make) |
| Preparing an open decision *ahead* of the call — research + author its forks to "ready to ratify" (no human judgment yet; sets `preparedDate`) | [docs/agent/backlog-workflow.md](docs/agent/backlog-workflow.md) → "The prepared-fork shape" (Claude: `/prepare` triggers it) |
| Building or changing a runtime demo under `demos/` | [docs/agent/demo-workflow.md](docs/agent/demo-workflow.md) |
| Building/continuing a flagship **exercise app** (#314) — the platform-first loop (WE is primary, the app is a forcing function) | [docs/agent/exercise-app-workflow.md](docs/agent/exercise-app-workflow.md) (Claude: `/exercise-app`) |
| Dev environment & scripts | `DEV_GUIDE.md` |
| Canonical specs (per-entry) | `src/_data/{blocks,plugs,intents,protocols,semantics,references}.json`; backlog = `backlog/*.md` |

## Repository inventory
<!-- AUTO-GENERATED:inventory — run `npm run gen:inventory`; do not edit by hand -->
- **Plugs** 45 — 31 active · 12 concept · 2 experimental
- **Blocks** 57 — 24 active · 7 concept · 26 draft
- **Intents** 47 — 14 concept · 33 draft
- **Glossary terms** 192 · **Research topics** 62 (58 open)
- **Projects** 35: webadapters, webanalytics, webaudit, webbehaviors, webblocks, webcases, webcompliance, webcomponents, webcontexts, webdecisions, webdirectives, webdocs, webevents, webexpressions, webguards, webinjectors, webintents, webintl, weblifecycle, webmanifests, webnotifications, webplugs, webpolicy, webportals, webpositioning, webrealtime, webregistries, webreliability, webreporting, webresources, webstates, webtheme, webtraces, webtraits, webvalidation
<!-- /AUTO-GENERATED:inventory -->

## Commands
```bash
npm start                 # Vite (3000) + 11ty (8080); browse http://localhost:3000
npm test                  # unit + integration (Vitest)
npm run test:integration  # E2E (Playwright; needs npm start)
npm run check:standards   # consistency & convention checks — part of Definition of Done
npm run check:app-conformance  # exercise-app platform-conformance benchmark (--app=demos/<id> [--json --strict])
npx @11ty/eleventy        # build docs site (verify page count after adding research)
```
