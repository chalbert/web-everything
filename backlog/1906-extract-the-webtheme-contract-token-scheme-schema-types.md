---
kind: story
size: 3
parent: "1294"
status: resolved
dateOpened: "2026-06-28"
dateStarted: "2026-06-28"
dateResolved: "2026-06-28"
graduatedTo: "we:webtheme/contract.ts"
relatedProject: webvalidation
relatedReport: reports/2026-06-28-split-analysis-1294-webtheme.md
tags: [relocation, webtheme, conformance]
---

# Extract the webtheme contract (token/scheme schema + types)

T1 of the webtheme relocation cascade (#1294). Carve a pure WE contract for webtheme: the token/scheme schema + types that we:webtheme/{tokens,schemes,defaultTokens,paletteSource}.ts implicitly define, so the resolution runtime can relocate to FUI while WE keeps only the contract + conformance vectors (per #1282). No runtime moves in this slice — it isolates the contract surface the later slices import via @webeverything/contracts. Mirrors webcompliance C1 (#1808).

## Progress

- **Status:** resolved
- **Done:** created `we:webtheme/contract.ts` — the pure type-only surface (zero runtime emit): the #404 DTCG token-model schema (`DtcgType`, `DtcgToken`, `DtcgGroup`, `DtcgDocument`, `FlatToken`, `ResolvedToken`), the #404 compile result shape (`CompileOptions`, `CompileResult`), the #405 scheme/accent derivation result types (`Rgb`, `AccentStep`, `SchemeRoles`, `ContrastPolicy`, `StepValidation`, `SchemeRuntime`, `DeriveOptions`), and the #1252/#1274 palette-source parser contract (`PaletteSourceParser`). Repointed the runtime modules to `import type` from it and `export type` the surface so external importers (e.g. `we:reproduction-parity/shadcn/theme.ts`) keep reaching the types via the runtime modules: `we:webtheme/tokens.ts` (token schema), `we:webtheme/compile.ts` (compile shapes), `we:webtheme/schemes.ts` (scheme shapes), `we:webtheme/paletteSource.ts` (parser type). Error classes (`TokenResolutionError`/`ColorParseError`/`PaletteSourceError`) and the `CustomPaletteSourceRegistry` stay runtime (they emit) — the contract is pure types only, exactly like C1. Added `we:contracts/webtheme.ts` re-export (`export type * from '../webtheme/contract'`) + `./webtheme` to `we:contracts/package.json` exports.
- **Verified:** tsc clean for webtheme + contracts + reproduction-parity scope · 73 tests pass (20 tokens + 29 schemes + 11 paletteSource + 13 reproduction-parity shadcn) · `check:standards` shows no new errors (the 2 errors present are pre-existing on baseline — a custom-states report + stale `we:AGENTS.md` inventory, both unrelated).
- **Notes:** no runtime moved (T1 is contract-only); the resolution+compile runtime relocates to FUI in T2 (#1907 cascade). The FUI→WE arrow (`@webeverything/contracts/webtheme`) is now the import site the later slices use.
