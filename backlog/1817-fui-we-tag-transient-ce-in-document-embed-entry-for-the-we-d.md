---
kind: story
size: 2
status: open
locus: frontierui
dateOpened: "2026-06-27"
tags: [dogfood, fui, tag, embed-boundary, transient-ce]
---

# FUI we-tag transient-CE in-document embed entry for the WE-docs taxonomy dogfood

The prerequisite the #1208 **taxonomy** half needs (kind/size/tier/tags/meta → `<we-tag>`). FUI ships the `we-tag` **block** (`fui:blocks/tag/registerTag.ts`, `<we-tag tone emphasis>`, #1669) but **no in-document embed entry** for it — the analog of the badge/filter-chip `fui:embed/badges-in-document.ts` (#1758). Build `fui:embed/tag-in-document.ts`: a `registerTagsInDocument(doc)` that calls `registerTag()` and injects `TAG_CSS` once into the host document (idempotent via a `<style id>` guard), exactly mirroring `badges-in-document`. The WE docs site then loads it by a runtime cross-origin `import(...)` in `we:src/_layouts/base.njk` (beside the existing badges/code-view loaders) and pairs it with a `we-tag{}` SSR baseline so the pre-upgrade pills don't FOUC.

## Acceptance
- `fui:embed/tag-in-document.ts` exports `registerTagsInDocument`, registers `<we-tag>`, injects `TAG_CSS` once (idempotent).
- Mirrors the `badges-in-document` contract (transient-CE, mode-C rule 6/7); a test covers the idempotent register + style-inject.
- Unblocks #1208's taxonomy-surface swap.
