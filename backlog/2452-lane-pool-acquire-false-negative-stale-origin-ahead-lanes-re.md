---
bornAs: xlzokbk
kind: story
size: 3
status: open
dateOpened: "2026-07-12"
tags: [lane, lane-pool, lease, tooling]
scope:
  - we:scripts/lane-pool.mjs
  - we:scripts/lib/lane-lease.mjs
  - we:scripts/__tests__/lane-pool-
  - we:scripts/lib/__tests__/lane-lease.test.mjs
---

# lane-pool acquire false-negative — stale-origin ahead lanes read as all-held; release ignores ownerSession

acquire auto-pick judges a lane's ahead-ness via laneDirtyOrAhead against the LOCAL origin ref with no prior fetch (deliberate no-per-lane-fetch tradeoff), so a lane whose HEAD is fully landed remotely but whose local origin ref is stale reads falsely ahead and the pool reports all-held while explicit --lane=N succeeds. Separately, cmdRelease keys ownership off defaultSession() (host:pid) instead of the ownerSession/CLAUDE_CODE_SESSION_ID signal isForeignLease uses (#2367), so a session cannot release its own lease without --force. Observed live 2026-07-12 (twice).

## Gap 1 — acquire's pre-fetch stale-ahead false negative

`cmdAcquire`'s auto-pick (`we:scripts/lane-pool.mjs:633-669`) builds candidate infos from
`laneDirtyOrAhead` on **local** refs — an explicit comment marks it "no per-lane fetch …
conservative (over-protects an ahead lane)". `git fetch` runs only for the already-chosen
winner (`we:scripts/lane-pool.mjs:680`), strictly after the pick. So a lane whose batch work
already landed via pushed `origin/lane/*` refs, but whose clone hasn't fetched since, computes
`ahead = origin/main..HEAD > 0` against the stale ref and `isLaneAcquirable`
(`we:scripts/lib/lane-lease.mjs`) rejects it — the #2267 never-recycle-unpushed-work guard
over-firing on *pushed* work.

Observed 2026-07-12: `acquire` failed "no free lane (24 all held/dirty)" while `status` showed
lanes 20–23 clean + unleased; each HEAD was contained in an `origin/lane/batch-…` ref
(verified with `git branch -r --contains`), and explicit `acquire --lane=20` — which skips
`laneDirtyOrAhead` entirely — succeeded.

**Fix directions (a real design tradeoff, not a pure oversight):** fetch in candidate clones
before judging ahead-ness (costs N fetches per pick — the exact cost the current design
avoids), or keep no-fetch but treat *HEAD contained in known remote refs* as not-ahead
(containment check against the shared-object store is local and cheap), or fetch lazily only
when the no-fetch pass concludes "all held". Tests: a clean lane with stale origin + fully
pushed HEAD must be auto-pickable; a genuinely unpushed-ahead lane must stay protected.

## Progress

**Gap 1 is DELIVERED and landed** — PR #1042 (`lane/2452-gap1-stale-ahead`), merged 2026-08-05, carved
out of the abandoned #1022 under the no-regression land bar. `aheadIsProvablyPushed` + `liveRemoteShas`
now let acquire's auto-pick treat a provably-pushed "ahead" lane as recyclable, proved against the LIVE
remote (one lazy `ls-remote`) rather than local remote-tracking refs, and failing closed on any git
fault. Pinned by `we:scripts/__tests__/lane-pool-acquire-stale-origin.test.mjs` (5 cases, including the
deleted-ref hardening case and the fail-closed object-locality limit); mutation-verified both ways.

The Gap-1 section above still describes the *original* problem statement — its "Fix directions" and
"Tests" lines are now satisfied on disk, not open work.

**Residue filed rather than bundled** (land-bar rule — non-blocking means tracked): #2918 (the fix
reaches only `acquire`, not `list`/`provision --acquirable`), #2920 (the fan-out cost, 677 git spawns /
29.5s on the live 38-lane pool), #2919 (containment unprovable when the remote tip object is absent
locally), and #2924 (the pick-time proof is never re-verified before the destructive reset).

**Next: Gap 2 only.** This story stays `open` because the release-ownership half below is untouched. Its
own review found that widening ownership to the durable `ownerSession` lets a bare `release --all` drop a
sibling's live lease without `--force`, after which a fresh acquire runs `checkout -B --force` +
`clean -fd` on that clone — a new way to destroy another actor's work, so it needs its own PR and its own
scrutiny rather than riding the stale-ahead fix.

## Gap 2 — release ownership still keyed on host:pid

`cmdRelease` compares against `defaultSession()` (host:pid — differs per shell invocation),
not the durable `ownerSession` (`CLAUDE_CODE_SESSION_ID`) signal `isForeignLease` adopted in
#2367. Net: the very session that acquired a lease reads as "not yours" on release and must
`--force` (observed twice, 2026-07-12 — lane-20 and lane-21). Port `cmdRelease` (and any other
`leaseOwnedBy` callers) onto the `ownerSession` comparison, with the same fail-open degraded
mode as #2367.

**Observed again 2026-08-06.** Two separate fix sub-agents each had to pass `--force` to release a lane they
had **just acquired themselves** in the same session. Same mechanism: `defaultSession()`
(`we:scripts/lane-pool.mjs:474` — `flags.session || LANE_SESSION || hostname():ppid`) is recomputed per
process, and every Bash tool call is a fresh shell, so the release invocation's host:pid never matches the
acquire invocation's. `CLAUDE_CODE_SESSION_ID` — the `ownerSession` signal already stamped on the lease — was
stable and set across all of those calls. A fresh sighting of the already-diagnosed Gap 2, recorded as
evidence that it still bites in normal agent use; the fix direction above is unchanged.
