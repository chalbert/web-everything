---
kind: story
size: 13
parent: "1836"
status: open
dateOpened: "2026-06-27"
tags: []
---

> **Outgrew size-3 → needs `/split` (batch-2026-06-27 pre-flight).** The original "auto-render from a WE
> `we:src/_data` registry" premise is **invalidated by #1839**, which ratified that the parity verdict is a
> *measured fact about the FUI runtime* and so must be stored **FUI-side** (a per-plug parity manifest under
> `fui:plugs/`) and surfaced to the doc-site via the **cross-origin data path** — **WE exposes at most a
> type-only schema, never the values** (#1282 zero-impl: a measured impl verdict in a WE file is a FUI→WE
> leak; `we:docs/agent/platform-decisions.md#plugged-only-residue-bar`). That makes this a 5-part cross-locus
> pipeline, none of which exists yet (no FUI parity manifest, no WE schema, no doc-site page). Carve into
> standalone slices, homed by `relatedProject`:
> 1. **FUI** — seed the per-plug parity manifests under `fui:plugs/` with the 15 re-audited verdicts
>    (`we:reports/2026-06-27-unplugged-functional-re-audit.md`), in the #1839 3-state vocab
>    (works / works-with-caveat + mandatory note / plugged-only + residue justification naming the missing
>    platform hook).
> 2. **FUI** — serve the parity data over the existing cross-origin MaaS data route
>    (`fui:tools/maas/vite-plugin.mjs`).
> 3. **FUI** — a drift gate ensuring the parity manifest tracks the runtime (must target the FUI tree / a
>    manifest, **not** a WE plugs dir — Gap A: WE has no plugs tree, so the existing dual-mode walk in
>    `we:scripts/check-standards.mjs` is a silent no-op in WE).
> 4. **WE** — a **type-only** schema for the parity entry shape (the only WE-resident artifact #1839 permits).
> 5. **WE** — a plugs-parity doc-site page (under the `we:src/plugs.njk` catalog) that fetches the FUI-served
>    data at runtime and renders the 3-state table (the catalog-auto-render pattern, but over cross-origin
>    runtime data, not build-time `we:src/_data`).

# Publish a doc-site plugged vs unplugged parity table

Publish a page comparing every public plug API across plugged and unplugged: works, works-with-caveat, or plugged-only, per capability. Auto-render it from a live registry (the catalog-auto-render pattern) seeded from the re-audited matrix, and cover it with a drift gate so it cannot go stale (mirror the #1309 plugs drift gate). Marks the plugged-only residue per the agreed bar.
