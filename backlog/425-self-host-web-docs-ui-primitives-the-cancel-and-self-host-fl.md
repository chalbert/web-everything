---
type: idea
workItem: story
size: 5
parent: "398"
status: open
dateOpened: "2026-06-12"
dateStarted: "2026-06-13"
tags: [webdocs, frontier-ui, primitives, self-host, product-build]
relatedProject: webdocs
crossRef: { url: /backlog/398-build-the-web-docs-product-fui-open-primitives-plateau-app-o/, label: "Web Docs product epic (#398)" }
---

# Self-host Web Docs UI primitives — the cancel-and-self-host floor

FUI slice of #398. Ship enough free, composable primitives to assemble a self-hosted Web Docs UI — page shell, nav, and the protocol/conformance panels — the load-bearing 'cancel and self-host always holds' floor from the #091 ruling, not a nicety. Reference impl is WE's own /protocols/ + capabilityMatrix rendering, generalized into reusable FUI parts. Foundational FUI root, parallel with the generator slice; consumed by the plateau-app served product.


## Form fork (2026-06-13, batch pre-flight) — needs a `/decision` before build

Not agent-ready as written. #091/#398 settled the **home** (FUI ships the primitives) and the **what** ("enough free, composable parts to assemble a self-hosted Web Docs UI") but **not the form** — and there is no FUI precedent to follow mechanically:

- **No FUI content-component precedent.** FUI `blocks/` are all *interaction behaviors* (droplist, tabs, navigation, for-each, traits, view-engine); FUI `packages/` are *tooling* (component-compiler, esbuild/rollup/vite plugins, jsx-runtime). There is **no** content/layout/panel component or `@frontierui/*-ui` package to extend.
- **The reference impl is a different paradigm.** WE's `/protocols/` + capabilityMatrix render is **11ty Nunjucks** (server-rendered templates), not FUI's runtime custom-element / JSX model — so "generalize into reusable FUI parts" is a port across paradigms, not a copy.
- **No consumer pins the form.** plateau-app (the named consumer) does not currently import `@frontierui/*` at all — it aliases `@we/*` to webeverything directly. So nothing establishes whether a "page shell" / "protocol panel" / "conformance panel" primitive is a **custom-element block**, a **JSX component** (jsx-runtime exists but is unused for content), or a **new published package**, nor how they compose into a self-hostable shell.

This is a foundational architecture call (the primitive form + composition model) — seeding the "foundational FUI root" on the wrong form mis-founds the whole Web Docs UI. **`/decision` the FUI self-host-primitive form first**, then this becomes an agent-ready build. Released unclaimed during a batch.
