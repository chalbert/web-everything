---
bornAs: xv0q6fn
kind: story
size: 2
parent: "2489"
status: open
dateOpened: "2026-07-14"
tags: [plateau-loop, console, observability]
---

# Loop console — out-of-console launchd alert when an anomaly persists

Slice E, part 2 of the health & anomaly-detection epic (parent #2489). The console and the CLI both
require someone to be looking; an unattended loop must push OUT when it goes stuck. When an anomaly
(slice E part 1 added the detection + verdict) persists past a threshold, fire a macOS notification (the
daemon runs under launchd — `osascript`/`terminal-notifier` or a launchd-native path) and persist an
alert record so a later `status` shows it prominently, with de-dup so a still-stuck loop does not re-nag
every pass. Unlike part 1 (CLI-only, fresh process), this fires from the RESIDENT daemon
(`plateau:tools/drain-daemon/daemon.mjs`) — so it needs a fresh-context adversarial review panel and a
`plateau:tools/drain-daemon/cli.mjs` restart to activate. Feeds the #2456 evidence gate (how often did the
loop need a human). Impl in plateau-app; WE holds zero impl (this card is the tracker).
