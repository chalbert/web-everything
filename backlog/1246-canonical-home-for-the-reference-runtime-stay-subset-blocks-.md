---
type: decision
workItem: story
size: 3
status: open
dateOpened: "2026-06-20"
tags: [blocks, duplication, drift, constellation-placement, frontierui]
relatedProject: webblocks
---

# Canonical home for the reference-runtime STAY-subset blocks (router, navigation, …): reconcile #641 FUI-canonical vs #697 WE reference-runtime carve-out

The reference-runtime STAY-subset blocks (`router`, `navigation`, `parsers`, `text-nodes`, `for-each`,
`transient`, `attributes`, `draft-persistence` + `view`/`tabs`/`wizard`/`workflow-engine`/`resource-loader`/`data-transfer`/`renderers`/`stores`)
sit in unreconciled tension: [#641](/backlog/641-decide-the-block-protocol-implementation-boundary-we-blocks-/)
ruled WE holds **no** block-impl copy (impl FUI-canonical) and every spec'd block declares
`implementedBy: @frontierui`, yet [#697](/backlog/697-delete-we-s-vendored-blocks-and-repoint-we-imports-build-to-/)
(resolved two days later) deliberately kept a **reference-runtime copy in WE** — and full runtime still
lives in *both* repos and has already drifted. This decision sets the canonical home (and the seam) and
must rule **before** any dedup in [#1245](/backlog/1245-reference-runtime-blocks-router-navigation-are-duplicated-an/)
can start; it carves the fork that was buried in #1245's body.

## The tension (grounded in the tree, 2026-06-20)

- **#641 (resolved 2026-06-15, codified `we:docs/agent/platform-decisions.md#constellation-placement`):**
  WE blocks are pure *protocols*; impl lives in FUI; WE holds **no** block-impl copy (`sourcePath` gone).
  The #659 gate (`validateBlockImplConformance`, `we:scripts/check-standards-rules.mjs:1326`) enforces it
  for the families that moved.
- **#697 (resolved 2026-06-17, *after* #641):** deliberately **kept a reference-runtime STAY subset in
  WE** — "blocks whose demos exercise a WE *standard*." A later, explicit exception to #641.
- **The filesystem reflects both at once.** Every STAY block with a spec declares
  `implementedBy: @frontierui/blocks/<id>/…` (FUI-canonical at the contract) — yet `we:blocks/<id>/`
  still holds full runtime `.ts`, drifted from `fui:blocks/<id>/` (router alone: all 5 source files
  differ, incl. the #365 entry-URL normalization and #423 accumulate-vs-overwrite fixes that landed only
  one side — the live plateau-app routing bug, 2026-06-20).
- **Five dirs have no spec at all** (`navigation`, `parsers`, `text-nodes`, `transient`, `attributes`):
  no entry under `we:src/_data/blocks/`, so they aren't declared WE protocols and #659 never sees them —
  pure undeclared duplicates.

## The fork

- **A — FUI-canonical, WE holds only contract/types (extend #641 to the STAY subset).** Delete the WE
  runtime copies; the contract `implementedBy: @frontierui` already points the right way. WE keeps the
  protocol spec (+ the `#817` `we:contract.ts`/types seam, or a real import for what a WE demo needs). The
  five unspec'd dirs get a spec or fold into a sibling. Consistent with #641/#606/#817 and the plugs
  reversal; treats #697's WE copy as a stale leftover, not a standing carve-out. *Cost:* WE demos that
  exercise these standards must consume FUI (import or the `#872` `@webeverything/contracts` type seam),
  re-confirming the #697 demo rationale survives.
- **B — formalize the #697 reference-runtime home in WE; FUI consumes.** WE is canonical for this subset
  (demos need real runtime), FUI imports rather than copies. Honors #697's stated intent. *Cost:* runs
  against #641's "no WE impl copy" and the FUI-canonical direction of #606/#817 — would need #641 amended
  with lineage, and an import seam from FUI→WE (the inverse of the usual direction).

**Bold default — A**, at ~70% confidence: #641 is the codified, general rule and the contract already
declares FUI-canonical; #697's carve-out reads as a not-yet-finished deletion rather than a designed
standing exception, and a WE demo can consume FUI without a WE runtime copy (the seam #817/#872 already
defines). The residual is whether any STAY block's demo *genuinely* needs WE-resident runtime (which
would make it a real reference-runtime standard, i.e. branch B for that block) — the per-block
classification is the thing to verify before ratifying. Whichever way it rules, a blind file-copy is
wrong (copies carry deliberate FUI adaptations: import style, tag defaults, the #365/#423 deltas).

> Not prepared/ratified — this is the de-buried fork at definition-of-ready shape. Run `/decision 1246`
> (prior-art trace of #641/#697/#817 + the per-block demo check) to rule it. Blocks all dedup +
> drift-gate slices under #1245.
