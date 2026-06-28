---
kind: story
size: 3
parent: "1836"
status: resolved
blockedBy: ["1890"]
dateOpened: "2026-06-27"
dateResolved: "2026-06-28"
tags: []
---

# Publish a doc-site plugged vs unplugged parity table

The WE doc-site page (the tail slice of the #1839-reshaped pipeline — split 2026-06-27, see [we:reports/2026-06-27-backlog-split-analysis.md](/reports/2026-06-27-backlog-split-analysis.md)). Build a plugs-parity page (under the `we:src/plugs.njk` catalog) that **fetches the FUI-served parity data at runtime** (the cross-origin data path #1839 mandates) and renders the 3-state table — works / works-with-caveat (+ mandatory note) / plugged-only (+ residue justification) — per public plug API. This is the catalog-auto-render pattern, but over cross-origin runtime data, not build-time `we:src/_data`. WE holds only the type-only schema ([#1888]); the verdict values are a measured FUI-runtime fact (#1839/#1282 zero-impl).

Blocked by [#1890] (the FUI MaaS data route that serves the parity manifest).

## Sibling slices (carved from the original size-13 pipeline, all under #1836)

- [#1887] **FUI** — seed the per-plug parity manifest with the re-audited 3-state verdicts (foundational).
- [#1888] **WE** — type-only parity-entry schema (the only WE-resident artifact #1839 permits).
- [#1890] **FUI** — serve the parity data over the cross-origin MaaS data route (blocks this page).
- [#1889] **FUI** — drift gate so the manifest tracks the runtime (Gap A: must target the FUI tree, not a WE plugs dir; mirror #1309).

## Progress (batch-parallel-2026-06-28)

Published the WE doc-site plug-parity page:

- **Page** `we:src/plugs-parity.njk` → permalink `/plugs/parity/`. Mirrors the catalog-auto-render
  pattern but over **cross-origin runtime data, not build-time `we:src/_data`** (per #1839): the
  page injects the (dev vs prod) FUI origin via `data-parity-origin="{{ links.frontierUrl }}"` — the
  same `links.frontierUrl` already used for the #1621/#865 cross-origin FUI imports.
- **Runtime fetcher** `we:src/assets/js/plug-parity.js` fetches `${frontierUrl}/_maas/parity/`
  (the #1890 aggregate route → `{ domains: [PlugParityManifest, …] }`) and renders one section per
  plug domain with a `<we-badge>`-per-capability 3-state verdict: `works` (success) /
  `works-with-caveat` (warning, renders the **mandatory note** + a backlog link for any
  `pendingPort` not-yet-ported row) / `plugged-only` (danger, renders the **residue justification**).
  Grounding `fui:` ref shown per row; a search box filters across plug/capability/note/residue.
  Degrades to an honest "couldn't load" message (not a blank table) when the FUI origin is
  unreachable (static publish / dev server down) — same posture as the live backlog board.
- **Styling** appended to `we:src/css/style.css` (`.parity-*`); the badge colors come from the
  cross-origin FUI `<we-badge>` tones.
- **Discoverability** a link to `/plugs/parity/` added to the `we:src/plugs.njk` catalog intro.

Zero-impl honored (#1282/#1839): WE ships only the page + the runtime fetcher; the measured verdict
**values** are never in a WE data file — they live FUI-side (the per-plug parity manifests under
`fui:plugs/`, e.g. `fui:plugs/webinjectors/parity.json`, #1887) and reach the page only over the
#1890 cross-origin route, typed against the #1888 schema
(`@webeverything/contracts/plug-parity`).
