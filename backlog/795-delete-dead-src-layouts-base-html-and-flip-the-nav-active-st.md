---
type: issue
workItem: story
size: 2
status: resolved
blockedBy: ["772"]
dateOpened: "2026-06-16"
dateStarted: "2026-06-16"
dateResolved: "2026-06-16"
tags: []
---

# Delete dead src/_layouts/base.html and flip the nav active-state lint to enforce

The cleanup rung of the #772 static a11y lint. `src/_layouts/base.html` is dead (no `layout: base.html` references — all 28 pages use base.njk) and still carries a 7-link nav with no `aria-current` (a #762-class miss the #772 lint warns on). Delete the dead layout, then flip `NAV_ACTIVE_STATE_ENFORCED` to `true` in scripts/check-standards-rules.mjs so the nav active-state rule becomes build-blocking — base.njk already wires aria-current, so once base.html is gone the rule is green and the regression class hard-fails going forward.

## Progress
- Verified `src/_layouts/base.html` dead (no `layout: base.html` references; all pages use base.njk) → `git rm`.
- Flipped `NAV_ACTIVE_STATE_ENFORCED` to `true` in `scripts/check-standards-rules.mjs` (+comment); the flag-aware unit test stays green either way.
