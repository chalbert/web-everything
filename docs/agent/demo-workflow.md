# Demo Workflow — building runtime demos

> Tier-1 reference. Read when creating or changing a demo under `demos/`.

Demos are **runtime, interactive** pages served by Vite on **:3000** and passthrough-copied into the
11ty docs site. Each is registered in `demos.json` and surfaces at `/demos/` (index) and
`/demos/{id}/` (a detail page linking to the live `:3000` URL). Use a demo to *exercise a standard in
a real browser* — not to document it (that's the block/adapter page's job).

```
demos/{id}.html        # shell: loads /plugs/bootstrap.ts + the .tsx; nothing else
demos/{id}.tsx         # the demo logic — JSX (mirror dialect) rendering real DOM
demos/{id}.css         # styles
src/_data/demos.json   # registry entry (the only file that *surfaces* the demo)
```

## 1. Register it (`demos.json`)
```json
{
  "id": "kebab-case-id",
  "name": "Human Title",
  "summary": "One line for the index card.",
  "description": "<h2>Concept</h2><p>…</p><h3>Scope</h3><p>POC/tier note…</p>",
  "status": "draft",
  "kind": "playground",                                       // optional — marks conformance playgrounds (vs showcases)
  "liveUrl": "http://localhost:3000/demos/{id}.html",
  "projects": ["webadapters"]
}
```
`projects[]` must resolve in `projects.json`. `npx @11ty/eleventy` should add one page at `/demos/{id}/`.

## 2. Bootstrap (the `.html` shell)
Load the platform bootstrap, then the demo module:
```html
<script type="module" src="/plugs/bootstrap.ts"></script>   <!-- exposes window.{CustomAttribute, injectors, attributes} -->
<script type="module" src="/demos/{id}.tsx"></script>
```
The **JSX factory is auto-injected** by `vite.config.mts` (`jsxInject` → `/blocks/renderers/jsx`), so
write JSX directly in the `.tsx`; it renders real DOM through the realigned renderer in the
**mirror dialect** (`class`/`for`, `on:*` string behaviors, `bind-*`, `<template is="…">`). Declare
the factory for tooling: `declare const jsx: typeof import('/blocks/renderers/jsx').default;`.

> **Bootstrap is auto-injected** into *every* demo HTML by `vite.config.mts` (`webEverythingPatches`),
> so the `<script src="/plugs/bootstrap.ts">` tag above is **optional** — include it only to be explicit.
> To skip injection entirely, suffix the name `-unplugged`.
> **JSX and bootstrap are available, not mandatory.** A demo that needs no WE plugs should be a plain
> `.ts` with native DOM APIs — fewer moving parts (e.g. `component-adapter-demo.ts`, which registers
> custom elements with no renderer/bootstrap dependency).

## 3. Pick the pattern
- **Showcase / SPA** — build an interactive app from the standards (e.g. `declarative-spa`).
- **Playground / conformance** (preferred for adapters & standards) — render each example live, show
  its source, and a **pass/fail badge** proving an invariant (e.g. `JSX→DOM == canonical`). See
  `demos/jsx-adapter-demo.tsx` as the reference.
  - **Drive examples from a shared fixture module**, imported by *both* the demo and the unit tests,
    so the badges and the tests can never drift.
  - **Share the chrome, don't re-roll it.** Fixtures stop *example* drift; the card/badge/summary/
    DOM-equality machinery and the `.play`/`.summary`/`.badge`/`.ex` CSS must come from **one shared
    source** (a `playground-harness.ts` + `playground.css`), imported — never copy-pasted. The two
    existing playgrounds already drifted ~80 CSS lines from copy-paste; retrofit a playground onto the
    shared harness when you touch it. *(Shared harness not yet extracted — first playground work to do
    so should create it.)*
  - **Name the invariant the badge proves** in the UI, and prefer proving the standard's *documented
    guarantees* over happy-path rendering: equivalence/round-trip (two-way, e.g. JSX⇄HTML), lowering
    fidelity (one-way, e.g. `<component>`→class), or determinism/idempotency. Include **negative/edge
    cases** (invalid input, error paths), not only passing ones.
  - **Expose a readiness flag + counts** on `window` (e.g. `window.playgroundReady = true`,
    `window.playgroundPass = n`) so an E2E spec can assert them.
  - **Registering custom elements?** `customElements.define` is **one-shot per tag** — an editable /
    re-running playground must **uniquify the tag** each run, and make `connectedCallback` idempotent
    (`if (!root.childNodes.length)`) so re-render / Declarative-Shadow-DOM hydration is safe.

## 4. Source toggle (docs pages — not the runtime demo)
To show the same element as HTML and JSX on a block/adapter page (`source-toggle.njk`):
- **`autoToggle(id, html)`** — author the HTML once; the JSX pane is **generated at build time** via
  the `htmlToJsx` filter. Requires **parseable HTML** (no comments inside a start tag, etc.).
- **`sourceToggle` / `jsxSource` / `endSource`** — manual panes; use for annotated or pseudo-HTML
  snippets that won't parse.

## 5. Testing (mandatory — details in [testing.md](testing.md) and the coverage plan)
- **Logic** → unit tests over the **shared fixtures** (`*.test.ts`, Vitest). Adding a mapping/behavior
  case = adding one fixture, which covers the demo and the tests at once.
- **Browser runtime** → an **E2E spec** at `{plugs|blocks}/__tests__/e2e/{id}.spec.ts` (Playwright):
  the demo loads, the readiness flag is `true`/counts are as expected, and **no console errors**.
  Run with `npm run test:integration` — the dev server must be running (`webServer` is commented out
  in `playwright.config.ts`; baseURL is `:3000`).
- **Build integrity** → `npx @11ty/eleventy` must build with no template error (a missing njk import
  aborts the *whole* build).

## 6. Verify checklist
- [ ] `demos/{id}.{html,tsx,css}` created; `demos.json` entry added (valid JSON).
- [ ] `npx @11ty/eleventy` builds; `/demos/{id}/` page appears.
- [ ] Vite serves `/demos/{id}.html` (200) and transforms the `.tsx` (no errors).
- [ ] Logic covered by unit tests over a shared fixture module.
- [ ] E2E spec added; `npm run test:integration` green with the dev server up.
- [ ] `status` starts `draft`; description states the POC/tier scope.
