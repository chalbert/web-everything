---
bornAs: x9ylkp7
kind: story
size: 3
parent: "3029"
status: open
blockedBy: ["3037"]
dateOpened: "2026-08-13"
scope:
  - we:scripts/operations/
scopeRationale: "Changes the dispatch observer and its registration in the waker; both live in we:scripts/operations/."
tags: [plateau-loop, delivery, operations, conveyor, dispatch]
---

# Give the dispatch observer a real completion signal — liveness is not an outcome

#3037's dispatch observer answers `running` or `unresolved` and never `succeeded`: `claude agents --json`
reports LIVENESS only — a session is listed or it is not — and `--all` showed no terminal record for a
completed background session (measured on 2.1.220). So a finished build is never resolved by the machine.
The real completion signal exists elsewhere: the agent's PR, which `we:scripts/conveyor/pr-watch.mjs` already
watches to a terminal state. Fold it in so a clean build resolves its own in-flight entry.

## Why this is not cosmetic

`unresolved` writes nothing, so a finished dispatch is re-reported on EVERY waker pass, and past
`STUCK_ESCALATION_HOURS` (6h) `we:scripts/operations/wake.mjs` exits non-zero on every pass until a person
closes the entry out. Nothing in `we:scripts/` reaches `resolveInFlight` from a command line, so closing one out
today means hand-writing a script. The first real dispatch therefore red-lights the waker permanently. That is
survivable only because nothing in production dispatches yet (#3096 is what changes that), which is why this
should land before, or with, that one.

## What it must not do

Do not weaken the `OBSERVATIONS` vocabulary in `we:scripts/operations/effect-observer.mjs`. There is still no
word for "failed" — two earlier vocabularies had one and each re-ran real work — and an `unresolved` answer must
keep writing nothing. A genuinely ambiguous outcome still asks a person; only a provably clean one resolves.

## Acceptance

A dispatched delivery agent whose PR reached a terminal state resolves its in-flight entry to `applied` without
a person, and the waker stops re-reporting it. An ambiguous or failed one still answers `unresolved`, still
writes nothing, and still surfaces. A CLI or documented one-liner exists for closing out an entry by hand.
