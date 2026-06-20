---
kind: story
size: 3
parent: "1245"
status: resolved
dateOpened: "2026-06-20"
dateStarted: "2026-06-20"
dateResolved: "2026-06-20"
graduatedTo: "fui:demos/view-tabs-demo.html"
relatedProject: webblocks
locus: webeverything
tags: [blocks, duplication, single-source, frontierui, view, tabs, runtime]
---

# Delete we:blocks/{view,tabs} runtime copies — swap WE view-tabs demo to a #701 fuiDemo iframe (FUI canonical)

Slice of #1245 now unblocked (C #1312 landed; fui:demos/view-tabs-demo.html self-bootstraps). Delete we:blocks/view/ and we:blocks/tabs/ per the #1246 elimination ruling; re-host we:demos/view-tabs-demo.html as a #701 fuiDemo iframe pointing at the FUI-hosted demo so the page keeps working after the local runtime is gone.

## Progress (batch-2026-06-20) — DONE

- Deleted `we:blocks/view/` + `we:blocks/tabs/` (the orphaned WE-resident runtime copies). Verified **no
  `.ts` consumer** imported them, and the catalog entries `we:src/_data/blocks/view.json` /
  `we:src/_data/blocks/tabs.json` already point `implementedBy` at the `@frontierui/blocks/view` +
  `@frontierui/blocks/tabs` packages — so the
  standard/spec is unchanged, only the duplicate runtime is gone (#1245/#1246/#1282: WE holds zero
  delivery runtime).
- Re-hosted `we:demos/view-tabs-demo.html` as a #701 fuiDemo iframe shell embedding the FUI-canonical
  `fui:demos/view-tabs-demo.html` (iframe `src` = the `FUI_DEMO_BASE` origin, default `localhost:3001`,
  per the `we:.eleventy.js` fuiDemo shortcode), keeping the WE header chrome + a note; removed the
  now-orphaned `we:demos/view-tabs-demo.css` (styles inlined). The page imported
  the deleted `we:blocks/view/*.ts` + `we:blocks/tabs/*.ts` directly — now it carries no WE runtime.
- Regenerated `we:custom-elements.json` (`npm run gen:cem`). Gate green (0 errors). WE demo page serves
  200 with the iframe → FUI :3001 demo (reachable, 200).
