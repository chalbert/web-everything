---
bornAs: xrhnxmu
kind: story
size: 2
priority: high
parent: "3718"
status: open
relatedTo: ["2449", "3720", "3725"]
scope: ["plateau:tools/drain-daemon/daemon.mjs", "plateau:tools/drain-daemon/lib.mjs", "plateau:tools/drain-daemon/lib.test.mjs"]
dateOpened: "2026-09-19"
tags: []
---

# Drain daemon clone refresh fails on most passes since 2026-09-19 (corrupt commit-graph), leaving it 47 commits behind: repair it and make a failing refresh an alert

The resident drain daemon logs `clone refresh failed` on 167 of 215 passes on 2026-09-19 and keeps running on its stale checkout, now 47 commits behind `main`. The cause is a corrupt commit-graph and invalid remote-tracking refs in its clone, not SSH. Repair the clone, then make repeated refresh failure an alert with a stated staleness limit, so the daemon never silently decides on old code.

Found by the driving session on 2026-09-20 and re-verified read-only from this session (nothing in the daemon's clone was changed).

## Evidence (2026-09-20 00:05Z)

- The daemon is alive: pid 53121, up about 18 days (started 2026-09-02), ticking about every 80 seconds. It landed every approved PR on 2026-09-19.
- The daemon's log (in plateau-app's daemon state folder), repeating on consecutive passes (00:02:53Z, 00:04:11Z, 00:05:31Z): `WARN: clone refresh failed (Command failed: git fetch --quiet origin main) — running this pass on the existing checkout`. Counts by day: 1 to 4 a day from 2026-08-29 to 2026-09-07 (sporadic), then **167 on 2026-09-19 out of 215 passes**, 6 so far on 2026-09-20. In the last 300 log lines, 97 of 104 passes failed the refresh.
- The daemon's own clone (its single-lane private pool, `we-drain-daemon`) has `origin/main` at `7bac0e5fc`; GitHub's `main` is `b4331d9`. The compare API says the clone is **47 commits behind**.

## The cause is not SSH

The failure was hypothesised to be an SSH URL with no usable key. That does not hold here. The daemon's clone does use an SSH remote (`git@github.com:…`), but a `git ls-remote` over that same SSH URL from a normal shell answers immediately with the agent's key, and the daemon's own environment carries `SSH_AUTH_SOCK`. Running the daemon's exact fetch as `git fetch --dry-run origin main` inside that clone fails BEFORE any network use with:

`fatal: You are attempting to fetch 74e7eda9…, which is in the commit graph file but not in the object database. This is probably due to repo corruption.`

`git fsck --connectivity-only` in the same clone reports `invalid sha1 pointer` on several remote-tracking refs (for example `refs/remotes/origin/lane/cost-2563`, `…/lane/memory-delivery-loop`). The commit-graph file is dated Sep 7. So: a corrupt commit-graph plus dangling remote-tracking refs. **Not tested:** whether SSH would also fail from the daemon's launchd environment once the corruption is fixed; confirm that after the repair.

The daemon's log records only `Command failed: git fetch --quiet origin main`. The child's stderr is discarded, which is why this looked like an unknown failure for a day.

## Why it matters for the landing trigger

The daemon runs each pass on the old tree: its copy of `we:scripts/merge-ai-prs.mjs`, its gates, and any mergeability or conflict read it makes are from that clone. Its README says the refresh is also how it picks up new drain code, so newer drain logic on `main` has not been running. Whether any merge in this period was wrong because of it is unknown; an audit of the merges since 2026-09-19 against current `main` is optional and not in this slice. This is the class of bug `land-advance` (#3720) must not inherit: **it must fail closed on a stale checkout, not warn and continue.** The same "a failing refresh degrades silently" shape hit `we:scripts/lane-pool.mjs` `refresh` in #3725 (there the unverified cause was an SSH-remote lane; the per-lane isolation fix stands regardless).

## Fix shape

1. **Immediate repair (operator or whoever owns the daemon clone; not done here).** Remove the stale commit-graph file and delete or prune the invalid remote-tracking refs, then fetch; or re-provision the clone with the daemon's `install` command. Confirm the next pass logs a successful refresh and the clone reaches `origin/main`.
2. **Capture the reason.** Log the failed command's stderr, not only the "Command failed" line.
3. **Make repeated failure an alert.** After a configurable number of consecutive refresh failures (default 3), raise the daemon's existing alert path (its alert files and desktop notification) instead of a plain `WARN`. Have `status` report "last good refresh" and "commits behind".
4. **A stated staleness limit.** Beyond a limit (commits behind, or hours since the last good refresh) the daemon says so loudly. **Whether it should also REFUSE to merge past the limit is a policy call for the operator, not built here:** the drain is the sole writer to `main`, so stopping landings has a real cost. Default proposed: alert only; refusing is an opt-in setting.

## Done when

1. **Executable** — `npx vitest run plateau:tools/drain-daemon/lib.test.mjs` (run from that repo) carries cases that fail before and pass after: N consecutive refresh failures produce one alert record and a captured stderr; a later success clears the alert; `status` output includes last good refresh and commits behind; a single transient failure raises no alert.
2. **Probed live** — after the repair, the daemon's next pass logs no `clone refresh failed`, and the clone's `origin/main` equals GitHub's `main`.
