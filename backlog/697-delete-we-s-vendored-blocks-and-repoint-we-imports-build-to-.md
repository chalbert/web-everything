---
type: issue
workItem: story
size: 8
parent: "658"
status: resolved
blockedBy: []
relatedReport: reports/2026-06-16-697-blocks-deletion-cutover-split-analysis.md
dateOpened: "2026-06-15"
dateStarted: "2026-06-17"
dateResolved: "2026-06-17"
graduatedTo: none
tags: []
---

> **Re-scoped 2026-06-16 by [#791](/backlog/791-reconcile-658-697-delete-and-repoint-with-the-604-iframe-bou/)
> = C.** The original "repoint every WE `blocks/…` import → @frontierui/blocks" premise is **struck** —
> that repoint *was* the WE→FUI import seam #707's iframe boundary forbids. The end-state is now: **delete
> WE's block-impl families** (the 9 WE-only families already migrated UP by #694/#695/#696) and **migrate
> their demos to FUI-hosted iframe embeds**; **retain a small reference-runtime `blocks/` subset** — the
> blocks whose demos exercise a WE *standard* (today `stores/simple`, `renderers/jsx`, `view`, `tabs`, per
> the #791 partition rule). **No `frontierui` vite alias, no `@frontierui/blocks` install in WE.**
>
> **Re-scoped again 2026-06-16 (split-analysis, [report](../reports/2026-06-16-697-blocks-deletion-cutover-split-analysis.md)).**
> The #694/#695/#696/#604/#791 blockers are resolved, but applying the #791 rule to the real tree shows
> the cutover is **not yet agent-ready** — two new blockers: **#813** (FUI hosts no demos for the 9
> families → iframe targets 404) and **#812** (unresolved fork: WE apps/straddle demos that *compose* a
> moved impl can't iframe or import). This card is now the **WE-side cutover only**, `blockedBy:[812,813]`,
> re-sized 13→8.

# Delete WE's block-impl families + migrate their demos to FUI iframe embeds; retain the reference-runtime subset (the #604/#707 client cutover)

S3 of #658, re-scoped to #791 = C. **No longer a "repoint imports" card** — WE does not import
`@frontierui/blocks` at any tier (#707 iframe boundary). Two moves: **(1)** delete WE's vendored
**block-impl** families (the 9 WE-only families graduated UP by #694/#695/#696) and replace each
block-impl demo with a FUI-hosted **iframe embed** (the existing `fuiDemo` mechanism, iframe → #765
in-document later); **(2)** retain only the **reference-runtime** `blocks/` subset — blocks whose demos
exercise a WE *standard* (apply the #791 partition rule to finalize the keep-list; concrete keepers today:
`stores/simple` → declarative-spa, `renderers/jsx` → jsx-*, `view`+`tabs` → custom-events). Apply the
rule across the **41** `/demos/*` that import `/blocks/…` (`grep -rlE "blocks/" demos/`, 2026-06-16, incl.
the `loan-origination/` + `auto-insurance/` exercise apps).

**Finalized partition** (output of applying the #791 rule — see the
[split-analysis report](../reports/2026-06-16-697-blocks-deletion-cutover-split-analysis.md)):

- **MOVE (delete from WE):** `audit`, `background-task-surface`, `data-grid` (+`renderers/data-grid`),
  `lifecycle`, `master-detail`, `selection`, `stepper`, `tree-select`, `type-ahead`.
- **STAY (reference-runtime):** `stores/simple`, `renderers/jsx`, `view`, `tabs`, **plus nearly all other
  `renderers/*`** (`component`, `data-table`, `pagination`, `reorderable-list`, `module-service`,
  `upgrader`, `audit-timeline`, `decision-trace`, `status-indicator`, …), `wizard`, `workflow-engine`,
  `resource-loader`, `data-transfer` — every family whose demo exercises a WE *standard*.

**Split 2026-06-17 (grounding pass) — this card is now the agent-ready 4-family half only.** Grounding
against both trees found two corrections to the premise: (1) **no cross-family source imports exist among
the 9** (`grep` returns zero edges — the "9 come out together / not batchable" claim was false; the real
partition is by *consumer*); (2) **5 of the 9 are blocked** — `audit`, `lifecycle`, `master-detail`,
`stepper`, `tree-select` are composed as classes by the two active exercise-app epics (#317/#318), which
have **no FUI home** yet (the #812 Fork-1(a) execution was unfiled). So the deletion splits cleanly along
the blocker:

- **This card (#697) — the 3 genuinely-free families:** delete `type-ahead`, `background-task-surface`
  (+ its 6 traits/fixtures), `data-grid` (+ `renderers/data-grid`); swap the 2 standalone block-impl demos
  (`background-task-surface-demo`, `data-grid-demo`) to `fuiDemo` iframes of the FUI-hosted demos (#813);
  **decouple `loader-background-handoff`** onto the escalation-event contract per #812 Fork-2(d) (real
  `ResourceLoader` → `background-task-register` event → minimal reference receiver, not the moved surface) —
  this also requires **relocating the handoff-contract types** (`LoaderSnapshot`, `LoaderStateHandle`,
  `BackgroundTaskRegisterDetail`, `BackgroundTaskDismissDetail`) out of `background-task-surface/types.ts`
  into the producer (`resource-loader`), since `resource-loader/backgroundHandoff.ts` type-imports them and
  STAYS; `durable-tier-verification` → `fuiDemo` iframe (#791 block-impl demo, SW on FUI origin); de-register
  `type-ahead`/`data-grid` from `plugs/bootstrap.ts` (+ stale comment refs in `traitManifest.ts` /
  `tools/trait-enforcer`); drop their `blocks.json` / `custom-elements.json` / block-description `.njk`
  entries; update the `registered-behaviors-bootstrap` e2e + fixture (drop the `type-ahead` case). Leave the
  reference-runtime subset untouched.
- **#824 — the 6 app-coupled families** (`audit`/`lifecycle`/`master-detail`/**`selection`**/`stepper`/
  `tree-select`): deferred, **`blockedBy: [823]`**. `selection` is here (not #697) because
  `master-detail/MasterDetailBehavior.ts` imports `../selection/SelectionBehavior` — pinned until the apps move.
- **#823 — the blocker** (`locus: frontierui`): move the two exercise apps to FUI (#812 Fork-1(a) exec).

**The correct blocker chain:** `#697` (this, 3 free families, agent-ready now) ∥ `#824` (6 families) →
`blockedBy #823` → (the apps get a FUI home). **`#823` is what blocks the rest.**

## Progress

- **Status:** RESOLVED 2026-06-17 — **all 3 free families deleted + verified** (`type-ahead`, `data-grid`,
  `background-task-surface`). Gates green: **3016 vitest pass, check:standards 0 errors, 11ty dryrun clean**,
  and the decoupled `loader-background-handoff` demo passes **4/4 invariants in real Chromium, 0 console
  errors**. The 6 app-coupled families remain in **#824** (`blockedBy #823` — the FUI app-move). (Grounding
  against both trees found the card only partially agent-ready → split into the #823/#824 blocker DAG.)
- **Done (2026-06-16):** Applied the #791 partition rule to the real tree (41 demos, 26 WE families vs FUI's).
  Finalized keep-list (reference-runtime subset is much larger than the 4 named keepers — nearly all
  `renderers/*` stay). Wrote [reports/2026-06-16-697-blocks-deletion-cutover-split-analysis.md](../reports/2026-06-16-697-blocks-deletion-cutover-split-analysis.md).
  Filed **#812** (B3 fork) + **#813** (B1 FUI-hosting); narrowed this card to the WE-side cutover, re-sized 13→8.
- **Grounding finding (2026-06-17, this session) — two corrections to the split-analysis premise:**
  1. **The "9 come out together / not batchable" coupling claim is false at import level.** `grep` for
     cross-family imports among the 9 returns **zero edges** (no `master-detail → selection`, no
     `audit → lifecycle`). The real partition is by **consumer**, not intra-family deps.
  2. **5 of the 9 are blocked by an *unfiled* prerequisite.** `audit, lifecycle, master-detail, stepper,
     tree-select` are composed as classes by `loan-origination` (#317) + `auto-insurance` (#318) — **both
     `status: active` epics**. #812 ratified Fork-1(a) "move the apps to FUI," but **FUI hosts neither app**
     (`frontierui/demos/` has the 3 standalone demos from #813 but no app), and the **Fork-1(a) execution**
     (host the 2 apps + bring up their 5 renderer-impl families `renderers/{audit-timeline,data-table,
     decision-trace,pagination,status-indicator}`) was **never filed**. So the app-coupled deletion cannot
     complete today.
  3. **The other 4 families ARE unblocked now:** `selection` (no code consumer — only metadata/`.njk`),
     `type-ahead` (only `plugs/bootstrap.ts` registration), `background-task-surface` (3 demos: 2 → `fuiDemo`
     iframe of FUI-hosted demo, `loader-background-handoff` → decouple per #812 Fork-2(d)), `data-grid`
     (demo → `fuiDemo` iframe; also wired into `plugs/webbehaviors/traitManifest.ts` + `tools/trait-enforcer`).
- **Decision (2026-06-17): B — split + do the agent-ready half now.** Filed **#823** (`locus: frontierui`
  epic — move the 2 apps to FUI, #812 Fork-1(a) exec) as the real blocker, and **#824** (story, the
  app-coupled 5-family deletion, `blockedBy: [823]`). #697 re-scoped to the 4 unblocked families.
- **Correction (2026-06-17):** relative-path-aware grep found `selection` is imported by `master-detail`
  (`MasterDetailBehavior.ts:11` → `../selection/SelectionBehavior`); master-detail is deferred (app-coupled),
  so **`selection` moves to #824**. #697's free set is **3 families**: `type-ahead`,
  `background-task-surface`, `data-grid`. Also found the `resource-loader` (STAY) → `background-task-surface`
  (MOVE) type edge in `backgroundHandoff.ts` — the #812 Fork-2(d) decouple relocates the contract types.
- **Done (2026-06-17, this session):** ✅ **`type-ahead` deleted** — byte-verified vs FUI (#170), removed
  `blocks/type-ahead/` + its unit test, de-registered from `plugs/bootstrap.ts`, retired the `type-ahead`
  case from the `registered-behaviors-bootstrap` e2e + fixture (nav:list retained as the registry proof),
  `blocks.json` contract left pointing to FUI. **Gates green: 3144 vitest tests pass, check:standards 0 errors.**
- **Done (2026-06-17, this session):** ✅ **`data-grid` deleted + demo swapped** — byte-verified vs FUI
  (#170), removed `blocks/data-grid/` + `blocks/renderers/data-grid/` + 4 unit tests + 2 e2e bootstrap specs
  + 2 e2e fixtures + the 3 `data-grid-demo.{html,css,ts}` files; added `fuiDemo` field to the data-grid
  block in `blocks.json` (→ FUI-hosted `data-grid-demo.html`, the #813 target) so the block page renders
  the iframe; spliced the `data-grid-demo` entry out of `demos.json`; de-registered both behaviors from
  `plugs/bootstrap.ts`. **Gates: 3046 vitest pass, 11ty dryrun clean, check:standards 0 errors mine**
  (the lone red is concurrent untracked #822's `[[wiki-link]]` — stepped over per gate-red-scoped rule).
  *Minor leftover:* `tools/trait-enforcer/__tests__` + `traitManifest.ts:28` reference `/blocks/data-grid/
  traits/Sortable` as illustrative string fixtures (transform test, not file-resolved — passes); now point
  at a deleted path → cosmetic doc-rot, candidate cleanup, not blocking.
- **Remaining — `background-task-surface` (the #812 Fork-2(d) standards decouple, NOT yet done):**
  (1) relocate handoff-contract types into `resource-loader` +
  sever `backgroundHandoff.ts`'s type-dep on the surface; (2) decouple the `loader-background-handoff` demo
  onto a minimal reference receiver per Fork-2(d); (3) swap `background-task-surface-demo` + `data-grid-demo`
  + `durable-tier-verification` to `fuiDemo` iframes; (4) delete `type-ahead`, `background-task-surface`,
  `data-grid` (+`renderers/data-grid`) + their tests; (5) de-wire bootstrap/traitManifest/trait-enforcer +
  registries (`blocks.json`, `custom-elements.json`, `.njk`) + the `registered-behaviors-bootstrap` e2e;
  (6) gates (vitest + check:standards + 11ty smoke).
