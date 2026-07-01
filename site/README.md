# `site/` — the WE-website surface boundary (#2006 Fork 2(b), tracked by #2052)

This directory is the **product-surface root** for the WE-website render — the artifact-producing
11ty + Vite product that *renders* the Web Everything standard. It is a **mis-homed product** per
constellation rule 1's file-seam test (artifact-producing delivery → out of WE), end-state extraction
to its own product-tier repo/package **gated on #872** (contract distribution). See the ratified
decision [#2006](../backlog/2006-the-we-website-is-a-product-mis-homed-in-the-we-repo-make-t.md).

## What this boundary is (and is not yet)

`#2006` Fork 2(b) ratified a **directory boundary** as the *interim* mechanism until the Fork 1(a)
extraction lands. The **machine-legible carrier** of that boundary — live now — is the fail-closed
**standard-vs-site classifier** in `check:standards` (added by #2052):

- Every tracked path under the render-tree zone (`src/**`, where the two surfaces interleave) is
  classified as **exactly one** of `{standard-surface, site-surface}`.
- A zone path matching **neither** set is a **hard error** — so new site code can never masquerade as
  standard, nor a new standard definition hide among the site loaders.
- Rule body: `classifySurfacePaths` in `scripts/check-standards-rules.mjs`; wired in
  `scripts/check-standards.mjs` (§12); regression-tested in
  `scripts/__tests__/check-standards-rules.test.mjs`.

The **physical relocation** of the live render files under `site/` (`.eleventy.js`, `vite.config.mts`,
`src/*.njk`, `src/_layouts/`, `src/_includes/`, `src/assets/`, `src/css/`, the `src/_data/*.{js,ts}`
loaders) is deliberately **deferred**: it is a large build-rewiring move (11ty's `input:"src"`, the
`_data` cascade, vite root, and the `eleventy`/`vite` config auto-discovery all key off the repo root),
and the boundary is already **machine-legible and enforced** by the classifier above. The classifier
*is* the extraction manifest — it tells you exactly which files lift when Fork 1(a) executes the move.

## Classification (the seam, from #2006 Fork 2(b))

**site-surface** (lifts to the extracted repo in Fork 1a):
- top-level page templates `src/*.{njk,md,html}`
- page layouts `src/_layouts/**`
- render partials `src/_includes/**` (including the `*-descriptions/` partials)
- static assets `src/assets/**`, styles `src/css/**`
- render fixtures `src/patterns/**`, `src/plateau/**`, `src/cases/**`
- Eleventy data loaders `src/_data/*.{js,ts,cjs,mjs}`

**standard-surface** (stays WE — the definitions the standard owns):
- per-entity registries `src/_data/{blocks,intents,plugs,protocols,semantics,projects,capabilities,
  adapters,researchTopics,…}/*.json`
- top-level standard data `src/_data/*.json`
- loader tests `src/_data/__tests__/**`

**The shared assembler-loader seam** (`scripts/lib/*-loader.cjs`) is consumed by BOTH the gate and the
site loaders — it assembles the standard's own data and **stays WE with the conformance gate** (it is
standard-surface). The render consumes that data across the seam; the dependency is not a co-location
requirement.

**neutral** (neither standard nor site — not policed by the classifier): everything outside `src/**`
— `node_modules/`, `backlog/`, `scripts/`, `capability-manifest/`, `conformance-vectors/`, `tools/`,
the tests, etc.
