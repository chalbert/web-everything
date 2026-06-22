---
kind: story
size: 3
parent: "1254"
locus: plateau-app
status: resolved
dateOpened: "2026-06-22"
dateStarted: "2026-06-22"
dateResolved: "2026-06-22"
graduatedTo: "plateau:src/component-assembler/assembler.ts"
tags: []
---

# plateau-app Component Assembler onto FUI card block

Migrate the Component Assembler (plateau:src/component-assembler/assembler.ts) off hand-rolled DOM onto FUI card + tabs + code-viewer. Ratchet release of #1254 now that the FUI card gap #1287 shipped. Gates on a rendered a11y/visual check per first-party-dogfood.

## Progress (batch-2026-06-22-1510-1483)

Migrated `plateau:src/component-assembler/assembler.ts` off hand-rolled DOM onto the three FUI blocks, consumed exactly like `plateau:src/main.ts`'s `registerNavigation` (bare standard-anchored tags, #841):

- **`<we-card>`** (`@frontierui/blocks/card`, #1287) replaces the `<article class="asm-card">` + hand-built header — `title`/`heading-level` attrs generate the card header; it erases to `<article class="fui-card">`.
- **`<we-tabs>`** (`@frontierui/blocks/tabs`) replaces the `<details>`-per-file recipe list — one `[tab-trigger]`/`[tab-panel]` pair per recipe file (APG Tabs a11y from the block).
- **`<code-view>`** (`@frontierui/blocks/code-view`, #924) replaces the `<pre><code>` source — the source is injected via the element's `.code` **property** post-mount (the block renders from `_code`, one clean text node, syntax highlights paint over it — no innerHTML escaping). Registrations are idempotent at module load.
- Trimmed the now-dead CSS (`.asm-card` chrome, `.asm-card-head`, `.asm-title`, `.asm-file`/`.asm-source` `<details>`/`<pre>` rules) the FUI blocks now own; kept layout + chips + meta.

**Rendered check (Playwright on :4000 `/component-assembler`, logged-in):** 6 `we-card`s (all upgraded to `article.fui-card`), 6 `we-tabs`, 18 `code-view`s with source populated, 18 working tab triggers — 0 app console errors. **Gate green:** plateau `npm test` 259/259. (The cross-repo `tsc` errors under `../frontierui/blocks/guard` + `virtual:trait-manifest` are pre-existing FUI type drift, unrelated to this change — none reference the assembler or the consumed blocks.)
