---
kind: decision
parent: "xtfrvc3"
status: open
dateOpened: "2026-09-23"
tags: []
---

# Rule the multi-repo conveyor forks

Six forks from the 2026-09-23 multi-repo audit (we:reports/2026-09-23-conveyor-multi-repo-gap-map.md), each with a recommended default: (1) replace #3803 Fork 5's not-WE fix refusal with a capability check on a per-repo profile, once the resolver/brief/profile slices land -- recommended; (2) keep ONE WE backlog with repo-prefixed scope rather than a backlog per repo -- recommended; (3) fix PRs that have no backlog item by attributing to the PR with scope from its diff -- recommended; (4) a plateau/frontierui fix runs that repo's own gate, plus WE check:standards only when it touches a WE half -- recommended; (5) CI-heal triggers for every repo's red CI, capped by the durable heal-mark count -- recommended; (6) land slices 1-4 before #3908's port and slice 5 after it -- recommended. Slices 5-7 are blocked on this card.

## Done when

1. **Executable** — TODO: a command that fails before this item lands and passes after.
