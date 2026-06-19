---
type: idea
workItem: story
size: 3
parent: "1033"
blockedBy: ["1034"]
status: resolved
dateOpened: "2026-06-19"
dateStarted: "2026-06-19"
dateResolved: "2026-06-19"
graduatedTo: "we:.claude/skills/review-design/SKILL.md"
tags: []
---

# /review-design Claude skill — screenshot a page, return a structured critique

Interactive devtool (.claude/skills/): Playwright-screenshot the page on the running dev server -> the skill (Claude is vision-capable, Reads the PNG natively) critiques it against the #1034 rubric -> structured result. No API key/SDK/provider seam needed (that machinery is for headless at-volume labeling). Zero lock-in devtool. TO DISCUSS sequencing/rubric dep.

## Progress

Authored the interactive devtool `we:.claude/skills/review-design/SKILL.md` — the Tier-C path: Playwright
full-page screenshot of a page on the **running** dev server → `Read` the PNG natively (Claude is
vision-capable in-session, **no** API key / SDK / `registerVisionProvider` seam — that machinery is the
#1082 in-browser VLM for at-volume #489/#490 labeling) → score against the **#1034 design-critique rubric**
(8 closed axes 1–5 + tier-tags + open localized findings `{dimension, elementRef, problem, severity 0–4}`).

Thin per skill-authoring discipline: it **points** at
[`docs/agent/vision-tiers.md → Design-critique rubric (ratified #1034)`](../../docs/agent/vision-tiers.md)
rather than restating the axes. The loop defers Tier-A axes (contrast/targets → #763/#770 a11y gate; token
use → token-lint) per the rubric compute-split (#1034 Fork 2) and owns only the Tier-C judgment + synthesis;
output is advisory (the persisted-label/correction loop is #1036). Sequencing/rubric dep resolved — #1034
ratified the rubric. WE `check:standards` 0 errors; the skill is registered (appears in the skills list).
