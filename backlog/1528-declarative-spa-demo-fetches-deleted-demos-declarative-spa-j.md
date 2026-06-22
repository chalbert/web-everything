---
kind: task
status: resolved
dateOpened: "2026-06-22"
dateStarted: "2026-06-22"
dateResolved: "2026-06-22"
graduatedTo: "we:demos/declarative-spa-jsx.tsx"
tags: []
---

# declarative-spa demo fetches a deleted JSX source file (404)

The `we:demos/declarative-spa.html` + `we:demos/declarative-spa-unplugged.html` demos `fetch()` the path
`we:demos/declarative-spa-jsx.tsx` to display the JSX source, but that file was deleted — the fetch 404s on
every load. Surfaced (not caused) by the #1234 plug-repoint browser probe. Fix: restore the JSX source file
or repoint/remove the fetch. Pre-existing, independent of the plug source.
