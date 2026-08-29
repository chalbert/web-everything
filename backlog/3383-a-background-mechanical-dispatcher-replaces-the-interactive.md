---
bornAs: xyv0vbz
kind: epic
parent: "3029"
status: open
dateOpened: "2026-08-28"
costTokens: "in:1590 cw:2468023 cr:345228334 out:635383"
costUsd: 213.19
costSessions: 2
tags: []
---

# A background mechanical dispatcher replaces the interactive session as delivery supervisor

## The problem, stated plainly (2026-08-27/28, the operator's own words)

"The big problem at the moment is that much of this is handled by a costly session that is getting
super large, keeps forgetting its context and cost a lot." Delivery work — dispatching fixers and
reviewers, watching PR state, clearing stuck labels, healing CI — has run through one long
interactive session. That session IS the single point of failure: expensive per turn, its own
context degrades as it grows, nothing continues if it isn't open. `we:scripts/operator/converge.py`
(PR #1669) already proves most of the individual mechanisms work; what's missing is running them
without a person driving every step.

## The target shape (the operator's own spec)

- The session's role narrows to **queueing work** and **being notified of blocked items that need
  a person** — not driving routine progress turn by turn.
- A **mechanical dispatcher** owns queuing and capacity: it decides what runs now based on
  available capacity, not an agent's guess.
- **Subagents only edit code.** Every command they'd otherwise run themselves is delegated to the
  mechanical layer, which queues it and reports the result back — an agent never blocks waiting on
  its own shell command; it hands off and gets told the outcome.
- A **supervisor watches every agent** — progress, whether it's blocked, whether it's on track —
  and surfaces exactly that to whoever's queueing work, without anyone polling.
- Escalation is the exception path, not the default: most cases resolve mechanically (see
  `#3379`'s sibling cards — the stale-label clear, `ci:failed` healing, the ordering bug behind
  `#1659`'s stranding, the headless-reviewer polling fix); only genuinely novel cases reach an
  agent or a person at all.

## How to build it (the operator's own sequencing — deliberately NOT incremental-merge-from-day-one)

This is the opposite build strategy from `#3379`'s already-landed pieces, deliberately: those were
individually proven, low-risk, and graduated to `main` immediately. This is different in kind — an
unbuilt queue/dispatch/supervision system, not yet proven at all. Build and refine it in a
dedicated branch, alongside whatever else lands, WITHOUT the per-commit review tax that would slow
down free iteration on a design that doesn't exist yet. Once it is genuinely stable — proven over a
long stretch of real use, the way `converge.py` itself was proven tonight — split it into small,
individually reviewable pieces and move them to `main` the normal way, one at a time. Only once
everything has transferred does the real system execute from `main` instead of the branch.

**The one caveat that must not get lost in that plan:** a branch does not make the system's ACTIONS
safe, only its CODE unreviewed. The moment this dispatcher runs for real — even from a branch, even
before any of its code has landed — it is taking real actions against real PRs and real shared
state, exactly as `converge.py` already did all of tonight. "Not yet merged" is not the same
guarantee as "not yet running." Whoever builds this owes the same care to what it's allowed to
touch unattended as to the code itself, from the first real run, not just at graduation time.

## Why this card exists, not more work in the session that wrote it

This session is itself an instance of the problem this epic describes — large, deep into
compaction, expensive per turn. Building the actual dispatcher here would extend the exact pattern
this epic exists to end. Filed so a FRESH session — full budget, none of tonight's accumulated
context to carry — can pick this up and build it properly.

## Done when

1. A background process (not an interactive session) can run at least one real PR through a full
   fix → review → land cycle with zero interactive-session turns inside the loop.
2. A blocked/escalated case reaches a person or a fresh agent via an explicit notification, not
   because someone happened to poll and notice.
3. `we:scripts/operator/converge.py`'s already-proven mechanisms (independent review dispatch via a
   separate process id, `ci:failed` classification, stale-label recovery) are either subsumed by
   the new dispatcher or explicitly superseded by it — not left running in parallel indefinitely.

## Session update (2026-08-28, continued session) — five pieces built and tested, still unlanded

A follow-on session (same day) picked this back up and built five pieces toward the target shape
above, all individually unit-tested and smoke-tested against real subprocesses (not mocks) —
`check:standards` clean, 1300+ tests green as of last verification. Nothing below is landed to
`main`; it sits committed in lane-11 (`/Users/nicolasgilbert/workspace/.lanes/web-everything/lane-11`,
5 commits behind `origin/main` as of this update), deliberately, per this card's own "How to build
it" section above.

1. **Session-identity fix (#3331, resolved)** — `claude --bg` proven to ignore `--session-id`; the
   observer now reads the real handle off the CLI's own `backgrounded · <id> · <name>` stdout line
   instead. Touches `we:scripts/operations/dispatch-lane-io.mjs`, `we:scripts/operations/explore-io.mjs`,
   `we:scripts/operations/wake.mjs`.
2. **`we:scripts/operations/dispatch-lane.mjs` widened to `fix`/`ci-heal` launch kinds** — reuses
   the build-dispatch machinery.
3. **`we:scripts/operations/route-pr-outcome.mjs`** — new declared operation, thin wrapper over the
   existing `deriveReviewDisposition`, read-only, no sink — closes the gap where nothing under
   `scripts/operations/*.mjs` reached the escalation-disposition logic.
4. **`we:skills-src/conveyor/runner.mjs` now actually calls `dispatch-lane`** per surfaced decision,
   instead of only printing what it would do — the mechanization this epic's "Done when" #1 needs.
5. **`we:skills-src/conveyor/supervisor.mjs`** — a new resident process that keeps the runner above
   alive (restart on crash, backoff, JSONL log), roughly half the size of the `plateau-app`
   drain-daemon precedent because the runner already owns the hard parts. **Nothing installed to
   launchd** — deliberately left as code only; deployment is a separate, later call.

A smaller side-decision surfaced and closed independently during this work: decision #3384
("chasing a moving target" — a retry-cap counter that couldn't tell staleness from a real failure,
which once cost a real PR a human closing it by mistake) went through the full
`/prepare` → independent review → ratify → resolve cycle for real and is merged (`main`, PRs
#1674, #1675). Its own recommended fix is filed but not yet built.

**Correction (2026-08-29): #3118 IS ratified.** The "What's still not done" list below originally
opened with "Decision #3118 was never ratified... the single biggest open gap." That was wrong and
is now stale twice over — #3118 resolved on `dateResolved: 2026-08-26`, ruling (c), call the
existing `dispatch-lane` operation, never a second spawn implementation, codified at
[we:docs/agent/platform-decisions.md#conveyor-dispatch-calls-the-declared-operation](/docs/agent/platform-decisions.md#conveyor-dispatch-calls-the-declared-operation).
All five pieces built in the prior session update already presuppose exactly that answer, correctly.

**What happened since the update above:** lane-11, which held the prototype, had 4 of its 5 built
pieces — the session-identity fix, `route-pr-outcome`, the runner→`dispatch-lane` wiring, and
`we:skills-src/conveyor/supervisor.mjs` — wiped by an `acquire --lane=11` re-claim after the
original lease went TTL-stale. The explicit-lane acquire path has no dirty-tree guard (a bug filed
separately). All four were recovered byte-for-byte from Claude Code's own session transcripts — the
original session's main + subagent JSONL logs, cross-checked against its file-history backup store
(10 of 12 cross-checked files matched the backup exactly) — and re-verified: 364/364 tests green,
`check:standards` 0 errors. Everything is now pushed to a durable remote branch,
`origin/lane/mechanical-dispatcher-recovered`, not just local-only in a lane clone, so it survives
any future lane reset. lane-11 itself still holds the working copy and has an occupant declared.

**What's still not done, in priority order:**

1. **The live end-to-end test.** Nothing blocks it now — #3118 is ratified and all five pieces are
   recovered and tested. Still needs: a setup decision (a scratch clone of the recovered branch,
   named anything other than `lane-N` so `dispatch-lane`'s `assertNotALaneCheckout` guard doesn't
   refuse it, rather than lane-11 itself or requiring `main` first) and picking one specific
   low-stakes backlog item to actually dispatch. The existing `-live`-named tests
   (`we:scripts/operations/__tests__/dispatch-spawn-live.test.mjs` etc.) only prove subprocess
   plumbing against a fake `claude` stand-in on `PATH`, NOT the real CLI's behavior — the real-CLI
   uncertainty #3118 flagged (whether `--bg` really discards `--session-id`, the exact
   `backgrounded · <id> · <name>` stdout shape, whether resume-by-short-handle works) is still
   genuinely unverified, and is exactly what this live test is for.
2. **Landing lane-11's five pieces to `main`** via the normal small-PR path.
3. **The stray-run-record reaper for `dispatch-lane`** (disk hygiene for the runner's own bookkeeping
   over a long-running deployment) was designed but not built — low urgency.
4. **"Done when" #2 (a notification path for a blocked/escalated case) is still open** — nothing
   built this session addresses it directly; the supervisor's JSONL log is observability, not a
   notification.
5. **Decision #3384's own recommended fix** — the `<!-- ci-heal-committed: -->` self-report marker
   on `we:scripts/conveyor/ci-heal-mark.mjs` — is still unbuilt. The decision itself is ratified AND
   resolved; only the code is outstanding. A separate, smaller thread from this epic.
