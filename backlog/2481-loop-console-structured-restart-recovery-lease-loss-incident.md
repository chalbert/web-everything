---
bornAs: xppmee9
kind: story
size: 2
parent: "2474"
status: resolved
dateOpened: "2026-07-13"
dateStarted: "2026-07-13"
dateResolved: "2026-07-13"
tags: []
---

# Loop console: structured restart-recovery & lease-loss incident markers

Emit daemon restart and lease-loss as structured, timestamped records (an incidents.jsonl) so the incident timeline shows each as its own event — today they live only in the unstructured daemon.log, so #2473 shows a restart COUNT but not per-event rows.

Follow-up to [#2473](/backlog/2473-loop-console-incident-timeline-drain-class-incidents-restart/). The shipped incident timeline derives incidents from the daemon's pass journal (`plateau:.drain-daemon/history.jsonl`) — it shows drain-fails, dup-NNN, lease-contention, and a restart COUNT from `state.starts`, but NOT each **restart-recovery** or **lease-loss** as its own timestamped row, because those events are written only to `plateau:.drain-daemon/daemon.log` (unstructured text).

Emit them as structured records instead: on daemon startup a `restart` record, and in the heartbeat lease-reclaim branch (`plateau:tools/drain-daemon/daemon.mjs` — "lease was reclaimed away") a `lease-loss` record, appended to a new `plateau:.drain-daemon/incidents.jsonl` (kept SEPARATE from `history.jsonl` so the pass-entry consumers — `parsePassResult`/`updateStateAfterPass` — are untouched). Then `deriveIncidents` (`plateau:tools/drain-daemon/lib.mjs`) merges both sources so the dev-panel timeline shows each restart/lease-loss with its timestamp; the dev-panel already renders the incident list.

Touches the resident daemon loop (startup + heartbeat branches) — small and additive, but it needs the daemon reinstalled to take effect, so it warrants the fresh-panel review before landing. Enriches the [#2456](/backlog/2456-review-the-drain-daemon-s-first-weeks-of-operating-evidence/) operating-evidence review. Impl lives in plateau-app (WE holds zero impl — this card is the tracker).

## Resolution (2026-07-13)

Shipped in plateau PR #30: the daemon now emits structured `restart` and `lease-loss` records to `plateau:.drain-daemon/incidents.jsonl` (kept separate from the pass-record `plateau:.drain-daemon/history.jsonl`), and `deriveIncidents` (`plateau:tools/drain-daemon/lib.mjs`) merges them into the incident timeline so each restart / lease-loss shows as its own timestamped row (previously only a restart COUNT). **Verified live:** restarted the daemon and its own restart record appeared in `status --json` incidents (`type: restart, "daemon (re)started"`). A fresh adversarial panel confirmed the best-effort emit cannot throw into the daemon, double-count `starts`, or pollute `history.jsonl`.
