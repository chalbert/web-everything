---
bornAs: xf757h3
kind: decision
parent: "2612"
status: resolved
dateOpened: "2026-07-22"
dateResolved: "2026-07-22"
codifiedIn: "docs/agent/platform-decisions.md#state-lives-where-its-nature-dictates"
tags: [plateau-loop, conveyor, backlog, build-queue]
---

# Should buildQueued be committed frontmatter at all, or session-local?

The conveyor now treats clear-for-build as session-local (a gitignored we:.conveyor/queue.json
sidecar), but the build-queue view (#2528/#2529) and the future product board still read committed
`buildQueued` frontmatter — should the two reconcile?

## Context

#2613 fixed a hard blocker: the operator's "clear this item for the conveyor to build" gesture is
**session-local operator intent**, not committed repo state. Routing it through the `we:scripts/backlog.mjs
build-queue add` verb writes `buildQueued: true` frontmatter via the guarded card-mutation path, which the
no-override lane guard (#2302/#104/#2219/#2339) BLOCKS from the primary/main checkout — but the /conveyor skill
runs from the main session, so the operator could never actually clear work. #2613 moved the conveyor's cleared
set into a gitignored sidecar (we:.conveyor/queue.json) that the guard does not police, so clearing works from
the main session again. The conveyor's dispatch plan (#2609) and tick state (#2611) now read membership from
that sidecar.

This leaves a **divergence**: two different notions of "cleared for build" now coexist —

- the conveyor's **session-local** sidecar (per-operator, this-session-only, uncommitted), and
- the **committed** `buildQueued` frontmatter that the existing build-queue view (#2528/#2529) and the future
  product board (#2527) still read as a shared, team-visible signal.

They are not wired to each other. This item captures that fork so it is decided deliberately, not by drift.

## The fork

**Fork A — `buildQueued` stays COMMITTED shared state.** The committed flag is the team/board queue: a shared,
persisted "this is cleared for build" that any operator or the product board sees, cleared via a lane → PR
(guard-gated as a card mutation). The conveyor's session-local sidecar is then just an **interim divergence to
reconcile** — the conveyor should eventually feed / reflect the committed flag (e.g. the sidecar is a fast
local cache that syncs to committed frontmatter through the normal lane transport), so the board and the
conveyor agree. Cost: clearing for the *board* still can't happen from the primary checkout (the guard blocks
it), so this fork keeps that friction for the shared signal even after #2613 unblocked the conveyor's local one.

**Fork B — `buildQueued` moves OUT of committed frontmatter entirely.** Clear-for-build is per-operator
intent for ALL consumers, so it lives in a session/operational store (the sidecar, or its server-backed
successor) for everyone — the #2528/#2529 view and the product board read that store too — and committed
frontmatter DROPS the flag. Nothing about "is this cleared right now" is ever committed to `main`. Cost: there
is then no committed, shared, cross-session record of the queue; a team-visible board needs a shared
operational store (not git), which is more infrastructure than a frontmatter field.

## Default (lean — NOT prepared)

**Leave OPEN / unprepared.** The right answer depends on a question not yet settled: **is the build queue a
shared team artifact or per-operator intent?** If shared → Fork A (committed stays authoritative, the sidecar
reconciles up). If per-operator → Fork B (the flag leaves git for an operational store). #2613 deliberately did
NOT decide this — it only unblocked the conveyor's local case with a sidecar, keeping committed `buildQueued`
untouched for the existing view. This is a **capture**, not a prepared ruling: no `preparedDate`. Prepare it
(survey how the #2527 board is meant to be shared, and whether other loops want a cross-session cleared queue)
before ratifying.

Links: #2528 / #2529 (the build-queue view that reads committed `buildQueued`) · #2527 (the future product
board) · #2612 (the conveyor epic) · #2302 (the guard that gates committed card mutations) · #2613 (this PR's
session-local sidecar).

## Ruling (2026-07-22)

**Ruled Fork B — session-local (Nicolas, merit-based).** "Cleared for build right now" is **transient
operator / session intent**, not durable spec — so it does not belong in committed frontmatter for *any*
consumer. It lives in a session-local sidecar (`we:.conveyor/queue.json`, and its server-backed successor when
the product board goes multi-tenant); committed frontmatter carries no clear-for-build flag. Nothing about
"is this cleared right now" is committed to `main`.

**This is an instance of the general rule, not a one-off.** The call is the first clause of the new statute
rule [state lives where its nature dictates](../docs/agent/platform-decisions.md#state-lives-where-its-nature-dictates):
transient operator intent → a session-local sidecar the lane guard does not police; durable readiness (`scope`,
`size`, `blockedBy`, `status`) → committed, upstream-authored, human-reviewable frontmatter. `buildQueued` is
the type case of the transient clause, which is *why* #2613 had to move it out of the guarded frontmatter path
(#2302 blocks the main session from clearing work) — that move is now ratified as correct, not an interim
divergence to reconcile up (Fork A rejected). The build-queue view (#2528/#2529) and the product board (#2527)
read the same session/operational store; a team-visible board is served by that shared store, never by a
committed git flag.

