---
kind: story
size: 5
parent: "1601"
status: open
dateOpened: "2026-06-30"
dateStarted: "2026-07-01"
tags: []
---

# Migrate bare .section-card / .standard-card surfaces to also emit .fui-card (unblocks #1895 dead-CSS sweep)

The ~14 templates that use .section-card/.standard-card BARE (no .fui-card) — we:src/backlog-pages.njk, we:src/state-pages.njk, we:src/conformance.njk, we:src/plug-pages.njk, we:src/demos.njk, etc. — must be migrated so each surface ALSO carries .fui-card (or .fui-card confirmed globally loaded on those pages). Until then #1895 cannot retire the bespoke frame in we:src/css/style.css without a visual regression (the frame is load-bearing on /backlog/ where .fui-card lands cross-origin only). Verify with before/after Playwright on the running dev server.

## Grounding — surfaced fork (batch-2026-06-30, released not resolved)

**Update (batch-2026-06-30-1994, 2026-07-01):** the fork below is effectively **already decided** — #1871 (the governing decision this grounding pointed at as "the likely `blockedBy` edge") **resolved** with `graduatedTo: none`, ratifying the **composed-component** path: bare surfaces migrate to product components (`standard-card` / a section-rooted card) that compose FUI primitives (`we-card` → `<article>`, `we-section-card` → `<section>`), and the bespoke frame retires **through** those components (it folded in #1895). So option (c) below is the ratified answer, NOT the bare "also carry `.fui-card`" add this item's title describes — that crude approach is **superseded**. Do **not** add `blockedBy #1871` (it's resolved). Per the single-source-of-truth rule (a decision item is rewritten to its new state, not layered), this item should be **rewritten** to the composed-component migration (the #1608 epic that built the primitives is resolved — verify what shipped), or closed/re-pointed. #1895 remains `blockedBy #1982`, so this still gates the dead-CSS sweep.

The item's premise — that "also carry `.fui-card`" is a clean, visually-neutral mechanical add — is **false on the running site**, so this needs a design call before it can be batched. Measured against the live dev server (:3000, cross-origin FUI upgrade settled) with Playwright:

- **`.fui-card`'s stylesheet IS globally loaded on every page** (injected by the FUI registration ESM via `we:src/_includes/base.njk`) — a bare `<div class="fui-card">` computes a real frame everywhere: `border 1px #e2e8f0 · border-radius 8px · box-shadow sm · display:flex(column) · no padding`. So the parenthetical "or `.fui-card` confirmed globally loaded" is already TRUE, yet that alone does **not** unblock #1895: with the class absent from the surfaces, deleting the bespoke `.section-card` frame still leaves them frameless. The surfaces genuinely must carry the class.
- **Co-applying `.fui-card` is NOT neutral — `.fui-card` WINS the cascade** (injected after `we:src/css/style.css`). Adding it to a live `.section-card` flips **`border-radius` 16px → 8px** and **`display` block → flex-column** (padding survives — `.fui-card` sets none; border unchanged). So a blanket add is a **site-wide visual change**, not a no-op — across **136 bare occurrences in ~37 files** (grep: `.section-card` broad incl. `we:src/_includes/project-*.njk` `<section>`/`<details>` TOC-target wrappers; `.standard-card` 29× / 14 files), including inline-gradient hero cards (`we:src/demo-pages.njk`), tables, and grids where `display:flex` can reflow children.

**The fork (needs ratification, do not force):** (a) accept the FUI look now — `.fui-card` wins, radius/flex flip site-wide as the intended convergence (then #1982 IS the visual change, not #1895); (b) reconcile first — align the bespoke `.section-card`/`.standard-card` frame to `.fui-card`'s exact look (8px, flex) so the add is neutral, then remove in #1895; (c) do the real `<we-card>` migration (#1608/#1871) with its anchor-semantics handling (section→article, wrapper-id ride-through, child-heading ids) rather than a bare class add. #1871 ("which project-include card surfaces migrate to we-card and how") already governs the HOW and should probably decide this. `blockedBy` #1871 is the likely edge.
