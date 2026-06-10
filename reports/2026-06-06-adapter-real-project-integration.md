# Real-Project Integration — adopting the JSX & `<component>` adapters in an existing build

**Date**: 2026-06-06
**Goal:** Tell the full, end-to-end story of how a *real* project — one with its own build system and
tooling — adopts the Web Everything **JSX adapter** and the **declarative `<component>` adapter**: what
it installs, what it configures, what it authors, and what ships to the browser. The deliverable is a
build-system × tooling matrix (the canonical question "how does this slot into my pipeline?") plus two
worked narratives and the packaging work this exposes.
**Related**: [adapters.json](../src/_data/adapters.json) (`jsx-adapter` `draft`, `declarative-component`
`concept`), [reports/2026-06-03-jsx-adapter-feature-mapping.md](2026-06-03-jsx-adapter-feature-mapping.md)
(the mirror-dialect contract), [reports/2026-06-03-declarative-component-element.md](2026-06-03-declarative-component-element.md)
(the `<component>` lowering), backlog `jsx-rendering-strategy-axis` (Axis 2, parked).

---

## 1. The two adapters have *different* integration shapes

This is the crux, and the reason a single "how do I use it" answer doesn't exist. The two adapters sit at
opposite ends of the build/runtime tradeoff:

| | **JSX adapter** | **`<component>` adapter** |
|---|---|---|
| What it is | A **JSX dialect** (the HTML mirror — `class`/`for`/`on:*`, *not* React) whose factory builds **real DOM** at runtime | A **build-time AST transform** that lowers `<component name="x-card">…</component>` → a class extending `HTMLElement` + `customElements.define()` |
| How a build tool adopts it | **Compiler configuration** — point the existing JSX transform at our factory (classic pragma *or* automatic `jsxImportSource`) | **A transform plugin/loader** — a new compile step the bundler runs over component sources (SFC-compiler model, like Svelte/Vue) |
| Runtime footprint | A small **runtime dependency** (the DOM-producing `jsx` factory) is bundled | **Zero runtime** — output is plain custom-element code; nothing WE-specific ships |
| Mental model | "Babel/esbuild already does JSX → calls; just retarget the calls" | "Add a plugin that turns `.component`/`<component>` source into a JS module" |
| Reversibility | Lossless HTML⇄JSX (the feature-mapping contract) — toggle in tooling | One-way **lowering** (fidelity, not round-trip) |

So the integration story splits cleanly: **JSX is a config change + one dependency; `<component>` is a
plugin.** Every row in the matrix below is really answering those two sub-questions for a given tool.

## 2. What WE must publish for this to be real (the prerequisite)

Today these transforms live *inside this monorepo* (`blocks/renderers/jsx/JSXRenderer.ts`,
`blocks/renderers/jsx/{htmlToJsx,jsxToHtml}.ts`, `blocks/renderers/component/declarativeComponent.ts`)
and are wired only into *our* esbuild/Vite/Vitest config (`jsxInject`, the `.eleventy.js` filter). A real
external project can't `import` from our repo. Adoption therefore depends on extracting three installable
artifacts — this is the **first work item** any real integration blocks on:

1. **`@frontierui/jsx-runtime`** — the DOM factory, exposed both ways:
   - classic: a named `jsx.createElement` + `jsx.Fragment` (what we use in-repo via `jsxInject`);
   - automatic: a `@frontierui/jsx-runtime/jsx-runtime` entry exporting `jsx`, `jsxs`, `Fragment`
     (the ergonomic path for real projects — no per-file import, just `jsxImportSource`).
2. **`@frontierui/component-compiler`** — the pure `<component>` → class transform
   (`declarativeComponent.ts`), framework-agnostic (string in → string out), plus the HTML⇄JSX transforms
   for tooling/source-toggle use.
3. **Thin bundler-plugin wrappers** around #2 — `@frontierui/vite-plugin`, `/esbuild-plugin`,
   `/rollup-plugin`, a webpack loader, etc. Each is ~30 lines: match the source, call the compiler, return
   the module. (The JSX side needs *no* plugin — it rides the host's existing JSX transform via config.)

Until #1–#3 exist, "integration" is copy-paste. After them, every row below is a few lines of config.

## 3. The integration matrix — build systems & tooling

**JSX wiring** = the config knob that retargets the host's JSX transform at our factory. **`<component>`
wiring** = where our compiler plugin hooks. **Runtime** = what WE-specific code ships to the browser.

| Build system / tool | JSX wiring (config) | `<component>` wiring (plugin hook) | Runtime shipped | Notes / gotchas |
|---|---|---|---|---|
| **esbuild** *(what this repo uses)* | `jsx: 'automatic'`, `jsxImportSource: '@frontierui/jsx-runtime'` (or classic `jsxFactory: 'jsx.createElement'`, `jsxFragment: 'jsx.Fragment'` + `inject: [...]`) | `esbuild` plugin (`onLoad` filter) calling the component-compiler | JSX factory only | We already run the classic path via `jsxInject`/`inject`. Fastest, but plugin API is `onResolve`/`onLoad`-based — fine for our string-in/string-out transform. |
| **Vite** | `esbuild.jsxInject` (dev) **or** `@vitejs/plugin-react`/native esbuild opts; cleanest = `jsxImportSource` in `tsconfig` + esbuild | `@frontierui/vite-plugin` (`transform` hook; `enforce: 'pre'`) | JSX factory only | Vite = esbuild (dev) + Rollup (build); the same plugin's `transform` runs in both. HMR for `<component>` needs care: `customElements.define` is one-shot, so the plugin must uniquify or full-reload (mirrors our demo gotcha). |
| **Rollup** | via `@rollup/plugin-typescript`/Babel/SWC plugin's JSX opts | `@frontierui/rollup-plugin` (`transform` hook) | JSX factory only | Vite's production path; same plugin code. |
| **webpack** | `babel-loader` (`@babel/preset-react`, `runtime: 'automatic'`, `importSource`) **or** `swc-loader` | a custom **loader** for `*.component`/`<component>` calling the compiler | JSX factory only | Most config-heavy. Loader order matters (component loader before ts/babel). |
| **Babel** (standalone) | `@babel/preset-react` `{ runtime: 'automatic', importSource: '@frontierui/jsx-runtime' }` (or classic `pragma`/`pragmaFrag`) | a Babel **plugin** visiting the `<component>` JSX element / a `.component` macro | JSX factory only | The reference JS-side wiring; SWC mirrors it. |
| **SWC** | `jsc.transform.react.runtime: 'automatic'`, `importSource` (or `pragma`/`pragmaFrag`) | **hard** — SWC plugins are Rust/WASM. Fallback: run our JS compiler as a *separate* pre-step, let SWC see plain output | JSX factory only | Powers Next.js/Turbopack. The `<component>` transform can't be a native SWC plugin without a Rust port; pre-transform instead. |
| **TypeScript (`tsc`)** | `compilerOptions.jsx: 'react-jsx'`, `jsxImportSource: '@frontierui/jsx-runtime'` (or `'react'` + `jsxFactory`/`jsxFragmentFactory`) | none — `tsc` only does JSX/types, not custom transforms (no public transform plugins) | JSX factory only | `tsc` gives **type-checked JSX** against our factory's JSX namespace. For `<component>` you still need a real bundler step. Ship JSX types with `@frontierui/jsx-runtime`. |
| **Parcel** | zero-config JSX via its Babel layer; set `importSource` in `.babelrc`-style config | a Parcel **transformer** plugin calling the compiler | JSX factory only | Parcel's convention-over-config means JSX "just works" once `importSource` is declared. |
| **Next.js** | `next.config` JSX is SWC-driven; set `compiler`/`jsxImportSource` (App Router: server components complicate a DOM factory) | SWC limitation (above) → pre-transform `<component>` sources, or a webpack-loader escape hatch | JSX factory (client only) | **Caveat:** our JSX factory builds *DOM*, so it's client-only — incompatible with RSC server rendering. Use `'use client'`, or treat WE output as islands. |
| **Astro** | per-island JSX via the chosen framework integration; or raw esbuild opts | a Vite plugin (Astro is Vite-based) — reuse `@frontierui/vite-plugin` | JSX factory (island) | Natural fit: `<component>` lowers to a custom element = a perfect Astro island with zero island-runtime. |
| **Bun** | `bunfig`/`tsconfig` `jsxImportSource` (Bun honors tsconfig JSX) | a Bun bundler plugin (`Bun.plugin`, `onLoad`) | JSX factory only | Bun's native JSX + plugin API make this one of the lightest integrations. |
| **Deno** | `deno.json` `compilerOptions.jsx: 'react-jsx'`, `jsxImportSource` (+ import-map to the npm/JSR package) | an `esbuild-deno-loader`-style plugin, or pre-transform | JSX factory only | JSR-publish `@frontierui/jsx-runtime` for first-class Deno consumption. |

**Reading the matrix:** the JSX column collapses to *one idea expressed in each tool's dialect* —
"automatic runtime, importSource = our package." The `<component>` column is *one plugin re-wrapped per
bundler*. The only genuinely hard cells are **SWC/Next/Turbopack** (Rust plugin barrier → pre-transform)
and **`tsc`** (no transform step → bundler still required); both are called out inline.

## 4. Worked narrative A — an existing Vite + TypeScript SPA

A team has a plain Vite + TS single-page app and wants to start authoring some UI with WE adapters
*without rewriting the app*.

1. **Install:** `npm i @frontierui/jsx-runtime @frontierui/vite-plugin`.
2. **Type-checked JSX** — `tsconfig.json`:
   ```jsonc
   { "compilerOptions": { "jsx": "react-jsx", "jsxImportSource": "@frontierui/jsx-runtime" } }
   ```
   Now `.tsx` files type-check against the mirror dialect (`class`, `for`, `on:*`) — `className` is a
   tolerated alias, function `onclick={fn}` is allowed-but-lossy (per the feature-mapping contract).
3. **`<component>` support** — `vite.config.ts`:
   ```ts
   import { webEverything } from '@frontierui/vite-plugin'
   export default { plugins: [webEverything()] }
   ```
4. **Author a component** (`cards.component` or inline) — declarative, zero-runtime:
   ```html
   <component name="x-user-card">
     <template><h3>{{ name }}</h3><slot></slot></template>
   </component>
   ```
   The plugin lowers it to a `class extends HTMLElement` + `customElements.define('x-user-card', …)` at
   build time. Nothing WE-specific ships for this element.
5. **Author JSX** that uses it — the factory builds real DOM:
   ```tsx
   const el = <x-user-card name="Ana"><span slot="footer">★</span></x-user-card>
   document.querySelector('#app')!.append(el)
   ```
6. **Ship.** Bundle = the app + `@frontierui/jsx-runtime` (small) + the generated custom-element classes
   (plain JS). Tree-shakes normally; the `<component>` outputs carry no framework.
7. **(Tooling bonus)** the same `@frontierui/component-compiler` powers an in-editor / docs
   **source-toggle** (HTML⇄JSX) via `htmlToJsx`/`jsxToHtml`, so the team sees both spellings of any element.

**Net diff to adopt:** two installs, three tsconfig keys, one Vite plugin line. The app is otherwise
untouched — that's the "any element, authored as HTML *or* JSX" promise landing in a real pipeline.

## 5. Worked narrative B — a non-Vite project (esbuild CLI / Next.js island)

- **esbuild CLI:** add `jsx: 'automatic'`, `jsxImportSource: '@frontierui/jsx-runtime'`, and
  `plugins: [webEverythingEsbuild()]`. One build command, no dev server assumptions. (This is closest to
  *our own* repo wiring, minus the in-repo paths.)
- **Next.js:** the JSX factory is DOM-producing → **client-only**. Mark usage `'use client'` and treat WE
  elements as islands; the `<component>` transform runs as a pre-step (SWC can't host our JS plugin
  natively). The custom elements then hydrate via Declarative Shadow DOM with the idempotent
  `connectedCallback` guard — no double-render. This narrative exists mainly to document the **RSC/SWC
  caveat** so adopters aren't surprised.

## 6. Cross-cutting gotchas (carried from the demo work)

- **`customElements.define` is one-shot per tag.** A dev server / HMR that re-runs a `<component>` module
  must uniquify the tag or full-reload; `connectedCallback` must be idempotent
  (`if (!root.childNodes.length)`) so DSD hydration and re-render are safe.
- **The JSX factory is not zero-runtime** (it constructs DOM). The *only* zero-runtime path for an element
  tree is authoring it as `<component>`/declarative HTML and letting the compiler lower it.
- **Server rendering** (RSC, SSG that executes JSX on the server) is incompatible with a DOM factory unless
  it runs against a DOM shim — out of scope for the first cut; declarative `<component>` lowering is the
  SSR-safe path (it emits standards-based custom elements).
- **Function event handlers are lossy** (no HTML form) — fine at runtime, but they don't round-trip in the
  source-toggle; the contract flags them.

## 7. Open questions to settle

These have been harvested into `/backlog/` as trackable items (the prerequisite engineering plus its
shaping decisions):

- **#125 — Extract the adapter packages** (§2): the foundational `@webeverything/{jsx-runtime,
  component-compiler, *-plugin}` extraction; folds in the **packaging-granularity** decision (split, not
  umbrella).
- **#126 — Documented JSX runtime default** *(resolved)*: automatic (`jsxImportSource`) vs classic —
  ruled **automatic externally, classic in-repo**, and applied to the
  [JSX Adapter page](/adapters/jsx-adapter/#wiring) (#233). Now that `@frontierui/jsx-runtime` is
  extracted (#125) with `./jsx-runtime`/`./jsx-dev-runtime` exports, the consumer config is the single
  `jsxImportSource: '@frontierui/jsx-runtime'` line shown in §4; in-repo wiring stays classic
  (`jsxInject`), since our own pages don't install the package.
- **#127 — `<component>` compiler toolchain reach**: the **SWC/Turbopack** story (pre-transform),
  the **`<component>` source surface** (`.component` vs inline — the one genuinely open fork), and the
  **`tsc`-only consumer** path.
