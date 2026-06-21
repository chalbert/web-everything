---
kind: story
size: 3
parent: "1250"
status: resolved
blockedBy: ["1297", "1298", "1299", "1300", "1301", "1302", "1303", "1304", "1305", "1306", "1307", "1308", "1350", "1354"]
dateOpened: "2026-06-20"
dateStarted: "2026-06-21"
dateResolved: "2026-06-21"
graduatedTo: "we:scripts/check-standards-rules.mjs"
tags: []
---

# Add a real plugs WE↔FUI drift gate to check:standards (mirror the blocks-side §8c/#659)

New we:scripts/check-standards.mjs section mirroring §8c/#659 (blocks contract↔impl drift): fail when we:plugs/<domain> diverges from fui:plugs/<domain>; detect-or-skip when ../frontierui absent. Lands after all per-domain reconciliation/port slices so it goes green, not red.

## Progress (batch-2026-06-21)

- Added pure rule `validatePlugWeFuiDrift` (+ `PLUG_DRIFT_ENFORCED=true`, `PLUG_SHARED_CORE_FILES`) to
  `we:scripts/check-standards-rules.mjs`, mirroring `validateBlockImplConformance`. Two arms, both
  cross-repo / detect-or-skip when ../frontierui absent:
  1. **Domain presence** — every `we:plugs/<domain>` (excluding infra: core/__tests__/utils) must have a
     matching `fui:plugs/<domain>` impl dir.
  2. **Shared-core byte parity** — the declared byte-identical plug-core contract files
     (`we:plugs/core/Plug.ts`, `we:plugs/core/HTMLRegistry.ts`, `we:plugs/unplugged.ts`; #1304/#1350) must
     match FUI exactly. Deliberately NOT the whole core/ — `we:plugs/core/CustomRegistry.ts` carries the
     #1350-governed divergence and `we:plugs/index.ts`/`we:plugs/bootstrap.ts` are per-repo registration
     wiring (all legitimately differ).
- Wired §8f into `we:scripts/check-standards.mjs` (fs walk → pure rule). Verified live: 13 domains + 3
  parity files checked, 0 errors, 0 skipped (FUI present) — green, as the spec requires (lands after the
  #1250 reconciliation slices). Enforced from landing: a re-drift now hard-fails.
- 4 unit tests in `we:scripts/__tests__/check-standards-rules.test.mjs` (pass/domain-missing/file-drift/
  FUI-absent-skip). Full rules suite 177/177; `check:standards` → 0 errors.
