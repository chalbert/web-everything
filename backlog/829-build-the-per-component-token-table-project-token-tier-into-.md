---
type: issue
workItem: story
size: 3
status: resolved
blockedBy: ["801"]
dateOpened: "2026-06-17"
dateStarted: "2026-06-17"
dateResolved: "2026-06-17"
graduatedTo: scripts/gen-cem.mjs
tags: []
---

# Build the per-component token table: project token tier into CEM cssProperties + render /blocks/{id}/ panel

Build slice ratified by #802. Extend gen-cem.mjs to emit cssProperties rows from each block's mapped component token group (resolved via webtheme flattenTokens/resolveTokens), MERGED (union) with #801's authored CEM contract — neither side clobbers the slot. Add an optional componentTokens (string|string[]) field to blocks.json entries naming the defaultTokens group(s) a block draws from (mirrors the fuiDemo precedent). Render a 3-column token panel (override · alias · resolved literal) on /blocks/{id}/. Blocked by #801 because both decisions write cssProperties and must coordinate the union emit. Sparse 2/69 token-tier coverage is a prioritisation input, not a scope cut.

## Progress

**Resolved 2026-06-17 (batch-2026-06-17).**

- **Shared resolver (the SoT seam, #802 Fork 1)** — `scripts/lib/component-tokens.mjs` resolves the webtheme component-token tier via the **real** `flattenTokens`/`resolveTokens` (never a re-implementation). The repo's Node has no TS loader, so the helper esbuild-transpiles the `webtheme/*.ts` modules on the fly (bundled → imported via a `data:` URL). Exposes `resolvedComponentGroups()` → rows keyed by token group, each carrying the three #802 Fork-3 columns: the overridable CSS custom property (`--button-radius`), the alias it references (`var(--radius-md)`), the resolved literal (`0.5rem`). esbuild added to `devDependencies` (was a transitive dep).
- **CEM emit (`gen-cem.mjs`)** — projects token-tier rows into each block's CEM `cssProperties`, **unioned** with the #801 authored styling API (`cemCssProperties` = authored ∪ token, authored wins on a name collision — the #802 amendment: neither side owns the slot, a clobber is a defect). `default` is the alias-aware CSS value (`var(--radius-md)`, matching the #403 compile), the resolved literal carried in the description.
- **`componentTokens` field (#802 Fork 2)** — added (`string | string[]`) on `blocks.json`; `action-button` → `"button"` (the one real mapping — `button`/`card` aren't block ids and there is no `card` block, the honest 2/69 sparsity the item flags). A block without the field renders no panel (the `fuiDemo` graceful-absence precedent).
- **Panel render** — `block-pages.njk` renders the 3-column **Component tokens** table from a new `src/_data/componentTokens.js` global (a CJS async data file that dynamic-imports the same shared resolver — so the panel and the CEM can never disagree). Verified in a full 11ty build: `action-button` shows `--button-radius` → `var(--radius-md)` → `0.5rem` across all four button tokens.

`graduatedTo` → `scripts/gen-cem.mjs` (the union emit) + `scripts/lib/component-tokens.mjs` (the resolver).
