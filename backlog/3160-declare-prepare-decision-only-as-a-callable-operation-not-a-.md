---
bornAs: x8fsi8b
kind: story
size: 8
status: open
parent: "3029"
relatedTo: ["3152", "3146", "3147", "3159"]
tier: pinned
dateOpened: "2026-08-25"
preparedDate: "2026-08-25"
tags: [operations, epic-3029, orchestration-load, prepare]
scope:
  - we:scripts/operations/prepare.mjs
  - we:scripts/operations/prepare-io.mjs
  - we:scripts/operations/__tests__/prepare.test.mjs
  - we:scripts/operations/__tests__/prepare-io.test.mjs
  - we:scripts/operations/run.mjs
  - we:scripts/operations/run-record.mjs
  - we:scripts/lib/judge-panel.mjs
  - we:skills-src/prepare-decision-item/SKILL.md
---

# Declare 'prepare' (decision-only) as a callable operation, not a hand-dispatched skill invocation

Every prep dispatch on 2026-08-17 (seven of them — `#3144`, `#2910`, `#1770`, `#2982`, `#3128`, `#3143`,
`#2985`) required the orchestrating session to hand-write a multi-paragraph `Agent()` prompt invoking
`we:skills-src/prepare-decision-item/SKILL.md`, because there is no callable operation for it. Measured
directly: this was the single largest source of repeated hand-written orchestration prompts in one session.

## Relationship to #3152 and #3146

`#3152` (genericize `prepare` into a kind-polymorphic operation) is the *bigger* redesign — one operation
dispatching to fork/skeptic/screen for decisions vs. scope/size prediction for stories. This item is
narrower and faster: make TODAY's decision-only prep (exactly what `prepare-decision-item` already does)
callable as one operation, without waiting on the kind-polymorphic generalization to land first. `#3146`
(declare prepare's skeptic/two-confusion-screen as judge steps) is a plausible sub-piece of this item's
actual implementation, not a competing item — whoever builds this should read `#3146` first rather than
re-designing the judge-step shape from scratch.

## Why pinned

This is the highest-leverage, lowest-risk orchestration-load reducer identified in the 2026-08-17 session's
own retrospective: unlike `#3152`, it requires no new design decision (the skill's actual logic already
exists and works — verified across seven real dispatches tonight, several catching genuine defects via
independent skeptic/screen passes) — it only requires wrapping that already-working logic in a declared
operation the same way `review-pr`/`claim`/`dispatch-lane` already wrap theirs.

## The operator's contract (2026-08-25) — the operation owns the loop TO LANDED, not just the prep

Stated directly, and it widens this card past "wrap the skill":

> Prepare, like any other work that needs review, should happen **out of the main session**. The main
> session calls an operation to dispatch the prepare; that operation launches the prepare, then runs the
> fix/review loop **until landed**. It must be **observable** so progress can be surfaced. The command
> **completes only once landed or failed**. It has to be **resumable**. Eventually this reduces to queueing
> the work and letting the conveyor daemon take it — but we move there in steps.

Five properties, none of which the current hand-dispatch has:

| property | what it means here |
| --- | --- |
| **out-of-session** | the main loop never authors the prep or applies a finding; it calls one operation |
| **loop-to-landed** | prepare → panel → apply findings → re-panel → … → PR → land, inside the operation |
| **observable** | each round's state is readable while it runs, not only in the final return |
| **terminal** | it returns `landed` or `failed` — never "started, go look" |
| **resumable** | `--resume=<run-id>` continues mid-loop; the engine's existing run record is the state |

**Steps, not a big bang.** Step 1 is this card: a `prepare` operation that owns the loop for ONE item,
driven from the main session and blocking until landed. Step 2 is the conveyor calling it instead of the
session (#3147). Step 3 is the main session only queueing (#3152's kind-polymorphism lands somewhere in
here, since the conveyor's queue is not decision-only).

## Grounding: the loop was run by hand on 2026-08-25, three rounds, and it is measured

The prep of the review-prep defect cluster (#3233, #3230, #3238) was driven manually in the main session —
exactly what this card exists to stop. That run is the specification, because it produced numbers:

- **Three rounds, ten juror seats, ~$3.53 total** (r1 $1.38 / 4 seats, r2 $1.04 / 3, r3 $1.12 / 3),
  ~2 min wall-clock per round. Cost per prepared card is therefore roughly a dollar, which is the number
  that makes looping-to-convergence affordable rather than aspirational.
- **The rounds were load-bearing, not ceremony.** Round 1's design was refuted as *worse than the bug*;
  round 2's replacement was refuted the same way by two independent jurors; round 3 had to invert the model.
  A single-pass prepare would have shipped a design that lost data.
- **Independence came from headless spawns**, not the `Agent` tool: every seat reported a distinct session
  id. Confirms the #3145 routing this card must follow.
- **The main session did all the mechanical work** — building payloads, reading findings, editing cards,
  committing. That is the load this card removes, and it dominated the session.

## Shape

Reuse, do not reinvent:

- **the panel** — `we:skills-src/jury/panel-fanout.mjs` over `judgeSpawn`/`judgePanel`, with the three
  required ceilings. Proven above.
- **the loop** — `/converge`'s bounded editor↔reviewer round cap already models "panel judges, editor fixes,
  panel re-judges, stop on convergence or cap". `prepare` is that loop with a card as the subject instead of
  a diff. Read it before designing a new one.
- **the transport** — lane acquire → commit → `we:scripts/pr-land.mjs` → the drain. Never a second route.
- **observability** — the engine already writes `.operations/runs/<id>.json` per run; the round state
  belongs there, so `--resume` and "surface progress" are the same mechanism rather than two.

**The editor is not a juror** (`we:docs/agent/delivery-loop.md`): the round that applies findings authors,
so it must be a different actor from every seat that judged it. Headless jurors make that true by
construction; #3159 tracks giving the editor its own tool-bearing headless spawn.

## Size, and why it is not the task it started as

**`size: 8`, retyped from `task` to `story`.** It was filed as an unsized task meaning "wrap the existing
skill". The operator contract above widened it to owning a loop that is observable, terminal and resumable,
and an unsized task is the wrong shape for that. 8 is the top of the batchable range and is deliberate: the
checklist says anything above 8 must be sliced rather than forced into a number.

**The seam if it does need slicing**, named now so nobody has to invent it later: *(i)* the operation that
runs prepare + panel + apply + re-panel and returns a terminal verdict, against a lane, stopping short of
the PR; *(ii)* the transport half — open, land, and report. (i) is the judgment machinery and carries all
the risk; (ii) is the same lane→PR→drain path four sibling operations already use. They split cleanly
because (i) returns a prepared card in a lane and (ii) does not care how it got there.

## Interfaces and protocol

**The per-round state lives on the existing run record**, not in a new store. `we:scripts/operations/run-record.mjs`
defines a record as `{ id, op, input, cursor, findings, verdict, effects, telemetry }` with
`RUN_RECORD_VERSION = 1` (`we:scripts/operations/run-record.mjs:31`, `:86`). Two consequences worth pinning
because Done-when 4 rests on them:

- **Rounds go in `findings`, keyed by round.** `findings` is already the per-step compute output map, and a
  round IS a compute step's output. Shape per entry:
  `{ round: number, seats: number, findings: number, converged: boolean, costUsd: number }`.
- **Observability is a read of that file, not a new channel.** The record is written as the run advances, so
  "surface progress while suspended" and "`--resume` continues" are the same mechanism. This is the reason
  the card does not propose a progress socket or a status endpoint.
- `newRunRecord` starts `cursor: 0` and `telemetry: []`; juror spend normalises through
  `normalizeJudgeTelemetry` (`:133`), which already exists and must be reused rather than re-summed.

**The panel call** is `we:skills-src/jury/panel-fanout.mjs` with `--depth`, `--max-depth` and
`--max-total-budget-usd` all supplied — they fail closed and must never be defaulted.

**The round cap and the stand-down rule come from `we:docs/agent/delivery-loop.md`** — three rounds on one
defect *class* without convergence — and from `/converge`, which already owns "how many jurors a care band
earns, which lenses are mandatory, how verdicts reduce, the round cap". This card **imports** that cap; it
does not invent a number.

**Terminal shape:** `{ outcome: 'landed' | 'failed', reason?: string, rounds: number, item, pr?: number }`.
`failed` reasons are at least `'round-cap'` and `'gate-red'`.

## Tasks

1. Declare the operation: `input` = `{ item, repo?, cwd?, model?, maxRounds? }`, steps
   `read → prepare → panel → apply → (loop) → open-pr → land`.
2. Acquire a lane for the work; the panel's jurors get their own, never the driver's (`assertLaneCwd`).
3. Drive the existing decision-prep logic from `we:skills-src/prepare-decision-item/SKILL.md` rather than
   re-authoring its rubric.
4. Loop: panel → apply findings → re-panel, writing a round entry to `findings` each pass.
5. Stop on convergence or the imported cap; return the terminal shape.
6. Hand off to the lane→PR→drain transport the sibling operations already use.
7. Tests, including the resume and the cap.

## Delivery shape

Lands incrementally behind `main` — a new operation is additive, and nothing calls it until it exists, so
there is no migration and no branch. It should land **after** the #3233/#3230/#3238 cluster, because it will
call `review-prep`-shaped machinery and should not be built against the version being fixed.

## Done when

1. **Executable** — `node we:scripts/operations/run.mjs prepare --item=<NNN>` drives a fixture item through
   research → fork/skeptic/screen (decision) via headless spawns, applies findings, re-panels, and returns a
   terminal `{outcome: 'landed'|'failed'}` — with no hand-written prompt from the caller. A test asserts
   `preparedDate` is set only after the independent passes return.
2. **Executable** — a test asserts every juror seat in one round reports a **distinct** session id, so a
   regression to `Agent`-tool subagents (one actor, N hats) reddens by name.
3. **Executable** — a test drives two rounds, kills the process between them, resumes with
   `--resume=<run-id>`, and asserts round 1's findings are **not** re-derived and the loop continues at
   round 2.
4. **Executable** — a test asserts the run record carries per-round state (round index, seat count, findings
   count, outcome-so-far) readable **while suspended**, not only after the terminal return.
5. **Executable** — a test asserts the operation returns `{outcome: 'failed', reason: 'round-cap'}` when the
   panel does not converge within the cap, rather than looping or returning success. The cap and the
   stand-down rule come from `we:docs/agent/delivery-loop.md`, not a new number invented here.
6. **Mutation** — deleting the re-panel step reddens case 1 by name (a one-shot prepare must not pass).
