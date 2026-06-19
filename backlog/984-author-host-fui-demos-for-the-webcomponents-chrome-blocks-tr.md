---
type: idea
workItem: story
size: 3
parent: "972"
locus: frontierui
status: resolved
dateOpened: "2026-06-18"
dateStarted: "2026-06-19"
dateResolved: "2026-06-19"
graduatedTo: "fui:demos/webcomponents-chrome-demo.html"
tags: []
---

# Author + host FUI demos for the webcomponents chrome blocks (transient-component, app-shell, button)

Author runtime demos for transient-component, app-shell and button in fui:demos/ and wire demoFile. Slice of #972; locus frontierui.

## Progress — done in batch-2026-06-18

Authored `fui:demos/webcomponents-chrome-demo.html` (reuses `demos/playground.css`), three live sections:
- **transient-component** — `registerTransient('auto-heading')`; nested `<section><auto-heading>` resolve to
  real `<h3>/<h4>/<h5>` by document depth (live read-out of the resolved tags).
- **button** — `createButton({...})` factory: default (click), `toggle` (aria-pressed flip), and `icon`/`href`
  link variants.
- **app-shell** — `mountAppShell(shadowRoot, { brand, main, footer })`; renders the header / main / footer
  landmark frame in a mode-C in-shadow mount.

Wired `demoFile` on all three blocks + cleared them from `DEMO_PENDING` (`fui:scripts/check-standards.mjs`,
#973). **Playwright-verified on :3001**: 3 auto-headings resolve to h3/h4/h5, button toggle flips on, app-shell
exposes header+main+footer, 0 console errors. FUI check:standards green.
