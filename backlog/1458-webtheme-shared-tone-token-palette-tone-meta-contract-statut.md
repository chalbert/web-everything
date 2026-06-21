---
kind: story
size: 5
status: resolved
blockedBy: ["1427"]
dateOpened: "2026-06-21"
dateStarted: "2026-06-21"
dateResolved: "2026-06-21"
graduatedTo: "we:webtheme/defaultTokens.ts"
tags: []
---

# webtheme shared --tone-* token palette + tone meta-contract statute (realizes #1427 Fork 1a)

Realizing build for #1427(a): define the shared tone TOKEN palette in webtheme (--tone-{neutral,danger,success,warning,info,critical}, light/dark-aware, severity-family only — progress/categorical stay intent-local per the #1427 roster ruling) and codify the tone META-CONTRACT statute in we:docs/agent/platform-decisions.md (a tone value names a semantic color/severity family the theme resolves, never a hex; open-numbered; membership test = differs only in semantic color, not behavior/lifecycle — the #1318 statute, second application).

## Progress (batch-2026-06-21)

- **Token palette** `we:webtheme/defaultTokens.ts` — new top-level `tone` color group → `--tone-{neutral,
  info,success,warning,danger,critical}` (severity family only). Each token is **scheme-aware via native
  `light-dark()`** (the dark step lighter, to read on a dark surface) — zero extra `we:webtheme/schemes.ts`
  wiring, the same mechanism the bg/fg roles use. The top-level group makes the var `--tone-danger` (not
  `--color-tone-danger`), matching the consumers (the #1468 meter block's zone colours).
- **Roster honoured:** only the 6 severity tokens; `progress`/`categorical` deliberately excluded (the
  #1427 roster — they fail the tone-membership test) — a test asserts `--tone-progress`/`--tone-categorical`
  never compile.
- **Statute** `we:docs/agent/platform-decisions.md#tone-meta-contract` — codifies: tone = a shared token
  palette + a meta-contract (dimension named `tone`, canonical synonym table, neutral/info distinct), value
  enum stays per-intent (never a flat cross-intent enum — the Bootstrap smell), membership test = color-only
  vs behavior/lifecycle. Lineage #1427 → builds #1458/#1459; second application of open-numbered-variants.
- 2 new webtheme tests (`we:webtheme/__tests__/tokens.test.ts`): `--tone-*` compile + light-dark + roster
  exclusion. webtheme suite 60/60; `check:standards` → 0 errors.
