# Reference-runtime STAY-subset canonical home — grounding for #1246 (2026-06-20)

`/prepare 1246` — focused prep of the de-buried fork "canonical home for the reference-runtime
STAY-subset blocks (`router`, `navigation`, … `stores`): reconcile #641 FUI-canonical vs #697 WE
reference-runtime carve-out." This is a reconciliation over **already-shipped code + prior rulings**
(no greenfield design), so the research is an internal-tree trace, not a web/prior-art survey — no
`we:researchTopics.json` topic applies (per *prepare-decision-item → already-researched ground*); this
report is the `relatedReport` artifact.

## Headline finding — the general reconciliation is ALREADY codified (#1078)

The item frames an open A/B fork (WE-canonical vs FUI-canonical home). It is **largely dissolved by
statute**: `we:docs/agent/platform-decisions.md:62-69` (rule 1, *reference-implementation tier*, lineage
**#1078** "refines #817: published-package purity vs repo-internal reference runtime") already
reconciles #641 and #697:

> "the WE *repo* may *additionally* host a **non-published reference runtime** — an executable spec
> consumed only by WE's own conformance demos/tests … **generalises the block reference-runtime
> carve-out** … FUI still ships the *production* impl … the `@webeverything` *package* stays types-only
> … The carve-out is the **repo**, never the **published package**, and **never inverts the WE→FUI
> source arrow.**"

So the three general sub-questions are settled, not open:
- **Production-canonical home** = FUI, always (#641 stands).
- **Published `@webeverything` package** = types-only, always (`we:` contracts package, #872/#239).
- **Source arrow** = WE→FUI, never inverts → the item's **branch B (FUI imports *from* WE) is excluded
  by statute**, not a coherent alternative.

What #1078 *generalised* is precisely #697's carve-out: a WE-repo reference runtime is a designed
standing tier, **not** "a not-yet-finished deletion." The item's premise that #697 reads as a stale
leftover is contradicted by the later statute that postdates and generalises it.

## Corrections to the item's grounding (verified 2026-06-20)

1. **"Five dirs have no spec at all (navigation, parsers, text-nodes, transient, attributes) → undeclared
   duplicates" is FALSE.** Spec files are named per *contract*, not per *dir*. Every one of the 16 dirs
   is a declared protocol: e.g. `we:src/_data/blocks/nav-list.json` → `implementedBy:
   "@frontierui/blocks/navigation/"`; `parsers` → `we:src/_data/blocks/double-curly-bracket-parser.json`;
   `text-nodes` → `we:src/_data/blocks/interpolation-text-node.json`; `transient` →
   `we:src/_data/blocks/transient-component.json`; `attributes` → `we:src/_data/blocks/drawer.json`/`on-event`.
   All 16 carry an `implementedBy: @frontierui/...` pointer.
2. **"No WE demo consumes router/navigation/parsers/… so they are pure duplicates" is INCOMPLETE.**
   They are consumed by WE-resident reference code — `we:plugs/bootstrap.ts` ("Web Everything Bootstrap
   — Plugged Mode", loaded via `<script src=we:/plugs/bootstrap.ts>`) imports `registerRouter`,
   `registerNavigation`, the `parsers/*` (`CallParser`/`ValueParser`/…), `InterpolationTextNode`,
   `registerTransient`, `registerEventAttributes` — and WE unit tests under
   `we:blocks/__tests__/unit/parsers/`, `…/text-nodes/` import them directly.

## Per-block consumption map (the classification that IS most of the ruling)

WE-resident consumer found = block's WE copy is a **live reference runtime** (deleting it breaks a WE
demo/test/bootstrap). None found = **stale leftover** (safe to delete; FUI is sole home).

| Block | WE `implementedBy` (→ FUI) | WE-resident consumer | Disposition |
|---|---|---|---|
| router | `@frontierui/blocks/router/…` | `we:plugs/bootstrap.ts:51`; check-standards test | **retain (reference)** |
| navigation | `@frontierui/blocks/navigation/` | `we:plugs/bootstrap.ts:53` | **retain** |
| parsers | `@frontierui/blocks/…parser` | `we:plugs/bootstrap.ts:44-45`; `we:blocks/__tests__/unit/parsers/*` | **retain** |
| text-nodes | `@frontierui/blocks/…interpolation` | `we:plugs/bootstrap.ts:49`; `…/unit/text-nodes/*` | **retain** |
| transient | `@frontierui/blocks/transient/…` | `we:plugs/bootstrap.ts:52` | **retain** |
| attributes | `@frontierui/blocks/…on-event` | `we:plugs/bootstrap.ts:50` | **retain** |
| for-each | `@frontierui/blocks/for-each/…` | `we:demos/for-each-demo.html` | **retain** |
| view | `@frontierui/blocks/view/…` | `we:demos/view-tabs-demo.html:190` | **retain** |
| tabs | `@frontierui/blocks/tabs/…` | `we:demos/view-tabs-demo.html:191` | **retain** |
| wizard | `@frontierui/blocks/wizard/…` | `we:demos/wizard-flow-demo.ts:10` | **retain** |
| workflow-engine | `@frontierui/blocks/workflow-engine/…` | `we:demos/wizard-flow-demo.ts:11` | **retain** |
| resource-loader | `@frontierui/blocks/resource-loader/…` | `we:demos/loader-background-handoff-demo.ts:21` | **retain** |
| renderers | `@frontierui/blocks/…` (data-grid) | `we:demos/data-table-demo.ts`, `we:demos/pagination-demo.ts`, +6 more | **retain** |
| stores | `@frontierui/blocks/…simple-store` | `we:demos/declarative-spa.html:172` | **retain** |
| **draft-persistence** | `@frontierui/blocks/draft-persistence/…` | **none found** (0 demo/test/bootstrap refs) | **delete candidate** |
| **data-transfer** | `@frontierui/blocks/data-transfer/…` | **none found** (only self-ref) | **delete candidate** |

**14 retain / 2 delete.** The item's blanket default A (delete all, ~70%) is wrong against the tree.

## Why "delete all → demos consume FUI" (branch A) is architecturally broken for the 14

A WE conformance demo/test that needs a block's **runtime** cannot get it from FUI:
- `@webeverything` **never imports Frontier UI** (npm-scope-mirrors-layer; rule 3) — a WE demo importing
  `@frontierui/...` runtime inverts the dependency the constellation forbids.
- The `@webeverything/contracts` package (#872) is **types-only** — it cannot supply runtime.

So for any STAY block a WE demo/test exercises, WE *must* hold a reference runtime — this is a **forced
invariant**, exactly what #1078 codified. Delete is only coherent for blocks with **no** WE consumer.

## Drift is #1245's job, not this decision's

Every block's WE copy has drifted from FUI (router: all 5 files differ; the #365/#423 fixes landed FUI
only). This decision sets the *home/seam*; the *dedup mechanism* (make WE's reference faithful to /
generated-from FUI's production contract, never the inverse) is `we:#1245`, which is blocked on this
ruling. The `#659` gate (`we:scripts/check-standards-rules.mjs:1331` `validateBlockImplConformance`,
`BLOCK_IMPL_DRIFT_ENFORCED=true`) already hard-fails a *missing* FUI impl, but does **not** detect
content drift between a present FUI impl and the WE reference copy — that gap is a #1245 slice.

## Residual / red-team targets for the deciding agent

1. **Is `we:plugs/bootstrap.ts` a qualifying #1078 reference runtime, or a #606 leftover?** #606 moved
   the *plugs runtime* → FUI; `we:plugs/bootstrap.ts` still lives in WE. If bootstrap is itself slated to follow
   #606, the 6 bootstrap-only blocks (router/navigation/parsers/text-nodes/transient/attributes) lose
   their WE consumer and become delete candidates too. Highest-leverage skeptic check. (Counter:
   bootstrap is the plugged-mode *demo playground* entry, not a published artifact — a textbook #1078
   reference runtime — `we:plugs/bootstrap.ts`.)
2. **Confirm the 2 delete candidates are truly unconsumed** — not exercised by a not-yet-wired demo or
   an out-of-tree test before deleting.
