---
kind: story
size: 5
status: open
dateOpened: "2026-07-10"
crossRef: { url: /backlog/2367/, label: "#2367 — destructive-git-op guard" }
tags: [lane-pool, guard, workflow, orchestrator]
---

# Per-lane ownership signal so the destructive-git-op guard also protects parallel /workflow lanes

The #2367 destructive-git-op guard only distinguishes lane owners in the SERIAL topology; under the parallel `/workflow` topology the lanes are provisioned by position and never `acquire` a lease, so no `ownerSession` is ever stamped and the guard fails open on the absent lease — leaving one lane free to clobber a peer. Close that hole by making the parallel dispatch stamp a per-lane lease that carries a unique per-lane identity, so the guard has something to check — a change to the lane-dispatch machinery, not to the guard.

## Context — what #2367 landed

#2367 (landed via PR #342) added a `PreToolUse` guard in [we:scripts/guard-bash.mjs](scripts/guard-bash.mjs) that blocks a destructive git op — `git reset --hard`, `git clean -fd`, `git checkout/restore .`, force-push — when the op's cwd is inside a `.lanes/<repo>/lane-N/` clone whose live lease is held by *another* session. Ownership is decided by a durable `CLAUDE_CODE_SESSION_ID` recorded on the lease as `ownerSession`, compared by `isForeignLease` in [we:scripts/lib/lane-lease.mjs](scripts/lib/lane-lease.mjs).

## The gap — parallel lanes carry no lease at all

This protects the **serial** topology (two separate top-level `claude` sessions — the actual 2026-07-09 incident, now fixed) but **not** the parallel `/workflow` topology. The parallel orchestrator ([we:.claude/skills/batch-backlog-items/parallel-execute.workflow.js](.claude/skills/batch-backlog-items/parallel-execute.workflow.js)) **provisions** a lane pool (`we:scripts/lane-pool.mjs provision` + `list --json`) and couples item↔lane **by position** — it **never calls `we:scripts/lane-pool.mjs acquire`** (zero `acquire` call sites in that workflow). But `ownerSession` is written **only** by the acquire path (`cmdAcquire`/`tryClaimLane` in [we:scripts/lane-pool.mjs](scripts/lane-pool.mjs)); `provision`/`refresh` write **no** `.lane-lease` marker. So parallel lanes carry **no lease at all**: `isForeignLease` reads the absent lease as `null` and returns `false`, and the guard **fails open on the missing lease**. Parallel lanes get no protection because there is nothing to check — not because of any `ownerSession` comparison.

## Verified (2026-07-10) — even a stamped lease could not tell siblings apart

The absent-lease gap above is the primary cause. There is also a **secondary** problem: even if the parallel path *did* stamp a lease, no ambient env value is unique per parallel lane, so a naive stamp could not distinguish siblings:

- `CLAUDE_CODE_SESSION_ID` is shared — the child inherits the parent's value.
- `CLAUDE_CODE_CHILD_SESSION` is a constant `"1"` — a flag, not an id.
- Process-ancestry over-matches: siblings share the orchestrator ancestor, so an ancestry test reads every sibling as the owner (that was the original fail-open the #2367 PR removed).

So the fix needs **both** a stamped per-lane lease **and** a unique per-lane identity on it — one without the other still leaves siblings indistinguishable.

## What's needed — the design decision

The parallel dispatch must be wired to **stamp a per-lane lease that carries a unique per-lane identity** — e.g. have each lane `acquire --session=<per-lane-slug>` as part of dispatch, or an equivalent lease-stamp in `provision`/coupling — so `isForeignLease` has a per-lane `ownerSession` to compare. This is **not** merely adding `--session=<slug>` to an existing `acquire` call: the parallel path calls no `acquire` today, so the change is larger — it must introduce the lease-stamp step into the dispatch machinery ([we:scripts/lane-pool.mjs](scripts/lane-pool.mjs) and its orchestrator caller in [we:.claude/skills/batch-backlog-items/parallel-execute.workflow.js](.claude/skills/batch-backlog-items/parallel-execute.workflow.js)), **not** touch the guard itself. It is the same "orchestrator ↔ lease integration" gap the original #2367 PR set aside as separate (see PR #342's dismissed-findings note).

## Acceptance

- A destructive git op run in a **sibling** parallel lane's clone is **denied** by the guard.
- The **owning** lane's own destructive ops still **pass**.
- Both the serial-session case and the degraded no-id fail-open behavior are **unchanged**.
