---
bornAs: x09zslx
kind: decision
parent: "3383"
status: open
dateOpened: "2026-09-14"
tags: [liveness, notifications, orchestration, design-principle, statute]
---

# Name the liveness guarantee before trusting it: harness-tracked notification vs. self-managed background vs. external watch

This repo has repeatedly rediscovered the same underlying gap in different clothes: a process gets
treated as "something will notify me" when its actual guarantee is weaker than that — or nonexistent.
Open decision: should this become one named, cite-able design principle (a `we:platform-decisions.md`
statute, in the spirit of how the narrower subagent-specific case below already got pinned into
`we:CLAUDE.md`) that every future long-running mechanism is checked against, rather than each mechanism
independently re-deriving its own answer to "will I actually be told when this is done?"

## Motivating evidence — the same gap, rediscovered independently, more than once

**The pinned case.** `we:CLAUDE.md` and `we:agent-memory-src/subagent-must-not-end-turn-on-passive-wait.md`
document a subagent kicking off a gating check (`verify-lane`, a CI/merge poll, a backgrounded test run) and
ending its turn on the assumption that a notification would wake it — when that guarantee exists **only**
for a harness-tracked Task/Agent-type job, never for a subagent's own backgrounded Bash command or an
untracked nested child. This hit **four separate subagents in one session** on 2026-09-04 before it was
written down, and recurred **at least three more times** on different subagents even after the note was
pinned — because the lesson was pull-based (a fresh subagent has no reason to open `agent-memory-src/`
unless told) until it was pinned directly into the one file guaranteed to auto-load into every session.

**The same shape, independently, elsewhere in this repo's own backlog:**

- `we:backlog/3162-general-agent-liveness-check-is-a-dispatched-agent-still-run.md` — there is no cheap way
  to ask "is dispatched agent X still alive, stalled, or already finished" without either waiting for its
  completion notification (which may never come the way you assume) or spawning a redundant checker agent —
  which itself caused a duplicate-review near-miss on 2026-08-17.
- `we:backlog/3367-watch-for-progress-instead-of-giving-up-on-a-clock.md` — every watchdog in the dispatch
  loop is a deadline standing in for "is it still working?", and a deadline answers that wrong in both
  directions (kills healthy slow work, tolerates a process that wedged instantly).
- `we:backlog/3550-general-pr-landing-progress-watch-alert-on-a-parked-pr-that.md` and
  `we:backlog/3549-define-neglected-for-a-general-parked-pr-landing-progress-wa.md` — a parked PR can go
  silently neglected because nothing distinguishes "someone is watching this" from "nothing is."
- `we:backlog/3594-stage-1-fleet-wide-scanner-for-false-monitor-wait-claims-acr.md` — a subagent transcript
  can *claim*, in prose, that a background wait is being tracked, with no real tracked mechanism backing the
  claim anywhere in the same transcript — the false-claim failure mode caught mechanically, at scale.
- `we:backlog/3681-mechanize-long-running-daemon-lifecycle-health-check-stalene.md` — a long-running daemon
  (the conveyor runner, the drain daemon) can run stale code for over 33 hours with nothing detecting the
  staleness, because nothing continuously checks whether the running process still matches what it should be
  running.
- The `Artifact` tool's own comment-notification contract draws exactly this line explicitly: a watched
  artifact only wakes a session while its status shows auto-replies **armed**, and that arming can lapse
  (interrupted session, killed watch task) without the session having any way to know it lapsed unless it
  re-checks.

Six-plus independent rediscoveries of the same question — across subagent orchestration, dispatched-agent
health, PR/lane watchdogs, and now published-artifact notifications — is the signal that this is a durable
design principle, not a one-off bug fixed once and pinned once.

## The open fork

**Should this become one explicit, named taxonomy of liveness/notification guarantees, cite-able the way
`we:docs/agent/platform-decisions.md` statutes are cited elsewhere, instead of staying six separately-worded
lessons that each new mechanism has to rediscover on its own?**

- *Option A — write it as a new statute.* Enumerate the actual finite set of liveness/notification
  mechanisms already in use across this system (a harness-tracked Task/Agent completion notification; a
  foreground blocking call that returns when the thing is actually done; an actively-polled loop the caller
  drives itself; an external watch/subscription with its own arm/disarm lifecycle, e.g. `Artifact` `watch`;
  a bare backgrounded process with **no** guarantee at all) and the guarantee each one actually carries.
  Require any newly-introduced long-running mechanism to state which category it is in, the same way `scope:`
  is now a required-in-spirit field on a backlog item. Bold-leaning option: this generalizes a lesson that
  has already cost real orchestration time at least six separate times, and a statute is exactly what
  `we:docs/agent/platform-decisions.md` exists for — a cite-able cluster rule instead of scattered prose.
- *Option B — leave it distributed.* The specific, highest-cost instance (subagents assuming a passive-wait
  notification) is already pinned in `we:CLAUDE.md`; the other five items above are each already filed as
  their own backlog items with their own scoped fixes. A new statute might just restate what those items
  already say without changing what anyone does differently.
- *Option C — go further than documentation.* Beyond a statute, add a structural/lint check — the
  pattern-detectable half of `we:backlog/3594-stage-1-fleet-wide-scanner-for-false-monitor-wait-claims-acr.md`
  is a concrete precedent — that flags a newly-introduced "you'll be notified" claim in code or docs that
  doesn't map to one of the named, real categories, so the principle is enforced rather than only stated.

No default is asserted here — this needs a real `/prepare` pass (naming the actual categories precisely
enough to be checked against, and deciding whether Option C's enforcement half is separable from Option A's
naming half or has to ship together) rather than a snap answer.

## Related work

- Parent: `#3383` (the background mechanical dispatcher epic — the origin of the pinned subagent case).
- `we:CLAUDE.md` / `we:agent-memory-src/subagent-must-not-end-turn-on-passive-wait.md` — the one instance of
  this pattern that is already pinned; this decision is about whether to generalize it, not re-litigate it.
- `we:backlog/3162-general-agent-liveness-check-is-a-dispatched-agent-still-run.md`,
  `we:backlog/3367-watch-for-progress-instead-of-giving-up-on-a-clock.md`,
  `we:backlog/3550-general-pr-landing-progress-watch-alert-on-a-parked-pr-that.md`,
  `we:backlog/3549-define-neglected-for-a-general-parked-pr-landing-progress-wa.md`,
  `we:backlog/3594-stage-1-fleet-wide-scanner-for-false-monitor-wait-claims-acr.md`,
  `we:backlog/3681-mechanize-long-running-daemon-lifecycle-health-check-stalene.md` — each an independent,
  narrower instance of the same underlying question.

## Done when

This is a decision item, not a build — it is **not** owed a code deliverable by this card. Done when this
fork reaches Definition of Ready via `/prepare` (a `/research/` topic + the fork above stated as named
options with a bold default, `preparedDate` stamped) and is later ratified via `/next decision`.
