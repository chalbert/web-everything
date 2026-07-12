---
bornAs: xql36r5
kind: story
size: 3
parent: "2445"
status: resolved
dateOpened: "2026-07-12"
dateStarted: "2026-07-12"
dateResolved: "2026-07-12"
tags: []
---

# Surface the drain daemon in the dev-panel — status, pass history, and controls in the dev browser

The #2449 phase-1 drain daemon is headless (plateau:tools/drain-daemon/cli.mjs status|logs|once|stop + launchd). Give it a dev-panel surface in plateau-app so the operator starts, stops, and monitors it from the dev browser — the operator wants this SOON (2026-07-12): it is the short-term step toward the Plateau Loop integrated-solution goal (epic #2445 DoD: gating/review/drain operable from a UI). Read plateau:.drain-daemon/state.json + plateau:.drain-daemon/history.jsonl: show residency/lease holder, last pass result, pass history, and the parked review:* PRs waiting on a human; start/stop/once controls via the existing dev-panel UI-to-CLI bridge (plateau:tools/dev-panel/, the proven pattern). Impl lives in plateau-app (WE holds zero impl — this card is the tracker). Does NOT depend on the deferred #2446 placement call: the dev-panel and daemon are co-hosted today, and the surface reads files/CLI, so it moves with them if placement later changes.

## Resolution (2026-07-12)

Delivered in plateau-app (impl PR plateau#21, same-named `lane/2454-devpanel-daemon-surface` refs):
the `plateau:tools/dev-panel/drain-daemon.html` page (served at the demos drain-daemon route) on every dev server consuming the dev-panel plugin — plateau `:4000` (the
plugin is now in plateau's own vite config too), WE `:3000`, FUI `:3001`. Residency + lease badges,
counters, parked `review:*` PRs (`review:human` flagged), recent-pass history, and start/stop/once/
dry-run controls. The bridge shells `plateau:tools/drain-daemon/cli.mjs` (new `status --json`, composed
by the pure `buildStatusReport` in `plateau:tools/drain-daemon/lib.mjs`, unit-tested) — one composer for
terminal and browser, so they can never disagree; install/uninstall stay terminal-only by design.
Verified live on a lane dev server; plateau vitest 787 green.
