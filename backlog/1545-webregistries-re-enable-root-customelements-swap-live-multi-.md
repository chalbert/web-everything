---
kind: story
size: 3
parent: "1483"
status: open
locus: frontierui
blockedBy: ["1544"]
humanGate: { kind: setup, what: "Re-enables the root `window.customElements` swap that previously white-paged the plateau site; acceptance requires live-verifying plateau-app (:4000) + WE site (:3000) + FUI demos render with no upgrade crash while OWNING the dev-server lifecycle. A concurrent batch can't restart/recover the user's running :3000/:4000 (don't-kill-dev-server). Needs a focused session that owns the servers — the reason 4 prior batch pre-flights declined it." }
dateOpened: "2026-06-22"
tags: []
---

# webregistries — re-enable root customElements swap + live multi-app verification

Uncomment the root redefine(window, 'customElements', new CustomElementRegistryImpl()) in fui:plugs/webregistries/index.ts (~line 95); live-verify plateau-app (:4000) + WE site (:3000) + FUI demos render with no *-is-not-a-function upgrade crash, owning the dev-server lifecycle (the reason 4 batch pre-flights declined it). WE-site clean read may need anchor bug #1503 fixed first. No we:plugs byte-replicate — #1047 deleted that copy; the fix is FUI-only now. Blocked by the #1544 determination path being implemented + unit-proven.
