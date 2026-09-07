---
bornAs: x7llsyo
kind: story
size: 5
parent: "3383"
status: open
dateOpened: "2026-09-06"
tags: [conveyor, review, pr-watch, alerting]
scope:
  - we:scripts/conveyor/parked-pr-progress-watch.mjs
  - we:scripts/conveyor/__tests__/parked-pr-progress-watch.test.mjs
  - we:skills-src/conveyor/runner.mjs
---

# General PR-landing-progress watch: alert on a parked PR that stalled with nobody working it

A standing mechanical pass, mirroring `we:scripts/conveyor/parked-pr-conflict-watch.mjs` and
`we:scripts/conveyor/duplicate-pr-watch.mjs`, that catches a parked PR (`review:pending`/`review:changes`/
`review:human`) making no progress toward landing — nobody has ever dispatched an independent review for it —
and posts a `review:changes`-shaped finding via `we:scripts/conveyor/reconcile-finding.mjs`. Distinct from the
two narrow watches already built under `#3383`: neither catches simple neglect, only its own single trigger
(a real merge conflict, or a duplicate sibling PR).

**Build-ready — `we:3549` ratified 2026-09-07, `blockedBy` cleared.** The exact rule for "neglected" was
carved into `we:3549` per this repo's own rule that a fork never lives inline in a build item; both its forks
are now ratified by the operator:

- **Fork 1 — signal (a) only, no-review-ever-dispatched.** This story builds signal (a) exactly as designed
  below. Signal (b) (the stale-verdict-label re-check, PR #1939's shape) is a separate follow-on,
  `#3596` (`blockedBy` this story) — **out of scope for this build.**
- **Fork 2 — time source (a) + configurable threshold, default 24h.** Read the current `review:*` label's
  apply time off GitHub's own issue-events timeline (`gh api`, the `labeled` event) as the durable
  start-of-park marker — no new store. The threshold defaults to 24 hours but MUST be a configurable knob
  (env var, e.g. `WE_PR_NEGLECT_THRESHOLD_HOURS`), not hardcoded.

See `we:3549` for the full ratification record and both forks' original option analysis.

## The evidence (2026-09-06/07, real incidents, neither caught by the two watches already built)

1. **PR #1928** sat `review:pending`, mergeable, for an extended period with no independent review ever
   dispatched for it. Found only because a human happened to check `gh pr view` directly.
2. **PR #1939** sat with a stale `review:changes` label left over from a duplicate-PR situation (`#1942`) that
   was resolved and closed — the label was never refreshed once the concern it encoded stopped applying.

**Every existing sweep traced and ruled out**, same method `we:scripts/conveyor/parked-pr-conflict-watch.mjs`'s
own header uses:

- `we:scripts/conveyor/parked-pr-conflict-watch.mjs` (`#xw0odtv`) — fires ONLY on `mergeable === 'CONFLICTING'`.
  A parked PR with no conflict at all, like both incidents above, never touches this pass.
- `we:scripts/conveyor/duplicate-pr-watch.mjs` (`#3500`) — fires ONLY when 2+ open PRs currently deliver the
  SAME item number. #1928 was never a duplicate. #1939 WAS one, once — but the moment `#1942` closed, this
  pass has nothing left to compare it against; it was never designed to notice a finding it once raised has
  gone stale.
- `we:scripts/conveyor/reconcile-fix-dispatch.mjs` (`#3438`) — dispatches a FIX for an already-`review:changes`
  PR with a live finding; it never asks whether a `review:pending` PR was ever given a REVIEW in the first
  place, and never re-derives whether an existing `review:changes` label still applies.
- `we:scripts/conveyor/review-status-tag.mjs` — closest prior art for the *shape* of a fix (see Design
  direction below), but it only refreshes its own cosmetic `review-status:*` label from live `claude agents
  --json` state; it never touches the `review:*` VERDICT labels this item is about, and it says nothing about
  how long a PR has been unreviewed.
- `we:scripts/conveyor/reconcile-pass.mjs` (`#3296`) — decides WHEN a review is currently owed, each run, from
  fresh ground truth; it has no memory of "not dispatched for a long time" across runs and isn't itself a
  neglect *alarm* — it is one of the pieces this pass's diagnosis reasoning can point to, not a substitute.

**Confirmed a genuinely unwatched axis, not a duplicate card.** Nothing periodically asks "is this parked PR
actually making progress toward landing" as its own concern, independent of any one specific cause.

## Design direction (this card's own proposal, informed by the two sibling watches — not invented from scratch)

- **Reuse the same finding/bounce mechanism already built, don't invent a third one.**
  `we:scripts/conveyor/reconcile-finding.mjs` is already the shim for "a mechanical pass found this PR
  conflicts with something decided elsewhere" — `we:scripts/conveyor/duplicate-pr-watch.mjs` already proves the
  pattern generalizes past merge-conflicts specifically. Post through it exactly the same way: a
  `review:changes` bounce, out-of-process (never in-process — that shim's own shared harness calls
  `process.exit()` on completion, which would kill a multi-PR sweep after its first finding, the same reason
  both sibling watches shell it as a subprocess).
- **Detection reuses ground truth already read elsewhere, no new liveness mechanism.** "No independent review
  ever dispatched" is answered by the SAME `claude agents --json` read + session-name-grammar match
  (`review-<pr>`/`fix-<pr>`) that `we:scripts/conveyor/session-reaper.mjs` and
  `we:scripts/conveyor/review-status-tag.mjs` already use — see `we:3549` Fork 1 for the exact rule.
- **Alert-only — this pass fixes nothing itself.** Matches the established philosophy from
  `we:scripts/conveyor/parked-pr-conflict-watch.mjs`: detection and judgment-triggering findings are a separate
  concern from auto-fixing. A neglected PR gets a bounce that routes it into the SAME fix→re-review cycle
  every other reconciliation finding already uses; nothing here re-dispatches a review or edits the PR itself.
- **Dedup, no separate store.** A PR that already carries `review:changes` is skipped on a later sweep — the
  label's own presence is the durable marker, mirroring `we:scripts/conveyor/duplicate-pr-watch.mjs`'s own
  "the label IS the state" contract (#2612, no parallel state store). Once flagged, a PR stays flagged until a
  human/agent clears it, same as every other reconciliation finding — this pass is not self-clearing the way
  `we:scripts/conveyor/parked-pr-conflict-watch.mjs`'s conflict label is, since "was this ever reviewed" only
  gets MORE true over time, never less.
- **The cadence.** Wired into `we:skills-src/conveyor/runner.mjs`'s `makeCliMechanicalPasses`, beside the
  `we:scripts/conveyor/parked-pr-conflict-watch.mjs` and `we:scripts/conveyor/duplicate-pr-watch.mjs` lines —
  the same "piggyback on a pass the headless runner already ticks" shape, so neglect is checked every tick
  with no new cron/daemon.

## Tasks

1. ~~Ratify `we:3549` (both forks) — unblocks everything below.~~ **Done — ratified 2026-09-07, see `we:3549`.**
2. `we:scripts/conveyor/parked-pr-progress-watch.mjs` — pure core (the neglect predicate per the ratified rule,
   a finding-plan builder) + IO shell (a `gh pr list`/`gh api` read, `we:scripts/operations/dispatch-lane-io.mjs`'s
   own `defaultListAgents` for the session-liveness read, a subprocess call to
   `we:scripts/conveyor/reconcile-finding.mjs` per finding), CLI `sweep` verb + `--dry-run` + `--repo=`,
   mirroring both sibling watches' own shape exactly.
3. Unit tests: the neglect predicate's branches (parked-long-enough+never-reviewed → true; parked-long-enough
   +review session found in full agents history → false; not-parked-long-enough → false regardless of review
   history; already-`review:changes` → skipped, dedup), plus fixtures reproducing PR #1928's and PR #1939's
   real shapes (mocked, not live `gh`/`claude` calls).
4. Wire into `we:skills-src/conveyor/runner.mjs`'s `makeCliMechanicalPasses`.
5. Live-verify with `--dry-run` against the real open-PR list; `npm run check:standards` and the full `vitest`
   suite stay green.

## Done when

1. **Executable** — `npx vitest run we:scripts/conveyor/__tests__/parked-pr-progress-watch.test.mjs` passes,
   including fixtures reproducing PR #1928 (never-reviewed, parked past threshold → flagged) and PR #1939
   (stale label per the ratified Fork-1 rule → flagged) shaped incidents, and a negative case proving a
   normally-waiting, recently-parked PR is never flagged.
2. **Executable** — `we:scripts/conveyor/parked-pr-progress-watch.mjs sweep --dry-run` runs clean against the
   live open-PR list with no `gh` errors.
3. **Executable** — `we:skills-src/conveyor/runner.mjs`'s `makeCliMechanicalPasses` invokes the new pass
   (`grep -n parked-pr-progress-watch we:skills-src/conveyor/runner.mjs`), so it runs every tick with no new
   cron/daemon.
4. **Executable** — `npm run check:standards` stays green.
