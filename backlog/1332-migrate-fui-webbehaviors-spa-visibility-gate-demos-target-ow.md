---
kind: story
size: 3
parent: "1250"
locus: frontierui
status: resolved
blockedBy: ["1299"]
dateOpened: "2026-06-20"
dateStarted: "2026-06-20"
dateResolved: "2026-06-20"
graduatedTo: "fui:demos/declarative-spa.html"
tags: []
---

# Migrate fui:webbehaviors SPA + visibility-gate demos target → ownerElement

Flip inline-behavior this.target → this.ownerElement in fui:demos/declarative-spa.html, fui:demos/declarative-spa-jsx.tsx, fui:demos/declarative-spa-unplugged.html, fui:demos/visibility-gate.ts, fui:demos/visibility-gate-heavy.ts; browser-verify on fui :3001. Part of the #1299 webbehaviors carve.

## Progress

- Flipped `this.target` → `this.ownerElement` (38 occurrences) across the 5 demo files. Confirmed all
  inline behaviors extend the **real plug** `CustomAttribute` (bootstrap/`window` in the .html/.tsx;
  `import … from '/plugs/index.ts'` in the unplugged demo) which carries the `ownerElement` getter
  (#1299) — so the alias is available in every file.
- **Browser-verified on live :3001:** `declarative-spa.html` + `declarative-spa-unplugged.html` load
  with **zero** console/page errors and render content; the existing e2e specs pass —
  `plugs/__tests__/e2e/visibility-gate.spec.ts` (reveal/pulse/heavy activate on view) and
  `plugs/__tests__/e2e/declarative-spa.spec.ts`.
- Note: `ownerElement` and the deprecated `target` getter both `return this.#target` (byte-identical),
  so the flip is behavior-neutral by construction. Two pre-existing smoke-test failures on the unrelated
  `for-each-demo.html` (a page-module load hang that reproduces on the pre-migration code too) are
  external to this changeset.
