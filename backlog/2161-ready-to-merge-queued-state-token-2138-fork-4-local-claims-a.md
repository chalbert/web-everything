---
kind: story
size: 3
status: open
dateOpened: "2026-07-02"
tags: [lane, pr-flow, merge-queue, session-tooling]
relatedTo: ["2138"]
---

# Ready-to-merge queued-state token (#2138 Fork 4): local claims-adjacent marker written at lane-push, read offline by claim/reopen/closeout

Implements #2138 **Fork 4 (ruled: option a)** — the "ready-to-merge" state the deferred queue needs. Today a lane's `active→resolved` flip rides the WE lane commit and only lands when the drain merges it, so while an item sits **queued** it is still `status: active` on `main` — a naive read would re-offer it or `reopen`/closeout would treat it as abandoned. Fix: the producing session, at lane-push, writes a **local queued marker adjacent to `we:claims.json`** (the central-state home `claim` already reads); `claim`/`reopen`/closeout read it **offline** and treat a queued item as unclaimable. Preserves Rule #105 (claim ignores git state, stays local — **no** network `ls-remote` on the ownership hot path, no second main-write). Predicate per the decision's `isQueued(item)` sketch. Paired with the drain deleting `lane/*` refs only after the whole couple's WE resolve is confirmed reachable on `main` (a single deletion point). Buildable + unit-testable now, independent of the PR substrate (#2153); **consumed by** the drain command (#2162).
