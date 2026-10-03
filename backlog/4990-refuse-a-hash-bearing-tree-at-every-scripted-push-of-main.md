---
bornAs: xk8rem0
kind: story
size: 3
parent: "3383"
status: open
blockedBy: ["4985"]
scope: ["we:scripts/push-if-green.mjs", "we:scripts/guard-git-push.mjs", "we:scripts/__tests__/"]
dateOpened: "2026-10-03"
tags: []
---

# Refuse a hash-bearing tree at every scripted push of main

From #3732: refuse a hash-bearing tree at every scripted push of main, including the push-if-green --sha publish path, and in a pre-push hook scoped to pushes of main beside guard-git-push. The raw admin push stays an accepted Rung 1 residual until the enforcement-rung knob builds. Acceptance: the same fixture the check rejects cannot be pushed by any script.

## Done when

1. **Executable** — a fixture tree holding a hash-named backlog file cannot be pushed by `we:scripts/push-if-green.mjs`, including the `--sha` path; the same fixture numbered can. Fails before this lands.
2. **Executable** — the main-scoped pre-push hook beside `we:scripts/guard-git-push.mjs` refuses the fixture, and does not touch a push to a POC branch.
3. The raw admin push stays an accepted Rung 1 residual until the enforcement-rung knob (#3532) is built; this card states it and does not try to close it.
