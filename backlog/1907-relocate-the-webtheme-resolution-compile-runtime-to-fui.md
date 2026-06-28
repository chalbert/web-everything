---
kind: story
size: 3
parent: "1294"
status: open
blockedBy: ["1906"]
dateOpened: "2026-06-28"
tags: []
---

# Relocate the webtheme resolution+compile runtime to FUI

T2 of the webtheme relocation cascade (#1294). Move the executable token runtime — resolveTokens (we:webtheme/tokens.ts) and compileToCss (we:webtheme/compile.ts), plus schemes/palette helpers — out of WE per #1282 to fui:webtheme/, importing the schema via @webeverything/contracts/webtheme (T1 #1906). Register the fui:webtheme alias in FUI vitest/vite/tsconfig (mirrors #1799/#1814). WE keeps the contract only; deps injected so the move is clean.
