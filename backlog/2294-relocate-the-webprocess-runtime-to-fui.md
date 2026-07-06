---
kind: story
size: 3
parent: "1294"
status: open
blockedBy: ["2293"]
dateOpened: "2026-07-06"
tags: []
---

# Relocate the webprocess runtime to FUI

Move we:process/driver.ts, we:process/registry.ts, we:process/provider.ts, we:process/index.ts to fui:webprocess/, repointing their imports to @webeverything/contracts/webprocess (type-only), mirroring the relocated fui:webpolicy/ runtime. WE keeps only we:process/contract.ts. Second slice of the process cascade under #1294.
