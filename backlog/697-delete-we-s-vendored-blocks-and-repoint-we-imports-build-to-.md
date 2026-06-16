---
type: issue
workItem: story
size: 8
parent: "658"
status: open
blockedBy: ["694", "695", "696", "604"]
dateOpened: "2026-06-15"
tags: []
---

> **Re-scoped 2026-06-16 by [#791](/backlog/791-reconcile-658-697-delete-and-repoint-with-the-604-iframe-bou/)
> = C.** The original "repoint every WE `blocks/…` import → @frontierui/blocks" premise is **struck** —
> that repoint *was* the WE→FUI import seam #707's iframe boundary forbids. The end-state is now: **delete
> WE's block-impl families** (the 9 WE-only families already migrated UP by #694/#695/#696) and **migrate
> their demos to FUI-hosted iframe embeds**; **retain a small reference-runtime `blocks/` subset** — the
> blocks whose demos exercise a WE *standard* (today `stores/simple`, `renderers/jsx`, `view`, `tabs`, per
> the #791 partition rule). **No `frontierui` vite alias, no `@frontierui/blocks` install in WE.** All
> blockers (#604/#707, #694, #695, #696, #791) are now resolved — ready to re-slice under #658.

# Delete WE's block-impl families + migrate their demos to FUI iframe embeds; retain the reference-runtime subset (the #604/#707 client cutover)

S3 of #658, re-scoped to #791 = C. **No longer a "repoint imports" card** — WE does not import
`@frontierui/blocks` at any tier (#707 iframe boundary). Two moves: **(1)** delete WE's vendored
**block-impl** families (the 9 WE-only families graduated UP by #694/#695/#696) and replace each
block-impl demo with a FUI-hosted **iframe embed** (the existing `fuiDemo` mechanism, iframe → #765
in-document later); **(2)** retain only the **reference-runtime** `blocks/` subset — blocks whose demos
exercise a WE *standard* (apply the #791 partition rule to finalize the keep-list; concrete keepers today:
`stores/simple` → declarative-spa, `renderers/jsx` → jsx-*, `view`+`tabs` → custom-events). Apply the
rule across the **41** `/demos/*` that import `/blocks/…` (`grep -rlE "blocks/" demos/`, 2026-06-16, incl.
the `loan-origination/` + `auto-insurance/` exercise apps). Size 8 — not batchable as one; re-slice under
#658.
