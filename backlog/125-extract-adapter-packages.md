---
type: idea
workItem: story
size: 5
status: open
dateOpened: "2026-06-06"
tags: [jsx, component, adapters, packaging, build-tooling, frontier-ui]
relatedReport: reports/2026-06-06-adapter-real-project-integration.md
relatedProject: webadapters
crossRef: { url: /adapters/jsx-adapter/, label: JSX Adapter }
---

# Extract the adapter packages so real projects can install them

Today the JSX and `<component>` transforms live *inside this monorepo*
(`blocks/renderers/jsx/{JSXRenderer,htmlToJsx,jsxToHtml}.ts`,
`blocks/renderers/component/declarativeComponent.ts`) and are wired only into *our* esbuild/Vite/Vitest
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
   (`declarativeComponent.ts`), framework-agnostic (string in → string out), plus the HTML⇄JSX transforms
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

**Unblocked 2026-06-07:** Frontier UI's `npm run build:plugs` (`tsc -p tsconfig.json`,
`declaration: true`) now compiles **clean (0 errors)** and emits `.d.ts` — it was previously broken
(54 type errors). Shipping these packages means shipping their types, so a clean declaration build is
a prerequisite; that gate is now green.
