---
kind: decision
status: resolved
dateOpened: "2026-06-23"
dateResolved: "2026-06-23"
graduatedTo: none
codifiedIn: "docs/agent/platform-decisions.md#tokens-js-first"
tags: [design-tokens, theme, webinjectors, webtheme, architecture]
relatedReport: reports/2026-06-23-categorical-taxonomy-provider.md
---

# Theme tokens are JS-first (the injector is the source of truth), one-way synced to CSS custom properties

Theme tokens (colour, layout, spacing, fonts, radii — every CSS-relevant value) must be readable by JS with no element to query: constructor/pre-attach compute, an OffscreenCanvas worker, a `console %c` message, SSR, tests. CSS custom properties can't serve these — a detached element resolves a var to `""` (browser-validated). So the source of truth is JS, held in the injector WE already ships (webinjectors/webcontexts), read synchronously and off-DOM; CSS custom properties are a derived, one-way (JS→CSS) projection for paint. Ratified 2026-06-23 (codified `tokens-js-first`); #1670 and #1683 are consumers.

Surfaced mid-discussion working #1670 (the categorical taxonomy "provider"). The instinct that drove #1670 — "one provider holding the value→presentation map, consumed cross-surface" — kept hitting a substrate question: *what actually holds and resolves a token value at runtime?* Walking the consumer cases showed CSS-custom-properties-as-source-of-truth fails a whole class of real consumers, and that the right substrate is the injector WE **already ships** — not a new mechanism. This decision generalises beyond categories to **all** theme tokens.

## What you have to decide

Where the **runtime source of truth** for a resolved theme token lives, and which direction it syncs:

- **(A — recommended) JS-first, one-way synced to CSS.** The resolved token set lives in the **injector/context** (`we:plugs/webinjectors/` + `webcontexts`), the DI system WE already ships. Any JS consumer reads it **synchronously, off-DOM, with no cascade and no loop**. From that one source, a CSS custom property is **emitted (JS→CSS, one-way)** for every CSS-relevant token, so the declarative paint path keeps cascade / light-DOM scope / dark-mode. Components read the **injector** to *know* their theme; CSS vars exist only to *paint*. `getComputedStyle` is never in the compute path.
- **(B — rejected) CSS-first.** CSS custom properties are the source of truth; JS reads them via `getComputedStyle`. Rejected — fails every off-DOM / pre-attach consumer (validated below), forces sync style recalc, and has no answer for workers/console/SSR/tests.

## Why CSS cannot be the source of truth (browser-validated 2026-06-23)

A Playwright probe (`:root` var + a `.scope` override; a custom element reading at each point) showed:

| Read point | Result | Meaning |
|---|---|---|
| `getComputedStyle(el)` on a **detached** element | `""` (empty) | Cannot read pre-attach / off-DOM at all. |
| In `connectedCallback`, inside the scoped subtree | `#00ff00` | The scoped value *does* resolve once attached… |
| Paint occurred before `connectedCallback`? | `false` | …pre-paint, but it is a **forced synchronous style recalc**, and it is the earliest possible point. |
| Console / worker / canvas (no element) | no target | `getComputedStyle` needs an element; these have none. |

So the attach-time CSS read is the fragile, costly path — reliable only for already-resolved ancestor vars, blind to the component's own not-yet-applied styles, and impossible for the constructor / `DocumentFragment` / worker / `console.log("%c", …)` cases. Pushing the read to "a later loop after attach" reintroduces FOUC. The injector read has none of these failure modes.

## The model (current stance for review)

```
injector / webcontexts          ← JS-first SOURCE OF TRUTH (resolved tokens: colour, layout, font, spacing, radii…)
   │  read synchronously by ANY js — constructor, worker, canvas, console, SSR, test  (no DOM, no cascade, no loop)
   │
   └──(one-way emit, single source)──▶  CSS custom properties  (--token-*)   ← PAINT PROJECTION ONLY
                                          cascade · light-DOM scope (scoped-token-override) · dark-mode · zero render cost
```

- **Single-source emit.** One token row is canonical (in the injector); it *emits* the CSS custom property. CSS vars are **never hand-authored in parallel**, so the JS-resolved and painted values cannot drift.
- **Scope mirrors on both sides.** An injector child scope and a `--token-*` redeclaration (`we:src/_data/semantics/scoped-token-override.json`) come from the same source row, so a scoped subtree resolves consistently whether read from JS or painted by CSS.
- **CSS vars are comprehensive, not colour-only.** Every CSS-relevant token (layout, spacing, fonts, radii, colour) is exposed as a custom property — the projection is the full theme, not a subset.

## Consumers / downstream

- **#1670** (categorical taxonomy) — its Fork 1 ("provider realization: declarative layer vs runtime DI registry") **dissolves** into this: category vocabularies are one JS-first token family (`--cat-*`) carried by the injector and synced to CSS. No new provider. `blockedBy` #1682.
- **#1683** — the implementation (injector resolves the theme; one-way CSS sync; migrate the hand-authored vars). `blockedBy` #1682.
- The **`design-tokens` protocol** (`we:src/_data/protocols/design-tokens.json`, `status: draft`): its runtime-tier wording ("each resolved token compiles to a custom property") is refined here — the **JS injector is the runtime source; the custom property is the derived projection**. This decision's `codifiedIn` should land that refinement (the design-tokens protocol and/or `we:docs/agent/platform-decisions.md`).

## Open residual (not a fork — the detail to specify)

The **single-source emit** mechanism: how the injector's resolved token set generates the `--token-*` custom properties (at build for the static set, at registration for a dynamic/app-added set) so the two projections stay consistent under scope. Specified in #1683, not re-decided here.

## Lineage

Emerged from the #1670 discussion (2026-06-23): the categorical-taxonomy "provider" instinct → "what resolves a token at runtime?" → the realisation that off-DOM/pre-attach JS consumers make CSS-as-source-of-truth untenable, and that `webinjectors` already is the JS-first substrate. Relates to the `design-tokens` protocol, `scoped-token-override` (light-DOM isolation), `webtheme`, and #1427/#1458 (tone tokens). Prepared-grounding shares the session report
[we:reports/2026-06-23-categorical-taxonomy-provider.md](../reports/2026-06-23-categorical-taxonomy-provider.md).
