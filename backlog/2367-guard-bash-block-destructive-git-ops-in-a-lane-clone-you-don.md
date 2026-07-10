---
kind: story
size: 3
status: resolved
dateOpened: "2026-07-09"
dateStarted: "2026-07-09"
dateResolved: "2026-07-10"
tags: []
---

# guard-bash: block destructive git ops in a lane clone you don't own

we:scripts/guard-bash.mjs must deny a destructive git op (reset --hard, clean -fd, checkout -- ., force-push) run with cwd inside a .lanes/<repo>/lane-N/ clone whose live lane-lease is held by another session — the hole behind a 2026-07-09 incident where a /slice ran git reset --hard in a lane a concurrent session had just leased (the acquire correctly refused, but the ;-chained reset ran regardless and clobbered the peer's clone). Reuse the existing isLaneClone helper plus we:scripts/lib/lane-lease.mjs; determine ownership without a session-id by testing whether the leaseholder pid is in the guard process's ancestry (my lease then allow; another live leaseholder then deny with an escape env such as LANE_CLOBBER_OK=1). Stale or absent lease then allow.
