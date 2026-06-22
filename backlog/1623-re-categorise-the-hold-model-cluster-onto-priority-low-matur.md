---
kind: task
status: open
blockedBy: ["1622"]
dateOpened: "2026-06-22"
tags: []
---

# Re-categorise the hold-model cluster onto priority:low / maturityGated (#1620)

Once the #1620 hold-model vocab lands (#1622), re-home the cluster the #1620 review surfaced. priority:low → #232 (ts-patch transformer) and the cheap build-whenever halves (likely #499). maturityGated + typed maturityTrigger → #367 (realRuns>=N soak), #718/#232 SWC-native plugin (a named adoptionSignal), #1486 (externalConsumers>=1, a 2nd dockable adapter). Leave existing-mechanism items untouched: #939 stays blockedBy #818; #978/#513 + the #718 launch-completeness call stay kind:decision; #928 already correct on platform-gated. Verify each retag against we:src/_data/backlogMeta.js vocab and run check:standards.
