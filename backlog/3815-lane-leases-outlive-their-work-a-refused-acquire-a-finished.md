---
bornAs: xer3jlp
kind: story
size: 5
parent: "3383"
status: open
scope: ["we:scripts/lane-pool.mjs", "we:scripts/conveyor/lease-reaper.mjs", "we:scripts/lib/lane-lease.mjs"]
dateOpened: "2026-09-21"
tags: []
---

# Lane leases outlive their work: a refused acquire, a finished worker with a purpose-named session, and abandoned dirty lanes all starve the pool

FOUND 2026-09-21. Four lanes stayed leased to finished sessions and about 40 more sat dirty from abandoned claim flips and scratch files, so list --acquirable showed almost nothing. Two of the code defects are already filed (#3407 refused acquire keeps the lease; #3669 leases of finished sessions are not reaped); this card holds what neither covers: the standing recovery for the two safe dirty classes and the worker-side release. Design-first, uncleared: several fixes are possible and the choice is not settled. Do not build until the operator picks. Do not queue this card.

## Evidence (2026-09-21, re-checked against main `a4ff83ea6`)

- What happened today: lane-35 (an aborted `prepare-3746-and-3753`), lane-51 (`build-3468`, its PR long landed) and lanes 65 and 68 (`fix-pr-2392-c`, whose acquire attempts were REFUSED yet left a lease) stayed leased to finished sessions. Separately, `list --acquirable` listed almost nothing usable while about 40 lanes sat dirty from abandoned claim flips and scratch files. Those lanes were recycled by hand; the salvage folder (`lane-salvage`, under the operator's `.operations` directory) holds 70 entries, a directory plus a `.patch` per lane, stamped from 2026-09-21 12:25 EDT. NOT verified here: the four historical lease records themselves, because they were recycled before this card was written. What was checked is the session-name grammar and the code path, below. Today `list --acquirable` shows 42 lanes.
- Refused acquire keeps the lease. `tryClaimLane` (we:scripts/lane-pool.mjs:864) writes the lease marker at the explicit-lane call site (:1101; the auto-pick call site is :1175) BEFORE the #3390 refusal (:1133-1138) and the #2924 refusal (:1218-1223), and `fail()` (:768) exits with no rollback. The first filing worker confirmed today that after such a refusal the marker was still on disk and `list --acquirable` showed nothing for a one-lane pool. I re-read the code and the line numbers above hold; I did not re-run that repro (the repo's push hook blocked scratch-repo setup, see the sibling card on `--adopt`).
- A finished worker with a purpose-named session is never reaped. Re-run today on main: `itemNumFromSession` (we:scripts/conveyor/lease-reaper.mjs:119, over `matchSessionSlug` :113) returns `null` for `prepare-3746-and-3753`, `build-3468`, `fix-pr-2392-c` and this filing's own `file-orchestration-bugs`; it returns `3779` for `conveyor-3779` and `fix-3779`, and `null` for a hash id (`conveyor-x9ylkp7`). `sessionGoneForLease` (we:scripts/conveyor/lease-reaper.mjs:345) returns `null` for a name outside that grammar (:347), so the session-gone axis never fires. The pool reaper `reapDeadLeasesInPool` (we:scripts/lane-pool.mjs:952) reaps only on a PR-terminal signal and only when `isLeaseStale` (:995, default 240 minutes, we:scripts/lib/lane-lease.mjs:35 and :46) holds and an item number parses. So a purpose-named worker's lease lives its full four hours.

## Relation to the open cards (read today)

- **#3407** ("refused #3390/#2924 acquire guards leave the lease reassigned to the failed requester", filed 2026-08-30): the SAME defect as the refused-acquire half here. It is still open and its line numbers (1044, ~1108) are stale; today they are the ones above. This card must not duplicate that fix; it should rely on #3407 for it.
- **#3669** ("Lane leases held by already-dead PIDs were not reclaimed automatically", filed 2026-09-13): the SAME defect class as the finished-worker half. Its own first hypothesis is exactly this: two leases carried a purpose-only session (`merge-mechanical-dispatcher-main`) that `itemNumFromSession` cannot parse. Today's four sessions confirm that hypothesis (the grammar check above). It is open and unbuilt, so its fix, extended to purpose-named sessions, covers this half.
- **#3657** ("lane-pool acquire's ensureDeps leaks npm ci's inherited stdout into the captured lane path"): NOT the same defect. It is about npm's output corrupting the path that `acquire` prints, and has nothing to do with leases.
- What neither card covers, and what this card is for: (1) a standing recovery for the two safe dirty classes (a lane dirty only by a one-line claim flip, and a lane holding only known scratch files), with salvage first; (2) the worker side: whether a worker's own brief must end with a `release`.

## The design choice (needs the operator)

- **(a) Release the lease on a refused acquire.** This is #3407. Small and local.
- **(b) Reap a lease whose holder session has finished**, in the session reaper or in `list --acquirable`. This is #3669, extended to purpose-named sessions. Needs a liveness signal for a session that has no item number: the `claude agents` listing, or a heartbeat.
- **(c) Worker briefs end with a release.** Cheapest, but it depends on the model remembering, and the failure above happened exactly when a worker was stopped or refused mid-task. Belt and braces only.
- **(d) A janitor operation for the two safe dirty classes**, run standing or on demand: salvage first (the same patch-plus-directory format the salvage folder uses), then clean and release. Refuses any lane with real uncommitted work. This is the piece nothing else builds.

**Proposed default:** (a) and (b) ship as the fixes of #3407 and #3669, not here; this card builds (d), with (c) added to worker briefs as belt and braces. Open questions for the operator: is "one-line claim flip" and "known scratch file" a closed list kept in one place, and does the janitor run standing (a tick) or only when `list --acquirable` comes back thin?

## Done when

Written for the proposed default (d); if the operator picks another option, this section is rewritten before the card is built.

1. **Executable** — `npx vitest run lane-janitor` passes. The new suite builds a temp pool with three lanes: (i) dirty only by a one-line claim flip, (ii) dirty only by a known scratch file, (iii) holding real uncommitted work. It runs the new janitor verb and asserts that (i) and (ii) are salvaged first (a patch and a directory exist in a temp salvage folder), cleaned, and appear in `list --acquirable`, while (iii) is left byte-for-byte untouched, is not acquirable, and is named in the verb's output. Fails today: no such verb exists.
2. **Executable** — `npx vitest run lane-pool` and `npx vitest run lease-reaper` stay green, and the janitor never removes a lane whose lease is live and not stale.
3. **Executable** — `npm run check:standards` reports 0 errors.
