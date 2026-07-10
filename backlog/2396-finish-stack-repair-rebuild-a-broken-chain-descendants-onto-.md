---
kind: story
size: 3
parent: "2387"
status: open
blockedBy: ["2393", "2394"]
dateOpened: "2026-07-10"
tags: []
---

# finish stack-repair: rebuild a broken chain descendants onto the repaired tip

we:scripts/lane-resume.mjs discover reads stackParents/base; a broken link (red CI or review:changes) buckets its overlap-descendants as blocked-on-it; after the link is repaired, rebuild each descendant onto the repaired tip — fast-forward when the fix touched no shared file, exactly one guided conflict per directly-overlapping descendant (resolved WITH the manifest topology) when it did — updating base and resolving each stackParent landed status via bornAs-on-main. NEVER lands a descendant past an unlanded parent. Tests: a mid-chain review:changes repair re-lands the salvageable tail without a blind rebase of the whole batch.
