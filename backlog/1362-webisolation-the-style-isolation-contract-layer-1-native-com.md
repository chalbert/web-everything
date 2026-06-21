---
kind: story
size: 3
status: resolved
blockedBy: ["1349"]
dateOpened: "2026-06-21"
dateResolved: "2026-06-21"
graduatedTo: webisolation
tags: []
---

# webisolation: the style-isolation contract + Layer-1 native-compile proposal doc

Stand up the webisolation plug shell and author its Layer-1 native-compile proposal: the self-styling, in+out shadow-grade isolation contract for a light-DOM subtree, framed as tracking csswg-drafts #11002 @scope isolated (cite it as the seam; do not block on its spec text). Defines what L2/L3 impls conform to. Ratified in #1349.

## Progress (2026-06-21 — batch-2026-06-20-1358-1357, RESOLVED)

Stood up **webisolation** as a first-class standard entity (the concept-shell precedent of webcharts /
webaudit / webcompliance: a `we:src/_data/projects/<id>.json` registration + icon, no runtime source dir —
a Layer-1 *proposal*, the L2/L3 impls are separate items). The `/projects/webisolation/` page is now the
canonical contract statement; the full Layer-1 native-compile proposal + prior-art survey already live in
`we:reports/2026-06-20-scoped-component-css-isolation.md` and `/research/scoped-component-css-isolation/`
(authored under the #1349 decision), so the registration cites them rather than duplicating 10KB.

**Created:**
- `we:src/_data/projects/webisolation.json` — `status: concept`, `category: standard`. Description states
  the **fixed contract** (self-referential rules + token DI, system-delivered scope-keying), the **in+out
  isolation goal** (no shadow root → native `<button>` a11y/form intact), **Layer 1 = tracking csswg #11002
  `@scope isolated`** (the seam, not a blocker; `@scope` alone is out-scoping only), the two conformant impl
  layers (L2 build-transform / L3 runtime polyfill, #1364), and the S1/S2 isolation-strategy Configurator
  dimension (#1365/#1366). Cites #1349, #854, #11002, the report + research topic.
- `we:src/assets/icons/webisolation.svg` — teal "isolation" mark (a dashed boundary walling a self-styling
  component, cascade stubs stopped at the wall), mirroring the 128×128 icon format.

**Verified:** `npm run check:standards` → 0 errors on the changeset; `/projects/webisolation/` renders 200
on :8080 with the name + `@scope isolated`/#11002 seam + isolation-strategy; the icon serves 200. The
sibling builds #1364/#1365/#1366 now have a real `concept` project to graduate from (D3-readiness).
