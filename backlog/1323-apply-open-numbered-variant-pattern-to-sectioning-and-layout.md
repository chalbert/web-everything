---
kind: story
size: 5
status: resolved
blockedBy: ["1322"]
dateOpened: "2026-06-20"
dateStarted: "2026-06-20"
dateResolved: "2026-06-20"
graduatedTo: "we:src/_data/intents/layout.json"
tags: []
---

# Apply open-numbered-variant pattern to sectioning and layout

## Progress (batch-2026-06-20) — layout half DONE; sectioning half carved to #1338

- **Layout (delivered).** Added the open-numbered `variant` axis to `we:src/_data/intents/layout.json` —
  recommended core set `flat | elevated | bordered`, orthogonal to `behavior`,
  behavior-free, open vocabulary + most-permissive default + plain-CSS-attribute (`[pane][variant]`),
  citing `we:docs/agent/platform-decisions.md#open-numbered-variants` (the #1322 statute). Structural
  differences (rail vs overlay) stay `behavior`/block-polymorphism, not variants. Mirrors the #1320 Action
  build.
- **Sectioning (carved → #1338).** The statute generalizes to *sectioning* too, but **no sectioning intent
  exists** (`we:src/_data/intents/layout.json` is app-shell regions; `we:src/_data/intents/hierarchy.json` is tree-nesting) — so the pattern has no
  target to apply to. Minting a sectioning intent is a `/new-standard` task, out of this dimension-add's
  scope. Filed **#1338** (mint sectioning intent + apply the variant axis); resolving #1323 on the layout
  application with the sectioning half tracked there.
#1318 established that presentational variants are an open-numbered axis off one semantic contract, and noted it generalizes beyond Action. Apply it to sectioning and layout: define each semantic contract once, then expose presentational variants as an open-numbered axis (recommended core set + author extension) rather than a closed enum. Seed from the variant-vs-block-polymorphism ceiling — structural differences are block polymorphism, presentational ones are variants. Blocked on the statute promotion (#1322) so it cites the codified rule.
