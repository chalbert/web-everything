---
bornAs: xdrbnkb
kind: decision
parent: "3318"
status: open
dateOpened: "2026-08-26"
tags: []
---

# Should a sampling floor be restored over auto-landed PRs

#2631 dropped the random review sampler on the finding that random sampling had no value — measured against a reviewer whose precision we cannot now state. That leaves nothing verifying the 22.5% of merges that reach no reviewer, and it is the only route by which seeded-defect recall becomes a real number. Ruling this reverses a ratified decision.

## Done when

1. **Executable** — TODO: a command that fails before this item lands and passes after.
