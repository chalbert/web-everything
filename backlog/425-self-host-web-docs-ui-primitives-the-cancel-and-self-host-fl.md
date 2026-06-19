---
type: decision
workItem: story
size: 5
parent: "398"
status: resolved
dateOpened: "2026-06-12"
dateStarted: "2026-06-14"
dateResolved: "2026-06-14"
graduatedTo: none
codifiedIn: "one-off"
preparedDate: "2026-06-14"
tags: [webdocs, frontier-ui, primitives, self-host, product-build]
relatedProject: webdocs
relatedReport: reports/2026-06-14-webdocs-primitive-form.md
crossRef: { url: /backlog/398-build-the-web-docs-product-fui-open-primitives-plateau-app-o/, label: "Web Docs product epic (#398)" }
---

# Self-host Web Docs UI primitives — the cancel-and-self-host floor

## Ruling (2026-06-14)

**Ratified — all four defaults, no overrides.** The self-host Web Docs primitives take a **static-first
islands** form (Fork 1): authored as **JSX on `@frontierui/jsx-runtime` plus a new server
render-to-string emit** (Fork 2), with interactivity supplied by **composing the existing FUI behavior
blocks as light-DOM islands, hydrate-optional** (Fork 3 — static HTML always works JS-off; the
conformance matrix's tabs/filter hydrate as an opt-in island; the small JS island is upside with no cost
to the no-JS floor), packaged as a **single published `@frontierui/webdocs-ui`** (Fork 4). Rejected
branches stand as recorded below (client-runtime SPA, DSD, Nunjucks server-template, split packages).

**Successors (carved at ratification):**
- **#544** — `jsx-runtime` server render-to-string emit (the Fork-2 enabling capability; FUI-core,
  separable, reusable by #424's generator). Prerequisite — no blocker of its own.
- **#545** — build the `@frontierui/webdocs-ui` self-host primitives per this ruling (the actual build
  #425 decided), `blockedBy: 544`. #425's successor build; #427 (served site) now depends on it, not on
  this decision.

This decision item is **resolved**; the work is now agent-ready via #544 → #545.

---

## Digest

**Prepared decision — ratified 2026-06-14 (see Ruling above).** FUI slice of #398: ship enough free, composable primitives to
assemble a self-hosted Web Docs UI (page shell, nav, protocol/conformance panels) — the load-bearing
"cancel and self-host always holds" floor from the [#091](/backlog/091-web-docs-as-a-service-plateau/) ruling.
#091/#398 settled the **home** (FUI ships them) and the **what**, not the **form**. **4 forks**, grounded
in the published [`/research/webdocs-primitive-form/`](/research/webdocs-primitive-form/) topic +
[report](../reports/2026-06-14-webdocs-primitive-form.md), each with a **bold** recommended default. The
batch pre-flight's "block vs JSX vs package, no content precedent" framing was **stale** — reading the
tree, jsx-runtime *is* FUI's content path; the real axis is the **rendering contract**, which prior art
answers as **islands architecture**.

## Axis framing — what the form decision actually decomposes into

The pre-flight note treated "primitive form" as one undifferentiated call. Reading the real tree splits it
into four orthogonal axes, each pinned to concrete code:

- **Rendering contract.** A docs floor's load-bearing need is **static HTML** (host-anywhere, SEO,
  readable JS-off). WE's reference impl already is static: `/protocols/` renders via 11ty Nunjucks
  ([we:src/protocols.njk](../src/protocols.njk), [we:src/capability-pages.njk](../src/capability-pages.njk)).
  But every FUI content path is **client-runtime DOM**:
  [frontierui `fui:packages/jsx-runtime/src/JSXRenderer.ts`](https://github.com/) `createElement` builds DOM
  nodes, and `we:blocks/view/ViewEngine.ts` is `document`-only. So this is the real tension, and **Fork 1**.
- **Authoring form.** `@frontierui/jsx-runtime` (`fui:packages/jsx-runtime/package.json`: "HTML-mirror-dialect
  JSX factory that builds real DOM") **is** FUI's content-authoring primitive — used by
  `we:blocks/renderers/index.ts` and `we:demos/declarative-spa-jsx.tsx`, *not* dormant. The gap is that it has
  **no server string-emit** (grep of `packages/jsx-runtime/src` finds only `document`/`createElement`).
  That's **Fork 2**.
- **Interactivity / hydration.** FUI's behavior blocks — `blocks/droplist/`, `blocks/tabs/`,
  `blocks/navigation/`, `blocks/for-each/` — are **light-DOM custom elements that enhance markup in
  place**, i.e. already islands by construction. Whether the panels reuse them (and hydrate) or stay
  pure-static is **Fork 3**.
- **Packaging.** No `@frontierui/*-ui` content package exists yet; impl publishes under `@frontierui`
 . One package vs split is **Fork 4**.

## Recommended path at a glance

| Fork | Recommended default | Main alternative | Confidence |
| --- | --- | --- | --- |
| 1 · Rendering contract | **Static-first islands** (server-render HTML, hydrate only interactive islands) | Client-runtime SPA | High |
| 2 · Authoring form | **JSX on `@frontierui/jsx-runtime` + a new server render-to-string emit** | Custom-elements + Declarative Shadow DOM | High |
| 3 · Interactivity | **Compose existing behavior blocks as light-DOM islands, hydrate-optional** | Pure-static panels (no JS) | Medium |
| 4 · Packaging | **Single published `@frontierui/webdocs-ui`** | Split (shell vs panels) packages | Medium-high |

**Carve (not a fork):** the **jsx-runtime server string-emit** (Fork 2's enabling capability) is a
distinct FUI-core build, separable from the webdocs-ui primitives and reusable by #424's generator
output. At ratification, carve it as its own prerequisite item and set #425 `blockedBy` it.

---

## Fork 1 — Rendering contract: static-first or client-runtime?

**Crux.** "Cancel and self-host always holds" means a self-hoster gets a working docs site on any static
host. The reference impl ([we:src/protocols.njk](../src/protocols.njk)) is server-static today; FUI's content
runtime ([frontierui `we:JSXRenderer.ts`](https://github.com/)) is client-only. Which contract do the
primitives expose?

- **A — Static-first islands** *(recommended)*. Primitives server-render to static HTML; only interactive
  regions ship JS and hydrate as independent islands. This is the established HTML-first pattern for
  content sites (Astro/Fresh/Qwik; docs are its canonical zero-JS-by-default case — see research topic).
  Strongest self-host floor: SEO-indexable, readable JS-off, minimal payload.
- *Rejected — B — Client-runtime SPA.* Primitives build DOM at runtime; the self-hosted site needs JS to
  render content. Flawed branch for a *docs* floor: bad SEO, breaks JS-off, heavier — a degraded
  "self-host always holds." (Stays available for app-shell surfaces that are genuinely interactive, but
  not the docs content contract.)

## Fork 2 — Authoring form: JSX-on-jsx-runtime, custom-elements+DSD, or server-template?

**Crux.** Given static-first (Fork 1), how is a primitive *written*? jsx-runtime is FUI's HTML-mirror JSX
factory ([`fui:packages/jsx-runtime/package.json`](https://github.com/)) but builds **light DOM** with no
string-emit; WE's reference is Nunjucks.

- **A — JSX on `@frontierui/jsx-runtime`, plus a new server render-to-string emit** *(recommended)*.
  Reuses FUI's existing content primitive (no second paradigm), HTML-mirror tags are already the natural
  shape for static markup, and it's **light-DOM** so no shadow-encapsulation machinery. The only real
  build is the string-emit path (the carve above). Lowest-lock-in unit: a JSX function returning
  HTML/DOM, degrading to plain markup.
- *Rejected — B — Custom-elements + Declarative Shadow DOM.* DSD is the native SSR mechanism for custom
  elements (MDN/Lit-SSR), but it buys **style encapsulation docs chrome doesn't need**, and DSD hydration
  is a known server/client-reconciler footgun. Over-engineered for the job; keep DSD available only for a
  primitive that explicitly wants encapsulation.
- *Rejected — C — Server-template form (generalize WE's Nunjucks).* Invents a **second FUI paradigm**
  (FUI has zero server-template precedent) and adds template-**engine lock-in**
 . Worse than extending the primitive FUI already has.

## Fork 3 — Interactivity: reuse behavior-block islands (hydrate-optional) or pure-static?

**Crux.** The interactive panels (tabbed/filterable conformance matrix, collapsible nav) — where does
their behavior come from, and must JS be present? This is the **one axis with real residual judgment**.

- **A — Compose the existing behavior blocks as light-DOM islands, hydrate-optional** *(recommended,
  confidence medium)*. The static JSX skeleton (Fork 2) is the page; `blocks/tabs/`, `blocks/navigation/`,
  `blocks/droplist/`, `blocks/for-each/` enhance it in place where interaction is wanted. Static HTML
  works JS-off; islands hydrate as the self-hoster's opt-in. Reuse, not reinvent; native-first graceful
  degradation.
- *Rejected — B — Pure-static panels (no JS at all).* Plain `<details>`/anchors, zero islands. Simplest
  and the absolute strongest floor, but **loses the tabbed/filterable conformance matrix** WE's own
  capabilityMatrix has — a real capability regression. (This is the override the decider may pick if a
  zero-JS guarantee is judged more valuable than the richer panels.)
- *Rejected — C — Reinvent interaction inside webdocs-ui.* Duplicates the behavior blocks; violates
  reuse. No reason to.

## Fork 4 — Packaging: one `@frontierui/webdocs-ui` or split?

**Crux.** No content package exists; what's the published unit?

- **A — Single published `@frontierui/webdocs-ui`** *(recommended)*. Depends on jsx-runtime (+ its new SSR
  entry) and the behavior blocks it composes. One cohesive docs-UI kit, one consumer (plateau-app served
  product + self-hosters); `npm i @frontierui/webdocs-ui` + assemble the shell *is* the cancel-and-self-host
  floor. Naming mirrors the layer.
- *Rejected (for now) — B — Split packages* (e.g. `-shell` vs `-panels`). Our standing bias is separation
 , but these primitives are one product surface with one
  consumer; splitting is premature abstraction. Cheap to split later if a second consumer wants only part.
