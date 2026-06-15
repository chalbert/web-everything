---
type: idea
workItem: story
size: 3
status: open
blockedBy: ["038"]
dateOpened: "2026-06-15"
tags: []
---

# iframe-based component viewer — embed FUI-hosted standard demos in WE docs with FUI branding

A reusable iframe-embed viewer so WE docs pages can surface a frontierui-hosted demo (starting with the #038 component-converter playground) inline next to the matching standard page (e.g. /blocks/component/), without any cross-repo import. The demo keeps FUI branding — it is plainly a frontierui deliverable — and lives only in FUI; WE points an iframe at the FUI dev/published surface. Generalises beyond the converter playground to any FUI demo WE wants to showcase. Ruled out the cross-repo-import alternative in #700 (DC-7): an iframe recovers co-location with the standard page without building a WE→FUI module/fixture import path or standing drift surface.

## Scope

- A small WE-side embed (web component / shortcode) that renders an `<iframe>` pointing at a FUI demo
  URL, with sandbox attrs, a sized/responsive frame, and a visible **FUI-branded** chrome (label/link
  back to the frontierui-hosted demo so provenance is clear).
- Source the demo URL from FUI's dev server (`:3001`) in dev and the published FUI demos surface in prod
  — parameterised, so one viewer serves any demo, not just the converter playground.
- First consumer: embed the #038 component-converter playground on `/blocks/component/`. The demo itself
  stays in `frontierui/demos/` (the #700 ruling); this item only adds the WE-side window onto it.

## Open / to confirm during build

- Exact prod URL contract for FUI demos (is there a stable published demos host yet, or dev-only for now?).
- Whether the FUI branding chrome lives in the WE embed wrapper or inside the FUI demo page itself.

## Blocked by

- **#038** — the converter playground must exist (in `frontierui/demos/`) before there's anything to embed.
  The generic viewer can be built against any existing FUI demo, but the first real consumer needs #038.
