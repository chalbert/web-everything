---
kind: story
size: 3
parent: "3029"
status: open
blockedBy: ["3331"]
scope: ["we:scripts/operations/dispatch-lane-io.mjs", "we:scripts/conveyor/tick-core.mjs"]
dateOpened: "2026-08-27"
tags: [operations, conveyor, dispatch, resume, steering]
---

# Resume an expired agent instead of relaunching it from scratch

When an agent's watchdog fires, the loop's only move is to start a new one with the original brief. Everything
the first agent learned — the files it read, the cause it found, the half-finished edit — is discarded, and
the replacement pays for all of it again. `claude --resume <sessionId>` continues a conversation with its
context intact, so an agent that merely *stopped* should be resumed, and only an agent whose context is
genuinely unrecoverable should be relaunched. Relaunching becomes the fallback, not the default.

## Why this is blocked on `#3331`

`claude -r, --resume [value]` addresses a session **by its id**. The dispatcher does not currently know the
id of the agent it started: it mints one, passes `--session-id`, and the CLI discards it. Probed 2026-08-27
on CLI **2.1.246**, three runs, 3/3 mismatched, with the CLI stating it outright —
`warning: --bg manages the session id; ignoring --session-id (use --resume <id> to continue an existing session)`.

`#3331` owns recovering the real id from `claude agents --json` and storing it on the run entry. Until that
lands there is nothing to resume, which is why this is `blockedBy` rather than merely `relatedTo`. The same
listing that carries the real `sessionId` is the source this card reads it from.

## What the loop does today

A watchdog firing produces a re-dispatch with the original brief — see the re-dispatch gate
(`planPrepareSpawns`, `we:scripts/conveyor/tick-core.mjs:57`) and the guard TTL backstop at
`we:scripts/conveyor/tick-core.mjs:101-102`. Nothing anywhere in the operations or conveyor trees calls
`--resume`: `grep -rnE -- '--resume|resumeAgent|steer'` over `we:scripts/operations/dispatch-lane-io.mjs`,
`we:scripts/operations/dispatch-lane.mjs` and `we:scripts/conveyor/tick-core.mjs` returns nothing (re-run
2026-08-27). A timed-out fixer therefore starts over, which is also why the supervisor needed a salvage-stash:
its successor's `reset --hard` would otherwise destroy the uncommitted work the first one had produced.

## The distinction this card has to get right

**Stopped is not the same as broken.** Three cases, and they must not be collapsed:

1. **Stopped but resumable** — the session exists and holds context (hit a wall-clock bound, was killed by a
   watchdog, the machine was busy). **Resume it.** This is the case the item exists for.
2. **Gone** — no session to address any more. **Relaunch**, and say in the record that context was lost.
3. **Poisoned** — the session is resumable but is the *reason* the work is failing: it is looping, it has the
   wrong idea and keeps re-deriving it, or it is repeating a refused action. **Relaunching is correct here**,
   and resuming would be worse than useless. This is the case a naive "always resume" gets wrong.

## Done when

1. **Executable** — a test in which a stopped-but-listed session is RESUMED (the argv carries `--resume
   <the real id>` and NOT the original brief re-sent as a fresh prompt), and a second in which an absent
   session is RELAUNCHED. Both must fail against `main`.
2. **The resume path reads the real id** stored by `#3331`, never a minted one. A test pins that a run entry
   carrying only a minted id refuses to resume rather than resuming the wrong session — attaching to another
   agent's session is worse than starting fresh.
3. **A relaunch after a failed resume is RECORDED as context-lost**, not as an ordinary dispatch. Whoever
   reads the run later must be able to tell "this agent started over" from "this agent continued".
4. **A resume is bounded.** A session resumed N times without the underlying work advancing is case 3
   (poisoned) and must fall back to a relaunch. The existing round caps are the precedent — reuse the durable
   floor (`prRearmCounts`, `we:scripts/conveyor/tick-core.mjs:71-73`) rather than a second in-memory counter,
   since a counter that dies with the process cannot cap anything across a restart.
5. **`#3118`'s clause 3 is answered in the card.** That ruling accepts stop-then-resume as the conveyor's
   steering mechanism; this item is where that acceptance either becomes real or is reported as unbuildable.

## Deliberately NOT in scope

- **Steering an agent mid-flight** (sending it new instructions). This card only restores an agent that
  stopped; deliberate stop-then-resume steering is `#3118`'s own follow-on.
- **The watchdog that decides an agent expired** — that is `#xnukacf`. This card is only what happens after.

## Lineage

Filed 2026-08-27 at the user's request, alongside `#xnukacf`: *"make sure we do not relaunch from scratch
sessions that expired if they can be restored from context."* The probe that makes it actionable — and that
blocks it — is `#3331`.
