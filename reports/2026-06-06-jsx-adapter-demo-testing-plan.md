# JSX Adapter — Demo Testing Coverage Plan (self-contained handoff)

**Date**: 2026-06-06
**Goal:** Give consistent, strong, low-maintenance test coverage to the JSX Adapter work (renderer + HTML↔JSX transforms + the playground demo + the build-time source-toggle) so it can be iterated on without silent breakage — a self-contained plan a fresh session can execute.
**Status**: ✅ IMPLEMENTED (2026-06-06). All P0/P1/P2 items below landed and are green
(`npm run verify` = `vitest run` + `eleventy` build-smoke; `npm run test:integration` for E2E).
What shipped:
- **#A** shared fixtures `blocks/renderers/jsx/__fixtures__/mapping-cases.tsx` (incl. the `jsxEquivalent`
  contract), imported by the demo + all JSX suites. **#2/#3** the two transform unit tests now source
  from it (no duplicated literals).
- **#B** `blocks/__tests__/unit/renderers/mapping-conformance.test.tsx` (render==canonical +
  round-trip + lossy, normalized-string compare). **#C** `htmlToJsx.linkedom.test.ts` (the 11ty build path).
  *(vitest.config.ts gained the same `jsxInject` as vite so `.tsx` fixtures/suites render the mirror dialect.)*
- **#D** `npm run build:check` / `verify` scripts (eleventy build-smoke). **#F** Playwright `webServer`
  enabled (reuses a running dev server locally).
- **#G** shared `demos/playground.css` + `demos/playground-harness.ts`; both playgrounds retrofitted.
- **#H** transform extracted to `blocks/renderers/component/declarativeComponent.ts` (+ shared
  `__fixtures__/component-cases.ts`), conformance suite `declarativeComponent.test.ts` (fidelity +
  determinism + idempotency + parse negatives). Demo retrofitted onto it.
- **#E/#16** `plugs/__tests__/e2e/playgrounds.spec.ts` (data-driven over `kind:"playground"`, zero-console
  + green-badges + sandbox exercise). **#9/#7/#11** `kind:"playground"` added to `demos.json`;
  `blocks/__tests__/e2e/source-toggle.spec.ts` (generated `<template is="for-each">` pane + tab toggle).
- **#8** report mirrored via `backlog/jsx-adapter-demo-testing.md` (`relatedReport`); `check:standards` green.

The original plan is preserved below for context.

---

## 0. Orientation — read these first

- Conventions for demos: [docs/agent/demo-workflow.md](../docs/agent/demo-workflow.md)
- Testing strategy (pyramid, locations, commands): [docs/agent/testing.md](../docs/agent/testing.md)
- The feature mapping this all implements: [reports/2026-06-03-jsx-adapter-feature-mapping.md](2026-06-03-jsx-adapter-feature-mapping.md)
- Parked/related design: [backlog/jsx-rendering-strategy-axis.md](../backlog/jsx-rendering-strategy-axis.md), [backlog/jsx-event-style-toggle.md](../backlog/jsx-event-style-toggle.md)

## 1. What the JSX Adapter work IS (context)

The JSX Adapter lets any element be authored as **HTML or JSX** and toggled losslessly. Two axes:
**syntax** (HTML ⇄ JSX, the work here) and **rendering strategy** (how it updates over time —
*parked*, see backlog). JSX here is a **mirror dialect** of the canonical HTML adapter — deliberately
**not React**: `class` (not `className`), `for` (not `htmlFor`), events as `on:*` **string**
behaviors (function `onclick={fn}` is allowed but non-reversible/lossy), `bind-*` bindings, and
directives as the literal `<template is="…">` customized built-in. `className`/`htmlFor` are tolerated
aliases that lower to `class`/`for`.

### Files that exist (all implemented and currently passing)
| File | What it is |
|------|-----------|
| `blocks/renderers/jsx/JSXRenderer.ts` | Runtime JSX factory → real DOM (mirror dialect). 31 unit tests. |
| `blocks/renderers/jsx/htmlToJsx.ts` | Build-time HTML → JSX transform. **DOM-impl-agnostic** (walks `nodeType`/`nodeName`, takes an injectable `doc`), so it runs in browser, vitest (happy-dom), and 11ty build (node/linkedom). 10 unit tests. |
| `blocks/renderers/jsx/jsxToHtml.ts` | Reverse JSX → HTML transform (lean, regex-based, no DOM). 8 unit tests. |
| `demos/jsx-adapter-demo.{html,tsx,css}` | "JSX Adapter Playground" — renders 8 mirror-dialect examples live, shows produced HTML + generated JSX, with **conformance** (JSX→DOM == canonical) and **round-trip** (htmlToJsx ↔ authored) badges. Registered in `src/_data/demos.json`. Live at http://localhost:3000/demos/jsx-adapter-demo.html |
| `src/_includes/source-toggle.njk` | Toggle macros. `autoToggle(id, html)` = author HTML once, JSX pane **generated at build time** via the `htmlToJsx` 11ty filter. `sourceToggle/jsxSource/endSource` = manual panes. |
| `.eleventy.js` | Registers the `htmlToJsx` filter (lazy esbuild-transpiles the TS + runs it over a linkedom document). |
| `src/_includes/block-descriptions/for-each.njk` | First block page using `autoToggle` (its JSX pane is build-generated). `dropdown.njk` uses the **manual** toggle (its example is annotated pseudo-HTML, not parseable). |

### Existing test infrastructure (already set up)
- **Vitest** (unit/integration), env happy-dom, **80% coverage threshold** over `plugs/**` and
  `blocks/**` (excludes `**/index.ts`, `**/__tests__/**`, `*.spec.ts`). `demos/**` is **not** in
  coverage scope. Config: `vitest.config.ts`. Run: `npm test`, `npx vitest run <path>`.
- **Playwright** 1.58 installed. Config: `playwright.config.ts` — `testMatch` =
  `{plugs,blocks}/**/__tests__/**/*.spec.ts`, baseURL `http://localhost:3000`, **`webServer` is
  commented out** (so the dev server must already be running). Run: `npm run test:integration`.
- 18 real E2E specs exist; **several are demo specs** — use as templates:
  `plugs/__tests__/e2e/declarative-spa.spec.ts`, `plugs/__tests__/e2e/text-interpolation.spec.ts`,
  `blocks/__tests__/e2e/router-demo.spec.ts`.

## 2. Testing review — current state & gaps

**What's solid:** the *pure logic* is well covered — renderer 31, htmlToJsx 10, jsxToHtml 8 (= 49
tests), all green; full suite ~1175 passing.

**The gaps (why breakage can slip through):**

1. **Fixture duplication / drift.** The playground's 8 example pairs (`demos/jsx-adapter-demo.tsx`)
   and the unit-test fixtures (`htmlToJsx.test.ts`, `jsxToHtml.test.ts`) are **separate copies**.
   Editing the mapping in one won't fail the other. The demo's green badges are **not** backed by CI.
2. **Conformance-harness logic untested as shipped.** The demo's `domEqual` and `jsxEquivalent`
   helpers (and the lossy-by-design handling) exist only in the `.tsx`; the unit tests reimplement the
   comparison separately. (Note: happy-dom lacks `isEqualNode`, so node-side checks must use
   **normalized string** comparison, not `isEqualNode`. The demo uses `isEqualNode` because it runs in
   a real browser.)
3. **No browser smoke for the new demos.** `jsx-adapter-demo` and the user-added
   `component-adapter-demo` have **no `.spec.ts`** — a jsxInject misconfig, a `bootstrap.ts` error, a
   runtime throw, or a red badge would pass CI unnoticed. (`testing.md` already mandates E2E for demo
   features — these just don't have it yet.)
4. **No build-integrity guard.** The 11ty build is where we got bitten (a missing njk import aborts
   the *whole* build; a `*/` in a TS JSDoc broke the esbuild transform). Nothing runs `build:docs` in
   CI, and the **linkedom build path** of `htmlToJsx` is not unit-tested (units run happy-dom).
5. **E2E ergonomics.** `playwright.config.ts` has `webServer` commented out, so E2E silently needs a
   manual dev server — easy to forget in CI.

## 3. Coverage plan (the table)

Layers: **U** = Vitest unit (logic), **B** = build-smoke (node/linkedom + 11ty build), **E** =
Playwright E2E (browser). Priority: P0 = do first (kills most drift/breakage cheaply), P1 = strong
guard, P2 = polish.

| # | Concern / artifact | Layer | Current | Target | Action | Pri |
|---|---|---|---|---|---|---|
| 1 | Renderer logic (`JSXRenderer`) | U | ✅ 31 | keep | none (extend per new behavior) | — |
| 2 | `htmlToJsx` logic (happy-dom path) | U | ✅ 10 | keep, source from shared fixtures | refactor tests onto shared fixtures (#A) | P0 |
| 3 | `jsxToHtml` logic | U | ✅ 8 | keep, source from shared fixtures | refactor tests onto shared fixtures (#A) | P0 |
| 4 | **Mapping fixtures (single source)** | U | ❌ duplicated | one shared module | extract `__fixtures__/mapping-cases.ts` (#A) | P0 |
| 5 | Conformance invariants (render==canonical, round-trip, lossy flags) | U | ⚠️ partial/temp | permanent suite over shared fixtures | add `mapping-conformance.test.ts` (#B) | P0 |
| 6 | `htmlToJsx` **build path** (linkedom) | B | ❌ none | 1 test | unit-test `htmlToJsx(html, linkedomDoc)` for key cases incl. comment-directive (#C) | P0 |
| 7 | `autoToggle` build output (for-each pane) | B | ❌ manual only | 1 assertion | build-smoke asserts the generated `<template is="for-each">` pane (#C) | P1 |
| 8 | 11ty build integrity (no template error) | B | ❌ none | CI gate | run `npx @11ty/eleventy` in CI, fail on error (#D) | P1 |
| 9 | `jsx-adapter-demo` loads & is green in browser | E | ❌ none | 1 smoke spec | `…/e2e/jsx-adapter-demo.spec.ts`: loads, `window.playgroundReady===true`, summary counts, **zero console errors** (#E) | P1 |
| 10 | `component-adapter-demo` loads & green (distinct invariant) | E | ❌ none | 1 smoke spec | same shape as #9 **plus** exercise the editable sandbox (type → Run → live element); its badge proves one-way lowering, not round-trip (#E, #H) | P1 |
| 11 | Source-toggle UX (HTML/JSX tab switch) | E | ❌ none | 1 assertion | click JSX tab on `/blocks/for-each/`, assert pane visibility (#E) | P2 |
| 12 | E2E runs without manual server | B/E | ⚠️ `webServer` commented | uncomment | enable `webServer: { command: 'npm run dev', url: 'http://localhost:3000', reuseExistingServer: true }` (#F) | P2 |
| 13 | Demo coverage in metrics | U | demos excluded | leave excluded | demos validated by E2E, not coverage % — no change | — |
| 14 | **Playground chrome (shared harness + CSS)** | B/E | ❌ duplicated (~80 CSS lines) | one shared source | extract `demos/playground-harness.ts` + `playground.css`; retrofit both playgrounds (#G) | P1 |
| 15 | `component-adapter` lowering invariants | U/E | ❌ none | suite | render == authored template; transform×2 byte-identical (determinism); DSD-seeded upgrade → no re-render (idempotency) (#H) | P1 |
| 16 | Playground E2E is data-driven | E | hand-listed | iterate `kind:"playground"` | one spec loops every `kind:"playground"` demo in `demos.json` → auto-covers future playgrounds (#E) | P1 |

## 4. Work items (actionable, with acceptance criteria)

**#A — Shared fixture module** (P0, keystone). Create
`blocks/renderers/jsx/__fixtures__/mapping-cases.ts` exporting an array of
`{ title, jsx, html, lossy? }` — the canonical 8 cases currently inlined in
`demos/jsx-adapter-demo.tsx` (element/class, attrs+boolean, events fn+string `lossy`, className/htmlFor
aliases, context `@ref`, fragment, slots, `<template is="for-each">`). *Accept:* both the demo and the
tests import it; deleting a case fails a test.

**#B — Permanent conformance suite** (P0). `blocks/__tests__/unit/renderers/mapping-conformance.test.ts`
iterating the shared fixtures and asserting, per case: render (`jsx.createElement` build of the tree)
→ normalized HTML == `html`; `htmlToJsx(html)` round-trips to `jsx` (lenient: ignore fragment
wrappers, `<x/>`↔`<x></x>`, `className`→`class`, `htmlFor`→`for`) **unless** `lossy`; `jsxToHtml(jsx)`
== `html` (lossy-aware). *Use normalized-string comparison, not `isEqualNode`* (happy-dom lacks it).
*Accept:* green; a deliberate mapping break turns it red.

**#C — Build-path unit test** (P0/P1). `blocks/__tests__/unit/renderers/htmlToJsx.linkedom.test.ts`:
`const { parseHTML } = require('linkedom')`, build a `document`, run `htmlToJsx(html, document)` over a
few fixtures incl. the comment-directive case; assert the `<template is="for-each">` output. This
guards the *actual 11ty path*, which differs from happy-dom. *Accept:* green.

**#D — Build-integrity CI step** (P1). Add an npm script (e.g. `"verify": "vitest run && eleventy"`)
or a CI job that runs `npx @11ty/eleventy` and fails on any `[11ty] Problem`/template error. *Accept:*
a deliberately broken njk import fails the step.

**#E — Demo E2E smokes** (P1). `plugs/__tests__/e2e/jsx-adapter-demo.spec.ts` (and one for
`component-adapter-demo`): `page.goto('/demos/<id>.html')`; collect `console` errors; assert none;
assert `await page.evaluate(() => window.playgroundReady) === true`; assert the summary text shows the
expected counts (e.g. `Render: 8/8`). Model on `plugs/__tests__/e2e/declarative-spa.spec.ts`. For #11,
also click `.mode-tab[data-mode="jsx"]` on `/blocks/for-each/` (note: that's an 11ty page on **:8080**,
not :3000 — decide whether E2E covers :8080 docs or keep that as a build-smoke string assertion).
**Make it data-driven (#16):** iterate every `kind:"playground"` entry in `demos.json` so new
playgrounds are covered automatically rather than hand-listed. For `component-adapter-demo` also exercise
the **editable sandbox** (fill the textarea → click Run → assert a live custom element rendered), and
assert its badge reflects **one-way lowering**, not round-trip. *Accept:* green with dev server up.

**#F — Enable Playwright `webServer`** (P2). Uncomment/fix the block in `playwright.config.ts` to
`command: 'npm run dev'`, `url: 'http://localhost:3000'`, `reuseExistingServer: !process.env.CI`.
*Accept:* `npm run test:integration` works from a cold start.

**#G — Shared playground harness + CSS** (P1, consistency keystone). The two playgrounds hand-roll the
same chrome — card/badge/summary/DOM-equality/readiness machinery and the `.play`/`.summary`/`.badge`/
`.ex` styles (already ~80 CSS lines apart). Extract them into `demos/playground-harness.ts` +
`demos/playground.css`, imported by both (no copy-paste). This is the *chrome* analogue of #A's *fixture*
dedup — fixtures stop example drift, this stops harness drift. Mandated by
[demo-workflow.md](../docs/agent/demo-workflow.md) but the files don't exist yet. *Accept:* both demos
render identically from one source; deleting a shared style affects both.

**#H — Component-adapter conformance** (P1). A suite for the `<component>` lowering, **separate from the
JSX mapping fixtures** because its invariant differs — one-way **lowering fidelity**, not equivalence/
round-trip. Drive from a shared component-fixtures module (mirrors #A; lives outside `demos/` so it's in
coverage scope). Per definition assert: rendered shadow/light tree == authored template; running the
transform twice yields **byte-identical** class output (determinism); a Declarative-Shadow-DOM-seeded
instance upgrades with **no re-render** (idempotency, the `if (!root.childNodes.length)` guard).
*Accept:* green; a change that breaks determinism or fidelity turns it red.

## 5. Sequencing
- **P0 (keystone, ~half day):** #A shared fixtures → #B conformance suite → #C linkedom path. Kills
  drift and guards both transform directions + the build path. After this, the demo's badges are
  CI-backed.
- **P1:** #D build-integrity in CI → #G shared playground harness/CSS (retrofit both demos) → #E demo
  E2E smokes, data-driven from `kind:"playground"` (+ #7 generated-pane assertion) → #H component-adapter
  conformance (fidelity + determinism + idempotency).
- **P2:** #F webServer, #11 toggle-UX click.

## 6. Commands & verification
```bash
npm test                                   # unit + integration (vitest)
npx vitest run blocks/__tests__/unit/renderers/   # the JSX suites
npx @11ty/eleventy --output=/tmp/check     # build-smoke (must print no template errors)
npm start                                   # dev server (:3000 Vite, :8080 11ty) — needed for E2E
npm run test:integration                    # Playwright E2E (needs dev server until #F)
npm run check:standards                     # repo invariants (unaffected by this work)
```

## 7. Gotchas a new session must know
- **happy-dom lacks `isEqualNode`** (and `DocumentFragment.isEqualNode`). Node-side equality = compare
  **normalized serialized strings**. The demo uses `isEqualNode` only because it runs in a real browser.
- **`autoToggle` needs parseable HTML.** Annotated/pseudo-HTML (comments inside a start tag, as in
  `dropdown.njk`) must use the **manual** `sourceToggle` macros.
- **A missing njk import aborts the entire 11ty build** ("Wrote 0 files"). The macro import line at the
  top of a block-description file is mandatory.
- **The 11ty dev server (`eleventy --serve` on :8080) can wedge** after a build error and stop
  rebuilding; bounce `npm start` to recover. Vite (:3000) is unaffected. Don't kill the user's servers
  — detect the running instance.
- **`htmlToJsx` is the one source for browser + build**; keep it DOM-impl-agnostic (no `instanceof` on
  DOM globals; use `nodeType`/`nodeName`).
- Function event handlers (`onclick={fn}`) are **lossy by design** — they have no HTML form, so they
  don't round-trip. Mark such fixtures `lossy`.
- **`customElements.define` is one-shot per tag.** An editable/re-running playground (the component
  demo's sandbox) must **uniquify the tag** each run; `connectedCallback` must be idempotent
  (`if (!root.childNodes.length)`) so re-render / Declarative-Shadow-DOM hydration is safe.
- **Vite auto-injects `bootstrap.ts` into every demo HTML** (`webEverythingPatches`) unless the name
  ends `-unplugged`. So an E2E "zero console errors" assertion also catches bootstrap failures — and a
  demo needing no WE plugs (e.g. `component-adapter-demo`, plain `.ts`, no JSX) still gets bootstrap
  injected.
- **The two playgrounds prove different invariants** — JSX = equivalence + round-trip (two-way);
  `<component>` = one-way lowering fidelity. Don't reuse the JSX mapping fixtures for the component demo.

## 8. Follow-ups to register
**Now enforced:** `check:standards` fails on any `reports/*.md` not exposed via a `/research/` topic or a
backlog reference (the "three homes" rule). So this report **must** be mirrored as a backlog pointer item
(`relatedReport`, no body) — leaving it unmirrored breaks the build; it is no longer optional. Then
register the P0/P1 items as `/backlog/` entries (see
[backlog-workflow.md](../docs/agent/backlog-workflow.md)) with `relatedReport` pointing here.
