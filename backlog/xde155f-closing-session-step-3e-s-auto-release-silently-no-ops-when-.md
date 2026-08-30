---
kind: task
status: open
dateOpened: "2026-08-30"
tags: []
---

# closing-session step 3e's auto-release silently no-ops when session holds 2+ lanes at once

PR #1720 review finding: `we:skills-src/closing-session/SKILL.md` step 3e tells the agent to release, "no
asking," every held lane with `ahead === 0`, looping `we:scripts/lane-pool.mjs release --lane=<N> --json`
over every lane the session holds. When a session holds 2+ lanes at once, both leases share one
`ownerSession` (`CLAUDE_CODE_SESSION_ID`), so `isContestedLease` (`we:scripts/lib/lane-lease.mjs`) is true
for each and `leaseOwnedByCaller` refuses the `ownerSession` fallback — release then needs the minted
`lease.holder` slug via `--session=`, which step 3e's status/ahead snippet never captures (it only builds
`{lane, head, clean, behind, ahead}`). The release call exits 0 with `released: 0`, a silent no-op, and the
step's own verdict template still has the agent write "released lane-N" for a lane that stayed held.

## Done when

1. **Executable** — a test (or an updated `we:skills-src/closing-session/SKILL.md` step-3e snippet) proving
   a session holding 2 live lanes can release each one via the documented recipe: the snippet must surface
   `lease.holder` per lane and the release call must pass `--session=<holder>` for a lane whose lease is
   contested. Fails before this item lands (release silently no-ops in this shape), passes after.
