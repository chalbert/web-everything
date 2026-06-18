---
type: issue
workItem: task
parent: "235"
status: resolved
dateOpened: "2026-06-09"
dateStarted: "2026-06-09"
dateResolved: "2026-06-09"
graduatedTo: none
tags: [jsx-adapter, dialect, events, react-compat]
relatedReport: reports/2026-06-07-dev-authoring-preferences-architecture-intents.md
relatedProject: webadapters
crossRef: { url: /adapters/jsx-adapter/, label: JSX Adapter }
---

# `react` JSX dialect: camelCase multi-word event names (`onmouseover` → `onMouseOver`)

Surfaced closing out #235 (configurable JSX authoring dialect). The `react` dialect maps the three
families #235 named — `class`→`className`, `for`→`htmlFor`, and **single-word** inline events
`on<event>`→`on<Event>` (`onclick`→`onClick`). The event rule only capitalizes the first letter
(`we:blocks/renderers/jsx/dialect.ts` `toReactPropName`), so a **multi-word** DOM event emits the wrong
React name: `onmouseover` → `onMouseover` (React is `onMouseOver`), `onkeydown` → `onKeydown`
(`onKeyDown`), `ondblclick` → `onDblclick` (`onDoubleClick`).

Within #235's stated scope (the three families, single-word events) this is fine, but a *production*
`react` dialect must produce real React handler names.

**What to do:**

- Map the DOM event name to React's camelCase prop using the canonical DOM-event → React-prop table
  (or a small curated map of the multi-word events: `mouseover`/`mousedown`/`mouseup`/`mouseenter`/
  `mouseleave`/`keydown`/`keyup`/`keypress`/`dblclick`→`doubleClick`/`contextmenu`/`pointerdown`…).
- Make the reverse (`toHtmlAttrName`) lower-case the whole React name back to the HTML event (already
  does `name.toLowerCase()`), and add a round-trip test over the multi-word set.
- Keep it inside `we:dialect.ts` so both `htmlToJsx` codegen and the playground toggle pick it up.

Pure mapping breadth — no new surface, no design fork. Parent #235.

## Progress
- **Status:** resolved (2026-06-09). `graduatedTo: none` — refined the existing `react` dialect, no new entity.
- **Done:**
  - `we:blocks/renderers/jsx/dialect.ts` — added the curated `REACT_EVENT_SUFFIX` table (mouse/keyboard/
    pointer/touch/drag/focus/composition/animation multi-word events; `dblclick`→`DoubleClick` the one
    true rename). `toReactPropName` now consults it (`onmouseover`→`onMouseOver`), single-word events
    still use the first-letter cap. `toHtmlAttrName` consults a derived `REACT_PROP_TO_DOM_EVENT` reverse
    map so renamed events (`onDoubleClick`→`ondblclick`) round-trip exactly; pure-cased names still fall
    through to `toLowerCase()`.
  - `we:blocks/__tests__/unit/renderers/jsxDialect.test.ts` — 16-case multi-word mapping table + an exact
    round-trip test (React name → DOM name) + single-word regression.
  - `we:blocks/renderers/jsx/__fixtures__/mapping-cases.tsx` — shared demo card 10 (`onmouseover` string
    event, non-lossy) so the playground's react toggle visibly shows `onMouseOver`.
- **Gate:** 83 JSX renderer tests green (incl. the shared round-trip over the new card); `check:standards`
  0 errors; touched files `tsc`-clean.
- **Scope note:** the map is *curated* (the standard React synthetic-event families), as the item asked —
  not an exhaustive every-DOM-event table; that was the intended scope, not a deferred leftover.
