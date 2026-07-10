---
kind: epic
status: resolved
dateOpened: "2026-07-05"
dateResolved: "2026-07-10"
graduatedTo: none
tags: []
---

# Prevent NNN collisions structurally: drain-only writer + JIT numbering (keep self-heal as backstop)

Shift backlog-ID collision handling from reactive healing to structural prevention. Root cause: #2189 dropped the /workflow disjoint-partition, so parallel lanes now race on max+1 at creation time. Fix in two ordered slices: (1) make the drain the sole writer to main — deprecate /pr self-land and /merge direct-merge into enqueue-and-drain; (2) have the drain assign the NNN just-in-time at land from a collision-free hash placeholder, rewriting blockedBy, parent and short refs. Duplicate-NNN then becomes unrepresentable. The existing self-heal tower (#2071, #2181, #2213, #2222, #2276, #2248) is NOT deleted — it is demoted to a dormant backstop plus a tripwire that should never fire once JIT lands.

**Children:** #2290 (drain-only, prereq) → #2288 (JIT numbering) → #2291 (demote self-heal to backstop). Plus **#2292** — an *interim* cheap stopgap (random-free allocation instead of max+1) that cuts collision probability *now* while the structural fix is built; it is superseded once #2288 lands.

**Backstop already in flight:** the drain-side self-heal (#2222) is implemented as **PR #151**, parked `review:human` — it should land as the interim/backup layer (immediate protection), then have its now-dead `/pr` + `/merge` wiring pruned by #2291. This epic is the prevention direction a concurrent drain session deliberately left unfiled; it is now filed here (no duplicate).
