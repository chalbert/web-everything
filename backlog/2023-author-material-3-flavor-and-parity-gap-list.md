---
kind: story
size: 8
parent: "1226"
status: open
blockedBy: ["2017", "2022"]
dateOpened: "2026-07-01"
tags: [parity, flavor, material, dtcg, gap-list]
---

# Author a full Material 3 flavor + produce the parity gap list

## Digest

Material is the next parity target after shadcn (#1226). What exists today is **not** a Material flavor: a hardcoded
~5-token `material-like` workbench preset (`fui:workbench/designSystems.ts:47-90`) and a 2-color/1-radius manifest
stub (`we:design-systems/material-like.tokens.json`). This item authors a **full** Material 3 flavor as a DTCG
override, loaded via the #2017 manifest loader, tested against representative M3 components, producing the parity
gap list — reusing the harness/method established by the shadcn slice (#2022).

## Scope

- Author `we:design-systems/material.designsystem.json` + `we:design-systems/material.tokens.json` as a **full** M3
  DTCG override (M3 color roles, tonal elevation, shape scale, state layers) — supersede the `material-like` stub.
- Load via #2017; render FUI button/card/nav under it.
- Diff vs an M3 reference (visual + behavioral); record divergences.
- Publish the gap list as a `we:reports/…` topic (feeds #1226).

## Acceptance

- Material 3 flavor loads through the manifest loader and re-themes FUI components to the M3 look, verified by
  Playwright vs an M3 reference.
- Written gap list enumerating non-reproducible M3 aspects (e.g. state layers, tonal elevation) with proposed
  intents/tokens.
- The `material-like` preset/stub is reconciled (superseded or repointed).

## Notes

- Depends on #2017 (loader) and reuses the harness/method from #2022. WE holds data; FUI holds impl.
