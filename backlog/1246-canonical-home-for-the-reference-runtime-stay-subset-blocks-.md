---
kind: decision
size: 3
status: resolved
dateOpened: "2026-06-20"
dateStarted: "2026-06-20"
dateResolved: "2026-06-20"
graduatedTo: none
codifiedIn: "docs/agent/platform-decisions.md#constellation-placement"
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

> **⚑ RATIFIED 2026-06-20: DELETE ALL 16 BLOCK COPIES — no block runtime stays in WE.**
> Per the user's deciding direction "we should not keep any implementation in WE," the ruling for the
> **block** reference-runtime subset is **FUI = sole home for all 16; WE keeps only protocols +
> conformance vectors + types**, demos FUI-hosted via the #701 iframe (the iframe path fits rendered
> UI). This **reverses #697** and **carves blocks OUT of the #1078 reference-impl tier**; codified in
> `we:docs/agent/platform-decisions.md#we-fui-embed-boundary` (rule 4 reference-vs-impl partition
> withdrawn) + a blocks-carve note on `#constellation-placement` rule 1.
> **Scope note:** #1246 ruled the *block* subset. The broader "fully zero-impl in WE" question was
> filed as #1282 and **has since been ratified** (2026-06-20): the WE project holds **zero
> implementation** as the rule (`we:docs/agent/platform-decisions.md#constellation-placement`); the
> #1078 reference-impl tier is withdrawn wholesale, with pre-existing logic runtimes (webpolicy et al.)
> relocating to FUI as **tracked debt** gated on a FUI home + #899 (epic #1294). Everything from
> here down to the "⚑ Ruling" section is the prior **14-retain/2-delete** analysis, **superseded, audit
> only**.

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

> **Superseded table (audit) — the "Default" column below reflects the prior 14-retain analysis, NOT
> the active ruling.** Active ruling: **delete all 16** (see the ⚑ banner above and the Reframe section).

| Fork | Question | Prior options | ~~Prior default~~ → **Active** | Conf. |
|---|---|---|---|---|
| 1 | Per-block disposition of the 16 WE copies | retain-as-reference · delete-as-stale | ~~14 retain / 2 delete~~ → **delete all 16 (WE holds zero impl)** | ~80% |
| 2 | Does `we:plugs/bootstrap.ts` consumption qualify as a #1078 reference runtime? | qualifies (retain its 6) · #606 leftover (delete its 6) | ~~Qualifies — retain~~ → **Dissolved: bootstrap moves to FUI** | ~80% |

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

~~**Default — A**, ~65% → revised **~90%** post-verification (below).~~ **SUPERSEDED** — the retain
default is reversed by the reframe (delete all 16). The verification below stands only as evidence that
the 14 *are* consumed today; under the reframe that consumption relocates to FUI-hosted demos (#701),
so it no longer argues for a WE-resident copy.

## Verification (deciding pass, 2026-06-20) — both named residuals closed

**Fork 2 / #606-scope skeptic trace — branch B fails to land; A strengthened to ~90%.**
- **#606 (resolved 2026-06-14, B = FUI owns the plugs *runtime* as `@frontierui/plugs`)** explicitly
  classifies `we:plugs/bootstrap.ts` as a **"POC/demo"** (`we:backlog/606-…md:38`: "the plugged
  `we:plugs/bootstrap.ts` (patches `window`/`Node`/`Element`) is a POC/demo"), distinct from the
  *unplugged library* (`we:plugs/index.ts` / `we:plugs/unplugged.ts`) it named the "real product surface" that
  moved to FUI. #606's "plugged showcase → `@frontierui/plugs`" was never executed — bootstrap still
  lives in WE.
- **bootstrap is not orphaned — it is THE plugged-mode reference entry for WE's demo suite:** loaded by
  14+ live demo pages via a `<script type="module">` import of `we:plugs/bootstrap.ts`
  (`we:demos/for-each-demo.html:71`, `we:demos/declarative-spa.html:166`, `we:demos/navigation-demo.html:73`,
  `we:demos/declarative-spa-router.html:225`, `we:demos/text-interpolation-demo.html:117`, +9 more),
  **auto-injected into every demo by `we:vite.config.mts`**,
  and exercised by `we:plugs/__tests__/e2e/*` + the 6 blocks' own unit tests under
  `we:blocks/__tests__/unit/{router,navigation,parsers,text-nodes,transient}/`.
- **#1078 postdates and governs #606.** #1078 ("the WE *repo* may host a non-published reference
  runtime … consumed only by WE's own conformance demos/tests") is the later statute that legitimizes
  exactly this. Moving bootstrap → FUI would break 14 WE demos that **cannot legally import FUI
  runtime** (npm-scope-mirrors-layer + types-only contracts). So branch B is **architecturally broken,
  not merely costlier** — the same shape as Fork 1's branch B. The 6 bootstrap-consumed blocks retain.

**Fork 1 / delete-candidate planned-consumer grep — both confirmed unconsumed.**
- `draft-persistence`: **0** runtime refs in `we:demos/`/`we:plugs/`; every hit is spec/doc
  (`we:src/_includes/block-descriptions/draft-persistence.njk` code *example*,
  `we:src/_data/referenceIndex.json`, `we:src/_data/blocks/draft-persistence.json`).
- `data-transfer`: **0** runtime refs in `we:demos/`/`we:plugs/`; every hit is doc/intent prose
  (`we:src/_includes/block-descriptions/{data-transfer,code-view,reorderable-list}.njk`, `/intents/data-transfer/`).
- Both safe to delete; FUI sole home. ~~Default A (14 retain / 2 delete) holds at ~90%.~~ **SUPERSEDED**
  — under the reframe *all 16* delete (the 14's consumption relocates to FUI-hosted #701 demos), so this
  evidence no longer argues for any WE-resident copy.

## ⚑ Ruling — RATIFIED 2026-06-20 (supersedes the forks above)

**User direction in the deciding discussion: "we should not keep any implementation in WE."** This
rejects the *premise* the two forks above rested on — that a WE conformance demo/test *forces* a
WE-resident reference runtime. It **reverses #1078's reference-implementation-tier carve-out and #697**,
not just their conclusion.

**Why the premise dissolves (the carve-out's only prop is met elsewhere):**
- The "WE demos need runtime" objection is already answered by **#701 `fuiDemo` iframe** — WE embeds
  *FUI-hosted* demos and never imports FUI block code. The current WE demos importing
  `we:plugs/bootstrap.ts` + `we:blocks/<id>/` runtime are **legacy pre-#701 state**, not the end-state;
  #1078 blessed that legacy as a standing tier instead of finishing the migration.
- WE conformance that needs a runtime to test against becomes **WE-owned vectors executed FUI-side**
  (#817/#899) — `we:blocks/__tests__/unit/*` convert to vectors; no WE impl required.

**Ruling:**
- **FUI = sole home for ALL runtime** — all 16 block copies + `we:plugs/bootstrap.ts` + the executable demos.
- **WE = block protocols + conformance vectors + types. Zero implementation.**
- WE docs embed FUI-hosted demos via the **#701** iframe.
- **Fork 1 collapses to "delete all 16"** (not 14-retain/2-delete). **Fork 2 dissolves** (bootstrap moves to FUI).
- Lineage: *"reverses #697; carves **blocks** out of the #1078 reference-impl tier — a block's
  demos-need-runtime prop is met by the #701 iframe (fits rendered UI). #1078's tier still stands for
  non-rendered logic runtimes (webpolicy et al.)."*
- **Scope guard (added at ratify, after tracing #1078):** #1078 resolved 2026-06-20 keeping
  `we:webpolicy/enforcement.ts` + ~10 non-rendered reference runtimes in WE, with reasoning the block
  case does **not** rebut (the `fuiDemo` iframe is built for rendered FUI components, not headless
  logic/proof conformance; the #899 FUI-side vector-runner is **not built**, so deleting those would
  "replace executable proof with nothing"). That broader call was filed as #1282 and **since ratified**:
  WE = zero implementation is the rule; #1078's tier is withdrawn wholesale; the logic runtimes relocate
  as **gated debt** (epic #1294), so nothing is stranded today.

**Downstream scope change:** #1245 grows from "dedup WE copies to track FUI" → **"delete all WE copies +
re-host the ~14 demos as FUI-hosted (#701) + convert WE unit tests to vectors."** The residual ~20% is
purely the demo re-hosting feasibility/sequencing — #1245's staging problem, not this decision's.

> The 14-retain/2-delete forks + verification above are **superseded** by this reframe and retained for
> audit only. Not yet ratified — awaiting explicit go. Blocks all dedup + drift-gate slices under #1245
> (now re-scoped as above) and amends statute #1078.
