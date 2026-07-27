---
bornAs: xuasox4
kind: story
size: 5
parent: "2612"
status: resolved
scope: ["we:scripts/merge-ai-prs.mjs", "we:scripts/conveyor/", "we:scripts/readiness/drain-lock.mjs"]
dateOpened: "2026-07-26"
dateStarted: "2026-07-27"
dateResolved: "2026-07-27"
tags: []
---

# Event-driven land: fast-drain on PR green-exit with ordering, re-gate, idempotency

Kill the up-to-60s daemon poll-gap per item: on a `we:scripts/conveyor/pr-watch.mjs` green-exit, trigger the
fast-drain immediately instead of waiting for the resident daemon's next re-sweep
(`plateau:tools/drain-daemon` `DEFAULTS.intervalSec=60`). This is the **one** lever on the serial land critical
path, so it's the one most likely to move #2606 throughput (not just latency). The fast-drain is **the daemon's
own land path scoped to one PR** — never a caller-trusted shortcut — so it carries the daemon's full ordering,
authority, and mutual-exclusion guarantees. The in-conveyor *wake* is already instant (`pr-watch` exits on
merge/park); this closes the daemon-side *land trigger* gap.

## Acceptance criteria (the design jury's three hard requirements)

The jury (high-care `decision-prose`) approved the lever only with these guards — a naive `--only` fire fails all
three:

1. **Ordering.** The fast-drain runs the identical `planLabelDrain` blockedBy / impl-first sequencing the sweep
   runs (`we:scripts/merge-ai-prs.mjs`). A WE half or a `blockedBy`-dependent PR that isn't ready **defers** — it
   is never landed early. (Today `--only=<pr>` targets one PR; confirm it evaluates blockedBy against the
   candidate set, and add it if not.)
2. **Authority ≠ serialization.** It re-derives the full pre-land gate **server-side** — non-author review
   sign-off present, required check green, mergeable — via `we:scripts/lib/pr-merge-gate.mjs`, never trusting the
   tick's "green" assertion. A buggy/compromised tick must not be able to land an unreviewed or red PR. (The
   single `gh pr merge` already routes through that gate; keep it on the `--only` path.)
3. **Mutual exclusion + idempotency.** Today `--only` **bypasses** the whole-process drain lease
   (`decideDrainLeaseGate` → `bypass` for `onlyPr`, `we:scripts/merge-ai-prs.mjs`) and leans only on the numbering
   mutex (`we:scripts/readiness/drain-lock.mjs`). Establish that the mutex serializes the actual `gh pr merge`
   **write** (not just NNN allocation), and add a **per-PR idempotency guard** so a concurrent daemon 60s sweep on
   the same PR is a safe no-op — never a double-attempt.

## Round-2 review — acceptance criteria

Two corrections from the second design-jury round:

- **Trigger on the LAST precondition, not CI-green alone.** The non-author review sign-off usually lands *after*
  CI goes green, so a green-only trigger fires while the gate is still incomplete, correctly no-ops, and nothing
  re-fires when the sign-off arrives → the PR falls back to the ≤60s daemon sweep exactly as today (C saves
  nothing for the common review-after-green item). The fast-drain must fire on **whichever of {CI-green,
  review-sign-off-present} completes last** — i.e. also on the sign-off event.
- **C's throughput claim is provisional on #2680.** Removing the ~60s poll-gap is only a *throughput* win if the
  serial land is a material fraction of wall-clock — the exact thing #2680 measures. Until then C is a *latency*
  lever; sequence/justify it against #2680's regime finding, don't assert it moves throughput.

## Invariants held

Sole-writer-to-main (the merge still runs under the daemon's serialization), the non-author review sign-off (re-gated
at land), and impl-first/WE-last ordering (planLabelDrain) are all preserved — the trigger moves earlier, the
authority does not move.

## Progress

Delivered (lane clone, gate green, 265 unit tests passing):

- **Round-2 trigger — `we:scripts/conveyor/pr-watch.mjs`.** The watcher now fires the single-PR fast drain
  (`we:scripts/merge-ai-prs.mjs --only=<pr> --label=ready-to-merge`) on the false→true transition of a new pure
  `isReadyToLand` predicate — CI-green AND the non-author review sign-off (`reviewDecision`) both present, so it
  fires on whichever precondition completes **last** (closes the green-only-no-op gap). Fires once per
  ready-transition (no busy-drain), re-fires after a ready→not-ready→ready dip (e.g. a rebase-drop restarts CI),
  best-effort (a fire failure falls back to the daemon's ≤60s sweep), and `--no-fast-drain` disables it. The poll
  now also fetches `statusCheckRollup,reviewDecision`.
- **AC1 Ordering — `planLabelDrain` + the `--only` path in `we:scripts/merge-ai-prs.mjs`.** Added an
  `extraOpenItems` union to `planLabelDrain`; the `--only` fast drain feeds it the full open-PR item set
  (`collectOpenPrContext`) so a narrowed single-PR candidate set still evaluates `blockedBy`/`stackParents`
  against the whole constellation — a target whose blocker is still open **defers**, never lands early. Added
  `--only-repo=<slug>` so a bare `--only=<n>` targets the LOCAL repo (fixing a latent same-numbered-PR-across-repos
  ambiguity) while the full scope stays the ordering context.
- **AC2 Authority.** The `--only` path runs the identical fresh-`gh` classify + review-escalation gate + the
  shared merge via `we:scripts/lib/pr-merge-gate.mjs` (`gh pr merge`) as the full sweep — it never trusts the
  tick's assertion; the fast drain re-derives review sign-off / required check / mergeable server-side
  (confirmed + documented).
- **AC3 Mutual exclusion + idempotency — `we:scripts/readiness/drain-lock.mjs` + the merge cascade.** Added
  `withLandWriteLock` (shares the serial-writer mutex key with the numbering section) and wrapped the actual
  `gh pr merge` write in it — the mutex now serializes the merge write, not just NNN allocation (the only lock a
  lease-bypassing `--only` fast drain shares with a concurrent daemon sweep). Inside the lock, a per-PR
  `isPrAlreadyMerged` re-check makes a concurrent 60s daemon sweep on the same PR a safe no-op — never a double
  `gh pr merge`.

Throughput note (Round-2): C removes the ≤60s poll-gap, a **latency** lever; whether it moves #2606 throughput
is provisional on #2680's serial-land-vs-wall-clock regime finding — not asserted here.
