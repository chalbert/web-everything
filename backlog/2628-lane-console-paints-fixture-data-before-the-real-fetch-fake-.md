---
bornAs: x3q09nh
kind: story
size: 3
parent: "2555"
status: open
scope: ["plateau-app:src/main.ts", "plateau-app:src/backlog-view/"]
dateOpened: "2026-07-23"
tags: []
---

# Lane console paints fixture data before the real fetch (fake-data flash; sticks forever on a quiet backlog)

CONFIRMED. `plateau-app:src/main.ts:757` `tryMountLaneBoard` calls `mountLaneBoard(mount)` with no data args, so it paints baked-in fixtures synchronously before any fetch — `BOARD` (`plateau-app:src/backlog-view/lane-board.ts:452`), `POOL` (`plateau-app:src/backlog-view/lane-board.ts:514`), `READY` (`plateau-app:src/backlog-view/lane-board.ts:524`), pulled in as default params at `plateau-app:src/backlog-view/lane-board.ts:768-781`. Real operators briefly see fake lanes/cards (e.g. #2250–#2258 "Seed brand palette"). Then `refreshBoard` (`plateau-app:src/main.ts:759`) + a 4s poll (`plateau-app:src/main.ts:763`, #2519) swap in real `/api/backlog` data.

CAVEAT: `plateau-app:src/main.ts:745` only upgrades when live data is non-empty, so on a genuinely quiet backlog the fixture STAYS painted indefinitely — an operator with a clean queue sees fake lanes forever, not an empty board.

Fix: initialize the board to an empty state plus a real skeleton/loading state instead of the fixture, and unconditionally replace it once the fetch resolves (including with an empty result). Keep `BOARD`/`POOL`/`READY` only as explicit fixtures for the offline state gallery, never as the live first paint.
