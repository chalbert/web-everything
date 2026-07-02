# Cross-repo explorer boundary — engine vs product surface (#1747 prep)

**Date:** 2026-06-24 · **Decision:** [#1747](/backlog/1747-decide-the-plateau-explorer-product-surface-to-fui-explorer-/) · **Research topic:** `/research/cross-repo-tool-engine-product-boundary/`

## Question

How does the Plateau explorer **product surface** (CLI / orchestration / report-bundling) consume the FUI
explorer **engine** (stateFlowGraph / oracles / browser-driver harnesses) once they live in different
repos — and where does the Layer-1 `genericInvariants` oracle set live?

## Grounding (verified against the tree)

- The 4 product-surface files (`fui:tools/explorer/cli.ts`, `fui:tools/explorer/cliRouting.ts`,
  `fui:tools/explorer/routeDiscovery.ts`, `fui:tools/explorer/reportBundle.ts`, ~640 LOC) import 8 engine
  internals via `fui:tools/explorer/cli.ts:21-31` (`workbenchHarness`, `docsSiteHarness`, `gateRunner`,
  `routeSweep`, `routeDiscovery`, `reportBundle`, `authRecipe`, + `stateFlowGraph`/`observation`/`gate`
  types). The 4 product files do **not** import `conformanceVectors` or `genericInvariants` directly.
- `plateau:package.json` has **no `@frontierui` dependency**; `fui:package.json` is `"private": true`
  with **no `exports`/`main`/`bin`** — no published public API exists today.
- `fui:tools/explorer/oracles/genericInvariants.ts` (app-agnostic no-crash / no-a11y) is consumed by
  `fui:tools/explorer/gate.ts:21`, `fui:tools/explorer/exploreAndAudit.ts:15`,
  `fui:tools/explorer/routeSweep.ts:18` — all **FUI explorer-engine internals** that stay in FUI.
- The **conformance** engine (contract `we:conformance-vectors/binding.ts` #1596, runner/judge
  `plateau:src/conformance-engine/conformanceVectors.ts` #1597) is a **different** engine from the
  **explorer** engine — the item's "false edge" reading is correct.

## Prior art

Real practice (Playwright `playwright-core`/`@playwright/test`; WebdriverIO `@wdio/cli`; axe-core +
`@axe-core/cli` + axe DevTools; Testing Library engine-as-peerDependency; Chromatic SaaS-over-OSS)
converges: nobody duplicates the engine, almost nobody hard-merges CLI into the engine bundle — the norm
is a separate CLI/product package **beside** the engine, co-located in one repo while churning, with a
thin operated wrapper in the product repo. Graduate to a curated public-API package (`exports` map, API
Extractor `@alpha`/`@beta`/`@public` gating) only when the surface stabilizes. Conway's law: split on
team/ownership boundaries, not technical ones.

## The WE wrinkle (why generic "keep co-located" can't be taken literally)

`we:docs/agent/platform-decisions.md` devtools-placement **rule 3 ratifies "autonomous-explorer CLI
chrome → Plateau"** (#1565 Fork 3; the live work item is `we:backlog/1577-*.md`). So the move to Plateau is
mandated — option (b) "keep the whole explorer in FUI" would **reverse** a ratified decision. The
real fork is *how* Plateau consumes the FUI engine: (a) full curated public API now vs (c) thin chrome
over the narrowest engine API. With the engine still churning (epic #1522/#1167), minimize the frozen
surface → **(c) interim, (a) end-state**.

## genericInvariants home

The #1565 residual framed it as "Plateau product-engine vs shared platform-UX lib." But the consumer
graph is decisive: `genericInvariants` is imported only by FUI engine internals
(`fui:tools/explorer/gate.ts`, `fui:tools/explorer/routeSweep.ts`, `fui:tools/explorer/exploreAndAudit.ts`)
that **stay in FUI**. Moving it to Plateau would create a banned backward CODE edge (FUI engine importing
from downstream Plateau). Plateau's CLI consumes these invariants **transitively** through the engine API,
not directly. So `genericInvariants` **stays in FUI** with the engine it serves; a shared platform-UX lib
(which would have to sit upstream of FUI, and can't be WE per #1282 since it's executable) is premature for
one file with no direct second consumer.

## Skeptic

- **Fork 1 → SURVIVES-WITH-AMENDMENT (flipped (b)→(c)).** Skeptic over-reached claiming "engine→FUI is a
  factual error" — that codified ruling governs the *conformance* engine (#1566), not the *explorer*
  engine. But its load-bearing point holds: rule 3 + #1577 ratify CLI-chrome→Plateau, so default (b)
  reverses a ratified call. Flipped to **(c)** (thin chrome over narrowest engine API, → (a) end-state).
- **Fork 2 → SURVIVES (skeptic REFUTED).** Skeptic argued genericInvariants → Plateau on bias-toward-
  separation. Tested against the consumer graph: its consumers are FUI-resident engine internals, so a
  Plateau home is a banned backward edge. Default **stays FUI**. (The bias-toward-separation pull is real
  but is satisfied at the *engine-API* seam, not by relocating an engine-internal oracle.)
