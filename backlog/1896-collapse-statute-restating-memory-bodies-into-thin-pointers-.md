---
kind: story
size: 3
status: open
blockedBy: ["1894"]
dateOpened: "2026-06-27"
tags: [memory, statute, reconciliation]
---

# Collapse statute-restating memory bodies into thin pointers (one-at-a-time)

Sub-task 3 of the memory statute-citation reconciliation, carved out of #1894 (which delivered the
codification + the additive citation pass). Now that STD/MON/ARCH leaves carry a `Codified:` footer pointing
at their `we:docs/agent/platform-decisions.md#anchor` statute, the remaining polish is to **collapse the leaf
bodies that merely restate that statute** down to a thin pointer (header + `Codified:` line), reclaiming
index/recall weight. **Bulk is unsafe and explicitly out of scope** — verification during #1893 already
caught one over-classification, and #1881 found *most* memories carry nuance beyond the canon, so the safe
finding is that **few** files qualify. Work it **one file at a time**: for each leaf with a `Codified:`
footer, diff the body against the cited statute section; collapse only when the body adds *nothing* the
statute doesn't already say; otherwise keep it (the nuance is the point). Candidates to screen first are the
14 leaves cited by #1894 (`#1`/`#2`/`#4`/`#5` monetization, `#75`/`#78`/`#83`/`#86`/`#89`/`#93`/`#123` STD,
`#29`/`#87`/`#97` newly-codified). Lineage: #1894, #1893, #1868, #1855, #1881.
