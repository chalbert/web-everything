---
kind: story
size: 3
status: open
blockedBy: ["2337"]
dateOpened: "2026-07-09"
tags: []
---

# Gate lane-pool --force against a live lease (implement #2337 ruling)

Implement the #2337 ruling (fork b): --force overrides dirty/ahead but must not silently stomp a LIVE lease. (1) Cover all three forced entry points — refresh/provision AND acquire --force. (2) refresh/provision --force skip a live-leased lane with a loud log (never reset it); free-but-dirty lanes still recycle. acquire --lane=N --force on a live-leased lane hard-fails, pointing at 'release --force'. (3) No new flag — the deliberate override reuses existing release --force. Flip the characterization test in we:scripts/__tests__/lane-pool-refresh-guard.test.mjs ('--force DOES eat a leased lane's untracked work') to assert the work now SURVIVES, and add the acquire --force case.
