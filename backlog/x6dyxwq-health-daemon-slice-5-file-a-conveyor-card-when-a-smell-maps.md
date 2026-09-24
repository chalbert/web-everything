---
kind: story
size: 5
parent: "xqmw8g9"
status: open
blockedBy: ["xev8pnf", "xv71n7k"]
scope: ["we:scripts/conveyor/health-file-request.mjs", "we:scripts/operations/health-file-request-land.mjs", "we:scripts/conveyor/health-watch-core.mjs"]
dateOpened: "2026-09-24"
tags: [health-daemon]
---

# Health daemon slice 5: turn a finding into an uncleared card through a filing request

Fifth slice of xev8pnf (Fork 5, default flipped by the skeptic round). The health process never files from
its own clone and never clears readiness:

- When an episode's smell carries a known-fix template, or the investigation names a concrete product
  change, the process writes a **filing request** (title, digest, scope, size, episode id) into the episode
  report and a request ledger under its state root.
- A **lane-bound declared operation** lands each request the normal way: lease a lane, run
  we:scripts/operations/file-item.mjs with `--queue=false`, verify, open a PR. The daemon clone stays clean
  (a dirty clone freezes self-update, #resident-daemon-reload-lifecycle clause 4).
- The card arrives **uncleared**; it is cleared through the normal readiness path. A card scoped to daemon
  code is never auto-cleared (x4g5os9 rules how those are built).
- Dedup: the ledger maps (smell, subject) → request → card; at most 3 requests a day; no landing while a
  lane-starvation episode is open.
- Stays off in `shadow` until the operator turns filing on.

## Done when

1. **Executable** — tests prove: a second request for the same (smell, subject) is deduplicated; the landing
   operation passes `--queue=false`; nothing is written to the daemon clone's working tree.
2. **Live proof** — one real request lands as an uncleared card through a PR, linked from its episode report.
