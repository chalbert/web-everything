---
kind: story
size: 3
parent: "2301"
status: open
blockedBy: ["2350"]
dateOpened: "2026-07-09"
preparedDate: "2026-08-14"
tags: [agent-memory, lane, hook, self-improving-loop]
scope:
  - we:scripts/memory-land-at-stop.mjs
  - we:.claude/settings.json
  - we:scripts/__tests__/
  - we:skills-src/closing-session/SKILL.md
scopeRationale: "One new hook script, its registration as the repo's FIRST Stop hook in we:.claude/settings.json, its unit test, and a one-line pointer in the close skill so the close does not re-grow the memory-PR exception it deliberately removed."
---

# Land the memory-lane diff via a deterministic hook on Stop — no agent-run /pr

A deterministic **Stop** hook commits the dedicated memory-lane's `agent-memory-src` diff and hands it to
the standard transport (`we:scripts/pr-land.mjs --label-on-green` + the drain) — the agent never runs `/pr`
for memory. Blocked by #2350's supervised repoint: until the machine-global memory symlink resolves to the
reserved lane, this hook would be committing the PRIMARY checkout. Slice of #2301.

## Premise re-verified 2026-08-14 — one correction to the card's own prose

The original card said this reuses "the close-session §1a survivors-ride-a-lane path". **That path no
longer exists.** `we:skills-src/closing-session/SKILL.md` now states, in as many words, *"The close never
opens a PR — no carve-out. The former memory-PR exception is gone"*, and *"Substantive agent-memory
content is NOT in this carve-out … the close no longer writes it at all"*. §1a today is
`we:scripts/conveyor/learnings-drop.mjs` — an untracked, machine-local JSONL append that touches no repo
content and opens nothing. So this item must **not** hook into the close; it must stand up its own
trigger. That is the fork below.

Also verified, and it is why nothing here is a no-op yet:

- **The repo has no `Stop` hook at all.** `we:.claude/settings.json` registers only `PreToolUse` (five
  Edit/Write hooks + one Bash) and `PostToolUse` (three). A repo-wide grep for `"Stop"` / `SessionEnd`
  across `we:scripts/`, `we:docs/`, `we:skills-src/` and `we:.claude/` returns nothing. This item adds the
  first one.
- **The reserved memory lane does not exist yet.** `we:scripts/lane-pool.mjs status --json` shows no lease
  carrying `reserved: true`, and the machine-global symlink still realpaths into the primary
  (`~/.claude/projects/-Users-…-webeverything/memory` → `we:.claude/agent-memory` → `we:agent-memory-src/`).
  #2350's agent-doable half (the `--reserve` primitive) landed; its human-gated cutover did not. The
  `blockedBy: ["2350"]` edge is therefore real, not bookkeeping.
- **#2352 already landed** (the guard's memory carve-out is gone, `b54f49a8`), so the guard side of #2301
  needs nothing from this item.

## Decided design

### Fork the card left open: which trigger — Stop, loop-tick, or close-session? → **Stop, alone.**

- **close-session is ruled out by an existing ruling, not by preference.** The close skill deliberately
  removed its memory-PR carve-out; re-adding memory landing there re-opens the exception that was closed.
  It is also a *skill* — agent judgment — and #2301's own constraint 3 is that the landing must be
  machinery. Same reason `we:scripts/drain-push-at-close.mjs` is a script the close *calls*, not prose the
  close *follows*.
- **loop-tick is ruled out by coverage.** It only fires under the conveyor. A solo session that writes a
  memory entry and stops would never land it, which is the majority case today.
- **Stop is the only harness event that fires for every session shape** — solo, batch, dispatched,
  conveyor tick. One trigger, no per-topology wiring.

*Residual, stated not hidden:* a session killed without a clean Stop leaves its memory commit for the next
session's Stop to pick up. That is acceptable — the diff is idempotent (the next Stop sees the same dirty
tree and lands it), and it is strictly better than today, where nothing lands it at all.

### Where the memory lane is — derive it, never configure it

Resolve the lane from the symlink itself: `realpathSync(<memory symlink>)` yields
`<lane>/agent-memory-src`, so the lane root is its `dirname`. Authoritative by construction — whatever the
symlink points at is the tree that actually got written, so a config drift is impossible. Two refusals
before acting, both no-op-and-log rather than throw:

1. the resolved root is a constellation **primary** checkout (a mis-pointed or un-cut-over symlink — the
   #2350-not-done state) → refuse, loudly, and land nothing;
2. the lane's lease is not reserved (`isReservedLease`, `we:scripts/lib/lane-lease.mjs:58`) → refuse; a
   pooled lane's `refresh` would `reset --hard` the memory before the PR merged.

### Concurrency on a shared global tree

#2301 settled on **one machine-global** memory lane, so two sessions can Stop at once into the same
working tree. Serialise with the existing O_EXCL lease primitive in `we:scripts/readiness/drain-lock.mjs`
(`acquireDrainLease` :161, `releaseDrainLease` :184, `DRAIN_LOCK_ROOT` :49) under its own `scope`. Exactly
one Stop wins; the loser no-ops and the winner's commit already includes the loser's writes (same tree).

### Not blocking the session

The Stop hook does only the cheap local half synchronously — is the tree dirty, take the lock, `git add
agent-memory-src && git commit` — then spawns `pr-land` **detached**, copying the proven shape at
`we:scripts/drain-push-at-close.mjs:94-119` (`detached: true` :116, fd-backed stdio, `.unref()` :119).
A Stop hook that awaited `--label-on-green` would hold the session open for the whole CI wait.

## Interfaces

- **New:** `we:scripts/memory-land-at-stop.mjs`, modelled on `we:scripts/drain-push-at-close.mjs`
  (165 lines) — a pure decision plus an injectable-boundary runner:
  - `export function decideMemoryLand({ laneRoot, lease, dirtyPaths, leaseStatus })` → `{ fire, reason }`
  - `export function buildPrLandArgs({ ref, bodyFile })` → the `pr-land` argv
  - `export function runMemoryLand({ spawnFn, nowMs, … })` — the impure edge, injected so the test
    asserts argv + `detached`/`unref` without a real PR
  - flags mirroring the sibling: `--dry-run`, `--json`
- **Reused as-is:** `we:scripts/pr-land.mjs` `--ref=… --label-on-green --body-file=…`. Note
  `prCreateBodyGuard` (`we:scripts/pr-land.mjs:346`) **refuses a bodyless PR**, so the hook must write a
  body file — a generated one-liner naming the session and the memory files touched.
- **Reused as-is:** `we:scripts/lib/lane-lease.mjs` — `isReservedLease` :58, `describeLease` :202.
- **Reused as-is:** `we:scripts/readiness/drain-lock.mjs` — `acquireDrainLease` :161,
  `drainLeaseStatus` :197, `releaseDrainLease` :184.
- **Registration:** a new `"Stop"` array in `we:.claude/settings.json`'s `hooks` object, alongside the
  existing `PreToolUse` / `PostToolUse`. The Stop event's payload shape must be checked against the
  running harness before wiring — no other hook in this repo consumes it, so there is no local precedent
  to copy. Fail-OPEN on any parse error, the same contract every guard in `we:scripts/` already keeps.

## Ordered tasks

1. Confirm the Stop event payload against the live harness (a throwaway hook that logs stdin); record the
   shape in the script's header.
2. Write `we:scripts/memory-land-at-stop.mjs` — pure decision first (`decideMemoryLand`,
   `buildPrLandArgs`), then the injected-boundary runner.
3. Add the two refusals (primary-checkout target, non-reserved lease) and the drain-lock serialisation.
4. Unit-test in `we:scripts/__tests__/memory-land-at-stop.test.mjs`: clean tree → no-op; primary target →
   refuse; non-reserved lease → refuse; lock held → no-op; happy path → correct argv, `detached`, `unref`.
5. Register the `Stop` hook in `we:.claude/settings.json`.
6. Add one line to `we:skills-src/closing-session/SKILL.md` pointing at the hook, so a future close does
   not re-grow the memory-PR exception on the grounds that "nothing lands memory".
7. Live check: write a memory entry, Stop, confirm a `ready-to-merge` PR appears and the primary checkout
   stays clean.

## Delivery shape

**One piece.** The script is meaningless without its `Stop` registration and the registration is unsafe
without the script's two refusals, so a slice would land a half-armed hook. It is also small — one new
file in the shape of an existing 165-line sibling, one settings entry, one test file. It stays behind
#2350's supervised cutover; landing it first would point the committer at the primary tree.

## Size — 3 (unchanged)

Basis: one new script that is a near-clone of an existing 165-line sibling
(`we:scripts/drain-push-at-close.mjs` — same pure-decision + injected-spawn shape, same detach mechanics,
same lease primitive), one `we:.claude/settings.json` entry, one test file. No new primitive is invented.
The two things that keep it off a 2: this is the repo's **first** `Stop` hook, so the event payload is
unverified surface, and the shared-tree race needs its own lock scope.

## Done when

- With the memory symlink resolved to the reserved lane, writing a memory entry and stopping the session
  produces an open PR labelled `ready-to-merge` whose diff is exactly the `agent-memory-src` change — with
  no agent-run `/pr` and no agent decision in the loop.
- `git status --porcelain` in the primary checkout is empty across that whole round-trip.
- A Stop with a clean memory lane exits 0 and spawns nothing (asserted in the unit test and observable in
  `--dry-run --json`).
- With the symlink still pointing at a **primary** checkout, the hook refuses, logs the reason, commits
  nothing and opens nothing (unit-tested).
- With the target lane's lease **not** `reserved`, the hook refuses and opens nothing (unit-tested).
- Two Stops racing on the same memory lane produce **one** commit and **one** PR; the loser no-ops
  (asserted against a held `drain-lock` lease).
- The Stop hook returns without waiting on CI — the test asserts the spawned child carries
  `detached: true` and is `unref`'d, matching `we:scripts/drain-push-at-close.mjs`.
- A malformed or unrecognised Stop payload fails **open**: exit 0, nothing spawned, session unaffected.
- `we:skills-src/closing-session/SKILL.md` names the hook as what lands memory, and still says the close
  itself opens no PR.
