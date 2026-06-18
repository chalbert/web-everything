---
type: idea
workItem: story
size: 3
parent: "746"
status: resolved
locus: plateau-app
relatedProject: webdocs
blockedBy: ["888"]
dateOpened: "2026-06-17"
dateStarted: "2026-06-18"
dateResolved: "2026-06-18"
graduatedTo: plateau-app/src/design-system-creator/importAdapter.ts
tags: [webdocs, design-system, theme-creator, plateau, dtcg, figma, ingest-adapter]
---

# DTCG / Figma-file import adapter for the Plateau creator

Free deterministic LOCAL parse of DTCG tokens and Figma variables-export files into a #747 manifest (adapter-as-normalization-hub; free per #775 Fork 2-B — only hosted Figma sync is paid).

## Progress (resolved 2026-06-18) — locus plateau-app

Free, deterministic, LOCAL import (adapter-as-normalization-hub) on the #888 creator:

- **`importAdapter.ts`** — pure parsers normalizing two incumbent token formats into the creator flat `themeTokens` pivot: `parseDtcg` (W3C DTCG nested `$value` tree → dotted names, ignores `$`-prefixed group metadata) and `parseFigmaVariables` (Figma variables-export `variables[]` with `resolvedValue`/`value`, slash-names → dots). `detectFormat` auto-detects; `importTokens`/`importTokensFromJson` dispatch + throw clear errors on unrecognized/empty/invalid input. No DOM/network/file-IO — the incumbent format never leaks past the pivot (lossy ingest, #775 Fork 2-B: local parse is free, only hosted Figma sync is paid).
- **creator.ts** — an Import control (paste JSON + Import button) merges parsed tokens into state, persists, and re-renders the token picker with the imported tokens.
- **Tests** — `importAdapter.test.ts` (8: DTCG flatten, Figma map, detect, dispatch+errors) + 2 creator import tests (DTCG import appears as editable tokens + persists; unrecognized-format error surfaced). Full plateau suite green (232 tests).
