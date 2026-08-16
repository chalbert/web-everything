---
bornAs: xcu5zqa
kind: task
parent: "2705"
status: resolved
scope: ["we:backlog/2716-s0r-taxonomy-reconcile-spec-allow-list-refreeze-r1.md"]
dateOpened: "2026-08-15"
dateResolved: "2026-08-16"
graduatedTo: none
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

## Resolved 2026-08-16 — superseded, #2716 already resolved independently

Closing as superseded, not as delivered work: a queue-generation scan flagged this card's ask ("resolve #2716
in the WE tracker") as still open, but `we:backlog/2716-*.md` already reads `status: resolved` —

- **Commit `87823064`** — "resolve #2716: FT taxonomy reconcile + SPEC allow-list refreeze R1 -- code already
  landed, status was stale" — set `status: resolved`, `dateResolved: "2026-08-15"`,
  `graduatedTo: "plateau-app:src/feature-tracker/feature-tracking.webcases.ts"` on `we:backlog/2716-*.md`,
  and is an ancestor of `origin/main` HEAD. That commit is not from this card's own line of work; it landed
  independently of #3131/#3133 the day before this sweep.
- `node we:scripts/check-readiness.mjs --select --json` lists `#2717` in `tierA` (verified live on the
  current tree), so `we:scripts/readiness/` no longer scores it as blocked.

**Nothing in this card's own body was executed to produce that result** — the ask was independently
fulfilled before this card could be picked up. Marking it `resolved` with a build credit would misstate what
happened, so this closes as **moot**: `graduatedTo: none`, no code/doc delivered under this card's own
authorship. See #3131 — the duplicate sibling ask, closed the same way and citing the same commit.
