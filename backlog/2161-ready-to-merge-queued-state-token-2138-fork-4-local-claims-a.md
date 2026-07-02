---
kind: story
size: 3
status: resolved
dateOpened: "2026-07-02"
dateStarted: "2026-07-02"
dateResolved: "2026-07-02"
graduatedTo: none
tags: [lane, pr-flow, merge-queue, session-tooling]
relatedTo: ["2138"]
---

# Ready-to-merge queued-state token (#2138 Fork 4): local claims-adjacent marker written at lane-push, read offline by claim/reopen/closeout

Implements #2138 **Fork 4 (ruled: option a)** — the "ready-to-merge" state the deferred queue needs. Today a lane's `active→resolved` flip rides the WE lane commit and only lands when the drain merges it, so while an item sits **queued** it is still `status: active` on `main` — a naive read would re-offer it or `reopen`/closeout would treat it as abandoned. Fix: the producing session, at lane-push, writes a **local queued marker adjacent to `we:claims.json`** (the central-state home `claim` already reads); `claim`/`reopen`/closeout read it **offline** and treat a queued item as unclaimable. Preserves Rule #105 (claim ignores git state, stays local — **no** network `ls-remote` on the ownership hot path, no second main-write). Predicate per the decision's `isQueued(item)` sketch. Paired with the drain deleting `lane/*` refs only after the whole couple's WE resolve is confirmed reachable on `main` (a single deletion point). Buildable + unit-testable now, independent of the PR substrate (#2153); **consumed by** the drain command (#2162).

## Progress

**Resolved 2026-07-02.** Shipped the primitive + the offline read-guards:

- **`we:scripts/readiness/queued-state.mjs`** — a PURE module (no fs/clock, mirrors `we:scripts/readiness/reservations.mjs`): `parseQueued`/`serializeQueued`, `isQueued`, `queuedNums`, `addQueued`, `removeQueued`. Backed by **`we:.claude/skills/batch-backlog-items/queued.json`** (tracked, seeded empty), read offline. **No TTL** — a durable ready-to-merge signal, cleared only by the drain at landing (an expiring lease would reopen the very re-claim window this closes).
- **CLI** in `we:scripts/backlog.mjs`: `queue <NNN...> [--lane] [--session]` (mark at lane-push) and `unqueue <NNN...>` (the drain's single clear point at landing).
- **Read-guards in `transition()`** for **both** `claim` and `release` (Rule #105 — offline, no tree read, no `ls-remote`): a queued item is refused by `claim` (not re-offered) and by `release` (the #2072 closeout reconcile's `active→open` flip — so a queued item is never reopened as abandoned). `--force` overrides for a deliberate stuck-entry abandon.
- **Tests:** `we:scripts/readiness/__tests__/queued-state.test.mjs` (6, green) + a live end-to-end exercise (queue → claim refused → release refused → unqueue → clear). Full suite 200/200, `check:standards` green.

**Boundary with #2162:** this ships the primitive + the *reader* side. The **lane-push `queue` call and the drain-landing `unqueue` call-sites** are wired by the drain/monitor command (#2162), which owns the relocated push+land flow — it consumes `isQueued`/`queue`/`unqueue`.
