---
type: issue
workItem: story
size: 5
status: resolved
blockedBy: ["658"]
dateOpened: "2026-06-15"
dateStarted: "2026-06-18"
dateResolved: "2026-06-18"
graduatedTo: scripts/check-standards-rules.mjs
tags: []
---

# Extend the dual-mode/drift conformance check to blocks (the #606 plugs analogue for blocks)

Execute the conformance arm of the #641 ruling: extend the dual-mode/drift conformance check that #606/#649 established for plugs to cover blocks. Gate that WE's fui:blocks.json block-protocol contracts stay content-equal with their canonical @frontierui/blocks impl (no silent drift, the #170 hazard), and that each block protocol's declared shape matches the impl it points at via sourcePath/implementedBy. Catches the re-divergence Fork 2 dedup closes, as an enforced check rather than a convention.

## Progress (resolved 2026-06-18)

**Grounding correction:** post-#641, WE blocks are pure protocols — there is **no WE-side block-impl copy**
(`sourcePath` is gone, 0/78 blocks carry it; the impl lives in FUI via `implementedBy: @frontierui/blocks/…`).
So the #170 drift hazard for blocks is **not** byte-divergence (the plug case) but a *contract pointing at an
impl that has moved or does not exist*. The gate is built accordingly.

- **`validateBlockImplConformance`** (`we:scripts/check-standards-rules.mjs`) — pure rule, mirrors
  `validatePlugDualMode`. Cross-repo + **detect-or-skip** (the `devServerProbe` pattern): when `../frontierui`
  is checked out, every `implementedBy` must resolve to a real impl path; when FUI is absent (CI without the
  sibling repo) the content arm is **skipped, never failed**.
- **Walker** — new section 8c in `we:scripts/check-standards.mjs` resolves each `@frontierui/blocks/<rel>` against
  `../frontierui/blocks` (file refs by extension, dir refs by dir/index module) and feeds the pure rule.
- **Staging** — `BLOCK_IMPL_DRIFT_ENFORCED=false` (WARN), the #636 warn→enforce shape: a contract may legitimately
  point *ahead* of an unbuilt impl, so a missing impl warns until the FUI backfill closes the gaps, then promotes
  to ERROR. The run surfaced **10 real gaps** (code-view, collection-operations, data-transfer, draft-persistence,
  props-table, reorderable-list, rich-text-editor, story-canvas, wizard, workflow-engine) — gate stays green.
- **4 new rule tests** (resolves / missing-warn / FUI-absent-skip / no-implementedBy). 141 rules tests + full
  `check:standards` green (0 errors).

**Carved to [#904](/backlog/904-close-the-10-block-contract-impl-drift-gaps-in-fui-flip-bloc/)** (parent #170):
build the 10 missing FUI impls + flip the enforce flag (the #726 analogue), and the deeper second arm —
compare declared `exports`/CEM surface against the FUI impl's *actual* exports (needs a TS export parse;
this item shipped the impl-existence arm).
