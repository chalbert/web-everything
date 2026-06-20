---
kind: epic
status: resolved
dateOpened: "2026-06-18"
dateResolved: "2026-06-19"
graduatedTo: none
tags: []
---

# Every FUI block detail page hosts its own live interactive demo

The FUI website (:3001) block detail pages show NO demo today — [`fui:src/block-pages.njk`](../../frontierui/src/block-pages.njk) renders only Protocol + Implementation + Back, no block carries a `demoFile`/`fuiDemo` field, and ~50 demos in `fui:demos/` sit unlinked to any block page. This epic makes every registered FUI block surface a real, live, interactive demo on its **own** detail page: wire a per-block demo slot, author the missing demos, and gate completeness so it never drifts.

## What this is NOT (boundary)

- **WE-docs embeds** (#727/#733/#734) embed FUI-hosted demos on the **WE** site's block pages via the `fuiDemo` iframe shortcode — a different surface. This epic is the **FUI** site's own detail pages.
- **The rich workbench** (#746) builds the live theme/trait switching, embedded Plateau configurators, and polyglot panel **on top of** this base render surface. #746 is the rich layer; #970 is the foundation it assumes (today uncarded). #746 effectively `blockedBy` #971.
- **Catalog text/manifest completeness** is #706/#731/#760 (already resolved) — this epic is the *demo* surface, not the catalog copy.

## Slices

| # | Item | What it adds | Blocked by |
|---|---|---|---|
| 1 | **#971** — per-block live-demo slot on `fui:src/block-pages.njk` | a "Try it live" iframe slot driven by a `demoFile` field on `fui:blocks.json`; wire the ~15 blocks whose demo already exists | — |
| 2 | **#972** *(epic)* — author + host demos for the demo-less block families | a runtime demo per block with none today (wizard, code-view, router, parsers, button, app-shell, …) so every block maps to one | #971 |
| 3 | **#973** — demo-completeness gate | `fui:scripts/check-standards.mjs` fails if a registered block lacks a resolvable `demoFile`, mirroring the #784 catalog gate — keeps "per block" from drifting | #971 |

## Mapping convention

The demo→block mapping lives on the `fui:blocks.json` entry (`demoFile`), consistent with #727's field — **not** the per-partial `.njk` line #733 chose for the WE side, because the FUI site is data-driven (`fui:src/block-pages.njk` paginates `fui:blocks.json`).

## Acceptance (epic done when)

- [x] Every `/blocks/{id}/` page on the FUI site renders a live demo in a uniform slot (#971) when the block carries `demoFile`. — delivered by #971 (resolved)
- [x] Every registered block carries a `demoFile` pointing at a real hosted demo (#972). — delivered by #972 (resolved)
- [x] `fui:scripts/check-standards.mjs` enforces demo completeness so no future block ships demo-less (#973). — delivered by #973 (resolved)
