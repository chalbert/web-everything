---
kind: story
size: 3
parent: "1836"
status: open
blockedBy: ["1890"]
dateOpened: "2026-06-27"
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
