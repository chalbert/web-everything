---
kind: story
size: 3
parent: "3383"
status: open
scope: ["we:scripts/lib/main-staleness.mjs", "we:scripts/operations/run.mjs", "we:scripts/operations/dispatch-lane-io.mjs"]
dateOpened: "2026-09-20"
tags: []
---

# Read-only operations must not need a hand-synced clone: settle which checkout the orchestrator reads from

FOUND 2026-09-20. The /continue and /handoff commands tell the orchestrator to run the reaper and the operator queue "from an up-to-date lane clone (e.g. lane-54; its HEAD must equal origin/main; the primary checkout is stale)". Lane-54 was 3 commits behind (HEAD da5a98e02, origin/main a69a8061d) and was fast-forwarded by hand before every run. Read in the code and run live 2026-09-20, the real picture is split three ways, and "scripts refuse a lane cwd or a stale checkout" is only true for some of them:
- READS do not refuse. we:scripts/operations/operator-queue.mjs, `we:scripts/operations/run.mjs suggest-next` and we:scripts/lane-pool.mjs status all ran from a lane clone (lane-1) today without complaint. What a stale checkout does to a read is quieter: it lacks the newer scripts and card files (the primary checkout is 190 commits behind its own origin/main ref, with 4 changed files; that ref was not fetched today). Not verified: that suggest-next ranks stale items from a stale checkout (not run against one today).
- DISPATCH does refuse. `assertNotALaneCheckout` in we:scripts/operations/dispatch-lane-io.mjs refuses when the root's basename is lane-N, and `assertMainNotStale` in we:scripts/operations/review-dispatch.mjs (#3439) refuses when the checkout is behind origin/main.
- A sync helper already exists for reads. we:scripts/check-readiness.mjs calls `checkMainStaleness({ autoFf: true })` from we:scripts/lib/main-staleness.mjs, which fetches and fast-forwards a checkout that has not diverged. No operation the orchestrator runs by hand uses it.
- "Which clone" also changes the answer to "what is cleared". The operator's cleared list is a gitignored sidecar, we:.conveyor/queue.json, resolved by script location (we:scripts/conveyor/queue-store.mjs). The same `we:scripts/conveyor/queue.mjs list` command showed 1 entry in the dispatch clone, none in lane-54 and 4 old entries in lane-1. (This fact also feeds the ordered-list card filed alongside.)

OVERLAP, NAMED. #3474 (open): the review-dispatch guard should fast-forward a clean checkout instead of refusing; that covers the dispatch guard for one script. #3752 point 3: a maintained fresh dispatch clone with a refresh step, for the dispatch path. #3748: dispatch clones start untrusted. This card is only the smaller delta: the orchestrator's READ side, and the rule for which checkout it may read from. If the #3752 design settles one maintained clone that reads can use too, fold this card into it.

DESIGN TO SETTLE.
1. A designated read-only clone that syncs itself: one named clone (not a lane, not the primary), fast-forward only before each run, refusing when it is dirty or diverged. Scripts stay unchanged. Cost: one more clone that needs the #3748 trust step, and it is the same clone #3752 proposes for dispatch, so decide whether reads and dispatch share one clone or use two.
2. Operations read origin/main directly: fetch, then run from a temporary detached worktree or export at origin/main. Never stale, works from any cwd, no sync step. Cost per run, and scripts that read the working tree need the path handed to them.
3. Call `checkMainStaleness` as a pre-step inside `we:scripts/operations/run.mjs` for read operations. It moves the checkout it runs in, so it must never run inside a lane another session is working in.
4. Recommendation: option 1, using `checkMainStaleness` as the sync step, with one clone for reads and dispatch, decided after the #3752 and #3748 designs are read.
5. Which lane the orchestrator may read from. A lane belongs to the pool's acquire and release, so a lane number written into a command text is not a lease: the pool can hand that lane to a worker. The rule must say the orchestrator holds a lane it acquired, or reads from a non-pool clone, and no command names a lane number.
6. What a read does on a stale or lane cwd: refuse with the one sync command, or print a one-line "reading N commits behind" banner and continue. Recommendation: banner, because a read that refuses stops the orchestrator on a step that changes nothing.

## Done when

1. **Executable** — a test with a scratch origin and a clone 3 commits behind: the chosen mechanism gives the read operation the content of origin/main (a new script and a new card file are present) with no manual fast-forward, and refuses or prints the banner when the clone is dirty or diverged.
2. **Executable** — run we:scripts/operations/operator-queue.mjs and `we:scripts/operations/run.mjs suggest-next` from a lane cwd and from a stale checkout: each either succeeds on current content or ends with one line naming the sync command; none reads stale content silently.
3. **Human verify** — the operator confirms which clone the orchestrator reads from and that it needs no hand fast-forward before a run.
