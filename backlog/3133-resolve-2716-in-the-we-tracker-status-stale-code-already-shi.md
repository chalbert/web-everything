---
bornAs: xcu5zqa
kind: task
parent: "2705"
status: open
scope: ["we:backlog/2716-s0r-taxonomy-reconcile-spec-allow-list-refreeze-r1.md"]
dateOpened: "2026-08-15"
tags: []
---

# Resolve #2716 in the WE tracker — status stale, code already shipped in plateau-app

`we:backlog/2716-s0r-taxonomy-reconcile-spec-allow-list-refreeze-r1.md` still carries `status: open`, but its
deliverable already shipped: `plateau-app:src/feature-tracker/feature-tracking.webcases.ts` (commit
`da66083e`, merged via plateau-app PR #115, 2026-07-27) is exactly S0r's acceptance — the 115-case register,
the 44-item `SPEC_BEFORE_RENDER` allow-list, the §0 three-branch forecast rule, and `validateFtRegister()`
enforcing all 5 invariants. Nothing further needs building. Because #2717 (S0a) declares `blockedBy: ["2716"]`,
the readiness engine scores #2717 as blocked even though the code it depends on is live — a purely mechanical
staleness, not an open question. Run `node we:scripts/backlog.mjs resolve 2716 --graduated-to=none` (verify
the acceptance-to-code mapping first) so #2717 shows ready once its own preparation lands.

## Done when
- `we:backlog/2716-*.md` carries `status: resolved` + `dateResolved`, with the resolution citing the
  plateau-app commit/PR that satisfies its acceptance.
- `we:scripts/readiness/` no longer scores #2717 as blocked by an unresolved prerequisite.
