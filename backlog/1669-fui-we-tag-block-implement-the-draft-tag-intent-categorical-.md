---
kind: story
size: 3
locus: frontierui
status: resolved
dateOpened: "2026-06-23"
dateStarted: "2026-06-24"
dateResolved: "2026-06-24"
graduatedTo: 1319
tags: [fui, gap, dogfood, badge, tag-intent]
---

# FUI we-tag block — implement the draft tag intent (categorical/decorative labels) for taxonomy pills

FrontierUI implements the Status Indicator intent (badge) and filter-chip, but not the Tag intent (we:src/_data/intents/tag.json, draft) — the decorative/categorical label #1319 split out from Status Indicator and Notification Marker, with a purpose-built categorical tone for labels that map to no severity. Build a FUI we-tag transient block mirroring fui:blocks/badge/ (config factory, CSS export, transient custom element, register helper) covering its tone/emphasis/shape dimensions, decorative-only (Action/Selection compose). Unblocks the taxonomy half of the badge dogfood: backlog kind/tier/tags/size pills (#1598/#1208) have no semantic home, and #1621 ruled they map to Tag, not the status badge. locus: frontierui.

**Consumer of #1670 (ratified 2026-06-23).** Its category-consumption API — how `we-tag` resolves a `(set, value)` to colour/icon/shape — follows the categorical-taxonomy ruling (`we:docs/agent/platform-decisions.md#categorical-taxonomy`): categories are a closed-set token family, `we-tag` paints via `--cat-<set>-<value>-*` custom properties (JS-first per #1682), `status` is excluded (Status Indicator owns it). Contract now decided — unblocked.

## Progress (batch-2026-06-23-1725-1665) — DONE

Built the FUI `we-tag` transient block mirroring `fui:blocks/badge/`:
- `fui:blocks/tag/Tag.ts` — `createTag`/`mountTag` config factory, `TAG_CSS` export, types + exported value arrays (`TAG_TONES`/`TAG_EMPHASES`/`TAG_SHAPES`) over the exact `we:src/_data/intents/tag.json` dimensions (tone `neutral|info|success|warning|critical|categorical`, emphasis `subtle|solid|outline`, shape `badge|pill|tag`), `mountInDocument` (Mode-C), `EmbedMountModule` contract assertion.
- `fui:blocks/tag/TagElement.ts` — the `we-tag` TransientElement (self-replaces to a native `<span>`).
- `fui:blocks/tag/registerTag.ts` + `fui:blocks/tag/index.ts`; `fui:demos/tag-demo.html`; `fui:blocks/__tests__/unit/tag/{Tag,TagElement}.test.ts` (20 tests green).
- Registered the block in `fui:src/_data/blocks.json` (weSpecPath `/intents/tag/`).

**Categorical painting (#1670/#1682):** `createTag({ set, value })` / `<we-tag set value>` enters categorical mode (both present) — adds `fui-tag--categorical` + `data-cat-set`/`data-cat-value`, suppresses the plain tone modifier, and resolves colour/icon/shape from `--cat-<set>-<value>-*` custom properties (JS-first, never an author hex) with literal fallbacks. **Decorative-only invariant:** zero `status`/`role="status"`/tone-word aria-label in functional code (a test asserts a tag never gets `role="status"` even with a stray `status` attr) — status stays owned by the Status Indicator intent. Unblocks the #1598/#1208/#1621 taxonomy pills. FUI gate 0 errors.
