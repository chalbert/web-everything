---
type: issue
workItem: story
size: 2
parent: "192"
status: open
blockedBy: ["476"]
dateOpened: "2026-06-13"
tags: []
---

# Research-freshness staleness derivation + warn-only check + reader badge

Slice B of the research-freshness ruling (#441), blocked by #476. Derive stale state from lastReviewed + reviewHorizon with the RFC 5861 grace band (stale-while-shown: past the horizon a topic is flagged for re-review, not hidden). Add a warn-only check:standards rule beside the registry checks (scripts/check-standards.mjs ~L156) — never a CI error. Surface the reader-facing freshness badge on the /research/ card grid and topic pages. Global reviewHorizon fallback applies when a topic declares none.
