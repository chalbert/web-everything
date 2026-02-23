# Research Report — Internationalization & Translation

**Plan file**: `plans/translations.md`
**Research page**: `/research/internationalization/`
**Date**: 2026-02-23

---

## Question

What do major frameworks provide for i18n and translation that is not yet part of web standards? What should Web Everything adopt?

## Key Findings

### Web Standards Are Strong for Formatting, Weak for Composition

The `Intl` API covers number formatting, date formatting, plural rules, collation, segmentation, and display names. The gaps are in **composing messages**, **managing translations**, and **reactive locale switching**.

### Critical Gaps

| Gap | Web Standard | Framework Solutions | WE Adoption Path |
|-----|-------------|--------------------|-----------------|
| Message formatting with variables | `Intl.MessageFormat` (TC39 Stage 1) | ICU MessageFormat, i18next interpolation, Fluent | Message formatter block using MF2 syntax |
| Variable interpolation | None | All frameworks — `{name}`, `{{name}}`, tagged templates | Built into message formatter |
| Fallback locale chains | None | All frameworks — `fr-CA` → `fr` → `en` | Message resolver walks chain; configurable via injector |
| Dynamic locale switching | None | All runtime frameworks — reactive state triggers re-render | Locale store (CustomStore) + reactive `@t` context |

### Unicode MessageFormat 2.0 (MF2)

**The most significant development.** Approved as part of Unicode Technical Standard #35 Part 9 (published 2024). Provides a standard message formatting syntax replacing ICU MessageFormat 1.0. Key improvements: consistent data model, better error handling, extensible function registry.

TC39 `Intl.MessageFormat` proposal is Stage 1 — 3–7 years from shipping in all browsers. Polyfill/library needed in the meantime.

### Build-Time vs Runtime Translation

The plugged/unplugged architecture maps naturally:
- **Unplugged (compile-time)**: Import message functions directly. Tree-shakeable. Type-safe. No runtime overhead.
- **Plugged (runtime)**: Bootstrap registers global translation context. `@t.key` resolves reactively. Dynamic locale switching via store.

### Framework Survey

| Framework | Library | Key Features Beyond Standards |
|-----------|---------|-------------------------------|
| React | react-intl, react-i18next, LinguiJS | ICU MessageFormat, compile-time extraction, type-safe keys |
| Vue | vue-i18n | Reactive `$t()`, component-scoped translations, SFC `<i18n>` blocks |
| Angular | @angular/localize, Transloco | Per-locale builds (AOT), XLIFF extraction |
| Svelte | svelte-i18n, Paraglide | Store-based reactivity, compile-time message functions |
| Lit | @lit/localize | Dual-mode (runtime + transform), `msg()` tagged templates |

## Proposed Architecture

| Concern | Maps To | Mechanism |
|---------|---------|-----------|
| Locale state | `CustomStore` | Reactive, observable locale value |
| Translation provision | Injector context (`@t`) | Scoped per DOM subtree |
| Message formatting | Block (MessageFormatter) | MF2-based, provided via injector |
| Locale detection | Pluggable strategies | Like prefetch strategies in the router |
| Locale routing | Router block integration | URL parameter → locale store |
| RTL switching | Behavior block | Observes `dir` attribute |
| Lazy loading | Translation loader via injector | Like route loaders |

Consumer API: `<span>@t.greeting</span>`, `<span>@t.itemCount({ count: $store.items.length })</span>`

## Files Created/Modified

| File | Action |
|------|--------|
| `src/_data/researchTopics.json` | Added `internationalization` entry |
| `src/_includes/research-descriptions/internationalization.njk` | New file (~391 lines) |
