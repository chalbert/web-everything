---
kind: story
size: 2
status: resolved
dateOpened: "2026-07-06"
dateStarted: "2026-07-07"
dateResolved: "2026-07-07"
tags: []
---

# renumber-collisions blindly rewrites surviving items' blockedBy edges when following a yielded id

we:scripts/backlog-renumber-collisions.mjs does a blind '#NNN' text rewrite when a newcomer yields to a free id — but if a SURVIVING item (main's) references the yielded id in its blockedBy or body, the rewrite follows that reference too and clobbers main's real edge. Observed 2026-07-06 finishing #162: running the script during an EDIT+collision merge rewrote main's surviving webprocess edges (2294 blockedBy 2293, 2295 blockedBy 2294, and the #1294 cascade body) to follow the yielded ids; caught and reverted by hand. Distinct facet from #2312 (foreign-file sweep) and #2213 (yield-to-live-id): here the id chosen is free, but the rewrite can't tell 'reference to the yielded newcomer' from 'reference to a surviving item that legitimately used that NNN'. Fix: scope the rewrite to the yielding item's own file + inbound edges that actually pointed at the newcomer, not every textual '#NNN'. Relates #2312, #2213, #2276.

## Resolution — duplicate of #2316 (fix already landed)

This item's fix already landed as **#2316** — the byte-identical twin this very collision bug spawned during `batch-2026-07-06-2313-2314` (2314 born, collided, yielded to 2316, then resolved as 2316 while 2314 stayed open). Commit `98b575c9 resolve #2316` scoped the reference sweep in **both** live plan-builders to exclude base-owned / published files: `planRenumber` skips any file in `ontoNames` (we:scripts/backlog/renumber-collisions.mjs) and `planBaseCollisionHeal` skips any file in `baseNames` (we:scripts/lib/nnn-collision-heal.mjs). A surviving/main item is *by definition* a published/base file, so its `#NNN`/`blockedBy` edge — the exact clobber observed above (2294/2295 webprocess edges) — is now left untouched. `planRenumber` is moreover provably safe here: `if (baseSet.has(group.num)) continue` skips every base-owned num wholesale, so a surviving item's edge can never even enter the rewrite. Regression tests exist for both builders (the `EDGE-CLOBBER GUARD (#2316)` cases). The old top-level `we:scripts/backlog-renumber-collisions.mjs` shares this fix — it imports `planRenumber` from the fixed core. **No new code needed; resolving as a duplicate.** (A narrower, unobserved facet — a *lane-authored* file referencing a base *keeper's* num rather than the yielder's — is a distinct case outside this item's "surviving main edges" scope; not filed, as the shipped guard covers every observed mode.)
