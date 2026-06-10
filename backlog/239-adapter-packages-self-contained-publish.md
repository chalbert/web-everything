---
type: issue
workItem: story
size: 3
parent: "125"
status: open
blockedBy: ["125"]
dateOpened: "2026-06-09"
tags: [adapters, packaging, build-tooling, publishing, frontier-ui]
relatedReport: reports/2026-06-06-adapter-real-project-integration.md
relatedProject: webadapters
crossRef: { url: /adapters/jsx-adapter/, label: JSX Adapter }
---

# Make the `@webeverything/*` adapter packages self-contained for publish

#125 extracted the five installable packages (`frontierui/packages/*`). To avoid duplicating the
already-built `<component>` lowering, `@webeverything/component-compiler` and the three
`@webeverything/{vite,esbuild,rollup}-plugin` packages **re-export from `@frontierui/compiler`**
(its new `./component-transform` subpath export) and declare it as a runtime `dependency`.

That works in-workspace (npm symlinks resolve it) and is the right *single-source-of-truth* call,
but it leaks an **internal, un-published** package name into the public dependency graph: `npm
install @webeverything/component-compiler` would fail to resolve `@frontierui/compiler` from the
registry. Before these can actually publish, pick one:

- **Publish `@frontierui/compiler` too** (simplest; accepts a `@frontierui/*` name in the public
  tree). Possibly re-scope it to `@webeverything/compiler-core`.
- **Relocate** the `component-transform/` source into `@webeverything/component-compiler` and have
  `@frontierui/compiler` depend on *it* (inverts the dependency so the public package owns the
  source). Cleanest boundary, larger move.
- **Bundle** the compiler into each consumer at build time (tsup/rollup) so there's no runtime dep.

Also missing for a real publish: a workspace-level ordered `build` script (build `@frontierui/compiler`
before the packages that consume its `dist/`), and a `prepublishOnly` per package. None of this blocks
in-repo use or the #125 smoke test — it's the registry-publish gate.
