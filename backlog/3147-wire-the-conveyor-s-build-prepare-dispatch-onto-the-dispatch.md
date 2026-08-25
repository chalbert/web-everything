---
bornAs: xkxakhz
kind: story
size: 5
parent: "2612"
status: open
relatedTo: ["3037", "3029", "3225"]
blockedBy: ["3165"]
dateOpened: "2026-08-16"
preparedDate: "2026-08-25"
scope:
  - we:skills-src/conveyor/SKILL.md
  - we:skills-src/conveyor/runner.mjs
tags: [plateau-loop, conveyor, delivery, operations, dispatch]
---

# Wire the conveyor's build/prepare dispatch onto the dispatch-lane operation instead of ad hoc Agent spawns

`we:skills-src/conveyor/SKILL.md` steps 3 and 3b instruct, in prose, exactly the sequence [#3037]'s
`dispatch-lane` operation now mechanizes: call the tick core for the dispatch plan, fill the delivery-agent
brief, and *"Spawn it as one background `Agent`"*. No skill, including conveyor's own, calls the operation
that exists to do exactly this (`grep -rl "dispatch-lane" we:skills-src/` returns nothing).

## The overlap is not superficial

`we:scripts/operations/dispatch-lane-io.mjs`'s own header confirms it: the sink shells the SAME
`we:scripts/conveyor/tick-core.mjs`, reads the SAME `we:skills-src/conveyor/delivery-agent-brief.md`, and is,
in its own words, *"THE ONLY THING IN THIS REPO THAT STARTS AN AGENT"* — through `claude --bg` (a real detached
CLI process, independently pollable via `claude agents --json`, resumable by the waker, backed by a run
record), not the in-session `Agent` tool the skill still names.

## Why this matters more than a style preference

This is a live-fire instance of the second concrete failure this audit was opened to trace: a build dispatched
via the raw `Agent` tool failed silently four times with zero trace, while the same work dispatched through
`dispatch-lane` worked immediately and produced an inspectable run record. The mechanism difference is real,
not cosmetic — `claude --bg` returns a session the waker can poll and resume (`inFlight`/`dispatch: true` on
the effect executor, #3073/#3084), while an in-session `Agent` spawn's liveness is whatever the parent session
happens to still be tracking. Conveyor is the standing delivery loop this constellation runs nightly; every
tick that still dispatches by hand carries the failure mode #3037 was built to remove.

## What changes

Steps 3 and 3b (`spawnBuilds`, `spawnPrepareScope`) call `node we:scripts/operations/run.mjs dispatch-lane`
(or the operation's programmatic entry point, if the conveyor runner already imports operation code rather
than shelling a CLI) once per surfaced dispatch, instead of hand-filling the brief and spawning an `Agent`
directly. The tick-core call, the guard bookkeeping (`nextState.buildGuards`/`nextState.prepareGuards`), and
the brief-fill are already inside the operation's `read`/`effect` steps — the skill's prose collapses to
"run the operation with this tick's dispatch plan," not a re-description of what it does internally.

**The check this card asked for has been RUN (2026-08-25), and the answer is the pessimistic one.**
`dispatch-lane` covers **builds only**:

| where | what it does |
| --- | --- |
| `we:scripts/conveyor/tick-core.mjs:858-859` | the planner returns `spawnPrepareScope` and `spawnPrepareDecision` |
| `we:skills-src/conveyor/runner.mjs:87-89` | the runner normalizes all three lists into its `dispatch` surface and **emits** them |
| `we:skills-src/conveyor/SKILL.md:262,271,273` | the prose then instructs a session to hand-spawn each entry |
| `we:scripts/operations/dispatch-lane-io.mjs:139` | the operation launches `match(decisions.spawnBuilds)` — **builds only** |
| `we:scripts/operations/dispatch-lane-io.mjs:52` | the brief path is hardcoded to the delivery-agent brief |

So the prepare lists are **consumed and surfaced** — they are not dropped. What is missing is a route from
them to the only thing in this repo that actually starts an agent. Step 3b therefore has **no operation to
call**, and one `dispatch-lane` call cannot replace both step 3 and step 3b today.

*(An earlier draft of this paragraph asserted that "nothing consumes" those keys. That was wrong, and the
error is instructive: the grep covered only `we:scripts/operations/` and `we:scripts/conveyor/` — not
`we:skills-src/`, where the consumers live — and searched the planner's INTERNAL local name
`decisionSpawns` rather than the public key `spawnPrepareDecision`. An independent review caught it.)*

Per this card's own instruction, the gap is filed rather than absorbed: **#3165** carries it, and this card
is `blockedBy` it. That keeps #3147 what it says it is — a skill rewiring — instead of quietly growing an
operation change inside it.

**Consequence for sequencing:** #3165 lands first and makes step 3b callable; #3147 then rewires both steps
in one pass. Doing #3147 first would mean wiring step 3 to the operation and leaving step 3b hand-spawned —
a half-migration with two dispatch mechanisms live in one skill, which is worse than either end state.

## Not in scope

Steps 3c–3e (fix dispatch, CI-heal dispatch) and the panel-reviewer/editor/validator spawns inside step 4 —
those are separate prose sites, not named by `dispatch-lane`'s own scope, and the panel/validator/editor sites
are the subject of the sibling item "subagent independent reviewers aren't independent" (relatedTo above), not
this one.

## Interfaces

The skill's prose collapses to one invocation per surfaced dispatch:

```
node we:scripts/operations/run.mjs dispatch-lane --num=<NNN> [--bookkeepingFile=<path>] --json
```

`--num` is the only required input. The operation's own `read`/`plan` steps already shell
`we:scripts/conveyor/tick-core.mjs`, resolve the item, fill the brief and compute the guard entry, so the
skill passes the item number and nothing else — it must not re-derive the plan or pre-fill a brief.

**Which entry point:** `we:skills-src/conveyor/runner.mjs` is a node process, so it can `import` the
operation rather than shelling a CLI. Prefer the import — shelling from inside the runner adds a subprocess
per dispatch and loses the thrown error. The `we:skills-src/conveyor/SKILL.md` prose still names the CLI
form, because a human or an agent reading the skill invokes it that way.

## Tasks

1. Rewrite `we:skills-src/conveyor/SKILL.md` steps 3 and 3b to name the operation instead of describing the
   spawn.
2. Point `we:skills-src/conveyor/runner.mjs`'s dispatch site at the operation.
3. Delete the now-dead brief-filling and `Agent`-spawn prose from those two steps — leaving it would give a
   reader two contradictory instructions.
4. Leave steps 3c–3e and step 4's panel spawns alone (see *Not in scope*).

## Delivery shape

Lands incrementally behind `main`, one PR, **after #3165**. Blocked rather than sliced: doing step 3 now and
step 3b later would leave two dispatch mechanisms live inside one skill.

## Done when

1. **Executable** — grepping `we:skills-src/conveyor/SKILL.md` for `dispatch-lane` returns hits in **both**
   step 3 and step 3b. It returns nothing today, in any skill.
2. **Executable** — grepping the same file for the hand-spawn prose (`Spawn it as one background Agent`, and
   the brief-fill instruction) returns **zero** hits within steps 3 and 3b, proving the superseded prose was
   removed rather than left beside the new instruction.
3. **Executable** — a test asserting `we:skills-src/conveyor/runner.mjs`'s dispatch path invokes the
   operation: with a stubbed operation entry point, a tick yielding one build and one prepare-scope spawn
   calls it **twice**, and the raw spawn path **zero** times.
4. **Mutation** — reverting either step's prose to the hand-spawn form reddens case 1 or 2 by name.
5. `npm run check:standards` — no new errors and no new warnings against the 0-error / 1435-warning baseline.
