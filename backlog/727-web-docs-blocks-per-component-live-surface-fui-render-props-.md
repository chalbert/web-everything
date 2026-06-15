---
type: idea
workItem: story
size: 8
parent: "623"
status: open
blockedBy: ["604"]
dateOpened: "2026-06-15"
tags: []
---

# Web Docs /blocks/ — per-component live surface (FUI render + props/token/a11y panels) on the catalog skeleton

The full per-component half of the Web Docs catalog, on top of the shipped /blocks/ index skeleton (#627, src/blocks.njk). Each block's /blocks/{id}/ page gains a live example (real FUI block render via #604's pipeline + the #701 fuiDemo iframe embed, NOT static specs), a props table (from the #626 CEM derivation), a token table, and an a11y panel — the Storybook-equivalent per-component view. Blocked on #604's render pipeline (held, D3-readiness: webplugs concept) and consumes #626's derived manifest. Carved from #627 at batch-2026-06-15 once its quick-win index slice shipped.
