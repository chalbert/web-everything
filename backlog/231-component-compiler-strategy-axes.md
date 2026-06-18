---
type: issue
workItem: story
size: 5
parent: "125"
status: resolved
dateOpened: "2026-06-09"
blockedBy: ["125"]
dateStarted: "2026-06-09"
dateResolved: "2026-06-09"
graduatedTo: frontierui/compiler/src/component-transform/compile.ts
tags: [component, adapters, compiler, build-tooling, strategy-axis, native-first, plugin-options]
relatedReport: reports/2026-06-06-adapter-real-project-integration.md
relatedProject: webadapters
crossRef: { url: /adapters/jsx-adapter/, label: JSX Adapter }
---

# Build the `<component>` compiler as configurable strategy axes (top-2 surfaces + pre-transform baseline)

Successor build to #127, which ruled that the `<component>` compiler's toolchain reach is **not one baked
pipeline** but a set of **configurable strategy axes**, each with a native-first default a project overrides
where its stack differs. This item proves that principle by shipping the top 2 strategies per axis, expressed
as adapter/plugin options. The remaining opt-ins are collected in **#232** (lower priority, on-demand).

## Scope (prove the principle, ship the top 2)

- **Source surface** — match + lower `<component>` from **`.html` (default)** and **`.tsx`**. Default is the
  native-first HTML surface; `.tsx` auto-enables when a JSX/TSX adapter is already configured.
  - Keep the `.html`/tagged-template match rule **statically analyzable** (e.g. an `html\`…\`` tag); defer
    arbitrary-string scanning.
- **Toolchain depth** — the **pre-transform** step that re-wraps cleanly across Vite/esbuild/Rollup/webpack/Babel
  (lets SWC/Turbopack see plain output). This baseline working everywhere *is* the proof.
- **`tsc`-only** — document **"a bundler is required"**; types flow via the JSX namespace, `<component>` lowering
  needs the bundler step.
- **Config home** — surfaces are selected via **adapter/plugin options** (e.g. `{ surfaces: ['html','tsx'] }`),
  living where the build is already configured. Native-first defaults when unspecified.

## Out of scope (collected in #232, deferred)

- `.component` dedicated-file surface (SFC-style).
- Per-bundler-native integration / Rust SWC plugin.
- `ts-patch`/`ttypescript` custom-transformer for bundler-refusing `tsc`-only projects.
- A Technical Configurator domain that generates the plugin options — **deferred to #150**.

## Acceptance

- A `<component>` authored in `.html` and one in `.tsx` both lower to the same custom-element output.
- The pre-transform runs identically under at least two bundlers (e.g. Vite + esbuild) in the conformance/demo path.
- Plugin options select the active surface set; omitting them yields the native-first default (`.html`).
- Conformance asserts the lowered output, mirroring the existing component-transform suite.

Depends on package extraction (#125). Sibling principle to #227 (auto-define strategy axis); config-surface
home tracked by #150.

## Progress
- **Status:** resolved 2026-06-09 — both strategy axes shipped over the existing #048 core transform, all
  acceptance criteria met. Built in **Frontier UI** (impl repo) per #125.
- **Files (frontierui/compiler/src/component-transform/):**
  - `fui:surfaces.ts` — **source-surface axis**. `lowerSurface(code, surface)` with two statically-analyzable
    match rules: `html` (a `<component>…</component>` element in markup) and `tsx` (a `<component>` inside an
    `` html`…` `` tagged template — the `html` tag is the anchor, `(?<![\w$.])` guards against `myhtml`` /
    `.html``). A bare JSX `<component>` outside `` html`` `` is intentionally not matched (no arbitrary-string
    scanning — deferred to #232). Both surfaces route through the same `parseDeclarative → emitImperative`
    pair, so the two lower to byte-identical output.
  - `we:compile.ts` — the **config-home** seam. `ComponentCompilerOptions { surfaces?: ('html'|'tsx')[] }`,
    `DEFAULT_SURFACES = ['html']` (native-first), `surfaceForId(id)` (`.html`→html, `.tsx`/`.jsx`→tsx, strips
    `?query`), and `compile(code, id, options)` → rewritten code or `null`.
  - `fui:plugins.ts` — the **toolchain-depth axis** (pre-transform baseline). `componentVitePlugin` (`enforce:
    'pre'`, also Rollup-shape-compatible) and `componentEsbuildPlugin` (`onLoad`), both thin over `compile()`.
  - `fui:STRATEGY-AXES.md` — documents both axes, the options/defaults, and the **`tsc`-only "a bundler is
    required"** note (lowering is a build step; `ts-patch` transformer deferred to #232).
  - `we:index.ts` re-exports the new public API alongside the core `transform`.
- **Conformance (mirrors the component-transform suite):** `fui:surfaces.test.ts` (10) + `fui:plugins.test.ts` (4).
  Proves acceptance: html-fixture and tsx-fixture lower byte-identically (#1); a **real `esbuild.build`** plus
  the Vite `transform` hook emit the same lowered component (#2); omitting options yields html-only and
  `surfaces:['tsx']` flips it (#3). Full frontierui compiler suite **74/74 green**; `tsc -p we:tsconfig.json`
  clean (added `@types/node` devDep — the esbuild plugin's first Node `fs` use). webeverything
  `check:standards` **0/0**.
- **#125 seam (still open):** the API is exported from `fui:component-transform/index.ts` but **not** wired as a
  `we:package.json` subpath export / standalone `@webeverything/component-compiler` package — that packaging is
  #125's job. In-repo + tests work today; external `import` waits on #125.
- **`.tsx` auto-enable:** implemented as explicit opt-in (`surfaces: ['html','tsx']`); the "auto-enable when a
  JSX adapter is configured" behaviour belongs in the adapter's own wiring / the #150 config domain, which
  passes the option — documented in `fui:STRATEGY-AXES.md`, not a separate gap.
- **Leftover spun out → #234:** baseline Rollup/webpack/Babel pre-transform wrappers (the remaining bundlers
  from #127's list; "same few lines over `compile()`"). Distinct from #232's native-depth opt-ins.

**Graduated to** `fui:frontierui/compiler/src/component-transform/compile.ts` — surface-aware compile() + Vite/esbuild pre-transform wrappers (fui:surfaces.ts, fui:plugins.ts), configurable strategy axes.
