---
kind: story
size: 3
status: resolved
dateOpened: "2026-06-24"
dateStarted: "2026-06-24"
dateResolved: "2026-06-24"
graduatedTo: scripts/backlog.mjs
tags: []
---

# Batch claim doesn't record the --scope baseline unless --session is passed (scope flag silently inert)

The batch loop in we:docs/agent/backlog-workflow.md (and the batch-backlog-items skill) runs claim <NNN> without --session, but we:scripts/backlog.mjs only records the #952 claim-time git baseline into we:claims.json when flag('session') is set. So a batch that follows the loop literally never records a baseline, and the --scope=<slug> gate flag (#952/#957) is silently inert — every concurrent finding is mis-classified and a session must diagnose externals manually (observed live in batch-2026-06-23-1689-1500: we:claims.json stayed empty across 16 items, so --scope demoted nothing and the #1661 record-touch hook found no session). Fix: have claim infer the session from the active reservation in we:reservations.json (the reserve step already records --session there), or fall back to the chat-rename slug, so the baseline records without a per-claim flag; alternatively document --session on the claim step. Keep it best-effort (no claim must fail on it).

## Progress (batch-2026-06-23-1725-1665)

Fixed — `claim` now infers the session so the #952 baseline records without a per-claim `--session`:

- `we:scripts/readiness/reservations.mjs` — new `sessionForNum(state, num)` recovers the session that `reserve`-d an item (the reserve step already stamps `--session` into `we:.claude/skills/batch-backlog-items/reservations.json`). Pure read; tolerates padded/unpadded num.
- `we:scripts/backlog.mjs` — the claim block reads the reservation **before** clear-on-claim drops it, then infers `session = flag('session') ?? sessionForNum(reservations, num) ?? mostRecentSession(claims)`. So a batch running `claim <NNN>` without `--session` still records the baseline into `we:.claude/skills/batch-backlog-items/claims.json`, making `--scope=<slug>` no longer silently inert (the failure observed in batch-2026-06-23-1689-1500). Best-effort preserved — the existing try/catch still guarantees no claim fails on attribution.
- `we:scripts/readiness/__tests__/reservations-session.test.mjs` — 3 tests for `sessionForNum` (found/unpadded/null). Full readiness suite green (57).
