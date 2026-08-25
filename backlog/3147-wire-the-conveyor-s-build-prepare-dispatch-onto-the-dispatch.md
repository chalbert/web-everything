---
bornAs: xkxakhz
kind: story
size: 5
parent: "2612"
status: open
relatedTo: ["3037", "3029", "3225", "3096", "3239", "3161"]
blockedBy: ["3118", "3165"]
dateOpened: "2026-08-16"
preparedDate: "2026-08-25"
scope:
  - we:skills-src/conveyor/SKILL.md
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

### Two open siblings already scope the build half — settle this before starting

**#3096** (*Route the conveyor's build dispatch through the declared dispatch-lane operation*) and **#3239**
(*the conveyor tick executes spawnBuilds by hand instead of through dispatch-lane*) are both open and both
name exactly the step-3 rewiring described here. `we:skills-src/conveyor/SKILL.md` even carries a `#3239`
annotation saying *"routing the spawnBuilds half through the operation is its own item."* Neither is blocked
by #3165, so either could land the build half independently — and whichever lands second either conflicts
with the other's edits or discovers the work already done.

**So this card's unique contribution is the step-3b PREPARE half, not step 3.** It should either absorb
#3096/#3239 explicitly or narrow to 3b. That is the first decision for whoever picks it up, and it is why
all three are now `relatedTo`.

It also weakens this card's own blocking rationale. The *Not in scope* section permanently leaves fix,
CI-heal, decision and panel spawns hand-spawned — so "two dispatch mechanisms live in one skill" is already
an accepted end state for the other kinds, not the unconditional harm the argument treats it as.

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

**The runner is OUT of this card's scope, and an earlier draft was wrong to name it.** That draft told a
builder to *"point `we:skills-src/conveyor/runner.mjs`'s dispatch site at the operation."* There is no such
site: the runner only normalises the tick's decisions and emits them (`tickSurface`, and `runLoop`'s injected
`emit`). Creating one would make the headless runner spawn agents itself — which is exactly the question
**#3118** leaves open and unratified. A card that instructs it would pre-empt that decision inside a skill
rewiring. Hence `blockedBy: ["3118", "3165"]` and a scope of the skill file alone.

## Tasks

1. Rewrite `we:skills-src/conveyor/SKILL.md` steps 3 and 3b to name the operation instead of describing the
   spawn.
2. Delete the now-dead brief-filling and `Agent`-spawn prose from those two steps — leaving it would give a
   reader two contradictory instructions.
3. Leave the other spawn sites alone. Enumerated from the file rather than from memory — there are exactly
   **three**, and two things an earlier draft listed are not spawn sites at all:
   - **§3c** (fix dispatch), line 521 — worded `Spawn it as ONE background \`Agent\`.`, a *different* literal
     from the one steps 3 and 3b use.
   - **§3c-ci** (CI-heal dispatch), from line 584.
   - **§3e** (drive a cleared decision), line 680.

   Not spawn sites: **§3d** says outright *"No guard, no spawn … this dispatches **no** agent and consumes
   **no** lane"*; **§3f** (infra-blocked) contains no spawn or `Agent` at all; and **there are no "panel
   spawns" in step 4** — grepping `we:skills-src/conveyor/SKILL.md` for `panel` returns **0**.

   *(Two earlier drafts got this wrong in different ways: one named a range "3c–3e" that does not exist, the
   next named §3d, §3f and panel spawns that do not spawn. Both were written from the card rather than from
   the file.)*

## Delivery shape

Lands incrementally behind `main`, one PR, **after #3165**. Blocked rather than sliced: doing step 3 now and
step 3b later would leave two dispatch mechanisms live inside one skill.

## Done when

1. **Executable** — grepping `we:skills-src/conveyor/SKILL.md` for `dispatch-lane` returns hits inside
   **both** step 3 and step 3b. Counted, not assumed: the file has **1** occurrence today, at line 77 — the
   `#3239` annotation in the tick-core table, which is neither step. So the criterion is that the count rises
   to at least 3 *and* that the two new ones fall within those steps; a bare whole-file count would already
   be non-zero and prove nothing.

   *(An earlier draft asserted it "returns nothing today, in any skill". False — that line 77 hit is exactly
   the annotation this card quotes as evidence elsewhere in its own body.)*
2. **Executable** — the hand-spawn prose is gone from steps 3 and 3b. The literal to match is
   ``Spawn it as **one background `Agent`**`` — bold and backticked, as actually written. Counted rather than
   estimated: it occurs **3** times today, at lines **251** (step 3), **279** (step 3b) and **680** (§3e,
   the decision spawn, out of scope). So the count must fall **3 → 1**, with line 680 the survivor.

   Line 521 is **not** in that set: §3c writes `Spawn it as ONE background \`Agent\`.` — capitalised and
   differently worded, so it never matched this literal. An earlier draft listed it as a must-remain
   occurrence and gave the count as 4 → 2; both were wrong, and the count was never run.

   *(An earlier draft before that specified `Spawn it as one background Agent` with no markup, which matches
   **zero** times — a criterion that would have "passed" while the prose sat untouched.)*
3. **Mutation** — restoring either step's prose reddens case 2 by name, and the count returns to 3.
5. `npm run check:standards` — no new errors and no new warnings against the 0-error / 1435-warning baseline.
