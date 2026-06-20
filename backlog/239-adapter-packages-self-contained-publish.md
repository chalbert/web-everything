---
kind: story
size: 3
parent: "125"
status: resolved
blockedBy: ["125"]
dateOpened: "2026-06-09"
dateStarted: "2026-06-10"
dateResolved: "2026-06-10"
graduatedTo: none
tags: [adapters, packaging, build-tooling, publishing, frontier-ui]
relatedReport: reports/2026-06-06-adapter-real-project-integration.md
relatedProject: webadapters
crossRef: { url: /adapters/jsx-adapter/, label: JSX Adapter }
---

# Re-scope the adapter/compiler implementation packages to `@frontierui/*` for publish

#125 extracted five installable packages, but four are mis-scoped: `@webeverything/component-compiler`
and the three `@webeverything/{vite,esbuild,rollup}-plugin` packages are **pure implementation**
(a `<component>` compiler and thin bundler glue) that import `@frontierui/compiler`. A `@webeverything/*`
package depending on Frontier UI inverts the constellation arrow — the *standard* layer must never
import the *implementation* layer. Re-scope all four to `@frontierui/*` so they sit beside the compiler
they already use, the public dependency graph is single-scope and registry-resolvable, WE imports
nothing, and `@webeverything/*` stays reserved for standard artifacts (intents, protocols, schemas).

## Ruling (settled 2026-06-10)

Decided in discussion. The original framing ("how do we make `@webeverything/*` packages self-contained
for publish — publish `@frontierui/compiler`, relocate its source, or bundle it?") was solving a problem
that only existed *because* the four consumers were mis-scoped `@webeverything`. None of them contain
anything standard-defined — verified: the three plugins are ~18–20 lines of bundler glue, and
`component-compiler` is 403 lines of `jsxToHtml`/`htmlToJsx`/`directives` plus a re-export. They are
Frontier UI implementation. So the call is to **correct the scope, not patch the dependency**:

- Implementation publishes under `@frontierui/*`; the `@frontierui/component-compiler → @frontierui/compiler`
  edge is then intra-scope, intra-repo, and fully resolvable from the registry — no leak, no rename of
  `@frontierui/compiler` to `compiler-core`, no relocation of `component-transform/` source.
- `@webeverything/*` is reserved for standard artifacts and, by rule, never depends on Frontier UI.
- The lost `@webeverything/vite-plugin` install-brand was never worth inverting the layering for.

## Scope

- Re-scope the four import-inverted packages `@webeverything/* → @frontierui/*` (`component-compiler`,
  `vite-plugin`, `esbuild-plugin`, `rollup-plugin`): `we:package.json` `name`, plus internal cross-references.
- Re-scope the fifth, `jsx-runtime`, on the same "no implementation under `@webeverything`" principle
  (approved in discussion). It has no `@frontierui` import, but it **is** implementation, and its package
  name doubles as the JSX adapter's **contract specifier** (`jsxImportSource` target / `JSX_RUNTIME_SPECIFIER`)
  — name and specifier must stay equal to be publish-resolvable, so re-scoping it also moves WE's emitted
  contract to `@frontierui/jsx-runtime`.
- **Follow every consumer** of the old names — repo demos, plateau-app, docs, adapter pages — and update
  imports/install instructions to the `@frontierui/*` names.
- Add the publish plumbing (carried from the original item; not blockers for in-repo use):
  - a workspace-level **ordered `build`** script so `@frontierui/compiler` builds before the packages
    that consume its `dist/`;
  - a **`prepublishOnly`** per package.

## Done when

- All five packages publish-ready under `@frontierui/*` with every name resolvable from the registry
  (no `@webeverything/*` → `@frontierui/*` runtime edge remains).
- No `@webeverything/*` package depends on Frontier UI anywhere in the tree.
- Every in-repo consumer of the old names is updated; the #125 smoke test still passes.

## Progress

- **Status**: resolved.
- **Done** (frontierui): all five packages re-scoped `@webeverything/* → @frontierui/*` (`component-compiler`,
  `jsx-runtime`, `vite/esbuild/rollup-plugin`) — names, doc comments, and code consumers (extraction smoke test,
  `compiler/__tests__/component-transform/*`). `prepublishOnly` added to each; root `build:packages` builds
  `@frontierui/compiler` first, then the five. Lockfile refreshed; `build:packages` + 24 tests green.
- **Done** (webeverything): JSX adapter contract moved to `@frontierui/jsx-runtime` — `JSX_RUNTIME_SPECIFIER`,
  the `we:jsx/index.ts` comment, `we:demos/maas-consumer-demo.html` importmap, and the two adapter-description njk
  partials. Full blocks suite (1013 tests) + `check:standards` green.
- **Leftover** (captured): markdown references to the old package names persist in several backlog items and
  one report — spun off as its own doc-sweep item (see close-out).
- **Note**: jsx-runtime is still duplicated between WE source and the frontierui package (importmap resolves
  the new name to WE's own `we:blocks/renderers/jsx/index.ts`) — pre-existing, tracked by #240/#170, untouched here.
