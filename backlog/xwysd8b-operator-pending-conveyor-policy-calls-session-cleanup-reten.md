---
kind: decision
parent: "xqmw8g9"
status: open
dateOpened: "2026-09-24"
tags: [conveyor, daemons, sessions, operator-policy, incident-2026-09-24]
---

# Operator-pending conveyor policy calls: session-cleanup retention, stuck-bot timeout, cleanup scope, daemon bots on an API key, auto-resume of interrupted workers

Five operator calls left open on 2026-09-24, filed as one decision with one fork each. **Not yet
prepared** — the options below are the ones named during the incident, with a leaning, not a researched
default. Run `/prepare` on this card before ratifying. Each fork is independent of the others.

## Fork 1 — How many days are a finished session's records kept before cleanup?

Options: (a) 1 day; (b) 7 days; (c) keep until the card or PR it served is resolved or merged, then 1 day.
Leaning: (c) — evidence stays while it can still be needed for a diagnosis, then goes.

## Fork 2 — How long may a bot run with no progress before it is stopped?

Options: (a) a fixed wall clock (e.g. 60 min); (b) no-progress time — no transcript growth, commit, label or
comment for N minutes (e.g. 20); (c) per-kind budgets (review, fix, build differ). Leaning: (b), with (c)
as its config — the #3367 "watch for progress, not a clock" direction.

## Fork 3 — Does session cleanup also cover in-chat workers?

Options: (a) daemon-dispatched sessions only; (b) every session, in-chat workers included; (c) in-chat
workers only after the operator's session that spawned them has ended. Leaning: (c) — never reap a worker
the operator may still be driving.

## Fork 4 — Do daemon bots move from the operator's subscription login to an API key?

Options: (a) stay on the subscription login; (b) move every daemon bot to an API key; (c) move only the
high-volume bots (review, fix-dispatch, investigators). Leaning: (c) — separates bot spend from the
operator's own usage and makes per-bot cost tracking (xfxl484) exact; needs the cost numbers first.

## Fork 5 — Is an interrupted worker auto-resumed, and by what?

Options: (a) never — its card goes back to the queue and a fresh session restarts it; (b) the owning daemon
resumes the same session id on its next tick; (c) the health daemon notices the interruption and dispatches
the resume. Leaning: (b) for daemon-dispatched workers, (a) for in-chat workers.

## Done when

1. **Executable** — each fork carries a ruling and `codifiedIn:` is set, and the rulings are wired into the
   code paths that read them (session reaper, stuck-bot timeout, dispatch auth).
