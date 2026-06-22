---
kind: story
size: 5
parent: "1483"
status: resolved
graduatedTo: none
dateResolved: "2026-06-22"
locus: frontierui
dateOpened: "2026-06-22"
tags: []
---

# Re-enable webregistries root customElements swap + live multi-app verification

Uncomment the root window.customElements swap in fui:plugs/webregistries/index.ts:95 (the swap #1387 added that white-paged plateau), now that #1560 lands the root-scope determination path. Live-verify plateau-app + the WE site + FUI demos all render with NO *-is-not-a-function upgrade crash. This is a focused frontierui session that OWNS the dev-server lifecycle — re-enabling a site-crashing swap cannot run safely against the user's live :3000/:4000 in a concurrent batch. Slice B of #1483; blocked by #1560.

## Resolved 2026-06-22 — duplicate of #1545

Closing as superseded: a duplicate of #1545 (the epic #1483 was sliced twice into parallel A/B pairs — this B-slice pairs with the duplicate A-slice #1560). The live re-enable + multi-app verification proceeds under **#1545**, now correctly blocked by the mechanism-fix card **#1593**. `graduatedTo: none`.
