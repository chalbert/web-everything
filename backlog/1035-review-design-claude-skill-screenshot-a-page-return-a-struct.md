---
type: idea
workItem: story
size: 3
parent: "1033"
blockedBy: ["1034"]
status: open
dateOpened: "2026-06-19"
tags: []
---

# /review-design Claude skill — screenshot a page, return a structured critique

Interactive devtool (.claude/skills/): Playwright-screenshot the page on the running dev server -> the skill (Claude is vision-capable, Reads the PNG natively) critiques it against the #1034 rubric -> structured result. No API key/SDK/provider seam needed (that machinery is for headless at-volume labeling). Zero lock-in devtool. TO DISCUSS sequencing/rubric dep.
