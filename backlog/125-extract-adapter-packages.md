---
type: idea
workItem: story
size: 5
status: resolved
dateOpened: "2026-06-06"
dateStarted: "2026-06-09"
dateResolved: "2026-06-09"
graduatedTo: frontierui/packages/
tags: [jsx, component, adapters, packaging, build-tooling, frontier-ui]
relatedReport: reports/2026-06-06-adapter-real-project-integration.md
relatedProject: webadapters
crossRef: { url: /adapters/jsx-adapter/, label: JSX Adapter }
---

# Extract the adapter packages so real projects can install them

Today the JSX and `<component>` transforms live *inside this monorepo*
(`blocks/renderers/jsx/{JSXRenderer,htmlToJsx,jsxToHtml}.ts`,
`we:blocks/renderers/component/declarativeComponent.ts`) and are wired only into *our* esbuild/Vite/Vitest
config. A real external project can't `import` from our repo, so every integration story in the
real-project report blocks on extracting installable artifacts. This is the **first work item** the
report (§2) exposes — until it exists, "integration" is copy-paste; after it, every build-system row in
the matrix is a few lines of config.

Extract three artifacts:

1. **`@webeverything/jsx-runtime`** — the DOM factory, exposed both ways: classic (`jsx.createElement` +
   `jsx.Fragment`, what we use in-repo via `jsxInject`) and automatic (a `/jsx-runtime` entry exporting
   `jsx`, `jsxs`, `Fragment` for `jsxImportSource`). Ship JSX types so `tsc` can type-check against the
   mirror dialect.
2. **`@webeverything/component-compiler`** — the pure `<component>` → custom-element-class transform
   (`we:declarativeComponent.ts`), framework-agnostic (string in → string out), plus the HTML⇄JSX transforms
   for tooling/source-toggle.
3. **Thin bundler-plugin wrappers** around #2 — `@webeverything/{vite,esbuild,rollup}-plugin`, a webpack
   loader, etc. Each is ~30 lines: match the source, call the compiler, return the module. (The JSX side
   needs *no* plugin — it rides the host's existing JSX transform via config.)

**Packaging granularity (settled here):** split (runtime / compiler / plugins) rather than one umbrella
`@webeverything/adapters`, so a `<component>`-only adopter ships *zero* runtime and a JSX-only adopter
skips the compiler. (This was report §7's first open question; recommendation adopted.)

**Where the impl lands:** the implementation belongs in **Frontier UI** (the impl repo), not this
standards/docs repo — per the repo constellation, WE holds the standard and Frontier UI holds the
implementation. This item tracks the work the standard surfaces; the actual package build/publish happens
there.

Companion decisions that shape the extraction: the documented JSX runtime default (#126) and the
component-compiler toolchain reach (#127).

**Unblocked 2026-06-07:** Frontier UI's `npm run build:plugs` (`tsc -p we:tsconfig.json`,
`declaration: true`) now compiles **clean (0 errors)** and emits `.d.ts` — it was previously broken
(54 type errors). Shipping these packages means shipping their types, so a clean declaration build is
a prerequisite; that gate is now green.

## Progress

- **Status:** active 2026-06-09 — discovery done; scope recalibrated (most engineering already exists).
- **Branch:** TBD (impl lands in **frontierui**, not this repo).
- **Recalibration (the big find):** the three artifacts are *not* greenfield —
  - **Artifact 2 (`<component>` compiler)** and **Artifact 3 (bundler plugins)** are already **built and
    tested** by **#231 (resolved)** in `frontierui/compiler/src/component-transform/`:
    `we:index.ts` (`transform`), `we:compile.ts` (`compile(code,id,opts)` surface-aware), `fui:surfaces.ts`
    (`lowerSurface` html+tsx), `fui:plugins.ts` (`componentVitePlugin` + `componentEsbuildPlugin`). #231's
    own Progress flags the leftover: *"not wired as a we:package.json subpath export / standalone
    `@webeverything/component-compiler` package — that packaging is #125's job."*
  - **Artifact 1 (`@webeverything/jsx-runtime`)** does **not** exist as a package. Source lives at
    `we:frontierui/blocks/renderers/jsx/JSXRenderer.ts` (classic: default `jsx`, named `createElement`,
    `Fragment`), wired in-repo via classic `jsxInject` (`vite.config.mts` / `we:tsconfig.json`) per #126.
    Missing: the **automatic** `/jsx-runtime` entry (`jsx`/`jsxs`/`Fragment`) + JSX type namespace +
    `we:package.json` `exports`. This is the keystone unblocking **#233** (apply #126's automatic-default ruling).
- **So #125 = packaging**, not transform engineering: (1) create `@webeverything/jsx-runtime` (new), and
  (2) give the already-built compiler + plugins an installable `@webeverything/*` identity with `exports`,
  types, and a clean `tsc` build. Extra bundler wrappers (Rollup/webpack/Babel) are spun out to **#234**;
  deferred opt-ins are **#232**.
- **Done:** read all source + sibling items (#126/#127 resolved, #231 resolved, #232/#234 open); confirmed
  jsx source + a `we:declarative-spa-jsx.tsx` demo exist in frontierui (a ready demo target for `jsxImportSource`).
- **Status:** resolved 2026-06-09. Built in **Frontier UI** (impl repo) as an npm-workspaces monorepo.
- **Shipped — five installable `@webeverything/*` packages under `frontierui/packages/`** (the settled
  split: runtime / compiler / plugins), wired via root `workspaces: ["compiler", "packages/*"]`:
  - **`@webeverything/jsx-runtime`** (the genuinely-new artifact) — the canonical HTML-mirror-dialect
    DOM factory, exposed **both** ways via `exports`: classic `.` (`jsx.createElement`/`Fragment`) **and**
    automatic `./jsx-runtime` (`jsx`/`jsxs`/`Fragment` for `jsxImportSource`, #126's external default) +
    `./jsx-dev-runtime` (`jsxDEV`). Ships a permissive `JSX` namespace so `tsc` type-checks the dialect.
  - **`@webeverything/component-compiler`** — re-exports the `<component>` lowering + strategy-axis
    `compile()`/`surfaces` from `@frontierui/compiler` (added a `./component-transform` subpath export
    there — single source of truth, no dup) **plus** the pure HTML⇄JSX source toggle (`htmlToJsx`,
    `jsxToHtml`, `desugar`/`sugarize`). String in → string out, zero runtime/DOM dep.
  - **`@webeverything/{vite,esbuild,rollup}-plugin`** — thin re-export shells (the `webEverything()`
    factory) over the compiler's already-built pre-transform plugins.
- **Verification:**
  - All 5 packages `tsc`-build clean and emit `.d.ts` (dual/subpath `exports` resolve).
  - **`fui:packages/__tests__/extraction-smoke.test.ts` (11 tests, green)** — imports every package by its
    **public `@webeverything/*` name** (through the workspace symlink → `exports` → built `dist/`) and
    exercises it: classic + automatic JSX build real DOM; `compile()` lowers a `<component>` in `.html`
    and respects the native-first default surface; HTML⇄JSX round-trips; each plugin factory returns a
    named plugin and the Vite hook lowers a module. This is the "external project can `import` it, not
    copy-paste" acceptance.
  - Full frontierui suite **87 files / 1333 tests green**; webeverything `check:standards` **0/0**.
- **Leftovers spun out:**
  - **#239** — make the packages self-contained for *registry publish* (the `@frontierui/compiler`
    runtime dep is un-published; pick publish-too / relocate-source / bundle; add ordered build script).
  - **#240** — collapse the now-triplicated `JSXRenderer` onto the package (in-repo consumers should
    import `@webeverything/jsx-runtime`).
  - Pre-existing successors unchanged: **#233** (apply #126's automatic-default to the docs — now
    unblocked, the `jsxImportSource` package exists), **#234** (extra bundler wrappers — already in the
    compiler), **#232** (deferred strategy opt-ins).

**Graduated to** `frontierui/packages/` — five installable @webeverything/* packages: jsx-runtime, component-compiler, vite-plugin, esbuild-plugin, rollup-plugin (npm workspaces).
