---
type: decision
locus: frontierui
workItem: story
size: 3
parent: "398"
status: resolved
dateOpened: "2026-06-12"
dateStarted: "2026-06-14"
dateResolved: "2026-06-14"
graduatedTo: "project:webdocs"
preparedDate: "2026-06-13"
tags: [webdocs, frontier-ui, adapters, ingestion, storybook]
relatedProject: webdocs
relatedReport: reports/2026-06-13-webdocs-ingestion-adapter-home.md
crossRef: { url: /backlog/398-build-the-web-docs-product-fui-open-primitives-plateau-app-o/, label: "Web Docs product epic (#398)" }
---

# Storybook ingestion adapter — Storybook to the webcases pivot

FUI slice of #398 (per-incumbent sub-split of the former combined adapters story, 2026-06-12). Bottom-up adapter that ingests Storybook (CSF/stories) into the webcases pivot the generator (#424) consumes — the lossy normalization-hub direction, so a customer can onboard their existing Storybook component docs. Enhancement on the self-host floor, not the floor itself. Independent of the Mintlify adapter (#429) and the primitives slice. Further incumbents (Docusaurus, …) drop in as more size-3 siblings under #398.

## Prepared 2026-06-13 — grounding

No design exists yet (no ingestion adapter in any repo). **Two forks** grounded in the published research topic [`webdocs-incumbent-ingestion-adapters`](/research/webdocs-incumbent-ingestion-adapters/) (Storybook CSF + Mintlify format survey) and report `we:reports/2026-06-13-webdocs-ingestion-adapter-home.md`, each carrying a **bold** recommended default. The same call governs every webdocs ingestion adapter (this, #429 Mintlify, future Docusaurus) — #429 is `blockedBy` this. `/next decision` makes the call; prep only brings it to ready. (Blocker #424 is resolved — the pivot it gated now ships at `fui:webdocs/generator.ts`.)

## Axis framing

A webdocs ingestion adapter is a pure function `incumbent source → WebCases` — a bottom-up adapter-as-normalization-hub shim that ingests incumbents into a lossy internal pivot the project never sees (lossy, disposable, the project never authors in the pivot). The pivot it targets is shipped: `WebCase = {id, title, description, code}` (`fui:webdocs/generator.ts:27-34`), `WebCases = Record<blockId, WebCase[]>` (`fui:generator.ts:37`), `RawCaseFile`/`RawCases` (`fui:generator.ts:40-46`). `parseWebCase` lifts title/description from a `<!-- WEB CASE N -->` HTML comment (`fui:generator.ts:54-67`) — a **WE-corpus-specific** convention incumbents won't carry, so an adapter sets those fields from the source's own metadata and emits `WebCases` directly.

The concern decomposes into two orthogonal axes:

- **Home (import reach).** *(Prep-time framing — superseded by Fork 1's 2026-06-13 reframe, which found the generator imports nothing from WE and so has no real import-reach constraint; kept here for the trail.)* #424 graduated the pivot to **webeverything**, not FUI and not a published `@webeverything/*` package. But this item is `locus: frontierui`, and FUI has **no path to it**: its only aliases are the seven `@web*/* → plugs/*` (`fui:frontierui/tsconfig.json:20-26`, `frontierui/vite.config.mts:126-132`) — no `@we`/webdocs reach. Both in-repo adapter families already live in webeverything, none in FUI: the **ingest** precedent `we:scripts/validation-normalize/adapters/eslint.mjs:1-20` (`ingest`/`emit`, plain module per tool, no registry) and the **generation** family `we:validation-generation/adapters/index.ts:1-29`. Even the served consumer can't reach the pivot yet — plateau-app aliases only `@we/plugs/*`+`@we/blocks/*` (`plateau:plateau-app/tsconfig.json:16-17`), not `webdocs` — so a `@we/webdocs` reach is needed regardless of home.
- **Contract shape (build target).** Two in-repo precedents: a **plain provider module** (`we:eslint.mjs:7-14`) vs a **runtime registry** (`CustomValidationAdapterRegistry`, `we:validation-generation/adapters/index.ts:1-29`). Ingestion runs once at customer onboard/build time, consulted by a tool — a build/author-time devtools provider seam, not a runtime DI registry.

## Recommended path at a glance

| Fork | Recommended default | Main alternative | Confidence |
| --- | --- | --- | --- |
| 1 · Cluster home *(reframed 2026-06-13, see below)* | **C — move the whole webdocs impl cluster (generator + coverage + adapters) to FUI**; adapters co-locate there | A — co-locate adapters in `webeverything/webdocs/` (status quo) · B — split adapter alone into FUI | Medium — corrects #424's landing; reopens a `resolved` item |
| 2 · Contract shape | **A — plain provider module `{ source, ingest } → WebCases`** (we:eslint.mjs precedent) | B — `CustomWebcasesAdapterRegistry` | High — author-time seam, not a runtime registry |

## Fork 1 — Cluster home (reframed during the 2026-06-13 decision discussion)

**Reframe (2026-06-13).** The original fork asked "adapter: follow the generator into webeverything (A), or split into FUI (B)?" — *taking the generator's WE location as fixed*. The decision discussion surfaced three clear findings that dissolve that framing:

- **`fui:webdocs/generator.ts` imports nothing** — zero coupling to any WE standard internal (it only defines the `WebCase`/`WebCases` types + parse/generate logic). So there is **no import-reach problem** to solve: the generator reaches into WE for nothing, and moving it to FUI needs no exposure plumbing and creates no cross-repo dependency.
- **Nothing in WE consumes the generator** — no build or runtime caller anywhere in the repo (WE's own docs still use the original `we:cases.js`, not this generalized generator). It's an orphan impl sitting in the WE tree.
- **#424 itself filed the generator as a "FUI slice of #398"** — the *intent* was FUI; only the code's *landing path* (`we:webeverything/webdocs/generator.ts`) put it in WE. The `WebCase` shape is docs-tooling impl, not a web-platform standard, so WE need not hold it at all.

So the adapter's home isn't an independent choice — it follows the generator, and the generator is misplaced. The options:

- **A — Co-locate adapters in `webeverything/webdocs/` next to the generator** (status quo home). Cohesive, zero plumbing — but *entrenches* the generator's layering violation rather than fixing it.
- **B — Split the adapter alone into FUI**, leaving the generator in WE. Worst end-state: manufactures a cross-repo FUI→webeverything dependency to shim WE's own input. Rejected by all.
- **C — Move the whole webdocs impl cluster (generator + `fui:coverage.ts` + adapters) to FUI**; the `WebCase` contract goes with it (WE holds nothing webdocs-specific). Adapters then co-locate with the generator **in FUI** — satisfying co-location **and** the constellation-layering "impl/adapters → FUI" line at once. Mechanically cheap precisely because the generator has zero WE imports; safe because no WE code consumes it.

**Default: C.** On **merit**: A and B both took the generator's WE residence as given, but that residence is an accident of #424's landing path, not a decision — the generator is pure impl with no tie to WE. C is the only option where co-location and the layering ruling both hold; it makes the prepared fork's dilemma vanish (move the generator to where adapters belong, instead of dragging adapters to where the generator wrongly landed).

*Scope note — C reopens #424 (resolved).* This is the "big enough to be its own decision" case: the ruling implies a **corrective migration** of `webdocs/` from webeverything → FUI, filed as a spin-off child of #398 at close-out (not done inside #426). The adapter builds (#429, future Docusaurus) then land in FUI cleanly. If the decider prefers **not** to touch #424's output now, the fallback is **A** (adapters in WE next to the generator) with the layering correction logged as known debt.

*Rejected — B.* Worse architecture (cross-repo split of the generator's own input shim), not merely more work.

*Sub-decision (only if A is chosen):* none needed — A is the status-quo home, direct type import. (Under B only, exposure mechanism would matter — publish an `@webeverything/webdocs` contract package vs a `webdocs` FUI path alias; the alias is lighter. Moot under A and C.)

## Fork 2 — Adapter contract shape (the build target)

Crux: two in-repo contract precedents — a plain provider module (`we:eslint.mjs:7-14`) vs a `CustomValidationAdapterRegistry` (`we:validation-generation/adapters/index.ts:1-29`).

- **A — Plain per-source provider module** `{ source, ingest }`, `ingest(raw) → WebCases`, matching `we:eslint.mjs`. The adapter maps the source's own metadata (CSF `Meta`/Story exports, Mintlify frontmatter+fenced blocks — see the research topic) to `{id,title,description,code}` and emits `WebCases` directly, bypassing `parseWebCase` (its `<!-- WEB CASE -->` convention is WE-specific, `fui:generator.ts:54-67`). `emit`/re-export is opt-in.
- **B — A `CustomWebcasesAdapterRegistry`** mirroring the validation-generation registry.

**Default: A.** It's a build/author-time devtools provider seam, not a runtime DI registry: ingestion runs once at onboard/build time, consulted by a tool — an author-time provider seam, not a runtime registry the standard consults. The source axis is still open (one plain module per incumbent, dropping in as size-3 siblings — Storybook, Mintlify, Docusaurus), exactly the `we:eslint.mjs`/`we:oxlint.mjs` pattern.

### What the `we:eslint.mjs` precedent looks like (option A, concrete)

The full precedent module — `we:scripts/validation-normalize/adapters/eslint.mjs:7-15` — is a plain per-tool provider: an id export + an `ingest` function (+ an opt-in `emit` inverse). No base class, no `register()` call, no singleton:

```js
export const tool = 'eslint';
export function ingest(config) {              // incumbent source → normalized model
  const rules = config?.rules ?? config ?? {};
  return Object.entries(rules).map(([rule, setting]) => {
    const severity = severityOf(setting);
    return { rule, severity, enabled: severity !== 'off' };
  });
}
export function emit(rules) { /* … the inverse re-export leg (#282), opt-in */ }
```

The consumer wires the modules with a static import + a plain lookup object, all resolved at module load — nothing registers itself at runtime (`we:validation-normalize/index.mjs:9-22`):

```js
import * as eslint from './adapters/eslint.mjs';
import * as oxlint from './adapters/oxlint.mjs';
export const adapters = { eslint, oxlint };   // plain object, built at load time
// use: adapters[toolId].ingest(cfg)
```

Adding an incumbent = drop a new `.mjs` + add one import line. The webdocs adapter is the same shape, `ingest` returning the pivot instead of lint rules:

```ts
// webdocs/adapters/storybook.ts
export const source = 'storybook';
export function ingest(raw: StorybookCSF): WebCases {
  // map CSF Meta/Story exports → { id, title, description, code }, keyed by block id
}
```

*Rejected — B.* Cargo-cult DI here: the validation-generation registry exists for on-demand runtime generation; one-shot author-time ingestion has no runtime consultation to justify a global singleton (the tell: kinship doc-comment + global mutable singleton — you'd instantiate a `CustomWebcasesAdapterRegistry` and call `.register('storybook', adapter)` at runtime, buying nothing over the static lookup object above).

---

## Ruling 2026-06-14 (ratified)

- **Fork 1 → C.** The whole webdocs impl cluster (`fui:generator.ts` + `fui:coverage.ts` + the new `adapters/`) moves from `webeverything/webdocs/` → **frontierui**, carrying the `WebCase`/`WebCases` types; WE holds nothing webdocs-specific. This corrects #424's landing path (the generator was filed as a "FUI slice" yet landed in WE, with zero WE imports and no WE consumer). Adapters then co-locate with the generator in FUI — satisfying both co-location and the constellation-layering "impl/adapters → FUI" line.
- **Fork 2 → A.** Plain per-source provider module `{ source, ingest } → WebCases` (the `we:eslint.mjs`/`we:oxlint.mjs` pattern), wired by static import + plain lookup object; **not** a `CustomWebcasesAdapterRegistry` (no runtime consultation to justify DI — a build/author-time devtools provider seam, not a runtime DI registry).

**Spin-off builds (this decision yields agent-ready builds, not code):**
- The corrective cluster migration `webdocs/` → FUI — the chain head (nothing blocks it).
- The Storybook ingestion adapter build — `blockedBy` the migration.
- #429 (Mintlify) re-pointed: `blockedBy` the migration (was `["424","426"]` — both now resolved).

**Graduated to** `project:webdocs` — ingestion-adapter ruling → built by #550 (cluster migration to FUI) + #552 (Storybook adapter); #429 (Mintlify) re-pointed to #550.
