---
bornAs: x2i6js3
kind: story
size: 5
parent: "4097"
status: open
scope: ["we:scripts/lib/gh-app-shim.mjs", "we:scripts/lib/github-app-auth-env.mjs", "we:scripts/lib/gh-throttle.mjs"]
dateOpened: "2026-09-24"
tags: []
---

# Sim scenarios: auth and gh budget (stale GH_TOKEN, 8KB output, rate limit, settings-file race, mint failure, points budget)

Matrix rows I-12, I-13, N-01, G-09, G-17, G-21, G-23, G-32, G-40 in we:reports/2026-09-24-daemon-scenario-simulator.md. Needs the fake App-mint endpoint from the harness-fidelity card.

## Done when

1. **Executable** — TODO: a command that fails before this item lands and passes after.
