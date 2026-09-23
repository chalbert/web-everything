---
bornAs: xx478x6
kind: decision
parent: "3963"
status: resolved
dateOpened: "2026-09-23"
dateResolved: "2026-09-23"
codifiedIn: "docs/agent/platform-decisions.md#conveyor-multi-repo-model"
tags: []
---

# Rule the multi-repo conveyor forks

Six forks from the 2026-09-23 multi-repo audit (we:reports/2026-09-23-conveyor-multi-repo-gap-map.md), each with a recommended default: (1) replace #3803 Fork 5's not-WE fix refusal with a capability check on a per-repo profile, once the resolver/brief/profile slices land -- recommended; (2) keep ONE WE backlog with repo-prefixed scope rather than a backlog per repo -- recommended; (3) fix PRs that have no backlog item by attributing to the PR with scope from its diff -- recommended; (4) a plateau/frontierui fix runs that repo's own gate, plus WE check:standards only when it touches a WE half -- recommended; (5) CI-heal triggers for every repo's red CI, capped by the durable heal-mark count -- recommended; (6) land slices 1-4 before #3908's port and slice 5 after it -- recommended. Slices 5-7 are blocked on this card.

## Done when

1. **Executable** — TODO: a command that fails before this item lands and passes after.

## Ruling

Ratified 2026-09-23 by the operator. The operator's own words, quoted: "I ratify". All six forks accepted as
the card's recommended defaults, no amendment. Ratified directly by the operator without a formal `/prepare`
pass (no skeptic or two-confusion screen was run on this card); the grounding is the 2026-09-23 audit in
`we:reports/2026-09-23-conveyor-multi-repo-gap-map.md`.

- **Fork 1 — RATIFIED:** the fix path's "not WE → `unsupported-repo`" refusal is replaced by a capability
  check on the per-repo profile (slice 1), once the resolver, brief and profile slices land. This supersedes
  #3803 Fork 5's "accept the refusal" default for the fix path.
- **Fork 2 — RATIFIED:** one backlog — the WE backlog — for all constellation repos, with repo-prefixed scope.
- **Fork 3 — RATIFIED:** a PR with no backlog item is fixed with the PR itself as the attribution and scope
  taken from its own diff under its repo's prefix.
- **Fork 4 — RATIFIED:** a fix agent runs the TARGET repo's own gate (from the repo profile), plus WE's
  `check:standards` only when the fix touches a WE half.
- **Fork 5 — RATIFIED:** CI-heal is owed for every constellation repo's red CI, capped by the durable
  heal-mark count.
- **Fork 6 — RATIFIED:** slices 1–4 land before #3908's port; slice 5 lands after it (or inside it if its
  HOLD lifts first).

Codified as [#conveyor-multi-repo-model](../docs/agent/platform-decisions.md#conveyor-multi-repo-model).
