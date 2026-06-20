---
kind: decision
size: 3
status: open
dateOpened: "2026-06-20"
dateStarted: "2026-06-20"
preparedDate: "2026-06-20"
relatedReport: reports/2026-06-20-1246-reference-runtime-canonical-home.md
tags: [blocks, duplication, drift, constellation-placement, frontierui]
relatedProject: webblocks
---

# Canonical home for the reference-runtime STAY-subset blocks (router, navigation, …): reconcile #641 FUI-canonical vs #697 WE reference-runtime carve-out

The reference-runtime STAY-subset blocks (`router`, `navigation`, `parsers`, `text-nodes`, `for-each`,
`transient`, `attributes`, `draft-persistence` + `view`/`tabs`/`wizard`/`workflow-engine`/`resource-loader`/`data-transfer`/`renderers`/`stores`)
appear to sit in unreconciled tension: [#641](/backlog/641-decide-the-block-protocol-implementation-boundary-we-blocks-/)
ruled WE holds **no** block-impl copy, yet [#697](/backlog/697-delete-we-s-vendored-blocks-and-repoint-we-imports-build-to-/)
kept a **reference-runtime copy in WE** — and full runtime still lives in *both* repos, drifted. This
decision must rule **before** any dedup in [#1245](/backlog/1245-reference-runtime-blocks-router-navigation-are-duplicated-an/)
can start. Grounding: `we:reports/2026-06-20-1246-reference-runtime-canonical-home.md`.

## Grounding digest (verified against the tree, 2026-06-20)

**The general reconciliation is already codified — #641 and #697 do *not* actually conflict.**
`we:docs/agent/platform-decisions.md:62-69` (constellation-placement rule 1, *reference-implementation
tier*, lineage **#1078** "refines #817: published-package purity vs repo-internal reference runtime")
states the WE *repo* may host a **non-published reference runtime** — "an executable spec consumed only
by WE's own conformance demos/tests … **generalises the block reference-runtime carve-out** … FUI still
ships the *production* impl … the `@webeverything` *package* stays types-only … The carve-out is the
**repo**, never the **published package**, and **never inverts the WE→FUI source arrow**." #1078 thus
*generalised #697's carve-out into statute* — #697 is a designed standing tier, not an unfinished
deletion. Three sub-questions are therefore settled, not open:

- **Production-canonical home = FUI, always** (#641 stands; all 16 declare `implementedBy: @frontierui/…`).
- **Published `@webeverything` package = types-only, always** (`@webeverything/contracts`, #872/#239).
- **Source arrow = WE→FUI, never inverts** → the original **branch B (FUI imports *from* WE) is
  excluded by statute**, not a coherent alternative. (Dissolved — see "Supported by default".)

**Two of the item's original premises are FALSE against the tree:**
1. *"Five dirs (navigation/parsers/text-nodes/transient/attributes) have no spec — undeclared duplicates."*
   False. Specs are named per-*contract*, not per-*dir*: `we:src/_data/blocks/nav-list.json` →
   `implementedBy: @frontierui/blocks/navigation/`; `parsers` →
   `we:src/_data/blocks/double-curly-bracket-parser.json`; `text-nodes` →
   `we:src/_data/blocks/interpolation-text-node.json`; etc. **All 16 are declared protocols.**
2. *"No WE demo consumes router/navigation/parsers/… → pure duplicates."* Incomplete. They are consumed
   by WE-resident reference code — `we:plugs/bootstrap.ts` ("Plugged Mode" demo entry) imports
   `registerRouter`/`registerNavigation`/`parsers/*`/`InterpolationTextNode`/`registerTransient`/
   `registerEventAttributes`, and WE unit tests under `we:blocks/__tests__/unit/` import them directly.

**Forced invariant that fixes the default.** A WE conformance demo/test needing a block's *runtime*
cannot source it from FUI: `@webeverything` **never imports Frontier UI** (npm-scope-mirrors-layer), and
`@webeverything/contracts` is **types-only** — neither can supply runtime. So WE *must* keep a reference
runtime for any STAY block its demos/tests/bootstrap exercise. The blanket "delete all WE copies"
(original default A) is architecturally **broken** for those blocks.

## Axis-framing

The real axis is **not** "WE-canonical vs FUI-canonical home" (settled: FUI production-canonical,
package types-only, arrow WE→FUI). It is the **per-block #1078 test**: *does WE-resident reference code
(a conformance demo, a unit test, or the `we:plugs/bootstrap.ts` playground) consume this block's
runtime?* If **yes** → the WE copy is a legitimate non-published reference runtime (#697 carve-out
stands; #1245 dedups it so it *tracks* FUI, never the inverse). If **no** → the WE copy is a stale
leftover with no carve-out justification → delete; FUI is sole home. Per-block consumption map (full
table with `file:line` in `we:reports/2026-06-20-1246-reference-runtime-canonical-home.md`):

- **Consumed (retain reference) — 14:** router, navigation, parsers, text-nodes, transient, attributes
  (all via `we:plugs/bootstrap.ts` + WE unit tests) · for-each, view, tabs, wizard, workflow-engine,
  resource-loader, renderers, stores (via `we:demos/*`).
- **No WE consumer found (delete candidate) — 2:** `draft-persistence`, `data-transfer`.

## Recommended path at a glance

| Fork | Question | Options | **Default** | Conf. |
|---|---|---|---|---|
| 1 | Per-block disposition of the 16 WE copies | retain-as-reference · delete-as-stale | **14 retain / 2 delete (`draft-persistence`, `data-transfer`), by WE-consumer evidence** | ~85% |
| 2 | Does `we:plugs/bootstrap.ts` consumption qualify as a #1078 reference runtime? | qualifies (retain its 6) · #606 leftover (delete its 6, move bootstrap→FUI) | **Qualifies — retain** | ~65% |

*Supported by default (not forks):* production-canonical = FUI; `@webeverything` package = types-only;
source arrow = WE→FUI (original branch B excluded by statute); the **dedup/drift-resolution mechanism**
is delegated to #1245 (make WE's reference faithful-to / generated-from FUI's production contract — never
the inverse). The `#659` gate (`we:scripts/check-standards-rules.mjs:1331`) hard-fails a *missing* FUI
impl but does not detect *content drift* against the WE reference copy — that detector is a #1245 slice.

## Fork 1 — Per-block: legitimate reference runtime, or stale leftover to delete?

*Fork-existence:* a real per-block either/or — a WE copy is **either** a live reference dep (deleting it
breaks a WE demo/test/`we:plugs/bootstrap.ts` — the excluded branch for the 14) **or** an unconsumed duplicate
(keeping it is pure drift surface with no #1078 justification — the excluded branch for the 2). The
flawed branch is concrete and opposite per block, so the classification *is* the ruling.

- **A — Apply the #1078 test by consumption: retain the 14 consumed, delete the 2 unconsumed.** WE keeps
  a non-published reference runtime for every block a WE demo/test/`we:plugs/bootstrap.ts` exercises
  (forced — WE can't import FUI runtime, contracts package is types-only); delete the WE copies of
  `draft-persistence` and `data-transfer` (no WE consumer found), leaving FUI sole home. #1245 then
  dedups each retained copy to track FUI. *Cost:* must confirm the 2 are not exercised by a not-yet-wired
  demo before deleting.
- **B — Blanket FUI-canonical, delete all 16 WE copies (original default A).** Rejected: breaks the 14
  WE demos/tests/bootstrap that need runtime no FUI path can legally supply (WE-never-imports-FUI +
  types-only contracts). Architecturally broken, not merely costlier.
- **C — Blanket retain all 16.** Rejected for the 2 unconsumed: keeping a copy with no #1078 consumer is
  pure drift surface the carve-out doesn't license.

**Default — A**, ~85%. The residual is the 2 delete candidates: low-confidence only on whether
`draft-persistence`/`data-transfer` have an out-of-tree or planned consumer; if so they fold into the
retain set. The deciding agent's skeptic pass should grep for any planned demo before deleting.

## Fork 2 — Does `we:plugs/bootstrap.ts` consumption qualify as a #1078 reference runtime?

*Fork-existence:* genuine either/or for the 6 blocks consumed *only* via `we:plugs/bootstrap.ts`
(router, navigation, parsers, text-nodes, transient, attributes). #606 moved the *plugs runtime* → FUI,
yet `we:plugs/bootstrap.ts` still lives in WE. If bootstrap is a #606 leftover slated to follow the
runtime to FUI, those 6 lose their only WE consumer and become delete candidates (Fork 1 reclassifies
them). The branches cannot coexist: bootstrap is either a standing WE reference playground or an
unfinished #606 move — its disposition flips 6 rows of Fork 1.

- **A — Qualifies: `we:plugs/bootstrap.ts` is the plugged-mode *demo playground* entry (loaded via
  `<script src=we:/plugs/bootstrap.ts>`), consumed only by WE demos — a textbook #1078 reference
  runtime.** The 6 blocks retain. Consistent with #1078 generalising #697.
- **B — #606 leftover: `we:plugs/bootstrap.ts` should follow the plugs runtime to FUI.** Then the 6 lose their WE
  consumer → delete their WE copies too. Requires confirming #606's scope intended bootstrap to move.

**Default — A**, ~65%. The residual: #606's exact scope for `we:plugs/` — whether bootstrap was meant
to stay as WE's reference entry or follow the runtime. **High-leverage red-team target** — flag for the
deciding agent's skeptic sub-pass to trace #606's resolution before ratifying; a B ruling moves 6 of
Fork 1's "retain" rows to "delete."

> Prepared (DoR), not ratified. Run `/decision 1246` to rule it — the deciding pass owes a skeptic trace
> of #606's scope (Fork 2) and a planned-consumer grep for the 2 delete candidates (Fork 1). Blocks all
> dedup + drift-gate slices under #1245.
