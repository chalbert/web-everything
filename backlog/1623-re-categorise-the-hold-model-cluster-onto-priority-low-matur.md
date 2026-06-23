---
kind: task
status: active
blockedBy: []
dateOpened: "2026-06-22"
dateStarted: "2026-06-23"
tags: []
---

# Re-categorise the hold-model cluster onto priority:low / maturityGated (#1620)

Once the #1620 hold-model vocab lands (#1622, resolved), re-home the cluster the #1620 review surfaced. priority:low → #232 (ts-patch transformer) and the cheap build-whenever halves (likely #499). maturityGated + typed maturityTrigger → #367 (realRuns>=N soak), #718/#232 SWC-native plugin (a named adoptionSignal), #1486 (externalConsumers>=1, a 2nd dockable adapter). Leave existing-mechanism items untouched: #939 stays blockedBy #818; #978/#513 + the #718 launch-completeness call stay kind:decision; #928 already correct on platform-gated. Verify each retag against we:src/_data/backlogMeta.js vocab and run check:standards.

## Progress (2026-06-23)

**Done:** #367 → `maturityGated realRuns>=3`; #232 → `priority: low`; #1486 re-homed to `blockedBy #1627`
(a concurrent session filed the dockview adapter #1627 — a real tracked prereq, cleaner than a park); #978
resolved by a concurrent session (folded into the #1258 framework-churn watch); #928 already
`platform-gated`; #939 already `blockedBy #818`; #499 → research-gated (topic opened). #1622 vocab landed
(blocker cleared — stale edge dropped).

**Next (residuals):**
- **#232** — `priority: low` is **inert** while `kind: decision` (the demote only acts on buildable Tier-A).
  To make it real: retype #232 to a buildable kind, **or** split the 3-opt-in pool (ts-patch + `.component`
  → `priority:low` builds; SWC-native → `maturityGated adoptionSignal`).
- **#718** — split the bundled card: Babel pre-step → build (launch-completeness); SWC-native plugin →
  `maturityGated adoptionSignal` (real SWC/Turbopack integration to test against). Pending the user's go on splits.
- Then resolve this task.
