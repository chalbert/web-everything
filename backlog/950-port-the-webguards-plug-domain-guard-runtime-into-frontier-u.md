---
type: issue
workItem: story
size: 3
parent: "170"
status: open
dateOpened: "2026-06-18"
tags: []
---

# Port the webguards plug domain + guard/ runtime into Frontier UI

Additive FUI-side port of the webguards domain: copy guard/{provider,registry,index,accessControl} + plugs/webguards/* + bootstrap wiring into FUI, with the guard contract resolved via the already-wired @webeverything/contracts/guard alias (fui:vite.config.mts). Sliced from #725 (we:reports/2026-06-18-backlog-split-analysis.md); disjoint from the webvalidation port so the two run in parallel. Done when FUI build + vitest are green for webguards. WE-side deletion is #449's job.
