---
kind: story
size: 5
locus: frontierui
status: open
blockedBy: ["1362"]
dateOpened: "2026-06-21"
tags: []
---

# webisolation L2: build-transform impl (unique-class light DOM, transform-primary)

The default/transform-primary conformant impl of the #1362 webisolation contract: a zero-runtime build transform that keys a component's CSS to a machine-generated unique scope class (vanilla-extract/CSS-Modules pattern) — native a11y free, SSR-trivial, total inter-view isolation. Strategy S1 by default; not immune to external hostile CSS (that is S2/shadow, the Configurator opt-in). Conforms to the Layer-1 contract ratified in #1349.

## Pre-flight note — locus fixed (impl→FUI) + an unresolved integration-seam design question (batch-2026-06-20-1358-1357)

Cascade-freed by #1362 (webisolation now exists as a `concept` standard) and surfaced as batchable, but
the pre-flight stopped the batch here for two reasons:

- **Locus corrected `→ frontierui`.** This is an *impl* (a build transform), and the constellation statute
  is impl→FUI ("WE = contracts only", #855/#817; WE holds the contract + conformance vectors, FUI/tooling
  holds the runtime). It had no `locus` so it defaulted to WE; set `locus: frontierui`. Gate each in
  `../frontierui`.
- **Genuine design question #1349 did NOT settle — the L2 transform has no defined input or build seam.**
  #1349's survey found FUI blocks today have **zero** CSS-isolation runtime and style via "ad-hoc global
  classes + `var(--…)` tokens" (`fui:blocks/button/Button.ts:114`, `fui:blocks/card/Card.ts:89`, `fui:blocks/badge/Badge.ts:78`).
  So before this transform can be written there is an open fork: **(a) what component-CSS authoring format
  does the transform consume** (a co-located `.css`/CSS-in-JS module à la vanilla-extract? a `static styles`
  string? a convention over the existing block class soup?) **and (b) which build-tool seam hosts it**
  (a FUI Vite plugin — cf. the existing `fui:tools/trait-enforcer/vite-plugin.ts` — vs PostCSS vs a
  standalone codegen). #1349 ratified the *contract* + that L2 is transform-primary, not the *integration
  mechanism*. Resolve that (a small `/decision`, or fold it into a focused FUI build session that picks the
  native Vite-plugin default) before building — it is not a clean batch-seam item as written.
