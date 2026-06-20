---
kind: story
size: 3
parent: "1250"
locus: frontierui
status: resolved
blockedBy: ["1344"]
dateOpened: "2026-06-20"
dateStarted: "2026-06-20"
dateResolved: "2026-06-20"
graduatedTo: "fui:plugs/webvalidation/"
tags: []
---

# Port 2 WE-only webvalidation files to FUI + wire index exports

Contract-audit then port we:plugs/webvalidation/CustomCommitmentPolicyRegistry.ts (70) + we:plugs/webvalidation/ValidationErrorSummary.ts (143) into fui:plugs/webvalidation/; add their 3 exports (CustomCommitmentPolicyRegistry, createDefaultCommitmentPolicyRegistry, ValidationErrorSummary) to fui:plugs/webvalidation/index.ts PRESERVING its @webeverything/* alias imports (do not blind-copy WE's relative-path index). Blocked by the alias wiring.

## Progress (2026-06-20, batch-2026-06-20-1344-1342)

Unblocked by #1344 (alias wiring) and ported both files into `fui:plugs/webvalidation/`:

- **`fui:plugs/webvalidation/CustomCommitmentPolicyRegistry.ts`** — ported from WE. **Import audit**: the
  `commitment-policy/` model is WE-resident (not vendored into FUI — confirmed `frontierui/commitment-policy/`
  absent, unlike the local `validator-resolution/`/`validity-merge/`), so WE's `../../commitment-policy/index.js`
  + `../../commitment-policy/registry.js` were retargeted onto the **`@webeverything/commitment-policy`**
  alias (#1344). `UnknownCommitmentPolicyError` rides the same index barrel, so the two WE imports collapse
  to one. Core `CustomRegistry` import stays FUI-local (`../core/CustomRegistry`).
- **`fui:plugs/webvalidation/ValidationErrorSummary.ts`** — ported from WE; `../../error-summary/index.js`
  → **`@webeverything/error-summary`** (#1344). Body verbatim otherwise.
- **`fui:plugs/webvalidation/index.ts`** — added the 3 exports next to their merge/resolution siblings,
  **preserving FUI's `@webeverything/*` alias style** (did not blind-copy WE's relative-path index).

`npx vitest run plugs/webvalidation` → **50 passed**; `tsc --noEmit` resolves the new alias imports with no
new errors; gate clean (no commitment/error-summary finding).
