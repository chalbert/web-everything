---
type: idea
workItem: story
size: 5
status: open
dateOpened: "2026-06-20"
tags: []
---

# Sweep the stale blockedBy edges (items marked blocked whose blockers all resolved)

The new stale-block gate guard (`we:scripts/check-standards.mjs`) surfaced ~16 items marked blocked whose `blockedBy` targets are ALL resolved — the block is stale, the item no longer actually gated. Each needs the same per-item triage the #1210 fix used: START it (the prerequisite genuinely landed) or RE-POINT `blockedBy` at the real remaining open dependency (filing it if missing), then clear `childlessReason: blocked` where it no longer applies. Re-derive the live set from the gate at work-time (concurrent sessions shift it); as of filing: #1162 #1184 #1186 #1194 #1222 #1030 #1047 #1083 #1137 #1153 #912 #953 #866 #798 #479 #487.

Work it item-by-item (each is a small independent re-point/start with its own judgment call) rather than one blind pass.
