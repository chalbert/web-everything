# Web Docs incumbent-ingestion adapters — home + contract prep (#426)

**Date:** 2026-06-13 · **For:** decision #426 (Storybook ingestion adapter — the home/import fork;
governs every webdocs ingestion adapter: #426 Storybook, #429 Mintlify, future Docusaurus) ·
**Epic:** #398 (Web Docs product) · **Grounded in:** [[managed_offering_constellation_layering]] (#091),
[[adapter_normalization_hub]] (#150), [[npm_scope_mirrors_layer]] (#239),
[[runtime_di_vs_devtools_provider_seam]]

This is the prep artifact (autonomous half — research + authoring, no call made). It surveys the
ingestion prior art, classifies the adapter against the architecture, and brings both forks to a
Definition of Ready with a recommended default each. The call is `/next decision`'s.

---

## 1. What the adapter must produce — the pivot it targets

`webdocs/generator.ts` (graduated by #424) defines the **webcases pivot** the adapters target:

- `WebCase = { id, title, description, code }` — `generator.ts:27-34`.
- `WebCases = Record<string, WebCase[]>` (keyed by block/standard id) — `generator.ts:37`.
- `RawCaseFile = { id, content }` and `RawCases = Record<string, RawCaseFile[]>` — `generator.ts:40-46`.
- `parseWebCase(file)` lifts title/description from a leading `<!-- WEB CASE N: Title -->` HTML
  comment — `generator.ts:54-67`. **This convention is WE-corpus-specific**: incumbent sources carry
  their title/description in their own metadata, so an ingestion adapter sets those fields itself and
  produces `WebCases` directly rather than round-tripping through `parseWebCase`.

So a webdocs ingestion adapter is a pure function `incumbent source → WebCases` (or `RawCases` when the
source already matches the HTML-comment convention, which incumbents won't).

## 2. In-repo adapter precedent — both directions already live in webeverything

There are two adapter families in the tree, and **both are in webeverything; FUI has none**:

- **Normalization-hub / ingest** (the direction #426 is): `scripts/validation-normalize/adapters/eslint.mjs`
  — `ingest(config) → normalized rule[]` plus an `emit` inverse (`eslint.mjs:1-20`), one plain module per
  tool (`eslint.mjs`, `oxlint.mjs`), **no registry**. This is the #150 normalization-hub pattern: lossy,
  disposable, the project never authors in the pivot.
- **Lowering / generation**: `validation-generation/adapters/{nativeHtml,zod,pydantic,jsonSchema}.ts`,
  collected by a `CustomValidationAdapterRegistry` factory (`validation-generation/adapters/index.ts:1-29`).
  The registry exists because these emitters are consulted *on demand to generate output*.

FUI, by contrast, has only interaction-behavior `blocks/` and tooling `packages/`, and its only module
aliases are the seven `@web*/* → plugs/*` (`frontierui/tsconfig.json:20-26`,
`frontierui/vite.config.mts:126-132`). **There is no `@we`/webeverything alias and no webdocs reach** —
a `locus: frontierui` adapter physically cannot `import { WebCases } from '…/webdocs/generator'`.

Even the served consumer can't reach it yet: plateau-app aliases only `@we/plugs/*` and `@we/blocks/*`
(`plateau-app/tsconfig.json:16-17`, `plateau-app/vite.config.mts:119-120`) — **not** `webdocs` — and
imports no `@frontierui/*` at all. So whoever consumes the generator+adapters needs a new
`@we/webdocs` reach regardless of the home picked.

## 3. External prior art — Storybook CSF & Mintlify → the pivot

Full survey published as research topic **`webdocs-incumbent-ingestion-adapters`**. Headline mapping:

**Storybook (Component Story Format 3)** — `*.stories.*` modules: one `Meta` default export + N named
Story exports.
- `id` ← story export key / `@storybook/csf` `toId(meta.title, name)`; group id ← `meta.title`/component.
- `title` ← story `name` field, else `startCase(exportKey)`.
- `description` ← JSDoc comment above the story / `parameters.docs.description.story`.
- `code` ← verbatim story export source or `parameters.docs.source.code` (the runtime "dynamic" snippet
  is framework-specific and post-render — prefer the literal).
- **Lossy / no equivalent**: `args`/`argTypes` control matrices, `play` interaction tests, `decorators`
  (so `code` isn't self-contained), multi-framework renderings, `parameters`/`tags`.
- **Reuse**: `@storybook/csf-tools` (`readCsf`/`loadCsf` → `CsfFile.parse()`, Storybook's own indexer),
  `@storybook/csf` (`toId`, `storyNameFromExport`); `.mdx` docs via `@mdx-js/mdx` + `remark-mdx`.

**Mintlify** — `docs.json` nav config + `*.mdx` pages with YAML frontmatter.
- `id` ← MDX path/slug; group id ← enclosing `navigation.groups[].group`.
- `title` ← frontmatter `title` (fallback `sidebarTitle`); `description` ← frontmatter `description`.
- `code` ← fenced code blocks / `<CodeGroup>` / `<RequestExample>` in the body.
- **Lossy / no equivalent**: interactive OpenAPI playground, component embeds (`<Card>`, `<Tabs>`,
  `<Steps>`…), nav hierarchy beyond one group level, multi-language `<CodeGroup>` sets, prose body.
- **Reuse**: `gray-matter` (frontmatter), `@mdx-js/mdx` + `remark` + `unist-util-visit` (code/JSX nodes),
  `JSON.parse` for `docs.json`.

Cross-cutting: both sources are **page/module-grained, not case-grained** — CSF fans out naturally to one
case per story; Mintlify needs a granularity choice (per-page vs per-snippet). The lossy cells **are** the
normalization-hub's comparative value ([[adapter_normalization_hub]]) — flag, never silently drop.

The survey did **not** reshape the home fork, but it pins the shared adapter contract (a per-source
`ingest` producing `WebCases`, reusing the source's own parser) — which is Fork 2 below.

## 4. Classification pass (7 questions)

1. **Which layer?** A bottom-up normalization-hub ingest shim is **implementation**, not a standard
   (lossy, tool-specific, disposable, never project-authored). By [[npm_scope_mirrors_layer]] impl → FUI
   — *but* the pivot it's typed against already resides in webeverything (#424), and the only existing
   ingest-adapter precedent is in webeverything. So "layer" is clean (impl); the *home* is the contested
   axis precisely because the impl it attaches to is in webeverything, not FUI.
2. **Protocol or intent dimension?** Neither — it's an adapter. The pivot (`WebCases`) is internal memory,
   never project-facing, so it is **not** a protocol (the normalization-hub's defining property).
3. **Expose the whole axis?** Yes — the *source* axis is open (Storybook, Mintlify, Docusaurus, …); one
   plain module per incumbent, dropping in as size-3 siblings under #398 (matching `eslint.mjs`/`oxlint.mjs`).
4. **Fixed mechanic or dimension?** Per-incumbent adapter = a dimension (pluggable); the contract each
   implements = a fixed mechanic (Fork 2).
5. **DI-injectable (runtime registry vs author-time provider)?** Ingestion runs **once at customer
   onboard/build time**, consulted by a tool — not by the running standard at runtime. Per
   [[runtime_di_vs_devtools_provider_seam]] that is an **author-time devtools provider seam → plain
   provider modules, not a `CustomXRegistry`**. A registry here would be cargo-cult DI (the tell:
   kinship doc-comment + global mutable singleton with no runtime consultation).
6. **Most-permissive default?** `ingest` is the floor; `emit`/re-export is opt-in (the eslint precedent
   ships both, but ingest-only onboarding doesn't need the inverse).
7. **Seam between intents?** N/A.

**Standing bias — separate & decouple** ([[bias_separation_decoupling]]): co-locating the adapter with
the generator does **not** violate it — the adapter normalizes *the generator's own input*, which is
cohesive with its consumer. Splitting it to FUI while the generator sits in webeverything would *introduce*
a cross-repo FUI→webeverything seam for no decoupling gain — the bias here favors co-location.

## 5. The two forks (DoR)

### Fork 1 — Adapter home (the import-reach call) — **default A, medium confidence**

- **A (recommended): Co-locate in `webeverything/webdocs/adapters/`**, next to `generator.ts`; re-key the
  item `locus: webeverything`. Direct type import (`generator.ts:27-46`), zero exposure plumbing, matches
  the in-repo ingest precedent (`scripts/validation-normalize/adapters/eslint.mjs`). Generator + adapters
  stay one cohesive cluster following #424's placement of the pivot in webeverything.
- **B (rejected): Adapters in FUI, expose the pivot first.** Honors the literal "adapters → FUI" line of
  [[managed_offering_constellation_layering]], but on **merit** (not effort) it's the worse end-state: it
  splits the generator's input-shim across a repo boundary, manufacturing a cross-repo FUI→webeverything
  dependency for code cohesive with its consumer. The "adapters → FUI" line was a generic decomposition
  heuristic written before any adapter existed; the artifact's actual nature (a normalization shim typed
  against a webeverything-resident pivot) is best-placed with that pivot.
  - *Sub-decision (only under B):* exposure mechanism — publish pivot types as an `@webeverything/webdocs`
    contract package vs add a `webdocs` path alias to FUI's tsconfig/vite. (Moot under A.)

**Noted tension for the decider:** the *purest* layering end-state is the whole webdocs cluster
(generator **and** adapters) in FUI — but the generator's home was settled by #424 (resolved, shipped at
`webdocs/generator.ts`). Re-opening that is out of #426's scope. If layering is ever enforced, move the
**whole cluster** in one migration, not the adapter alone. Default A takes the pivot's location as given.

### Fork 2 — Adapter contract shape (build target) — **default A, high confidence**

- **A (recommended): Plain per-source provider module** `{ source, ingest }`, `ingest(raw) → WebCases`,
  matching `scripts/validation-normalize/adapters/eslint.mjs:7-14`. The adapter maps the source's own
  metadata to `{id,title,description,code}` and emits `WebCases` directly (it does **not** route through
  `parseWebCase`, whose `<!-- WEB CASE -->` convention is WE-corpus-specific — `generator.ts:54-67`).
  `emit`/re-export is opt-in. Flag lossy cells per [[adapter_normalization_hub]].
- **B (rejected): A `CustomWebcasesAdapterRegistry`** mirroring `validation-generation/adapters/index.ts`.
  Cargo-cult here — that registry exists for on-demand runtime generation; one-shot author-time ingestion
  has no runtime consultation to justify a global singleton (classification Q5).

## 6. Recommended path at a glance

| Fork | Recommended default | Main alternative | Confidence |
| --- | --- | --- | --- |
| 1 · Adapter home | **A — co-locate in `webeverything/webdocs/adapters/`** (re-key `locus: webeverything`) | B — adapters in FUI + expose the pivot | Medium — trades cohesion/precedent against the layering ruling |
| 2 · Contract shape | **A — plain provider module `{ source, ingest } → WebCases`** (eslint.mjs precedent) | B — `CustomWebcasesAdapterRegistry` | High — author-time seam, not a runtime registry |

Both defaults make #426 an agent-ready build and unblock #429 (Mintlify) to follow the same home + contract.
