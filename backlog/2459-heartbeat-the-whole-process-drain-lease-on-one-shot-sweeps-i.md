---
bornAs: xx2zvaz
kind: story
size: 2
status: open
dateOpened: "2026-07-12"
tags: []
scope:
  - we:scripts/merge-ai-prs.mjs
  - we:scripts/__tests__/merge-ai-prs.test.mjs
---

# Heartbeat the whole-process drain lease on one-shot sweeps in merge-ai-prs

The #2449 always-on whole-process lease in we:scripts/merge-ai-prs.mjs heartbeats only inside the watch loop; a ONE-SHOT full/label sweep holds the lease for its whole run but never heartbeats it, so a sweep that outlives the lease TTL (a deep multi-repo blockedBy cascade) reads STALE and a second full drain reclaims it mid-run — the exact #2424 double-drain the lease exists to prevent. Fix: heartbeat during the one-shot sweep too (per-PR-landed or on a timer), keeping the existing release-on-every-exit contract. Surfaced by the PR #444 human review (findings applied to #441's landed code).

## Design

**Where the hole is, exactly.** In `we:scripts/merge-ai-prs.mjs` the lease is acquired once, at the
`── Whole-process drain lease — ALWAYS-ON for full/label sweeps + watches (#2449)` block
(`decideDrainLeaseGate` → `acquireDrainLease(DRAIN_LOCK_ROOT, leaseOwner, { scope: leaseScope })`), and released
on every exit path by the `process.on('exit', …)` handler installed right after. The only
`heartbeatDrainLease(...)` call is the first statement inside the `for (let pass = 1; ; pass++)` **watch** loop.
The one-shot branch — `if (!WATCH) { … await sweepOnce() … process.exit(…) }`, which sits *above* that loop —
never reaches it, so a sweep longer than `DRAIN_LEASE_MINUTES` (`we:scripts/readiness/drain-lock.mjs`) reads
stale to `drainLeaseStatus` and a second full drain reclaims it mid-run.

**Shape: a pure decider plus a thin pump, matching the file's existing split.** `we:scripts/merge-ai-prs.mjs`
already exports ~50 pure deciders next to an impure shell (`decideDrainLeaseGate`, `isPassIdle`,
`decideBatchesIdleExit`, …), each unit-tested in `we:scripts/__tests__/merge-ai-prs.test.mjs` with no fs/gh/clock.
Keep that:

- Export a pure `shouldHeartbeatLease({ leaseHeld, lastBeatMs, nowMs, intervalMs })` (or an equivalent
  `dueForHeartbeat`) so the cadence is testable without a clock or a lock directory.
- Drive it from the one-shot path. Prefer a **per-PR-landed** beat inside the land cascade (right beside the
  existing `withLandWriteLock(...)` block, where the loop already iterates candidates) over a `setInterval`:
  the sweep is synchronous-ish and a timer would need `unref()` plus teardown on all four exit codes
  (0 / 2 / 3 / 5). A belt-and-braces timer is acceptable only if it is `unref()`ed and cleared before every
  `process.exit`.
- `--under-lease` (a resident-daemon child pass) must still **never** heartbeat — the parent daemon owns the
  beat, exactly as the watch-loop call site's comment records. Gate on the same `leaseHeld` flag, which is
  already `false` under `under-lease`.
- Re-supply `{ scope: leaseScope }` on every beat (#2458 — `heartbeatDrainLease` rewrites the marker, so an
  omitted scope silently widens/erases it). The watch call site does this; copy it.
- The release-on-every-exit contract is unchanged: no new exit path, no second release.

## Done when

- `npx vitest run merge-ai-prs` fails before and passes after on a new case in
  `we:scripts/__tests__/merge-ai-prs.test.mjs` that drives the pure heartbeat decider: not due before the
  interval, due after it, and **never** due when the lease is not held (the `--under-lease` child).
- A test proves the wiring, not just the decider: a one-shot sweep whose landed-PR loop runs past the interval
  invokes the injected heartbeat at least once, and an `--under-lease` one-shot invokes it **zero** times.
- `grep -c heartbeatDrainLease` over `we:scripts/merge-ai-prs.mjs` returns **two or more** call sites (today it
  returns exactly one, inside the watch loop) — the cheap observable that the one-shot path is covered at all.
- No new lease release: the `process.on('exit', …)` release installed at the acquire block remains the single
  release site, and `--dry-run` / `--only` / `--no-drain-lease` runs still acquire nothing and beat nothing.

## Independent review — 2026-08-21

Confidence: **High**

**Risks assessed** (per we:backlog/3103-*.md's taxonomy):

- **premise** (addressed; strategy: verify by mutation or reversion BEFORE building) — The described hole (one-shot sweeps never reach the watch loop's sole `heartbeatDrainLease` call at we:scripts/merge-ai-prs.mjs:4058) is real and verified against the live file; DRAIN_LEASE_MINUTES resolves to 15 (we:scripts/readiness/file-locks.mjs:47 via we:scripts/readiness/drain-lock.mjs:62), a plausible overrun window for a deep cascade, and the card's own Done-when requires a red-before/green-after test proving the gap before the fix.
- **interface** (addressed; strategy: round-trip test at the seam, written by whoever owns neither half) — The card explicitly requires re-supplying `{ scope: leaseScope }` on every new beat (per #2458's rewrite-the-marker contract in `heartbeatDrainLease`, we:scripts/readiness/drain-lock.mjs:176-181), mirroring the watch call site (we:scripts/merge-ai-prs.mjs:4058) exactly rather than leaving the seam to drift.
- **decorative-guard** (addressed; strategy: mutate the guarded line; require a NAMED test to redden) — runCli/sweepOnce are not exported or executed by tests today (the test file itself documents this as 'this file's standing norm', we:scripts/__tests__/merge-ai-prs.test.mjs:462, and instead hand-reproduces the cascade loop as a 'faithful mini', e.g. we:scripts/__tests__/merge-ai-prs.test.mjs:3581-3614), so the card's prescribed 'wiring test' will necessarily be such a mini rather than an execution of the real call site — mutating the REAL heartbeat call would not by itself redden that mini. The card mitigates this the same way this file already does elsewhere (e.g. we:scripts/__tests__/merge-ai-prs.test.mjs:466-472) by also requiring the `grep -c heartbeatDrainLease >= 2` source-contract check as a textual backstop, which is the established precedent for this exact class of untestable-wiring gap in this file — not a new gap this card introduces.

**Corrections recommended:**

- none — the preparation held up as written.

The card accurately diagrams the live we:scripts/merge-ai-prs.mjs lease-acquire/release/watch-heartbeat structure (verified at we:scripts/merge-ai-prs.mjs:3966-3996, 4027-4041, 4057-4058) and proposes a fix — gate a new per-PR-landed heartbeat on the same `leaseHeld` flag beside the existing `withLandWriteLock` call in the land cascade (we:scripts/merge-ai-prs.mjs:3692, inside the `for(;;)` cascade at we:scripts/merge-ai-prs.mjs:3647-3719 that sweepOnce, we:scripts/merge-ai-prs.mjs:2809, runs once per one-shot) — that is structurally sound, correctly scoped, and consistent with this file's existing pure-decider/thin-pump split and its established 'faithful mini' + source-contract test conventions.

_Recorded through the declared `review-prep` operation._
