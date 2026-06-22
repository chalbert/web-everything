---
kind: story
size: 3
parent: "1442"
status: resolved
dateOpened: "2026-06-22"
dateStarted: "2026-06-22"
dateResolved: "2026-06-22"
graduatedTo: "@frontierui/blocks/app-shell/AppShellElement.ts (<we-app-shell>)"
locus: frontierui
relatedProject: webcomponents
relatedReport: reports/2026-06-22-1442-slice-wave-3.md
tags: [packaging, custom-elements, block-model, conversion, app-shell, frontierui]
---

# Convert app-shell to we-app-shell custom element (persistent light-DOM B)

Register the app-shell block as a we-app-shell custom element via the persistent light-DOM (B) mechanism, mirroring the shipping reference at fui:blocks/wizard/WizardElement.ts. Styled-noun structural layout frame with slot management -> persistent B per the #1381 packaging guideline (we:docs/agent/block-standard.md §7). Wave-3 slice (we:reports/2026-06-22-1442-slice-wave-3.md), flat application of an already-shipping pattern, no buried fork.

## Progress

Resolved 2026-06-22 (batch-2026-06-22-1615-1208). Persistent-B element completing the wave-3 trio.

- `fui:blocks/app-shell/AppShellElement.ts` — `AppShellElement` + idempotent
  `registerAppShell(tag='we-app-shell')`; reactive `config` property; zero-config renders the default demo
  shell.
- `fui:blocks/app-shell/AppShell.ts` — `defaultAppShellConfig()` (a *factory*, not a const — the config holds
  live Nodes) + `mountAppShellLight(host, config)`. **Slot management in light DOM:** the block's `slotMain`
  path renders `<slot name="main">`, which only projects inside a shadow root; the light-DOM helper instead
  *moves* the host's authored children into `<main>` (captured before the chrome replaces them) — a one-shot
  SSR-content projection (the #865 dogfood path). Styles via one-time `document.head` injection, never shadowed.
- `fui:blocks/app-shell/index.ts` — re-exports the element + helpers.
- `fui:blocks/__tests__/unit/app-shell/AppShellElement.test.ts` — 5 pins incl. the light-DOM slotMain
  projection. 11/11 green; FUI `check:standards` 0 errors.
- `we:src/_data/blocks/app-shell.json` — `implementedBy` → the element file; `exports` + summary updated.

Closes the #1442 wave-3 trio (#1615 / #1616 / #1617). Residual flagged in the wave-3 report (is app-shell a
`we-` wrapper vs plain layout plumbing?) resolved by building it as a styled slot-host — defensible per the
report's ~80% recommendation.
