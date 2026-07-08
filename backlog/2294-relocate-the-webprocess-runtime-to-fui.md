---
kind: story
size: 3
parent: "1294"
status: resolved
blockedBy: ["2293"]
dateOpened: "2026-07-06"
dateResolved: "2026-07-07"
graduatedTo: frontierui/webprocess/{driver,registry,provider,index}.ts
tags: []
---

# Relocate the webprocess runtime to FUI

Move we:process/driver.ts, we:process/registry.ts, we:process/provider.ts, we:process/index.ts to fui:webprocess/, repointing their imports to @webeverything/contracts/webprocess (type-only), mirroring the relocated fui:webpolicy/ runtime. WE keeps only we:process/contract.ts. Second slice of the process cascade under #1294.

## Resolution (2026-07-07)

W1 of the webprocess relocation cascade (mirrors #1799/#1916/#1915 — the runtime moves to FUI first, the WE
copy is deleted in a later W4 slice, #2297).

- **FUI**: byte-mirrored fui:webprocess/driver.ts, fui:webprocess/registry.ts, fui:webprocess/provider.ts,
  fui:webprocess/index.ts, and the ported fui:webprocess/__tests__/runtime.test.ts (33 tests) from
  we:process/, rewriting the contract import from the local relative contract module to the published
  @webeverything/contracts/webprocess arrow (already aliased in fui:vite.config.mts + fui:tsconfig.json by
  #2293). Added the missing third registration — fui:vitest.config.ts's alias + the
  webprocess/**/__tests__/** include glob — mirroring the intl/reliability/webpolicy entries (the #804-2a
  vitest half).
- **WE**: no source change — we:process/driver.ts, we:process/registry.ts, we:process/provider.ts,
  we:process/index.ts stay in place (deleted in #2297, the W4 slice); we:process/contract.ts remains the
  sole pure-contract surface.
- FUI webprocess vitest suite green (33/33); WE check:standards 0 errors; WE npm test 192 files / 2492
  tests green.
