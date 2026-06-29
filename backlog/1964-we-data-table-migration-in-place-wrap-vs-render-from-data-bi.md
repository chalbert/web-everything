---
kind: decision
status: open
dateOpened: "2026-06-29"
tags: []
---

# we-data-table migration: in-place wrap vs render-from-data binding — is the wrap statute-conformant?

## Digest

The #1600 family migrates doc tables by **wrapping** them — `<we-data-table><table>…</table></we-data-table>` (in-place, no binding); 5 landed this session (#1610–1613) and render clean (Playwright, 0 errors). But #1818 (ratified, `#block-data-ingestion`) declares `we-data-table` **render-from-data**: data comes only from `rows="[[ ref ]]"`, *"raw author markup is never a data source,"* *"the two kernel shapes never mix."* The wrap contradicts that — yet #1867 Fork-2(c) ratified an *"in-place DOM enhancer"* that blesses it. Which codified rule governs? Gates #1609 and whether the 5 landed migrations stand.

## Fork 1 — does the wrap conform, or must table surfaces use the render-from-data binding?

- **(a) Bless the wrap as the doc-table migration pattern** *(recommended — it's what shipped, renders clean, and matches every #1600-family item body + the #1606 `<we-code-view>` wrap precedent).* Amend #1818 to carve out a **dual mode**: `we-data-table` enhances an existing SSR `<table>` **in place** for *static, non-interactive* doc surfaces (light-DOM-scan contract), and uses `rows="[[ ref ]]"` render-from-data for *deterministic/interactive data* surfaces. #1609 + the 5 landed migrations are correct as-is. **Cost:** reconciles #1818's "kernels never mix" line with the shipped reality.
- **(b) #1818 governs strictly — render-from-data only.** The wrap is non-conformant; the 5 landed migrations (#1610–1613) are reworked to `rows="[[ ref ]]"` bindings + a build-resolved `<table>`. Rich-HTML / `colspan` doc tables that can't be expressed as scalar `rows` data either **stay plain `<table>`** (out of `we-data-table` scope) or wait on a rich-cell escape (a new capability). **Cost:** undo + redo shipped work; some doc tables can't migrate at all.
- **(c) Split by table kind.** Genuinely-tabular data → render-from-data binding; rich static documentation tables → stay plain `<table>` (never `we-data-table`). Re-scope the #1600 family accordingly. **Cost:** re-triages each surface; partially un-migrates.

**Skeptic on (a):** if `we-data-table`'s kernel ever changes to the destructive `replaceChildren` render path #1818 describes, every wrapped table silently empties — the in-place behaviour we observed is load-bearing and undocumented. Blessing the wrap means **pinning that behaviour** in the #1818 carve-out, not just tolerating it.

## Evidence / context

- Codified rules in tension: `we:docs/agent/platform-decisions.md#block-data-ingestion` (#1818) vs `…#ssr-data-table-build-harness` (#1867 Fork-2c).
- Item bodies that assume the wrap: #1609 / #1610 / #1611 / #1612 / #1613 (all cite the #1621 rule-7 transient-CE mount, "badge dogfood counterpart").
- Runtime proof the wrap works: this session's Playwright run (4 pages, 0 errors; one empty `we-data-table` on `/blocks/data-table/` is the block's own `rows`-bound demo, not a migrated surface).
- Resolving this unblocks #1609 and closes the #1600 epic; **separate** open item: `standard-section`/`standard-card` (#1954–1959) render but don't upgrade (a bug to investigate, not part of this decision).
