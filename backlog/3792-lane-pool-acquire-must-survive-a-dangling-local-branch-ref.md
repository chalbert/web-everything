---
bornAs: x0cexbl
kind: story
size: 2
parent: "3383"
status: open
relatedTo: ["3657", "3725", "2452"]
scope: ["we:scripts/lane-pool.mjs", "we:scripts/lib/lane-lease.mjs"]
dateOpened: "2026-09-21"
tags: []
---

# lane-pool acquire must survive a dangling local branch ref

`lane-pool acquire` dies outright when one lane holds a dangling local branch ref, so a dispatch that only wanted a free lane fails as infrastructure. Make acquire survive it: heal the ref or skip the lane and name it. Design-first and deliberately not cleared for the conveyor. Relates #3657 (acquire's dependency install) and #3725 (list/refresh acquirability; its Defect 2 makes `refresh` survive one bad lane, this card is the `acquire` path and the dangling-ref cause).

## FOUND (2026-09-21)

- **Reported failure.** On 2026-09-21 an independent review failed `blocked-on-infra` because the `git fetch origin --prune` inside `lane-pool acquire` died with `fatal: bad object refs/heads/lane/3026-scope-readiness-prepare-3026`, a dangling local branch ref in lane-30; four more were reported in lane-3 and lane-8. I could NOT confirm those now: on 2026-09-21 later, `git fetch origin --prune --dry-run` and `git for-each-ref refs/heads` both succeed in lanes 30, 3 and 8, so the refs have since been removed.
- **Reproduced in a throwaway repository.** A loose ref file under `refs/heads/lane/` naming an object that does not exist makes `git fetch origin --prune` print `fatal: bad object refs/heads/lane/<name>` and exit 1, and makes `git for-each-ref refs/heads` itself die with `fatal: missing object <sha> for refs/heads/lane/<name>`. So any code that enumerates refs to find the bad one must tolerate the same failure.
- **Where it throws.** `fetchOriginPruneWithRetry` in we:scripts/lane-pool.mjs is called from `refreshLane` and from `acquire` just before its reset. It retries only the transient ref-lock signature (`isTransientRefLockError`, we:scripts/lib/lane-lease.mjs) and rethrows anything else, so the throw escapes `acquire` and nothing is handed out even when other lanes are healthy.
- **No health signal.** `lane-pool status` shows dirty, behind and leased, with nothing about broken refs.

## DESIGN TO SETTLE

1. **Heal or skip.** Delete a local branch ref whose object is missing (it cannot hold work, since the object is gone) and say so, or skip that lane, name it and pick another. Healing is only safe for a ref that resolves to no object; anything else is left alone.
2. **Where the check runs.** In `acquire` before the fetch and on the lane it chose, so a healthy pool never pays for a scan of all lanes.
3. **Finding the bad ref.** Cannot use `for-each-ref` (it dies); parse the fetch error, or read the loose and packed ref files directly.
4. **Status flag.** Show a lane with a dangling ref in `status` and `list`.
5. **Cause.** Not established here; a ref left by an interrupted branch delete or a pruned object store is a guess to test, not a finding.

## Done when

1. **Executable** — a new test `we:scripts/__tests__/lane-pool-dangling-ref.test.mjs` builds a fixture lane whose `refs/heads/lane/<name>` is a loose ref file naming a missing object (the reproduction on this card), runs `node we:scripts/lane-pool.mjs acquire` against it, and asserts that acquire exits 0 having either healed the ref (and said which) or skipped that lane by name and handed out another. Fails today: acquire throws `fatal: bad object refs/heads/lane/<name>`.
2. **Executable** — `node we:scripts/lane-pool.mjs status` marks the fixture lane as having a broken ref.
