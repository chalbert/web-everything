---
kind: task
status: resolved
blockedBy: []
relatedReport: reports/2026-06-23-backlog-split-analysis.md
dateOpened: "2026-06-22"
dateStarted: "2026-06-23"
dateResolved: "2026-06-23"
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

**Residuals cleared (2026-06-23):**
- **#232** — already sliced upstream into a storied epic: #1628 (`.component`, `priority:low`), #1629
  (per-bundler SWC, `priority:low`), #1630 (`ts-patch`, `priority:low`). The demote is real (sits on the
  buildable child stories, not the inert epic). No action needed.
- **#718** — retyped decision→epic and split: **#1658** Babel pre-step → `priority: low`; **#1659**
  SWC-native trait transform → `maturityGated` (`maturityTrigger: adoptionSignal: a real SWC/Turbopack
  trait consumer`). See we:reports/2026-06-23-backlog-split-analysis.md.

Sweep complete — every cluster item re-homed onto the #1620 hold model.
