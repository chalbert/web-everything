---
kind: story
size: 5
parent: "1483"
status: open
blockedBy: ["1560"]
locus: frontierui
humanGate: { kind: setup, what: "Re-enables the root `window.customElements` swap that previously white-paged plateau (#1387); acceptance requires live-verifying plateau-app (:4000) + WE site (:3000) + FUI demos (:3001) all render with NO `*-is-not-a-function` upgrade crash while OWNING the dev-server lifecycle. A concurrent batch can't restart/recover the user's running servers (don't-kill-dev-server). Needs a focused frontierui session that owns the servers — the same class as #1545." }
dateOpened: "2026-06-22"
tags: []
---

# Re-enable webregistries root customElements swap + live multi-app verification

Uncomment the root window.customElements swap in fui:plugs/webregistries/index.ts:95 (the swap #1387 added that white-paged plateau), now that #1560 lands the root-scope determination path. Live-verify plateau-app + the WE site + FUI demos all render with NO *-is-not-a-function upgrade crash. This is a focused frontierui session that OWNS the dev-server lifecycle — re-enabling a site-crashing swap cannot run safely against the user's live :3000/:4000 in a concurrent batch. Slice B of #1483; blocked by #1560.
