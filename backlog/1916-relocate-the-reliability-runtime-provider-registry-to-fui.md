---
kind: story
size: 3
parent: "1294"
status: resolved
locus: frontierui
graduatedTo: "fui:reliability/provider.ts + fui:reliability/registry.ts"
dateOpened: "2026-06-28"
dateStarted: "2026-06-28"
dateResolved: "2026-06-28"
tags: [webreliability, relocation, constellation-placement]
---

# Relocate the reliability runtime (provider/registry) to FUI

Slice 1 of the reliability relocation cascade (#1294). Move the executable reliability runtime — provider + registry from we:reliability/provider.ts and we:reliability/registry.ts — out of WE per #1282 to fui:reliability/, importing the contract via @webeverything/contracts/reliability (we:reliability/contract.ts stays in WE). Register the fui:reliability alias in FUI vitest/vite/tsconfig (mirrors #1799). Mirrors webpolicy W1.

## Progress

- **Status:** resolved
- **Branch:** main (the integration-worktree branch could not be created — `git worktree add` / branch creation is blocked in this shared single-branch checkout; per Commit-On-Current-Branch the WE-side change committed on `main`).
- **Done:**
  - WE (this commit): published the FUI→WE arrow `we:contracts/reliability.ts` (type-only re-export of `we:reliability/contract.ts`) and added `"./reliability"` to `we:contracts/package.json` exports — neither existed before this slice (unlike analytics #1915, where the arrow pre-existed). `we:reliability/contract.ts` + the WE runtime stay in place (the WE runtime is deleted in #1925, the W4 slice).
  - FUI (separate repo `frontierui`, committed there): established the FUI runtime home `fui:reliability/` — `fui:reliability/provider.ts` (`assertRecoveryResult` trust guard + `RECOVERY_OUTCOMES`/`FAILURE_DISPOSITIONS`), `fui:reliability/registry.ts` (`CustomRecoveryHandlerRegistry`, first-accept-wins `recover()`), `fui:reliability/index.ts` (`createDefaultRegistry`, empty — protocol ships no default handlers), and the ported `fui:reliability/__tests__/registry.test.ts` (15 tests). Both runtime files import the contract via `@webeverything/contracts/reliability` (not a local contract).
  - FUI alias `@webeverything/contracts/reliability` → WE `we:contracts/reliability.ts` registered in all three configs (`fui:vite.config.mts`, `fui:tsconfig.json`, `fui:vitest.config.ts`) + the `reliability/**/__tests__/**` vitest include pattern (mirrors the intl/webpolicy/webcompliance entries).
- **Next:** all done — FUI vitest green (reliability 15/15). WE `npm run check:standards` green (0 errors). W2 (#1919 binding + deep-equal vectors), W3 (#1922 docs/plateau iframe), W4 (#1925 delete WE runtime) remain.
- **Notes:** Per the W1/W4 split (mirrors #1799→#1802 for webpolicy), W1 *establishes* the FUI runtime + the published contract arrow and does NOT delete the WE runtime; that is #1925's job. The WE runtime byte-mirrors into FUI verbatim except the contract import is rewritten from the local relative contract module to the published `@webeverything/contracts/reliability` arrow.
