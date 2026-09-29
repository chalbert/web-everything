---
kind: story
size: 8
tier: pinned
parent: "xejxlwl"
status: open
scope: ["we:scripts/conveyor/health-watch-core.mjs", "we:scripts/conveyor/health-watch.mjs", "we:scripts/conveyor/health-smells/index.mjs", "we:scripts/conveyor/health-smells-notify-list.mjs", "we:scripts/operations/dispatch-eligibility.mjs", "we:skills-src/conveyor/build-dispatch-daemon.mjs", "we:scripts/operations/review-dispatch.mjs", "we:scripts/operations/review-extra-seats.mjs", "we:scripts/lib/provider-routing.mjs", "we:scripts/operations/completion-store.mjs"]
dateOpened: "2026-09-28"
tags: []
---

# Health loop MVP: auto first-action, verify, escalate for 'reviews not completing' and 'builder idle while work queued'

MVP story (operator-pinned, 2026-09-28): two SLO checks get an automatic FIRST ACTION + VERIFY + ESCALATE, on top of we:scripts/conveyor/health-watch-core.mjs's existing shadow-mode smell framework (#4077), which today only alerts/investigates and never acts. (1) 'reviews not completing' — breach when no review completion (we:scripts/operations/completion-record.mjs kind:'review') lands in N minutes while reviews are owed; action: read the failing seat/provider off the most recent review-seat rows (we:scripts/conveyor/run-scorecard-store.mjs, we:scripts/lib/provider-routing.mjs#selectReviewSeatProvider) and re-dispatch the stalled review job (we:scripts/operations/review-dispatch.mjs / we:scripts/operations/review-job.mjs) with that seat skipped via the existing quota/allowance gate (we:scripts/operations/review-extra-seats.mjs's own quota-cooloff skip) — the exact gap that let a quota-exhausted Codex advisory seat crash every review job twice tonight. (2) 'builder idle while work queued' — extends the existing we:scripts/conveyor/health-smells/daemon-owed-no-dispatch.mjs signal; action: diagnose hold reasons via the declared we:scripts/operations/dispatch-eligibility.mjs dry-run, then release any stale build-dispatch claim whose PR has already settled, via the SAME retirement logic we:skills-src/conveyor/build-dispatch-daemon.mjs's own runBuildDispatchTick 'retired' path already computes. Both checks share one new generic action+verify+escalate mechanism on the episode model (we:scripts/conveyor/health-watch-core.mjs), gated off by default (mirrors #4078/#4079's own dispatch-off-until-flipped discipline) since this is the health daemon's first ever WRITE capability against another subsystem's state.

## Design

**The generic mechanism (shared by both checks).** `we:scripts/conveyor/health-watch-core.mjs`'s smell shape
already carries an optional `diagnose: {command, args, timeoutMs}` that `we:scripts/conveyor/health-watch.mjs`
runs read-only on `opened`/`flapping` (its own tick, `:596-608`). This story adds a sibling optional field,
`action: {command, args, timeoutMs}`, and three episode fields (`actedAt`, `verifyAfterMs`-derived
`verifyDeadline`, `recoveredAt`) plus one plan kind, `'act'`:
- On `opened`, if the smell declares `action` and the daemon-level gate below is open, `planActions`
  (`we:scripts/conveyor/health-watch-core.mjs`) emits an `act` entry (mirrors the existing `diagnose` entry,
  same shape, run the same way — a real command run with a timeout, never a raw code path re-derived per
  check).
- `we:scripts/conveyor/health-watch.mjs`'s tick executes it exactly like today's diagnoses loop (`:596-608`):
  same hard timeout, same `scrubText`/`summarizeDiagnosisOutput` before anything is persisted, output recorded
  as `ep.actionResult`. A budget gate mirrors `we:scripts/conveyor/health-investigate-plan.mjs`'s own
  `planInvestigations` shape verbatim (one action in flight per episode, a rolling-24h cap, no action while an
  inhibiting episode — `bad-credentials`/`gh-graphql-budget`/`gh-call-failures`/`machine-overload` — is open):
  never a second, different budget model for the same "don't hammer a broken system" problem #4078 already
  solved once.
- The NEXT tick(s) after `actedAt` re-evaluate the SAME smell (nothing new needed — `stepEpisodes` already
  re-runs every registered smell every tick); if it comes back clean and the episode's normal `closeAfter`
  hysteresis closes it, `recoveredAt` is stamped and nothing further happens. If the episode is STILL open at
  `now - actedAt >= verifyAfterMs` (a new per-smell config number, alongside `openAfter`/`closeAfter`), it is
  marked `escalated: true` and a `notify` plan entry fires UNCONDITIONALLY (never `shadowSuppressed` — an
  action that provably didn't work is exactly the case shadow-mode suppression must not hide), reusing the
  existing notify path (`we:scripts/conveyor/health-watch.mjs`'s desktop notification,
  `notifyDesktopChecked`) and, once `we:backlog/xjnidoc-*.md` lands, that SAME `we:scripts/conveyor/health-watch.mjs`
  notify loop's sibling publish call to its stream (additive there — this story's own Must does not depend on
  that card).
- **Global off-switch, matching #4078/#4079's own precedent**: a new `actionsEnabled: false` default on
  `we:scripts/conveyor/health-watch-core.mjs`'s `DEFAULT_HEALTH_CONFIG` (materialized in the health watch's own
  runtime config file under its state root, same as every other config number in that object) gates the WHOLE
  `act` plan kind — with it off, both checks still
  diagnose and alert exactly as any other smell does today, just without the first action. This is the health
  daemon's first-ever write against another subsystem's state (everything through #4079 either reads, or
  writes ONLY its own state dir / an uncleared card through a lane); the off-switch is the same "operator turns
  it on" discipline #4078/#4079 both already carry, not a new invention.

**Check 1 — "reviews not completing".** New smell,
`we:scripts/conveyor/health-smells/review-completion-stalled.mjs`:
- **Probes** — the existing `prEventsStatus`/`prs` probes for "reviews are owed" (an open, non-draft PR with no
  terminal review label) plus a new read of `we:scripts/operations/completion-store.mjs`'s records filtered to
  `kind: 'review'` (`we:scripts/operations/completion-record.mjs`'s own closed enum) for "when did a review
  last reach `status: 'done'`".
- **Breach** — reviews are owed and no `review` completion record has reached `done` in `N` minutes (config,
  default 30 — the same order of magnitude as tonight's ~2h incident, caught long before it compounds).
- **Deterministic diagnosis** — the tail of the most recent `review`-kind completion records
  (`we:scripts/operations/completion-store.mjs`) plus the most recent seat rows from
  `we:scripts/conveyor/run-scorecard-store.mjs`, read via `we:scripts/lib/provider-routing.mjs`'s own
  `selectReviewSeatProvider` inputs — this is what actually failed tonight: a Codex advisory seat hit its quota
  and CRASHED the review job instead of being SKIPPED by the cooloff that `we:scripts/operations/review-extra-seats.mjs`
  already implements for its own per-seat calls.
  - **Action** — re-dispatch the stalled PR's review job (`we:scripts/operations/review-dispatch.mjs`'s
  `dispatchReview` / `we:scripts/operations/review-job.mjs`'s `run`) with the diagnosed failing seat/provider
  explicitly excluded — the SAME allowance gate `we:scripts/operations/review-extra-seats.mjs` already applies
  per-call (a provider whose last seat row hit quota is skipped), invoked as a re-dispatch rather than
  discovered only after a second crash.

**Check 2 — "builder idle while work queued".** Extends the EXISTING
`we:scripts/conveyor/health-smells/daemon-owed-no-dispatch.mjs` smell (already breaches on "dispatched 0 while
blocked for 30 min" — no new probe or breach logic) with:
- **Deterministic diagnosis** — the declared `dispatch-eligibility` dry-run read
  (`we:scripts/operations/dispatch-eligibility.mjs`, already a declared operation, already read-only) instead
  of only the daemon's own refusal-reason histogram — a second, independent read of WHY nothing is dispatching.
- **Action** — release any stale build-dispatch claim whose run has already settled: the SAME "retire" logic
  `we:skills-src/conveyor/build-dispatch-daemon.mjs`'s `runBuildDispatchTick` already computes (a claim is
  retired when its PR delivers the item, or it left the cleared queue on a real, non-empty queue read) —
  called directly against the live claim store, so a claim goes stale even while the build-dispatch daemon
  ITSELF is the frozen/idle thing (the exact tonight's-incident shape: "builder frozen then idle"), rather than
  waiting for that daemon's own next tick to notice.

## MVP cut

**Must:**
1. `action`/`verifyAfterMs`/`actionsEnabled` on the episode model and `planActions`
   (`we:scripts/conveyor/health-watch-core.mjs`), with the budget gate mirroring
   `we:scripts/conveyor/health-investigate-plan.mjs`'s shape.
2. The action-execution + verify + unconditional-escalate loop in the tick
   (`we:scripts/conveyor/health-watch.mjs`), scrubbed and timed-out exactly like the existing diagnoses loop.
3. `review-completion-stalled` smell — probe, breach, diagnosis, action (re-dispatch with the failing seat
   excluded) — `we:scripts/conveyor/health-smells/review-completion-stalled.mjs`.
4. `daemon-owed-no-dispatch`'s new diagnosis (dispatch-eligibility dry-run) + action (retire settled stale
   claims) — `we:scripts/conveyor/health-smells/daemon-owed-no-dispatch.mjs`.
5. Both smell ids added to `we:scripts/conveyor/health-smells-notify-list.mjs`'s `NOTIFY_EVEN_IN_SHADOW` so an
   escalation actually reaches the operator today, in shadow mode, exactly like the 13 smells already there.
6. `actedAt`/`recoveredAt` recorded on the episode (the time-to-detect/time-to-recover numbers the parent epic
   names) — cheap, the same edit as item 1, so it rides in the Must even though a DISPLAY surface for it is a
   Could below.
7. Unit tests for 1–4 (fixture-driven, no real `gh`/`claude`/build-dispatch daemon), mirroring
   `we:scripts/conveyor/__tests__/health-investigate-dispatch.test.mjs`'s own fake-sink shape.

**Could (real, already designed above, not built now — see the parent epic's own follow-up list for the
larger items; these are the two things that ride ALONGSIDE this exact scope but aren't required for the two
checks to work):**
- The `we:backlog/xjnidoc-*.md` stream publish call on `escalated` — additive once that card lands; this
  story's Must ships the desktop-notification escalation rung on its own, complete without it.
- A display surface for the recorded time-to-detect/time-to-recover numbers (plan page / Plateau `/wip`) — the
  numbers are recorded (Must, item 6); showing them anywhere is separate product work.

**Size.** `size: 8` — real net-new surface (a generic action/verify/escalate mechanism plus two check-specific
diagnoses/actions plus tests), matching the sizing this repo already gave `we:backlog/xjnidoc-*.md` for a
comparably-shaped new mechanism; within the ~1.5× MVP budget (12) for a `size: 8` card.

## Interfaces

- `we:scripts/conveyor/health-watch-core.mjs` — `DEFAULT_HEALTH_CONFIG` gains `actionsEnabled: false`; smell
  shape gains optional `action`/`verifyAfterMs`; `planActions` gains the `'act'` kind and the unconditional
  (never `shadowSuppressed`) escalate-on-`escalated` notify; `stepEpisodes`/episode shape gain `actedAt`,
  `verifyDeadline`, `recoveredAt`, `escalated`.
- `we:scripts/conveyor/health-watch.mjs` — a new `runActions` step beside the existing diagnoses loop
  (`:596-608`), same timeout/scrub discipline, budget-gated the same way
  `we:scripts/conveyor/health-investigate-plan.mjs`'s `planInvestigations` already is.
- `we:scripts/conveyor/health-smells/review-completion-stalled.mjs` (new) — probes `prEventsStatus`/`prs` +
  a new `reviewCompletions` probe (thin read over `we:scripts/operations/completion-store.mjs`); `diagnose`
  reads `we:scripts/conveyor/run-scorecard-store.mjs` + `we:scripts/lib/provider-routing.mjs`; `action`
  re-dispatches via `we:scripts/operations/review-dispatch.mjs` with the failing seat excluded through
  `we:scripts/operations/review-extra-seats.mjs`'s existing skip gate.
- `we:scripts/conveyor/health-smells/daemon-owed-no-dispatch.mjs` — gains `diagnose` (the
  `we:scripts/operations/dispatch-eligibility.mjs` dry-run) and `action` (retire settled claims via
  `we:skills-src/conveyor/build-dispatch-daemon.mjs`'s own retirement logic against the live claim store).
- `we:scripts/conveyor/health-smells-notify-list.mjs` — two new entries in `NOTIFY_EVEN_IN_SHADOW`.

## Tasks

1. Generic action/verify/escalate mechanism on the episode model + budget gate (Must).
2. Tick-side `runActions` execution loop (Must).
3. `review-completion-stalled` smell: probe, breach, diagnosis, action (Must).
4. `daemon-owed-no-dispatch` diagnosis + action addition (Must).
5. Notify-list wiring for both smell ids (Must).
6. `actedAt`/`recoveredAt` episode fields (Must).
7. Unit tests for 1–6 (Must).
8. `we:backlog/xjnidoc-*.md` stream-publish wiring on `escalated` (Could, once that card lands).
9. Time-to-detect/time-to-recover display surface (Could, separate follow-up card).

## Delivery shape

One PR. Items 1–7 are one coherent slice — a generic mechanism with no concrete check exercising it, or a
check with no mechanism to run its action, each prove nothing standalone — so they land together; the Could
items are explicitly deferred, not split into a parallel PR in the same lane.

## Done when

1. **Must — Executable.** Unit tests prove: an `act` entry is only planned when `actionsEnabled` is true and
   no inhibiting episode is open; the budget gate matches `planInvestigations`'s own shape (one in flight, a
   rolling-24h cap); an episode that clears within `verifyAfterMs` never escalates; one that does not clear
   escalates UNCONDITIONALLY (never shadow-suppressed); both new smells' diagnosis and action fire on a
   fixture-driven `opened` transition with a fake action command asserting its argv.
2. **Must — Live proof.** With `actionsEnabled: true` in the real health config, one real "builder idle while
   work queued" episode (or a faithfully reproduced fixture of one, per this repo's own "no load generator"
   precedent for smells hard to trigger live —
   `we:scripts/conveyor/health-smells/machine-overload.mjs`'s own header) shows the dispatch-eligibility
   diagnosis running, a real stale claim (if any exists) retired, and — whichever way it resolves — the
   episode's `actedAt`/`recoveredAt`/`escalated` fields populated correctly in its report.
3. **Could.** Stream-publish wiring on escalate; a time-to-detect/time-to-recover display surface.
