---
type: idea
workItem: task
parent: "940"
status: open
dateOpened: "2026-06-18"
tags: []
---

# Rich-text-editor demo + Playwright e2e harness (engine switcher)

Foundational shared fixture for the #940 engine adapters: a FUI demo page exercising <rich-text-editor> with an engine="" switcher, plus a Playwright spec verifying real contenteditable selection/format on the native engine (happy-dom can't do selection/range). Each engine slice extends this switcher + adds an e2e assertion.
