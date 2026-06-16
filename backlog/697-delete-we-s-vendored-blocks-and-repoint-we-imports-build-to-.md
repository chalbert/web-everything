---
type: issue
workItem: story
size: 8
parent: "658"
status: open
blockedBy: ["812", "813"]
relatedReport: reports/2026-06-16-697-blocks-deletion-cutover-split-analysis.md
dateOpened: "2026-06-15"
dateStarted: "2026-06-16"
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

**WE-side cutover (this card, once unblocked):** delete the 9 MOVE families from `blocks/`; swap the
standalone block-impl demos (`background-task-surface-demo`, `data-grid-demo`) to `fuiDemo` iframes of
the FUI-hosted demos (#813); handle the moved-impl-composing artifacts per the #812 ruling; leave the
reference-runtime subset untouched. The 9 come out **together** (intra-`blocks/` deps couple
`selection`/`type-ahead` to the rest). `size 8`, not batchable as one.

## Progress

- **Status:** open, `blockedBy:[812,813]` (split-analysis re-scope done 2026-06-16; not agent-ready until
  both blockers land).
- **Done:** Applied the #791 partition rule to the real tree (41 demos, 26 WE families vs FUI's). Finalized
  keep-list (reference-runtime subset is much larger than the 4 named keepers — nearly all `renderers/*`
  stay). Wrote [reports/2026-06-16-697-blocks-deletion-cutover-split-analysis.md](../reports/2026-06-16-697-blocks-deletion-cutover-split-analysis.md).
  Filed **#812** (B3 fork) + **#813** (B1 FUI-hosting); narrowed this card to the WE-side cutover, re-sized 13→8.
- **Next:** resolve **#812** (the consumption fork — highest leverage) and land **#813** (FUI hosts the
  demos); then this cutover is agent-ready — delete the 9 MOVE families together + swap demos to `fuiDemo`.
