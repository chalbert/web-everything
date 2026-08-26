---
bornAs: xkxakhz
kind: story
size: 5
parent: "2612"
status: open
relatedTo: ["3037", "3029", "3225", "3096", "3239", "3161", "3118"]
blockedBy: ["3165"]
dateOpened: "2026-08-16"
preparedDate: "2026-08-25"
scope:
  - we:skills-src/conveyor/SKILL.md
tags: [plateau-loop, conveyor, delivery, operations, dispatch]
---

# Wire the conveyor's build/prepare dispatch onto the dispatch-lane operation instead of ad hoc Agent spawns

`we:skills-src/conveyor/SKILL.md` steps 3 and 3b instruct, in prose, exactly the sequence [#3037]'s
`dispatch-lane` operation now mechanizes: call the tick core for the dispatch plan, fill the delivery-agent
brief, and *"Spawn it as one background `Agent`"*. No skill, including conveyor's own, **calls** the operation
that exists to do exactly this. Run rather than asserted: `grep -rl "dispatch-lane" we:skills-src/` returns
**one** file — `we:skills-src/conveyor/SKILL.md` — and its single hit is the `#xbbscm5` annotation at line
77, which *names* the operation while explaining that routing through it is a separate item. A mention, not a
call.

*(An earlier draft said the grep "returns nothing", in this paragraph and again in Done-when 1. Round 3
corrected the criterion and left this sentence, so the card asserted both readings at once. The correction is
recorded here rather than silently applied because the same string standing in two places after one of them
is fixed is the defect that has now cost this PR two rounds.)*

*(Earlier rounds called line 77 "the `#3239` annotation". It is not written that way. The comment reads
`@operation-home-ok: #xbbscm5` — the pre-JIT hash **#3239** was born as, confirmed by `bornAs: xbbscm5` in
its own frontmatter. The item is the right one; only the label was wrong, so the annotation is named by the
string it actually carries.)*

*(The round-6 cut of that note ended **"and `grep -rl xbbscm5 we:backlog/ we:skills-src/` returns exactly
those two files"**. **That was wrong the moment it was written, and it is retracted.** The same commit put
`xbbscm5` on five lines of this card, so this card became a third hit — a stated command with a stated result
that does not reproduce at the head that states it, in a paragraph whose stated virtue is "Run rather than
asserted".*

*Round 7 corrected that to a **three**-file listing — this card, #3239's card and
`we:skills-src/conveyor/SKILL.md` — and **that correction is retracted too, for the same reason one round
later.** The commit that wrote it, `50bcc3f6`, also put `xbbscm5` into `we:backlog/x6uyq86-…md`, the very card
filed to prevent this, making a fourth hit. A count corrected without re-running the command at the commit
that carries the correction is not a correction. Re-run in this lane at the head that states it:*

```
$ grep -rl xbbscm5 backlog/ skills-src/
backlog/3147-wire-the-conveyor-s-build-prepare-dispatch-onto-the-dispatch.md
backlog/3239-the-conveyor-tick-executes-spawnbuilds-by-hand-instead-of-th.md
backlog/x6uyq86-a-done-when-criterion-names-a-fixture-whose-stated-outcome-i.md
skills-src/conveyor/SKILL.md
```

*The identity claim never depended on the count — `bornAs: xbbscm5` in #3239's own frontmatter establishes it
alone. Of the four hits, **two carry** the annotation and its born-as declaration —
`we:skills-src/conveyor/SKILL.md:77` and #3239's frontmatter — and **two only discuss it**: this card and
`x6uyq86`. (Round 7's sentence here read "this card is the third hit and only discusses them"; there are four
hits and two discussers, so it is retracted with the count above.) A quoted invocation carrying a quoted
result that nobody re-ran is its own defect class, and the prevention for it is `x6uyq86` — widened in the
previous push to cover it, and now carrying this round's repeat as its second founding fixture.)*

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
name exactly the step-3 rewiring described here. `we:skills-src/conveyor/SKILL.md` even carries #3239's
annotation — written as `#xbbscm5`, its born-as hash — saying *"routing the spawnBuilds half through the
operation is its own item."* Neither is blocked by #3165 (#3096 is blocked by #3037; #3239 by nothing), so
either could land the build half independently — and whichever lands second either conflicts with the
other's edits or discovers the work already done.

**So this card's unique contribution is the step-3b PREPARE half, not step 3.** It should either absorb
#3096/#3239 explicitly or narrow to 3b. That is the first decision for whoever picks it up, and it is why
**both** — #3096 and #3239 — are now `relatedTo`.

*(This sentence said *"all three are now `relatedTo`"* from round 2 through round 5. The paragraph names two
items, not three, so the count had no referent; it is **two**.)*

It also weakens this card's own blocking rationale. The *Not in scope* section permanently leaves the fix,
CI-heal and decision spawns hand-spawned — so "two dispatch mechanisms live in one skill" is already an
accepted end state for the other kinds, not the unconditional harm the argument treats it as.

**Consequence for sequencing:** #3165 lands first and makes step 3b callable; #3147 then rewires both steps
in one pass. Doing #3147 first would mean wiring step 3 to the operation and leaving step 3b hand-spawned —
a half-migration with two dispatch mechanisms live in one skill, which is worse than either end state.

## Not in scope

The three other spawn sites, enumerated from the file in Tasks 3 below rather than named as a range: **§3c**
(fix dispatch, line 521), **§3c-ci** (CI-heal, from line 584) and **§3e** (drive a cleared decision, line
680). They are separate prose sites and are not named by `dispatch-lane`'s own scope.

*(This section is where two earlier errors originated and where they survived being corrected elsewhere. It
said "Steps 3c–3e", a range that does not exist, and it named "the panel-reviewer/editor/validator spawns
inside step 4" — grepping `we:skills-src/conveyor/SKILL.md` for `panel` returns **0**. Tasks 3 was corrected
in round 3; this section, the original source of both claims, was not, so the card refuted itself by grep in
one place and relied on the refuted claim in two others. The sibling item about subagent reviewers not being
independent is still `relatedTo`, but it is not about spawn sites in this skill.)*

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
rewiring. Hence the scope of the skill file alone.

*(An earlier draft ended that paragraph **"Hence `blockedBy: ["3118", "3165"]` and a scope of the skill file
alone"** — and the frontmatter carried `blockedBy: ["3118", "3165"]` from round 2 through round 4. **The
`#3118` half was wrong and is retracted.** The premise above supports the scope, not the blocker: declining
to create a runner spawn site is precisely what stops this card pre-empting #3118, and a card that avoids a
question is not blocked by it. Two further checks, both run in this lane rather than reasoned from the card:
naming the operation in prose sits on the **default** side of #3118's Fork 1 and pre-empts neither branch
(re-read against live #3118 below); and `we:scripts/readiness/dispatch-plan.mjs:165` records that `isReady
requires every blockedBy resolved`, so an open `kind: decision` in `blockedBy` would have made this card
undispatchable until a human ratifies — the exact opposite of what preparing it is for. `#3118` is now
`relatedTo`. The card's other two statements of its own ordering — *Consequence for sequencing* and
*Delivery shape* — always said `#3165` alone; the frontmatter is what disagreed with them, and it now
agrees.)*

### The Fork 1 premise, re-read against live #3118

**The round-6 cut of the paragraph above read as follows — `13f2da58`, card lines 150–152, quoted to the
semicolon that closes the clause (line 152 continues *"; and"* into the second check, which still stands):**

> #3118's Fork 1 default (a) is a WE-native in-process runner, and `we:scripts/operations/dispatch-lane-io.mjs`
> already shells `claude --bg` locally — no cross-process call into `plateau-app` anywhere in the file — so
> naming the operation in prose sits on the default side of the fork and pre-empts neither branch

**(a) is no longer #3118's default, and the sentence is retracted rather than edited away.** It was true at
this branch's old merge base `60acbe5f`. It is false on the `main` this card lands on: PR #1565 (merged
`b71595f9`) amended #3118, and at `origin/main` `14cd7c60` — byte-identical to `e6db8cf5` for this card, so
the retraction has not gone stale behind main a second time — its *Recommended path at a glance* row reads

> **(c) call the existing `dispatch-lane` operation** — the declared operation that already starts agents
> headlessly; the runner calls it per surfaced dispatch

with `(a) port a new WE-native we:scripts/conveyor/agent-runner.mjs` moved into the *excluded alternatives*
column, under an amendment note headed *"the fork survey was missing an option, and it changes the
default."* Verified in this lane at the merged head, `we:backlog/3118-session-free-conveyor-where-does-headless-agent-spawning-liv.md:57`
and `:59`.

**The conclusion is unchanged and the premise is stronger, not weaker.** Under (c) the default *is* calling
`dispatch-lane`, which is precisely what this card asks the skill's prose to do — so this card sits more
squarely on the default side of the fork than the retracted sentence claimed, and neither the scope of the
skill file alone nor the dropped `blockedBy: ["3118"]` moves. The check that is genuinely independent of the
amendment still holds and was re-run here: `we:scripts/operations/dispatch-lane-io.mjs` shells `claude --bg`
locally with no cross-process call into `plateau-app` anywhere in the file — `grep -c claude` returns **33**
lines and `grep -c plateau` returns **0** — so option (b) is untouched either way.

**The tension (c) creates with the paragraph above, stated rather than left silent.** #3118's new default
has *the runner* calling `dispatch-lane` per surfaced dispatch — the very spawn site this section argues is
out of this card's scope. Those are not in conflict: this card declines to create that site, and #3118 is
still `kind: decision, status: open`, so the site is #3118's to create when it is ratified. But a builder
reading both should know the runner call is the ruling's likely destination, and that this card stops one
step short of it on purpose.

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
   `@operation-home-ok: #xbbscm5` annotation (#3239's born-as hash) in the tick-core table, which is neither
   step. So the criterion is that the count rises
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
4. `npm run check:standards` — no new errors and no new warnings against the baseline at build time. (Do not
   hard-code a number: it moved 1435 → 1437 while this card was being prepared.)
