---
kind: story
size: 2
parent: "3383"
status: open
scope: ["we:scripts/lane-pool.mjs", "we:scripts/verify-lane.mjs", "we:scripts/lib/lane-verify.mjs"]
dateOpened: "2026-09-23"
tags: []
---

# lane-pool acquire leaves stale verify-lane marker, blocking the new holder's verify start

2026-09-22/23: `we:scripts/lane-pool.mjs acquire` reset a lane to a fresh HEAD but left the previous holder's `.lane-verify` marker on disk, so `we:scripts/verify-lane.mjs` refused to start for the new HEAD with "superseded: refusing to START verification for <HEAD>: the on-disk marker holds a terminal green record for <other sha>". Hit at least 5 times: WE lane-28 (marker c8fe5ef5, new HEADs 7808c462 and 40ebaba2), plateau-app lanes 6, 10, 12, 14 -- each cost a lane swap plus a full re-verify.

Root cause: we:scripts/lane-pool.mjs#cmdAcquire's reset block (`git checkout -B <branch> <baseRef> --force` then `git clean -fd`) never touches `.git/.lane-verify` -- `git clean -fd` does not descend into `.git`, and cmdAcquire never imports we:scripts/lib/lane-verify.mjs (no `VERIFY_FILENAME`/`readVerifyMarker` reference exists in we:scripts/lane-pool.mjs today). A fresh lease therefore inherits whatever terminal marker the previous holder left.

we:scripts/verify-lane.mjs's own START-write guard (its `preStart` check, just before `writeMarker(verifyStartBody(...))`) already tries to protect against exactly this: before writing a `running` marker for a new HEAD it runs `git merge-base --is-ancestor <marker sha> origin/main` (#3538) and only allows the overwrite when that succeeds. But an abandoned/superseded lane's last-verified sha is typically NEVER merged into origin/main -- that is what makes it abandoned -- so the ancestry check fails and the guard refuses indefinitely. The only escapes today are `node we:scripts/verify-lane.mjs reset` (which itself refuses while a live foreign lease exists) or swapping to a different lane, which is what all 5 incidents above actually did.

Proposed fix location: we:scripts/lane-pool.mjs#cmdAcquire, in the reset block, right after `git clean -fd` and its `unmapLanes(repo, [chosen])` call (once `baseRef`/the new HEAD sha is resolved and the tree is confirmed reset). Read the lane's `.git/.lane-verify` marker via we:scripts/lib/lane-verify.mjs#readVerifyMarker, and if it holds a terminal (`green`/`red`) record whose `sha` is NOT an ancestor of the new HEAD, delete it (the same unconditional delete we:scripts/verify-lane.mjs's own `reset` mode already performs via `unlinkSync`). Do NOT clear a marker whose sha IS an ancestor of the new HEAD -- that is a legitimate re-verify of already-covered history, and today's ancestry check in we:scripts/verify-lane.mjs already lets that case proceed correctly, so clearing it too would just be redundant, not unsafe.

Why this is safe to do at acquire and not more broadly: acquire has just force-reset the lane's entire tree (`checkout -B --force` + `clean -fd`) onto a base the marker's sha has no proven relationship to. Nothing can still be relying on that marker inside THIS lane, because acquire only runs against a lane it is freshly claiming -- any previous lease on it is already gone by the time the reset block executes.

This must NOT be confused with (and must not weaken) the overlap guard's real purpose, which is unrelated: we:scripts/verify-lane.mjs's START-write and finish-write compare-and-set logic (#2833 findings 1/4) protects two verify RUNS racing inside the SAME lane against the SAME lease -- e.g. a slow `verify` still running when a second `verify` starts for a newer commit, or a slow run's finish trying to stamp its result over a newer run's already-recorded one. That protection lives entirely inside we:scripts/verify-lane.mjs's own read-modify-write sequence during a single lease's lifetime and is orthogonal to acquire's ACROSS-LEASE marker inheritance bug; the fix above only ever runs once per acquire, before any verify run for the new lease has started, so it can never race one.

Done when: acquire a lane whose `.git/.lane-verify` marker holds a terminal green (or red) record for a sha that is NOT an ancestor of the lane's freshly-reset HEAD (e.g. seed one by hand: write `{"sha":"<unrelated-sha>","status":"green"}` to `$(git -C <lane-dir> rev-parse --absolute-git-dir)/.lane-verify` right after an ordinary acquire, then re-run `we:scripts/lane-pool.mjs acquire --lane=<n>` against that same lane), and `node we:scripts/verify-lane.mjs` then starts (writes a fresh `running` marker, exit reflects the gate run) instead of exiting 3 with `status:'superseded'`.

## Done when

1. **Executable** — seed a stale terminal marker for an unrelated sha, acquire the lane, and confirm
   `we:scripts/verify-lane.mjs` starts instead of refusing as `superseded`:

   ```sh
   LANE=$(node scripts/lane-pool.mjs acquire --lane=<free lane N> --no-install --json | python3 -c 'import json,sys;print(json.load(sys.stdin)["path"])')
   GITDIR=$(git -C "$LANE" rev-parse --absolute-git-dir)
   echo '{"sha":"0000000000000000000000000000000000dead","status":"green"}' > "$GITDIR/.lane-verify"
   node scripts/lane-pool.mjs acquire --lane=<same lane N> --no-install   # simulates the NEXT holder's acquire/reset
   node scripts/verify-lane.mjs --repo="$LANE" --gate=true
   echo "exit=$?"   # TODAY: exit 3, status:'superseded', detail cites the stale unrelated sha as "an overlapping verify-lane run"
                     # AFTER THE FIX: exit 0 (or 2 on a real gate failure) — never 3/superseded for a marker whose sha is not an ancestor of HEAD
   ```
