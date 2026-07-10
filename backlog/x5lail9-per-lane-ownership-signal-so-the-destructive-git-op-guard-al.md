---
kind: story
size: 5
status: open
dateOpened: "2026-07-10"
crossRef: { url: /backlog/2367/, label: "#2367 — destructive-git-op guard" }
tags: [lane-pool, guard, workflow, orchestrator]
---

# Per-lane ownership signal so the destructive-git-op guard also protects parallel /workflow lanes

The #2367 destructive-git-op guard only distinguishes lane owners in the SERIAL topology; under the parallel `/workflow` topology every sibling lane stamps the SAME `ownerSession`, so the guard reads a peer's clone as "mine" and lets one lane clobber another. Close that hole by giving each parallel lane its OWN identity and threading it into the lease — a change to the lane-dispatch machinery, not to the guard.

## Context — what #2367 landed

#2367 (landed via PR #342) added a `PreToolUse` guard in [we:scripts/guard-bash.mjs](scripts/guard-bash.mjs) that blocks a destructive git op — `git reset --hard`, `git clean -fd`, `git checkout/restore .`, force-push — when the op's cwd is inside a `.lanes/<repo>/lane-N/` clone whose live lease is held by *another* session. Ownership is decided by a durable `CLAUDE_CODE_SESSION_ID` recorded on the lease as `ownerSession`, compared by `isForeignLease` in [we:scripts/lib/lane-lease.mjs](scripts/lib/lane-lease.mjs).

## The gap — parallel siblings all share one ownerSession

This protects the **serial** topology (two separate top-level `claude` sessions — the actual 2026-07-09 incident, now fixed) but **not** the parallel `/workflow` topology. When several lanes run at once under one orchestrator, the lanes are subagents that inherit the parent's `CLAUDE_CODE_SESSION_ID`, so every sibling lane stamps the **same** `ownerSession`. `isForeignLease` then sees `ownerSession === mySessionId` for every sibling and allows one lane to clobber a peer lane — the exact multi-lane collision #2367 set out to prevent.

## Verified (2026-07-10) — no ambient per-lane identity exists

There is no ambient env value that is unique per parallel lane:

- `CLAUDE_CODE_SESSION_ID` is shared — the child inherits the parent's value.
- `CLAUDE_CODE_CHILD_SESSION` is a constant `"1"` — a flag, not an id.
- Process-ancestry over-matches: siblings share the orchestrator ancestor, so an ancestry test reads every sibling as the owner (that was the original fail-open the #2367 PR removed).

## What's needed — the design decision

The lane launcher / orchestrator must hand each lane its **own** identity and thread it into `we:scripts/lane-pool.mjs acquire` (e.g. `acquire --session=<per-lane-slug>`), so the lease's `ownerSession` is unique per lane and the guard can tell siblings apart. This is a change to the lane-dispatch machinery ([we:scripts/lane-pool.mjs](scripts/lane-pool.mjs) and its orchestrator caller), **not** to the guard itself — it is the same "orchestrator ↔ lease integration" gap the original #2367 PR set aside as separate (see PR #342's dismissed-findings note).

## Acceptance

- A destructive git op run in a **sibling** parallel lane's clone is **denied** by the guard.
- The **owning** lane's own destructive ops still **pass**.
- Both the serial-session case and the degraded no-id fail-open behavior are **unchanged**.
