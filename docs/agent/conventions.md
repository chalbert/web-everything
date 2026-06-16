# Conventions — Naming, Glossary, Code Style

> Tier-1 reference. Read when naming anything, writing code, or adding glossary terms.
> Canonical naming authority for **both** Web Everything and Frontier UI.

## Naming Conventions

### Attributes
- **Component properties**: single-word or concatenated lowercase (`multiple`, `autofocus`).
- **Behavior attributes**: colon-namespaced (`layout:grid`) when a Web Behavior attaches functionality.
- **Event behaviors**: `namespace:event` (e.g. `on:click`) to bind interactions to abstract Actions.
  - The attribute **value** is the **Action ID** (`save`, `next`).
  - Pass static data with `arg-[name]` attributes (e.g. `arg-id="123"`).
- ❌ Avoid hyphenated attributes (`allow-multiple`) except when mirroring `aria-*` / `data-*`.

### Code identifiers
- **Classes**: PascalCase — `SimpleStore`, `CallParser`.
- **Functions/variables**: camelCase — `createStore`, `parsedResult`.
- **File names**: kebab-case — `simple-store.njk`, `on-event`.
- **Constants**: SCREAMING_CASE — `DEFAULT_OPTIONS`.

### Domain-specific patterns (machine-checked by `check:standards`)
- **Traits**: `with[Capability]` — `withSortable`, `withDraggable`. ❌ Never `use[Capability]` (reserved for React Hooks).
- **Registries**: `Custom[Name]Registry` — `CustomStoreRegistry`.
- **Implementations**: interfaces `Implemented[Name]` (`ImplementedStore`); definitions `[Name]Definition` (`StoreDefinition`).
- **Injectors**: domains start with `@` (`@web-intents`, `@date/core`). Use the provider syntax from the Web Injectors spec for defaults/fallbacks.

## Glossary Philosophy (`src/_data/semantics.json`)
- **Term first**: identify the abstract concept (`Action`, `Layout`), not the project artifact (`Action Intent`).
- Each entry: **Term** (general web/UI concept), **Definition** (universal explanation), **Usage** (the Web Everything implementation, e.g. "standardized by Web Intents").
- Any new term introduced by a block/plug/intent **must** be added to `semantics.json`. `check:standards` flags terms used in descriptions but missing here.

## TypeScript
- Strict mode. Export types alongside implementations.
- `#privateFields` for truly private members. Prefer interfaces over type aliases for object shapes.
- Each module has an `index.ts` re-exporting its public API.

## JSDoc
Add JSDoc to all public APIs (`@param`, `@returns`, `@example`). Keep examples concise.

## Icons (SVG)
Canonical template: `src/assets/icons/_template.svg`.
- **Canvas**: `viewBox="0 0 128 128"`. **Background**: rounded rect `rx="30"` at `x=14 y=14 w=100 h=100`, fill Slate-50 `#f8fafc`. Center content in the ~84×84 safe area.
- **Depth**: `filter="url(#floatShadow)"` on the main `<g>`. **Strokes**: min `stroke-width="6"`. Prefer primitive shapes.
- **Semantic color map** (gradients, top-left → bottom-right):
  - Red `@web-intents` Action/Behavior (`#ef4444`→`#b91c1c`)
  - Indigo `@web-states` Data/Store (`#818cf8`→`#4f46e5`)
  - Purple `@web-injectors` Structure/Wiring (`#c084fc`→`#9333ea`)
  - Sky `@web-plugs` Utilities/Polyfills (`#38bdf8`→`#0284c7`)

## Page Backgrounds & Surfaces (`.njk`)
The `<body>` background is a **pale → darker gradient** (`linear-gradient` in `src/css/style.css`). On a long page the lower portion darkens until anything sitting directly on it becomes unreadable. So nothing readable may sit on the bare gradient — it is a *canvas*, not a content surface.

- **Long-form content pages** (mostly flowing prose / tables, e.g. Capabilities, Validation) — wrap the whole page body in `<div class="page-sheet">…</div>`. `.page-sheet` is the white sheet that text rides on; the gradient becomes the surrounding frame. This is the default for any page that isn't a grid of self-contained cards. Add it the moment a page grows past ~1.5 screens, not after the bottom goes unreadable.
- **Grid/tile index pages** (Intents, Protocols, Research) are exempt — their content is already inside opaque white cards, so the gradient only shows in the gutters.

When a sheet isn't used (or for one-off framed elements that escape it), the same readability rule applies element-by-element — set `background: #fff;`:
- **Data tables** — set `background: #fff;` on the `<table>`. Row/cell tints (divergence highlights, confidence pills) layer on top of the white base.
- **Bordered boxes** — any framed `<div>` with `border: 1px solid var(--color-border)` (callout/message panels, list rows like intent → capability) — set `background: #fff;` on the box. Accents (colored left border, chips) stay on top.

## Adding a top-level page (`.njk`)
A new public page has **three** wiring points, and one is a silent footgun if missed. Add a page by touching all three, then run the gate:

1. **The page** — create `src/<name>.njk` with front-matter `layout: base.njk`, `title:`, and an explicit `permalink: /<name>/`. The 11ty `--serve` watcher (`:8080`) picks it up automatically. Follow `src/about.njk` (prose) or `src/project-lifecycle.njk` (card grid) for shape; apply the surface rules above.
2. **The nav** — add a `<a href="/<name>/" class="nav-link">` link to the right `nav-group` in `src/_layouts/base.njk` (Standards / Explore / About).
3. **The Vite proxy** — add `<name>` to the catalog alternation in `vite.config.mts` (the `^/(projects|…|author|…)` proxy key). **This is the footgun:** miss it and the page renders on the 11ty server (`:8080`) but **404s on the Vite dev server (`:3000`)** — which is the URL you actually browse. Vite does not auto-discover routes; the allowlist is hand-maintained.

Then run `npm run check:standards` — section 9 ("Vite dev-proxy allowlist must cover every 11ty catalog route", #210) cross-checks every `src/*.njk` permalink segment against the proxy keys and **fails the build** on a missing entry. Running the gate is what catches a forgotten step 3; a green local `:8080` page is not proof the wiring is complete. Note `check:standards` does **not** run the 11ty build itself, so also smoke a template-touching change with `npm run verify` (or `npx @11ty/eleventy --dryrun`).
