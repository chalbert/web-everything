---
type: idea
workItem: story
size: 3
parent: "1040"
status: resolved
blockedBy: ["1087"]
dateOpened: "2026-06-19"
dateStarted: "2026-06-19"
dateResolved: "2026-06-19"
graduatedTo: docs/agent/block-standard.md
tags: []
---

# Block status lifecycle governance

Document the block lifecycle concept→draft→experimental→active + graduation criteria, codifying the rules already enforced in the validator: LIFECYCLE/checkStatus at `we:scripts/check-standards-rules.mjs:567` (+598) and the active⇒implementedBy warn at `we:scripts/check-standards.mjs:140`. Adds the missing governance doc section under #1087's spec home; flags (does NOT decide) any gate-tightening (e.g. making active⇒implementedBy an error, a graduation-demo gate) as a separate type:decision follow-up.
