---
type: issue
workItem: task
parent: "138"
status: resolved
dateOpened: "2026-06-07"
dateResolved: "2026-06-07"
graduatedTo: "Root cause + fix landed as #160 (plateau had no autonomous custom-element lifecycle, so <auto-complete>'s connectedCallback never fired). Demo now boots green on the real runtime."
tags: [autocomplete, droplist, demo, conformance, bootstrap, custom-element, browser]
relatedProject: webblocks
crossRef: { url: /blocks/autocomplete/, label: Autocomplete block }
---

# Autocomplete conformance demo crashes on load — `<auto-complete>` substrate never builds in the browser

The `<auto-complete>` conformance playground (`plateau/src/auto-complete-demo.{html,ts}`, served at
`:3011/auto-complete-demo.html`) throws on first card and never finishes booting
(`window.autoCompleteDemoReady` stays `undefined`). The thrown error is
`TypeError: Cannot read properties of null (reading 'addEventListener')` from `instrument()` —
`el.querySelector('input')` returns `null` because **the element's substrate is never built**: a
real-browser probe finds **zero** `auto-complete input` nodes on the page even though
`customElements.get('auto-complete')` is `true`. So `<auto-complete>` is *registered* but its
`connectedCallback` substrate (`input` + `ul[role="listbox"]` + `[role="status"]`) is not present
after the element is connected to the document.

This is **not** specific to any one card — it breaks card 1 (the baseline async source) first, so the
diacritic card and the new failing-source card (#148) never render either. It surfaced while
verifying #148 in-browser; the #148 contract itself is proven by the happy-dom unit/integration
tests (`Filter.test.ts` + `LiveStatus.test.ts`), but the playground can't visually demonstrate any
autocomplete behavior until this is fixed.

Notable secondary symptom: creating + connecting an `<auto-complete>` from a Playwright
`page.evaluate` block reproducibly destroys the execution context (the evaluate resolves to
`undefined` rather than returning its value), which hints the connect path may navigate / reload or
otherwise tear down the page rather than (or in addition to) silently failing to build the substrate.

Close the loop:

- Reproduce against `:3011/auto-complete-demo.html` and determine why `connectedCallback` doesn't
  build (or its output doesn't persist): is the upgrade deferred, is connectedCallback throwing
  silently as a custom-element reaction (errors route to `window.onerror`, not the caller), or does
  connecting trigger a navigation/reload that wipes the appended substrate?
- Fix so the playground boots green (`autoCompleteDemoReady === true`) and all three cards render a
  working input + listbox.
- Add a Playwright smoke test (real layout, like the windowed/anchor browser-demo direction in #145 /
  #149) asserting the demo reaches ready and card 1 has a live input — so this regression is
  CI-guarded, not eyeballed.

Spun off from #148 (filter error channel) during in-browser verification.

## Progress

- **Status:** resolved by [#160](/backlog/160-plateau-autonomous-custom-elements/).
- **Root cause:** exactly as suspected here — `<auto-complete>` was *registered* but its
  `connectedCallback` never ran, because plateau's runtime had **no lifecycle path for autonomous
  custom elements** (the stand-in only delegated to customized built-ins via `is=`). Not a navigation/
  reload; the substrate simply was never built.
- **Fix (#160):** tag-keyed rehydration in `getStandInElement.ts`, `createElement` returning the real
  class (`Document.patch.ts`), and `connectedCallback` driven from `pathInsertionMethods.ts`. The demo
  now boots the real runtime green (`autoCompleteDemoReady === true`, every card renders a live input +
  listbox, zero console errors — verified via Playwright).
- **Secondary symptom** (Playwright `evaluate` returning `undefined` for objects/arrays on patched
  pages) is captured separately as [#165](/backlog/165-playwright-evaluate-object-serialization-patched-pages/).
- **Still open:** the Playwright smoke test this asked for is the broader plateau e2e harness —
  [#168](/backlog/168-plateau-in-browser-test-harness/).
