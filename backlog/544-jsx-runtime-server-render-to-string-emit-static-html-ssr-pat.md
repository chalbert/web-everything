---
type: issue
workItem: story
size: 5
status: resolved
dateOpened: "2026-06-14"
dateStarted: "2026-06-14"
dateResolved: "2026-06-14"
graduatedTo: none
tags: []
---

# jsx-runtime server render-to-string emit (static-HTML SSR path)

FUI-core capability carved from the #425 ruling: @frontierui/jsx-runtime currently only builds light DOM at runtime (JSXRenderer.createElement) with no server string-emit. Add a render-to-string path so the same HTML-mirror JSX primitives can server-render to static HTML — the enabling capability for static-first islands. Separable from the webdocs-ui primitives and reusable by #424's webdocs generator output. Prerequisite for #512 (the webdocs-ui primitives build) and thus the whole self-host Web Docs UI floor (#398/#091).

## Progress (2026-06-13) — resolved

Added a **new standalone module** rather than touching `JSXRenderer.ts` — that file is a byte-for-byte mirror of the WE canonical, pinned by `canonical-sync.test.ts`, and is the DOM path. The SSR path has different concerns (escaping, void elements, the element-vs-text ambiguity) that don't belong in the DOM serializer.

- **`@frontierui/jsx-runtime/server`** — new [packages/jsx-runtime/src/renderToString.ts](../../frontierui/packages/jsx-runtime/src/renderToString.ts) + `./server` package export. Same `createElement(type, props, ...children)` signature as the DOM factory but emits an **HTML string with no DOM** (no `document`, no jsdom dep). Mirrors the dialect rules: `class`/`className`, `for`/`htmlFor`, boolean attributes, `style` objects, and the #245 rule (a STRING `on:click` handler survives as a content attribute; a function handler is dropped — no static form). Void elements emit no closing tag.
- **The element-vs-text rule** — a branded `RawHtml` wrapper: `createElement` always returns `RawHtml`, so a nested-element child is emitted verbatim while a plain-string child is HTML-escaped — no double-escaping, no unescaped injection. `renderToString(node)` is the top-level unwrap.
- **Components** — a custom-element class with `static tagName` (Auto-Define #241) emits its registered tag (upgrades on the client); a plain function component is invoked + serialized; a client-runtime directive (`directiveIs`) or a class without a `tagName` **throws** (loud, never a silently-wrong page).
- **Test** — [renderToString.test.ts](../../frontierui/packages/jsx-runtime/__tests__/renderToString.test.ts), 14 tests green; canonical-sync still green; `tsc` build clean; FUI `check:standards` 0/0.

Unblocks **#512** (webdocs-ui primitives) and is reusable by **#424**'s webdocs generator output.
