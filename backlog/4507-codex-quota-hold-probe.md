---
bornAs: x6ov12s
kind: story
size: 3
status: resolved
scaffoldedBy: "conveyor-codex-quota-probe"
dateScaffolded: "2026-09-29"
scope: ["we:scripts/operations/review-extra-seats.mjs"]
dateOpened: "2026-09-29"
dateResolved: "2026-09-29"
preparedDate: "2026-09-29"
preparedAgainstSha: "5f085100221b37db3e033d22990b9903593c6558"
tags: []
---

# Codex review seats stuck: quotaHold reads only the last row, no way to refresh a stale hold

we:scripts/operations/review-extra-seats.mjs's quotaHold only reads a provider's MOST RECENT review-seat scorecard row. Once a row shows a quota hold, every future seat call for that provider is skipped before it ever runs, so no fresh row can ever be written and nothing can end the hold before its stated reset even if the provider real quota has since refreshed. Add a bounded periodic self-probe: while held, allow one real seat call through after a configurable interval has elapsed since the last row, recorded through the normal scorecard append path. Confine the change to we:scripts/operations/review-extra-seats.mjs's quotaHold and probe path.

## Done when

1. **Executable** — `npx vitest run we:scripts/operations/__tests__/review-extra-seats.test.mjs` (the `we:` here
   is only this card's locus-lint marker; strip it to actually run the command) includes a
   `probeDue`/`quotaHoldOrProbe` case built from the live incident's own numbers (codex, `quotaUsedPercent: 99`,
   `quotaResetsAt: "2026-10-03T17:11:00-04:00"`, `scoredAt: "2026-09-28T22:31:00-04:00"`) that FAILS against
   `we:scripts/operations/review-extra-seats.mjs`'s unmodified `quotaHold` (the pre-fix reader — held solid until
   Oct 3) and PASSES once `quotaHoldOrProbe` is wired into both call sites in this file.
2. A scratch copy of the real operator scorecard store (never the real file, path in the Proof plan below) shows,
   before the fix: `codex` held past 2026-10-03; after: once `now - lastRow.scoredAt >= probeIntervalMs`, the
   provider is available for exactly one call again, and a fresh clean row ends the hold on its own (a fresh
   quota-exhausted row re-arms it with a new timestamp instead).

## Premise check (against origin/main, 2026-09-29)

Confirmed live and NOT already fixed / NOT superseded. `origin/main`'s
`we:scripts/operations/review-extra-seats.mjs#quotaHold` (this checkout was stale — the provider split, card
xn2wf9t, had already landed there) is byte-identical in its holding logic to what the incident describes: it
reads only the provider's most recent `review-seat` row and, for the gauge branch, holds
`while quotaUsedPercent >= CODEX_QUOTA_FULL_PERCENT (98) && now < Date.parse(quotaResetsAt)` — no code path
anywhere ever re-admits a held provider before that timestamp. Codex's real last row
(`quotaUsedPercent: 99`, `quotaResetsAt: 2026-10-03T17:11 ET`, `scoredAt: 2026-09-28T22:31 ET`) reproduces the
reported chicken-and-egg exactly: nothing can write a newer row because the hold blocks every call that would
write one. `REVIEW_SEAT_PROVIDERS` is now `['codex', 'agy-claude', 'agy-gemini']` (the same card's provider
split) — the fix must hold for all three, not just codex, even though codex is the one presently stuck.

## Scope check

Real touch-set matches the declared `scope:` — `we:scripts/operations/review-extra-seats.mjs` only (its OWN two
test files, `we:scripts/operations/__tests__/review-extra-seats.test.mjs` and
`we:scripts/operations/__tests__/review-red-team.test.mjs` (the latter defends the `runRedTeam` call site — a
converge red-team round on this card correctly flagged an earlier draft's scope note as under-stating this),
ride along as tests-for-the-file, not a scope expansion). **Note (coordinator, 2026-09-29):** two sibling lanes are also touching this same file right
now (one on this same card number by coincidence of dispatch, one fixing an unrelated `agy-claude`
`--effort`/`--model` argv bug) — this build stays confined to the `quotaHold`/probe call sites only, adds no new
export outside that path, and does not touch `we:scripts/lib/provider-routing.mjs`, the cap/reservation ledger,
or any other shared helper already in flight elsewhere. Rebase on `origin/main` immediately before `open-pr`.

## Design

`quotaHold` itself is unchanged (it is heavily depended-on and already correctly reads "most recent row wins" —
the bug is not in what it computes, it's that NOTHING ever re-admits a held provider so it can write a fresher
row). Add, beside it:

- `PROBE_INTERVAL_ENV` / `DEFAULT_PROBE_INTERVAL_MS` (30 min) / `resolveProbeIntervalMs(env)` — same shape as the
  file's existing `resolveDailyCap`/`resolveSeatTimeoutMs` env readers.
- `probeDue(records, provider, now, intervalMs)` — PURE: true once at least `intervalMs` has elapsed since that
  provider's own most-recent seat row (whatever wrote the current hold, or a prior probe that re-armed it).
- `quotaHoldOrProbe(records, provider, now, env)` — PURE: same return shape as `quotaHold` (a reason string, or
  `null` meaning "may proceed"); when `quotaHold` would hold AND `probeDue`, returns `null` for exactly this one
  read — the caller's normal per-provider single-call-per-run shape (`byProvider` grouping in `runExtraSeats`)
  already means at most one real call results, and that call's own row becomes the new "most recent", which is
  exactly what naturally re-arms (quota-exhausted again → new `scoredAt`, next probe not due for another
  interval) or ends (a clean row → next plain `quotaHold` read is `null` with no probing needed at all) the hold.
  No new state is introduced — no new file, no new store, no hand-edited scorecard — the existing
  `appendScorecard` row IS the state.

Call sites: replace `quotaHold(records, p, now)` with `quotaHoldOrProbe(records, p, now, env)` at BOTH existing
read points inside this file (the added-seats loop and the red-team loop) — a one-line change each, nothing else
in either loop moves.

## MVP (Musts only)

- [ ] `PROBE_INTERVAL_ENV`, `DEFAULT_PROBE_INTERVAL_MS`, `resolveProbeIntervalMs`, `probeDue`, `quotaHoldOrProbe`
      exported from `we:scripts/operations/review-extra-seats.mjs`.
- [ ] Both existing `quotaHold(records, p, now)` call sites switched to `quotaHoldOrProbe(records, p, now, env)`.
- [ ] Unit tests for `probeDue` and `quotaHoldOrProbe`, including the live incident's exact numbers.
- [ ] Live proof against a scratch copy of the real scorecard file (never the real one, never hand-edited).
- [ ] No change to `we:scripts/lib/provider-routing.mjs`, the cap/reservation ledger, `quotaHold` itself, or any
      other shared helper.

Explicitly OUT of MVP (see Follow-ups): a manual on-demand probe operation/CLI; a log line distinguishing a
probe call from an ordinary call in job output; per-provider probe-interval tuning; the race window where two
concurrent reviews both see the same probe as due within one interval.

## Test plan (each fails before the fix, against origin/main's unmodified quotaHold)

1. `probeDue`: false with no rows for the provider; false when `now - lastRow.scoredAt < intervalMs`; true once
   `>= intervalMs` — including the live incident's own numbers (last row `2026-09-28T22:31` ET, `now` several
   hours later same/next day, default 30 min interval → true).
2. `resolveProbeIntervalMs`: default when unset; env override; a garbage/negative env value falls back to the
   default (same pattern `resolveDailyCap`/`resolveSeatTimeoutMs` already test).
3. `quotaHoldOrProbe`: returns `null` unchanged when `quotaHold` itself is `null` (not held — no behavior change
   for the common case); returns the SAME hold reason `quotaHold` would when held but not yet probe-due (recent
   row); returns `null` (probe admitted) when held AND probe-due, reproducing the live incident's row exactly;
   after a simulated fresh `quota-exhausted` row (new, later `scoredAt`) is appended, immediately returns the
   held reason again until the interval elapses a second time (the re-arm).
4. Arc-level (extends the existing `we:scripts/operations/__tests__/review-extra-seats.test.mjs` "runExtraSeats
   — the arc, with fakes" suite): with a held-but-probe-due provider seeded into fake records, `runExtraSeats`
   includes it in this run's routed providers and issues exactly one call to it (never more — the existing
   per-provider single-call-per-run shape already enforces this; the test only needs to confirm the provider
   was not filtered out before reaching that shape).
5. Soak-break proof (RED without the probe / GREEN with it): a test that calls the UNCHANGED, still-exported
   `quotaHold` directly on the live incident's row at `now` = days later but still before `quotaResetsAt` and
   asserts it STILL holds (this is "revert the probe" made concrete — `quotaHold` alone, which is what every
   call site used before this fix, never self-heals), contrasted with the same row through `quotaHoldOrProbe`
   once `probeDue` — which does not hold. Reverting the two call-site edits (the only production change) makes
   every caller read `quotaHold` again and the live incident's hold reproduces exactly as reported, forever.

## Proof plan (live, before/after, on a SCRATCH copy of the real scorecard — never the real file, never hand-edited)

1. Copy the operator's real scorecard store (an absolute path under the operator's home directory, OUTSIDE this
   repo: `we:/.claude/daemon-self-sync-state/conveyor-state/.conveyor/run-scorecards.json` — the `we:` prefix
   here only satisfies the write-time locus lint on this card, it is not a repo-relative path) to a scratch path.
2. BEFORE: `quotaHold(records, 'codex', <2026-09-29 ~2pm ET as epoch ms>)` against the scratch copy's real codex
   row → held, reason names `2026-10-03T...` (matches the reported incident exactly).
3. AFTER: `quotaHoldOrProbe(records, 'codex', <same now>, env)` → `null` (probe admitted) once `now` is past one
   `resolveProbeIntervalMs` beyond the row's own `scoredAt` (it already is, by ~15+ hours). Then append ONE fresh
   row to the SAME scratch copy through the real `appendScorecard` (never a hand edit) simulating what that one
   admitted call would write — first a clean row (`quotaUsedPercent` low) and show `quotaHold` on the updated
   scratch copy now reads `null` with no probing needed at all (hold fully released); separately, appending a
   fresh `quota-exhausted` row instead and showing the hold re-arms with the new timestamp.
4. Never touches the daemon clone or the primary checkout — the scratch copy is the whole proof surface, exactly
   as this brief requires.

## Follow-ups (file as cards via the file-item operation, not built here)

- A manual, operator-triggered probe operation/CLI for an on-demand refresh outside the periodic window.
- A log line in job output distinguishing a probe call ("provider X was held; probing") from an ordinary
  routed call, for observability.
- Per-provider probe-interval tuning (today one interval for all three `REVIEW_SEAT_PROVIDERS`).
- The race window: two concurrent reviews both reading the same stale row within one probe interval could both
  attempt a probe call simultaneously; today nothing dedups that beyond the existing reservation ledger's own
  per-day cap.
- (converge round 1, simplicity lens) `probeDue`'s "most recent seat row for this provider" selection duplicates
  `quotaHold`'s own `seatRows`+filter+sort — a deliberate tradeoff this card made to keep `quotaHold` itself
  byte-identical (see Design), but the duplication itself is real: extract a shared `lastSeatRow(records,
  provider)` helper both readers call, so they can never drift on what "last row" means.
