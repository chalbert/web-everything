---
kind: decision
size: 2
parent: "3029"
status: open
dateOpened: "2026-08-11"
tags: [plateau-loop, delivery, operations, engine, dispatch]
scope:
  - we:scripts/operations/engine.mjs
---

# Choose the waker: something must call `advance` when dispatched work finishes

A suspended run resumes only when someone calls `advance`, and it cannot be the session that dispatched the
work — that session is gone. The [#3030] spike named three candidates and costed none, and filed nothing. Until
one is chosen, every stage above it in the epic produces runs that suspend correctly and never wake.

## Why polling is free, which narrows the decision

`advance`'s no-resume path returns the run unchanged — it is idempotent by construction, and the engine says so
in as many words. So a waker may poll as often as it likes and change nothing until the work is done. The
question is not *how to poll safely*; it is *who owns the schedule and what depends on what*.

`claude agents --json --cwd <lane>` is the poll itself: no TTY needed, filterable to one build's checkout, and
keyed on a `sessionId` that survives the process. The spike established that start and observe are both
scriptable. **Stop is not exposed** — that is a separate open question, not this one.

## The candidates, and the dependency each creates

- **The drain.** Already sweeps every 60s, already reads PR state, already runs unattended. Cheapest by far —
  and it makes the operation engine depend on the drain, which the epic may not want, since the engine is meant
  to be the thing the drain is eventually expressed IN.
- **An operator or agent re-invoking the CLI.** Free, honest, no new dependency — and not automatic, which
  defeats the purpose for anything running overnight.
- **The converge daemon.** Purpose-built, and deliberately **not installed**; it should stay uninstalled until
  the silent re-hold in `we:scripts/merge-ai-prs.mjs` is understood. Choosing it means unblocking that first.

## Why this is a decision and not a task

The three differ in what they couple, not in effort. Picking the drain is a five-line change that quietly
inverts a layering the epic is built on; picking the daemon is correct-shaped and blocked on unrelated work.
That trade is a ruling, not an implementation detail — which is why this is `kind: decision` rather than a
story.

**Measured, and it is why the CLI option is weaker than it looks:** across 2026-08-10/11 this session lost five
headless runs that started slow work and exited before it finished — every one instructed against it. One left
an orphaned run record stalled with zero telemetry. A waker that depends on a session staying alive is a waker
that stops when the session does.

## Done when

- [ ] One waker is chosen, with the dependency it creates stated rather than discovered later.
- [ ] The rejected options record WHY, so the next reader does not re-open a settled trade.
- [ ] If the choice is blocked on other work, that blocker is named and linked.
