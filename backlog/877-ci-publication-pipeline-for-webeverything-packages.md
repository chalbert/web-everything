---
type: issue
workItem: story
size: 5
parent: "872"
status: open
blockedBy: ["874"]
dateOpened: "2026-06-17"
tags: []
---

# CI publication pipeline for @webeverything packages

Stand up the CI that publishes @webeverything packages (starting with @webeverything/contracts) on version bump — the piece that makes the publish/version ceremony cheap (per the #834 discussion: 'publication is not that complex with correct CI'). No CI exists yet; lower priority ('no hurry'). Covers version bump, prepublishOnly, provenance, and tag/release wiring. Risk-mitigation story for the #872 epic addressing the publish-ceremony cost.
