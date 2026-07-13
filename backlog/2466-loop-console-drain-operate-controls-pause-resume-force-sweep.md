---
bornAs: x9amggn
kind: story
size: 5
parent: "2474"
status: resolved
dateOpened: "2026-07-12"
dateStarted: "2026-07-13"
dateResolved: "2026-07-13"
tags: []
---

# Loop console: drain operate controls — pause / resume / force-sweep / skip + policy surface

Operate the drain from the panel: pause, resume, force a sweep, skip a couple, hold/release the lease; plus the drain policy surface (merge-anyway timeout, run-tooling-last, escalation relief).

## Resolution (2026-07-13) — v1 (pause/resume + policy surface)

Shipped in plateau PRs #27 + #28: operator **pause / resume** for the resident drain daemon and a read-only **policy & config** surface in the `plateau:tools/dev-panel/drain-daemon.html` surface.

- **Pause/resume:** `pause` writes a `plateau:.drain-daemon/paused` flag; the daemon loop (`plateau:tools/drain-daemon/daemon.mjs`) checks it **after** acquiring the drain lease, so a paused daemon still HOLDS the lease — the queue is frozen and the sole-writer guarantee holds even across a launchd restart (the #28 fix, from a fresh-panel finding that the original placement dropped the lease on a restart-while-paused). CLI `pause`/`resume` + dev-panel buttons + a paused badge; `status` reports `paused`.
- **Policy surface:** a pure `describeDaemonPolicy(cfg)` (`plateau:tools/drain-daemon/lib.mjs`) folded into `buildStatusReport` — the resolved config (pass interval, max backoff, pass timeout, heartbeat, 15-min drain-lease TTL, WE clone) plus the drain policy (impl-first/WE-last couple ordering, cross-item blockedBy ordering, single sole-writer-to-main lease, review:* PRs parked never auto-cleared).

**Verified live:** paused the running daemon, observed `paused — skipping sweeps until resumed` in the journal a cycle later, then `resume` → `resumed — sweeping`. A fresh adversarial panel reviewed the resident-loop change before land.

**v1 scope.** `force-sweep` (marginal — the daemon already sweeps every 60s) and `skip-a-couple` (better placed as an unlabel action on the queue board, [#2471](/backlog/2471-loop-console-queue-lease-board-live-merge-queue-blockedby-ed/)) were deliberately deferred out of v1.
