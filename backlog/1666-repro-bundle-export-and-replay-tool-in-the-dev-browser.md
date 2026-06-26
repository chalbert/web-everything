---
kind: story
size: 8
parent: "1663"
status: resolved
locus: plateau-app
dateOpened: "2026-06-23"
dateStarted: "2026-06-26"
dateResolved: "2026-06-26"
graduatedTo: 1663
tags: []
---

# Repro-bundle export and replay tool in the dev browser

Build the export+replay TOOL in the plateau-app dev browser: capture the current moment, serialize it to a repro bundle conforming to the #1664 contract, mint a shareable link, and on the other side open that link to replay the action trace and land in the identical declared context. Composes the #1664 shape and the FUI viewer components. Local-first and zero-server per the cost-flat rule. Rides the shared trace/replay capture substrate #1667 — a `blockedBy` prerequisite (shared with #1646 and #1649) this slice consumes, not builds; wire it up once #1667 ships.

## Progress (batch-2026-06-26-1745-1775)

Built the export+replay TOOL as a plateau-app dev-browser module, composing three now-resolved pieces (built
none of them): the #1667 capture substrate (`plateau:src/dev-browser/capture`), the #1664 repro-bundle
contract + schema (`@webeverything/contracts/repro-bundle`), and the #1665 FUI viewer
(`@frontierui/blocks/repro-bundle`).
- `plateau:src/dev-browser/repro-export/bundle.ts` — the pure core: `traceToBundle` (projects a #1667
  `CaptureTrace` onto the #1664 `ReproBundle`, validated via `assertReproBundle`) + the **local-first,
  zero-server** shareable-link codec (`encodeBundle`/`decodeBundle` base64url over UTF-8, `mintShareLink`/
  `readShareLink` over a `?repro=` param — the link IS the bundle, per the cost-flat rule).
- `plateau:src/dev-browser/repro-export/index.ts` — `mountReproExport`: EXPORT mode (capture → snapshot →
  export to a link + preview) and REPLAY mode (open a `?repro=` link → decode → render the FUI inspector +
  replay timeline + ownership viewer). Matches the dev-browser module/barrel pattern (intent-inspector etc.).
- `plateau:src/dev-browser/repro-export/bundle.test.ts` — 8 tests (projection validity, 1:1 mapping,
  rules/ownership context, link round-trip incl. UTF-8, malformed-token rejection).
- `plateau:vite.config.mts` / `plateau:tsconfig.json` / `plateau:vitest.config.ts` — added the
  `@webeverything/contracts/repro-bundle` alias (→ `we:repro-bundle/index.ts`, mirroring FUI's own), which
  the FUI viewer also needs transitively.
- `plateau:scripts/render-conformance-baseline.json` — re-baselined the two new surfaces (#1280 gate).

Gate: plateau-app `vitest run` 571 pass (was failing only on the new-surface baseline, now updated); tsc
clean for the new module.
