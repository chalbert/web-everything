---
type: issue
workItem: story
size: 3
status: open
blockedBy: ["763"]
dateOpened: "2026-06-16"
tags: []
---

# Mirror the rendered-site a11y gate into Frontier UI (:3001)

Mirror the #770 axe-core/playwright gate into the frontierui repo so the FUI site (:3001) gets the same WCAG 2.1 A/AA rendered-page coverage, with its own hand-maintained route allowlist. Same warn→enforce ratchet posture. Follows the duplicated-dev-panel mirroring pattern (the gate in this repo natively covers only WE-docs). Ratified in #763 fork 3 = mirrored per-repo.
