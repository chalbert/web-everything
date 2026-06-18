# JSX Adapter — HTML↔JSX Feature Mapping (the declarative-mirror dialect)

**Date**: 2026-06-03
**Adapter page**: `/adapters/jsx-adapter/`
**Scope**: The Axis-1 (syntax) contract for the JSX adapter — a complete, reversible feature mapping between the canonical HTML adapter and a JSX *mirror dialect*, plus the source-toggle that renders the same element tree both ways. Rendering strategy (Axis 2) is out of scope and parked.
**Companion**: backlog `jsx-rendering-strategy-axis` (Axis 2 — binding/vdom/directives, parked); `we:adapters.json` declares HTML canonical and "all formats interconvertible via AST transformers".

---

## 1. The decision: JSX is the HTML adapter spelled differently, not React

The goal is to define **any** element as HTML *or* JSX and toggle losslessly. That is only achievable if JSX is a **faithful, reversible mirror of the canonical HTML adapter** — not a React dialect. So the adapter deliberately diverges from React conventions:

- `class`, not `className`. `for`, not `htmlFor`. (Our factory reads attribute keys verbatim; `for`/`class` are not JS reserved words in prop-key position.)
- Events are **string behaviors** at the canonical layer — `on:click="handler($event)"` — because a string handler has an HTML representation and a raw function reference does not. (Function-style is allowed too; see §3, row 5.)
- Reactive text (`{{ }}`) is **not** eager JSX `{js}` — eager evaluation has no inverse to a runtime path. Reactive text is therefore deferred to Axis 2; the Axis-1 reversible binding form is the `bind-*` attribute (row 10).
- Directives are spelled as the literal `<template is="…">` element form (row 7), the one spelling JSX can carry and reverse.

The existing `we:JSXRenderer.ts` is React-flavored (`onclick={fn}`→`addEventListener`, `className`→`class`). **Realigning it to the mirror dialect is the implementation task that follows this spec.**

## 2. Two axes (recap)

| Axis | What it is | Status |
|---|---|---|
| **1 — Syntax** | HTML ⇄ JSX ⇄ template-string spelling of the *same* element tree | **this report** |
| **2 — Rendering strategy** | how the tree updates: declarative-static · vdom · fine-grained · imperative | parked → `jsx-rendering-strategy-axis` |

Everything below assumes the **declarative-static** strategy (the native-first default) — the only one where an HTML↔JSX mapping is pure spelling. Cross-strategy conversion (e.g. JSX `items.map()` ⇄ `<template is="for-each">`) is Axis-2 compiler work.

## 3. The feature mapping (the contract)

| # | HTML adapter | JSX mirror | Round-trip | Notes |
|---|---|---|---|---|
| 1 | `<div class="x">` | `<div class="x">` | ✅ | `class`, never `className` |
| 2 | `<user-card name="Ana">` | `<user-card name="Ana">` | ✅ | custom element = string tag |
| 3 | `<input required>` | `<input required />` | ✅ | bare boolean ⇄ `required` / `required={true}` |
| 4 | `history-link="/x"` `trusted-html` | same kebab attrs | ✅ | behaviors are plain attributes |
| 5 | `on:click="inc($event)"` | `onclick={inc}` *or* `on:click="inc($event)"` | ✅¹ | ¹reversible for **named** handlers; inline closures `onclick={() => …}` are one-way (lossy) |
| 6 | `<span slot="header">` | `<span slot="header">` | ✅ | named slots = `slot` attribute |
| 7 | `<template is="for-each" items="…" key="…">` | `<template is="for-each" items="…" key="…">` | ✅ | literal element form is canonical; `<For>`/`<Show>` sugar deferred |
| 8 | `<!-- control:for-each … -->…<!-- /… -->` | `<template is="for-each" …>` | ⚠️ | comment-form and template-form are two HTML spellings of one directive; JSX can't carry semantic comments, so it canonicalizes on the element form. Reversal picks one canonical HTML spelling (Tier 2) |
| 9 | `{{ expr }}` / `[[ expr ]]` text | — | ⛔ | reactive text is **Axis 2** (reactive-by-path); not mapped here |
| 10 | `bind-text="count"` | `bind-text="count"` | ✅ | the Axis-1 reversible binding form |
| 11 | `options="@countries"` | `options="@countries"` | ✅ | injector/context refs are string-valued |
| 12 | `<component name="…">…</component>` | `<component name="…">…</component>` | ✅ | declarative element passes through |
| 13 | `<template>…</template>` | `<template>…</template>` | ✅ | inert template passes through |

Rows 1–4, 6, 10–13 are mechanical. The design work is rows 5, 7–9.

## 4. Resolutions for the contested cells

**Events (row 5).** Canonical/reversible form is the string behavior `on:click="inc($event)"`; the renderer also accepts function props `onclick={inc}`. A **named** function reference round-trips (`onclick={inc}` ⇄ `on:click="inc($event)"`, resolved through the injector handler context — exactly how `we:declarative-spa-jsx.tsx` already works). An **inline closure** has no string path and is one-way; the transform either synthesizes a handler name or flags it lossy. Default authoring now = function-style; the string⇄function *display* choice becomes a UI sub-toggle later (→ backlog `jsx-event-style-toggle`).

**Directives (row 7–8).** Canonical JSX directive spelling is the literal `<template is="for-each">` element — it is the one form JSX can both express and reverse. The pretty `<For>`/`<Show>`/`<Resource>` components are optional sugar mapped through the same directive registry. **Implemented (#070):** `we:blocks/renderers/jsx/directives.ts` — `desugar()` lowers the sugar to `<template is>`, `sugarize()` lifts it back, and the runtime `For`/`Show`/`Resource` components build the same DOM as the canonical form. Both spellings are equivalent; the component layer is purely an alternative spelling, not a different runtime. Comment-form directives (`<!-- control:for-each -->`) are an HTML-only spelling; their JSX mirror is the template-element form, and choosing which HTML spelling reversal emits is Tier-2.

**Interpolation (row 9).** Bare `{js}` in JSX is eager evaluation; `{{ }}` in HTML is a runtime reactive path. They look alike and mean opposite things, and `{{x}}` isn't even valid JSX text. So Axis-1 does **not** map reactive text — it uses the `bind-*` attribute form (row 10), and reactive `{{ }}` is owned by Axis 2.

## 5. The source toggle

Two tiers; only Tier 1 is in scope now:

- **Tier 1 (now):** a reusable `we:source-toggle.njk` macro (`html`/`jsx` panes) reusing the global `we:mode-selector.js` (same `.mode-selector-container` / `.mode-tab[data-mode]` / `[data-mode-content][data-mode]` structure as `we:component-source-toggle.njk`). Panes hold **authored** HTML/JSX pairs that follow §3. The mapping table *is* the spec these pairs conform to. First applied on the JSX Adapter page as the canonical demonstrator.
- **Tier 2 (later):** the live bidirectional AST transform (`htmlToJsx` / `jsxToHtml`) the adapter page already advertises — driven by a directive/behavior registry so it is not hardcoded — which can auto-populate the JSX pane for every block from its HTML.

## 6. Open questions (registered in `/backlog/`)

- **Event-style display toggle** — string ⇄ function spelling as a UI sub-toggle, and the inline-closure lossy case → `jsx-event-style-toggle`.
- **Comment vs template directive canonical HTML spelling** — which form reversal emits (row 8) → folded into Axis-2 lowering (`jsx-rendering-strategy-axis`).
- **Rollout** — Tier-1 authored pairs per block vs waiting for the Tier-2 transform to generate them.
