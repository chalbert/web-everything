---
type: issue
workItem: story
size: 1
parent: "757"
locus: frontierui
status: resolved
dateOpened: "2026-06-16"
dateStarted: "2026-06-16"
dateResolved: "2026-06-16"
tags: []
---

# FUI block detail pages: refresh stale not-yet-migrated copy

Every block detail page (`we:src/block-pages.njk`, paginated over all 23 blocks) carries a static "Implementation" section reading: *"Implementation details will appear here once the code is migrated to FrontierUI. For now, the implementation lives in the Web Everything repository."* That is stale — `blocks/` in the FrontierUI repo already contains real implementations (e.g. `fui:background-task-surface/BackgroundTasksElement.ts`). The copy tells every visitor the impl still lives in WE, which is no longer true. Refresh the section to reflect that FrontierUI is the implementation, and ideally link to the actual source path for the block.

## Acceptance

- The "Implementation" placeholder copy no longer claims the code hasn't been migrated.
- Verify against the repo before editing: confirm which blocks actually have on-disk implementations vs. spec-only stubs (the copy may be partly true for a subset) and word accordingly.
- If a per-block source link is cheap, point at the block's directory under `blocks/`.

## Notes

- Pure content fix; smallest slice of the #757 epic.
- Don't assert "all migrated" blindly — a few `fui:blocks.json` entries may still be spec-only; check first.
