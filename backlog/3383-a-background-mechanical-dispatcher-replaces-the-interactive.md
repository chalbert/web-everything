---
bornAs: xyv0vbz
kind: epic
parent: "3029"
status: open
dateOpened: "2026-08-28"
costTokens: "in:1566 cw:2345735 cr:344380407 out:631940"
costUsd: 211.45
costSessions: 1
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

**What's still not done, in priority order:**

1. **Decision #3118 ("where does agent-spawning live") was never ratified.** All five pieces above
   presuppose its answer — (c), call `dispatch-lane`, never a second spawn implementation — but the
   operator has not actually ratified it. This is the single biggest open gap.
2. **Nothing has been fired end-to-end, live.** Every test this session deliberately avoided
   triggering a real dispatch through the full chain (a real queued item → the runner above →
   `dispatch-lane` → a real spawned agent → a real PR → `route-pr-outcome` → resolution) — this
   card's own "Done when" #1 is therefore still open. `we:scripts/operations/dispatch-lane-io.mjs`'s
   sink refuses to dispatch from a lane checkout (`assertNotALaneCheckout`), so a live test needs
   the primary checkout (meaning lane-11's pieces land first) or an equivalent non-`lane-N` setup —
   worth a decision of its own before attempting it.
3. **The stray-run-record reaper for `dispatch-lane`** (disk hygiene for the runner's own bookkeeping
   over a long-running deployment) was designed but not built — low urgency.
4. **"Done when" #2 (a notification path for a blocked/escalated case) is still open** — nothing
   built this session addresses it directly; the supervisor's JSONL log is observability, not a
   notification.
