---
kind: story
size: 2
status: open
dateOpened: "2026-07-06"
tags: []
---

# renumber-collisions blindly rewrites surviving items' blockedBy edges when following a yielded id

we:scripts/backlog-renumber-collisions.mjs does a blind '#NNN' text rewrite when a newcomer yields to a free id — but if a SURVIVING item (main's) references the yielded id in its blockedBy or body, the rewrite follows that reference too and clobbers main's real edge. Observed 2026-07-06 finishing #162: running the script during an EDIT+collision merge rewrote main's surviving webprocess edges (2294 blockedBy 2293, 2295 blockedBy 2294, and the #1294 cascade body) to follow the yielded ids; caught and reverted by hand. Distinct facet from #2312 (foreign-file sweep) and #2213 (yield-to-live-id): here the id chosen is free, but the rewrite can't tell 'reference to the yielded newcomer' from 'reference to a surviving item that legitimately used that NNN'. Fix: scope the rewrite to the yielding item's own file + inbound edges that actually pointed at the newcomer, not every textual '#NNN'. Relates #2312, #2213, #2276.
