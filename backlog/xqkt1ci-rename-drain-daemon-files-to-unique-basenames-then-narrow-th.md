---
kind: task
parent: "2445"
status: open
dateOpened: "2026-07-14"
tags: [plateau-loop, drain-daemon, gate, infra]
---

# Rename drain-daemon files to unique basenames, then narrow their TRUST_CHAIN entries (follow-up to #2480)

#2480 registered the phase-1 drain daemon's `plateau:tools/drain-daemon/daemon.mjs` / `plateau:tools/drain-daemon/cli.mjs` / `plateau:tools/drain-daemon/lib.mjs` in TRUST_CHAIN at engine tier, but TRUST_CHAIN matches by BASENAME and these names are generic — the daemon's cli basename already collides with [we:scripts/gen-wrapper/cli.mjs](scripts/gen-wrapper/cli.mjs) and [we:scripts/ingest-adapter/cli.mjs](scripts/ingest-adapter/cli.mjs), so PRs touching those unrelated files over-escalate (accepted as the safe direction under #2480, but not ideal). The durable fix: rename the daemon's source files to unique basenames (e.g. `plateau:tools/drain-daemon/drain-daemon.mjs` / `plateau:tools/drain-daemon/drain-cli.mjs` / `plateau:tools/drain-daemon/drain-lib.mjs`) in plateau-app — updating imports AND the launchd plist `ProgramArguments` (which points at the daemon's entrypoint) AND the installed path (a daemon reinstall/restart) — then narrow the three TRUST_CHAIN entries in [we:scripts/lib/gate-config.mjs](scripts/lib/gate-config.mjs) to the unique basenames so no unrelated file over-escalates. Impl spans plateau-app (rename) + WE (narrow the entries); WE holds zero daemon impl (this card tracks the cross-repo cleanup). Relates to #2480, #2449.
