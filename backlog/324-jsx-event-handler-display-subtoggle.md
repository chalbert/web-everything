---
type: idea
workItem: story
size: 2
status: resolved
dateOpened: "2026-06-11"
dateStarted: "2026-06-12"
dateResolved: "2026-06-12"
graduatedTo: blocks/renderers/jsx/eventHandlerForm.ts + autoToggleEvents macro + eventHandlerToFunctionProp filter
tags: [jsx, adapters, events, source-toggle, dialect]
---

# Add the string-function event-handler display sub-toggle (reuse the html|react dialect machinery)

Add a display sub-toggle that switches the JSX source between the two event-handler spellings — the convenience function prop (`onclick={inc}`) and the canonical string behavior (`on:click="inc($event)"`) — reusing the already-shipped soft `html | react` dialect machinery (`source-toggle.njk` / `mode-selector.js`) as a second axis, not a new protocol. Ratified in #051 (Fork 1): function-style is JSX's type-checked draw and the ecosystem majority, but only the string behavior serializes to HTML, so it stays the reversible canonical target; the toggle just chooses which form is shown. Closures need the #325 lossy handling.

## Progress

**Resolved 2026-06-12.** Shipped the sub-toggle as a mechanism (transform + filter + macro), mirroring exactly how `autoToggle` ships — page rollout stays the separate concern of [#069](/backlog/069-jsx-autotoggle-rollout/) / [#139](/backlog/139-autotoggle-secondary-snippets/) (no page uses the base toggle yet, so wiring one here would be out of scope).

- **`blocks/renderers/jsx/eventHandlerForm.ts`** (new) — the event-handler display-form axis, **orthogonal to the html|react name dialect**. `toFunctionProp` rewrites the canonical string behavior `on:click="inc($event)"` → convenience `onclick={inc}`; `toStringBehavior` is the named-only reverse; `applyEventHandlerForm` + `DEFAULT_EVENT_HANDLER_FORM='string-behavior'` (native-first). Only the round-trippable `NAME($event)` shape is rewritten — non-canonical string behaviors (literal args) and the html|react casing compose on top, keeping the two axes independent. Inline closures are intentionally untouched here; their lossy handling is #325's `reverseEvents` (the function→canonical direction), which this display path never invokes.
- **10 unit tests** in `blocks/__tests__/unit/renderers/eventHandlerForm.test.ts` (both directions, round-trip, multi-handler, literal-arg passthrough, closure-untouched, default).
- **`.eleventy.js`** — `eventHandlerToFunctionProp` filter (lazy esbuild-transpile of the SAME shared transform, mirroring `liftToVdom`/`htmlToJsx`). Smoke-verified through the exact 11ty load path.
- **`src/_includes/source-toggle.njk`** — `autoToggleEvents(id, html)` macro adds a third **"JSX · fn"** pane (`data-mode="jsx-fn"`) that pipes `htmlToJsx | eventHandlerToFunctionProp`. Reuses `mode-selector.js` unchanged — the fn pane is just another `data-mode`, so the "second axis" needs no new protocol.

Gate: 26 vitest (10 new + 16 jsxToHtml) green; `check:standards` 0 errors; `.eleventy.js` syntax valid (filter applies on the dev server's next restart — not restarted, per the live :8080 instance).
