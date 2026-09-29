---
bornAs: xx0x4zv
kind: story
size: 2
tier: pinned
status: open
scope: ["we:scripts/lane-whois.mjs", "we:scripts/conveyor/health-smells/lane-worker-without-lease.mjs", "we:scripts/conveyor/lane-pool-health-watch.mjs"]
dateOpened: "2026-09-29"
tags: []
---

# lane-worker-without-lease reads finished sessions as live workers (47 lanes flagged at once)

The new health smell lane-worker-without-lease (#4370, PR #2989, we:scripts/conveyor/health-smells/lane-worker-without-lease.mjs) opened on 47 WE lanes in one tick at 2026-09-29T21:26Z while no worker was running at all. Example: lane-1 — lease none, last holder released 2026-09-28T15:05Z (session conveyor-delivery-lane-1-fd32fe99), its PRs #2838/#2839 merged — yet we:scripts/lane-whois.mjs reports holder ALIVE (live session found). The whois live-session test counts a finished/idle background session still listed by claude agents (cwd or last holder = the lane) as a live worker. MVP: a worker is live only if its session is actually running (busy/process alive and transcript written recently), never merely listed; a released lease whose holder session has since gone idle is not a worker. Test: fixture with an idle listed session → no smell; busy session → smell. Proof: live health tick shows 0 opens with no workers running; soak break: revert → mass opens again.

## Done when

1. **Executable** — the new whois `liveWorker` cases and the smell-input case fail before this item lands and pass after:

```bash
npx vitest run scripts/__tests__/lane-whois.test.mjs scripts/conveyor/health-smells/__tests__/lane-journal-smells.test.mjs \
  -t "liveWorker|workersWithoutLease"
```

2. Live: one health tick on the current host, with no worker running in any unleased lane, opens 0 `lane-worker-without-lease` smells (before: 47).

## Premise check (against origin/main, 2026-09-29)

Still true. `we:scripts/lane-whois.mjs:405` sets `liveOwner = liveAgentInLane(agents, dir, [lease?.ownerSession, last?.ownerSession, last?.workerSession, last?.session])`. `liveAgentInLane` (`we:scripts/lib/lane-salvage.mjs:103`) treats any listed `claude agents --json` entry as live unless its `state` is one of `done/failed/stopped/completed/killed` — an entry with no state, or an idle one, counts as live, and a match by cwd or by the last holder's session id is enough. `workersWithoutLease` (`we:scripts/conveyor/lane-pool-health-watch.mjs:468`) then flags every unleased lane whose `liveOwner === true`. Not done: no commit references #4544 / `4544` beyond the JIT-number drain commit. Scope is right: the three files the card names are the whole touch-set, plus their two test files.

## Design

`liveOwner` is shared with the reclaim/salvage safety gates (`we:lane-pool.mjs` reclaim, `liveAgentInLane` callers in `we:lane-salvage.mjs`), which are deliberately **fail-safe** (unknown ⇒ assume live, never reset a lane under a possible worker). Tightening `liveAgentInLane` would weaken that safety gate, so do NOT change it. The smell is alert-only and the opposite polarity (a false positive is noise, a false negative is a missed alert), so it needs its own stricter signal:

1. `we:scripts/lane-whois.mjs` adds a second field `liveWorker` beside `liveOwner`. It is `true` only when a matched agent (same cwd / last-holder-session match `liveAgentInLane` uses — factor the match into a shared helper that returns the matched entries, so both fields use one match rule) is *actually running*: `state` is an explicit running state (`working`; the builder first captures the real `claude agents --json` state vocabulary from a live idle/finished listed session and pins it as a const, since only `working` and an absent `state` are observed on this host today) **and**, where the entry exposes a transcript/last-activity time, that time is within a recent window (`WORKER_ACTIVE_WINDOW_MS`, default 10 min, aligned with `IDLE_TOO_LONG_MS` in `we:scripts/operations/live-work.mjs:38`). A listed entry with an idle/unknown/absent state is NOT a worker. `liveOwner` and `holderAlive` are unchanged.
2. `workersWithoutLease` (`we:scripts/conveyor/lane-pool-health-watch.mjs:468`) filters on `row.liveWorker === true` instead of `row.liveOwner`. The smell file `we:scripts/conveyor/health-smells/lane-worker-without-lease.mjs` needs no logic change; update its header comment to say "running worker".
3. The whois human line (`we:lane-whois.mjs:575`) keeps printing `(live session found)` for `liveOwner` and adds `(running)` for `liveWorker`, so an operator can tell a merely-listed session from a running one.

## MVP

Musts only: (0) FIRST, before any code, capture the real `claude agents --json` state vocabulary from a live idle/finished listed session and pin it as a const (the running set is unverified today — only `working`/absent seen); an unknown state is treated as not running; (a) `liveWorker` on the whois row with the strict state+recency rule; (b) `workersWithoutLease` reads it; (c) tests below; (d) doc comments updated. Deliberately OUT: changing `liveOwner`/`liveAgentInLane` semantics or the reclaim gate; reading transcript files ourselves for recency when the listing has no timestamp (use the listing field only); auto-closing already-open smells (they close on their own after `closeAfter: 2` clean ticks).

## Test plan

- `we:lane-whois.test.mjs`: unleased lane, fake `claude` lists the last holder's session with `state: "idle"` (a finished but still-listed session) → `liveOwner:true` (unchanged) but `liveWorker:false`. Red before: the field does not exist (undefined ≠ false).
- Same, with `state: "working"` and cwd in the lane → `liveWorker:true`. Red before: field missing.
- Same, `state: "working"` but last-activity older than the window → `liveWorker:false` (guards a hung/stale entry). Red before: field missing.
- Entry with no `state` at all, or an unknown state → `liveWorker:false` while `liveOwner:true` (pins the fail-safe vs fail-quiet split)
- `state: "working"` with NO timestamp in the listing → `liveWorker:true` (chosen behaviour: recency only applies when the listing exposes it).
- Every new whois test title contains the literal `liveWorker` so the Done-when `-t` filter matches them.
- The existing `we:lane-journal-smells.test.mjs` case "workersWithoutLease picks unleased lanes with a live owner only" is REWRITTEN to feed `liveWorker` (its current `liveOwner`-only rows would otherwise return `[]` and fail).
- If the shared match helper refactors `liveAgentInLane`, the existing `we:lane-salvage` and #4372 whois tests stay green unchanged (behaviour-identical for reclaim/salvage callers).
- The smell's `summary` string and header comment say "running worker"..
- `we:lane-journal-smells.test.mjs`: `workersWithoutLease` given rows `{lease:null, liveOwner:true, liveWorker:false}` → `[]`; `{liveWorker:true}` → `[lane]`. Red before: the first returns the lane.
- Regression: the existing #4372 tests (unleased lane with a live agent ⇒ `liveOwner:true`, `holderAlive:true`) stay green unchanged.

## Proof plan

Before: on the live host, `node we:scripts/lane-whois.mjs --json` (read-only) shows the idle-listed lanes with `liveOwner:true` and the health log line carries `workerWithoutLease` with dozens of lanes (47 at 2026-09-29T21:26Z). After: the same command shows `liveWorker:false` for those lanes and the next real health-watch tick logs an empty `workerWithoutLease` and opens 0 smells. Soak break: revert the `workersWithoutLease` filter to `liveOwner` on a scratch copy, re-run the tick against the same listing, and the mass-open returns — captured as before/after in the PR body.

## Follow-ups

- Move the `claude agents --json` state vocabulary into one shared const module used by `we:live-work.mjs`, `we:lane-salvage.mjs` and whois (three places each hard-code a state set today).
- Consider whether the reclaim gate's `liveOwner` should also use recency, so a long-idle listed session stops blocking reclaim of a lane (a safety-side change — needs its own decision, not this item).
