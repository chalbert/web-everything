---
bornAs: xthv8dq
kind: epic
status: open
dateOpened: "2026-07-28"
preparedDate: "2026-08-26"
relatedTo: ["2677", "2445", "2527", "2626", "2636", "2464", "2703", "3029", "3070", "3096", "3102", "3118", "3165", "3296", "3323", "3331", "3332", "3353"]
scope:
  - we:backlog/2753-session-free-conveyor-reduce-the-operator-session-to-queue-e.md
scopeRationale: "A coordinator epic. Its only touch-set is its own card body — the residue inventory, the DAG and the finish line below. Every line of code named here is carried by a child or a sibling that owns its own scope: the runner call, the three leftover SKILL hand-spawn sites, the board publish, and the unattended start are named as SLICES in this card, not absorbed into it. Inert for dispatch either way: a cleared kind:epic is held `needs-slice` BEFORE the scope gate (we:skills-src/conveyor/SKILL.md:96-99), so this field is a declaration of honesty, not a dispatch input."
tags: [conveyor, session-free, plateau-loop, roadmap]
---

# Session-free conveyor — reduce the operator session to queue + expose-state

Dispatch is the operator session's last mechanical job. `we:skills-src/conveyor/runner.mjs:81` projects the tick
core's five spawn lists and `:201` prints them; a session reads that print and starts every agent by hand, at
five sites in `we:skills-src/conveyor/SKILL.md` (`:251`, `:279`, `:521`, `:605`, `:680`). #3118 ruled **how** an
agent gets started — call the declared `dispatch-lane` operation — but nothing yet makes the runner the caller.
This epic owns that residue: the five hand-spawn sites, the board's session-only publish step, and the runner's
own unattended start.

## Why it matters

The conveyor is one wire away from running without a chat. Every other plane already survives a dead session:
the tick core decides (#2699), the runner drives it self-clocked (#2702), the drain lands (#2449), the reaper
releases (#2700). The **spawn** is the exception, and it is not a small exception — it is the step that turns a
plan into work. While a model has to read a printed surface and act on it, "session-free" is false for the one
thing the conveyor exists to do, and every stall waits for a person to notice a line of stdout.

The direction is also nearly out of unknowns. #3118 removed the last architectural fork (call the operation,
never a second spawner), #3165 gave the operation three of its five kinds, and #3332/#3353/#3096 carry the rest
of the plumbing. What remains is wiring, and this card's job is to name it precisely enough that nobody has to
re-derive it.

## What is actually true today — measured in this lane

Every number below came from a command run in lane-14 from the WE repo root, at `origin/main` `f90ba961`,
2026-08-26 ~20:40 EDT. Verbatim transcript:

```
$ grep -cE 'Spawn it as \*\*one background `Agent`\*\*|[Ss]pawn it as ONE background `Agent`' skills-src/conveyor/SKILL.md
5
$ grep -o dispatch-lane skills-src/conveyor/SKILL.md | wc -l
       1
$ grep -c 'dispatch-lane' skills-src/conveyor/runner.mjs
0
$ grep -c 'dispatch-lane\|dispatchLane' skills-src/conveyor/__tests__/runner.test.mjs
0
$ npx vitest run skills-src/conveyor/__tests__/runner.test.mjs
 Test Files  1 passed (1)
      Tests  23 passed (23)
$ grep -c "the PUBLISH step is the SESSION's" skills-src/conveyor/SKILL.md
1
$ npm run check:standards        # run plainly, twice — identical both runs
1 error(s), 1447 warning(s) (… 3331 backlog items)
```

Reading them in order:

- **Five hand-spawn sites** in `we:skills-src/conveyor/SKILL.md`: `:251` §3 build · `:279` §3b prepare-scope ·
  `:521` §3c fix · `:605` §3c-ci CI-heal · `:680` §3e prepare-decision.
- **One `dispatch-lane` mention** in that whole file — line 77, the `@operation-home-ok` marker in the tick-core
  table, which is in neither step.
- **The runner and its test know nothing of the operation** — zero hits in
  `we:skills-src/conveyor/runner.mjs` and zero in `we:skills-src/conveyor/__tests__/runner.test.mjs`, whose 23
  passing tests are all about `carryForward` / `shouldStop` / `tickSurface` / `runLoop`.
- **The board's session-only publish seam is still there**, one hit at `we:skills-src/conveyor/SKILL.md:835`.
- **The gate's one error** is the pre-existing stranded-hash card
  `we:backlog/xv3nqsg-guard-that-every-committed-pr-land-invocation-declares-its-v.md`, unrelated to this item
  and deliberately left alone (see *Not in scope*).

**The runner really does only print — read, not inferred from a comment.** `tickSurface`
(`we:skills-src/conveyor/runner.mjs:81-94`) returns `{ statusLine, notes, dispatch: { builds, prepareScope,
prepareDecision, fixes, ciHeals }, armWatchers }` and nothing else — a pure projection with no `child_process`
reachable from it. `runLoop`'s body (`:114-156`) calls `emit`, then `mechanicalPasses`, then `shouldStop`,
`heartbeat`, `sleep`, `carryForward` — no fifth call. `makeCliEmit` (`:201-214`) either writes one JSON line or
prints `↳ surface for judgment layer: N build · …`. The only child processes the runner starts are `tick-core`
(`:161-175`) and the two cleanup passes (`:179-197`).

## Where the roadmap actually stands — the old DAG, corrected

The sequence this card carried since 2026-07-28 has largely landed, and two of its five steps were describing a
world that no longer exists. Corrected rather than overwritten:

| the old step | what is true on 2026-08-26 |
| --- | --- |
| 1. **#3118 the long pole** — "until it's decided and built, a session must still spawn" | **RULED and resolved 2026-08-26.** Fork 1 → **(c)**, call the declared `dispatch-lane` operation. Codified at [we:docs/agent/platform-decisions.md#conveyor-dispatch-calls-the-declared-operation](../docs/agent/platform-decisions.md#conveyor-dispatch-calls-the-declared-operation) — clause 2: *"The runner becomes a caller, not a backend… It supplies the item and the dispatch kind; the operation owns the argv, the brief, the handle, the run record and the observation."* The decision half of the long pole is gone; the wiring half is this card's residue |
| 2. **#2418 coordinator delegates the review pipeline** | **Resolved.** Its successors are `converge-pr` (**#3323**, open, size 8 — drive ONE bounced PR to merged) and the delivery reconciler (**#3296**, open, size 5, prepared — reconcile an open PR against a live process). Both sit under #3029, not here |
| 3. **#2626 + #2742 operational state store** | #2626 **resolved**; #2742 still open (size 5). Unchanged |
| 4. **#2505 / #2555 / #2508 the console surface** | #2508 **resolved**; #2505 and #2555 still open epics. Unchanged |
| 5. **#2445 / #2527 the Plateau Loop app** | Both still open epics. Unchanged |

Both gap children this epic filed are done: **#2752** (mechanize epic-resolve-on-last-child) and **#2754**
(shadow→enforce flip for decision auto-ratification) are resolved, along with **#2787**, the flip-metric
correction that came out of #2754's review. Its one other open child is **#3105** (the gate outruns the agent
foreground window) — a delivery-agent footgun, not a session-residue item.

## The residue — what the session still does that the runner should

Seven, each pinned. **Two are fully owned. Three are owned only on the operation side, with their SKILL half
unowned. Two have no owner at all.**

| # | what a session still does | where | owner |
| --- | --- | --- | --- |
| R1 | starts the **build** agent by hand | `we:skills-src/conveyor/SKILL.md:251` | **#3096** (open, size 3, prepared, `blockedBy: 3353`) |
| R2 | starts the **prepare-scope** agent by hand | `we:skills-src/conveyor/SKILL.md:279` | **#3096** |
| R3 | starts the **fix** agent by hand | `we:skills-src/conveyor/SKILL.md:521` | operation side **#3332**; the SKILL side is **unowned** |
| R4 | starts the **CI-heal** agent by hand | `we:skills-src/conveyor/SKILL.md:605` | operation side **#3332**; the SKILL side is **unowned** |
| R5 | starts the **prepare-decision** agent by hand | `we:skills-src/conveyor/SKILL.md:680` | operation side **shipped** (#3165); the SKILL side is **unowned** and blocked on nothing but file order |
| R6 | **publishes the status board** — the Artifact call is a session capability | `we:skills-src/conveyor/SKILL.md:835-841` | **unowned** |
| R7 | **starts and supervises the runner** | `we:skills-src/conveyor/SKILL.md:16`, `:177-182`, `:891` | **unowned** |

**R1–R5 do not add up to "the session is out of the dispatch loop", and this is the correction that matters
most.** #3096 switches the SKILL's prose from the harness `Agent` tool to the declared operation — but the SKILL
is *the session's* instructions. After #3096 lands, a session still reads the runner's printed surface and still
executes the call; the call is merely a shell command instead of a tool. That is a real gain, because a shell
command is something a headless process can make — but the process that should make it,
`we:skills-src/conveyor/runner.mjs`, gains nothing from #3096. That card's `scope:` is
`we:skills-src/conveyor/SKILL.md`, one file, and the runner module is not in it. **Nothing in the tree carries
"the runner calls the operation."**

Verified rather than assumed — grepping the corpus for the runner module's path returns ten cards, and the
three open ones that name it are #2572 (the converge daemon, unrelated), #3096 (whose scope is
`we:skills-src/conveyor/SKILL.md`) and #3287 (PR frontmatter):

```
$ git grep -ln 'skills-src/conveyor/runner.mjs' origin/main -- 'backlog/*.md' | wc -l
      10
```

No open card scopes `we:skills-src/conveyor/runner.mjs`.

**R5 is the cheapest thing on this list and is stranded by an accident of slicing.** `dispatch-lane` already
routes `prepare-decision` — `we:scripts/operations/dispatch-lane-io.mjs:190-193` launches three lists
(`['build', decisions.spawnBuilds]`, `['prepare', decisions.spawnPrepareScope]`, `['prepare-decision',
decisions.spawnPrepareDecision]`) and `briefPath(root, kind)` at `:93` resolves a brief per kind. #3096's own
`Done when` #2 names line 680 as **"the survivor"** of its 3→1 count, deliberately out of its scope. So the
operation can dispatch it and the skill still hand-spawns it, with no card between them.

## The slices — named, not absorbed

**This residue is not one item's worth.** Four slices, three files, three different blockers. Absorbing them
into this epic would put a size-13-ish body of work behind a container the dispatcher never launches. Named
here for filing, sized from the work read above:

| slice | what it does | proposed `scope:` | size | blocked by |
| --- | --- | --- | --- | --- |
| **S1 — the runner calls the operation** | Replace the print-only `emit` path with a per-dispatch call to `dispatch-lane`, one per surfaced row across all five kinds, as an injected effect the unit test can drive with a fake. This is the slice that actually removes the session from the dispatch loop | `we:skills-src/conveyor/runner.mjs`, `we:skills-src/conveyor/__tests__/runner.test.mjs` | **5** | #3096 + #3353 (the SKILL must name the operation, and the guard must be hardened, before a real spawn fires) |
| **S2 — the three SKILL sites #3096 leaves behind** | Rewire §3c (`:521`), §3c-ci (`:605`) and §3e (`:680`) onto the operation and delete their hand-spawn prose, finishing the 5→0 count | `we:skills-src/conveyor/SKILL.md` | **3** | #3096 (same file — serialize, do not race) and #3332 (the fix/CI-heal kinds must exist first). §3e's half is unblocked by #3165 and could ship inside #3096 if that lane is still open |
| **S3 — publish the board without a session** | Retire the two-step generate→publish seam at `we:skills-src/conveyor/SKILL.md:835-841`. Either the console (#2527/#2505/#2555) hosts it, or `we:scripts/conveyor/status-artifact.mjs` gains a headless publish target. Delete §8 per its own retirement clause at `:853-858` | `we:scripts/conveyor/status-artifact.mjs`, `we:skills-src/conveyor/SKILL.md` | **3** | S2 (same file) |
| **S4 — start the runner unattended** | A scheduler entry that launches `we:skills-src/conveyor/runner.mjs`, mirroring the ruled precedent in `we:scripts/converge-daemon-install.mjs` (a launchd `StartInterval` job on the operator's Mac, #2572 ruling R7) — the runner is already singleton-locked, so a periodic fire is safe by construction | a new installer beside `we:scripts/converge-daemon-install.mjs` | **3** | nothing. Sibling of #3070 (which chooses the waker for the operations engine, not for this runner) |

S1 is the one to file first and the one to fund. S2 and S3 touch the same file as #3096 and must queue behind
it. S4 is independent of all three and can go any time.

## Not in scope

- **Ratifying a prepared decision.** Human by standing rule (`we:skills-src/conveyor/SKILL.md:891`); #2754 and
  #2787 defined and corrected the shadow→enforce flip, and the flip itself is an operator arming, not a wire.
- **`/review` on a `review:human` / `review:pending` park.** A hard human-only gate
  (`we:skills-src/conveyor/SKILL.md:490-493`). Surfacing it is "expose state" and is the target, not residue.
- **`/slice` on a cleared epic.** Deliberately surfaced, never auto-run
  (`we:skills-src/conveyor/SKILL.md:648-650`).
- **Landing.** The resident drain daemon is the sole writer to `main`
  (`we:skills-src/conveyor/SKILL.md:733-741`). Neither the runner nor a session ever merges.
- **The five liveness hardenings and the first live dispatch** — #3353. **The `fix` / `ci-heal` kinds on the
  operation** — #3332. **The `--session-id` probe** — #3331. **The SKILL's build/prepare rewiring** — #3096.
  Each owns its own scope; this card cites them and touches none.
- **The product console** (#2505 / #2527 / #2555) and **the shared DO/D1 operational-state store** (#2742).
  Replacing chat as the operator surface is those epics' work.
- **`converge-pr` (#3323) and the delivery reconciler (#3296).** Both landed as cards under #3029 on
  2026-08-26. They make delivery self-healing; they are not session residue.
- **Healing the stranded-hash card.** `backlog/xv3nqsg-*.md` is `check:standards`'s one error today. Numbering
  it rewrites `we:docs/agent/platform-decisions.md` and would make this a statute edit. Left alone deliberately.

## Done when

Every count below was RUN in lane-14 at `origin/main` `f90ba961` on 2026-08-26, and **every one fails today**.

1. **Executable — the SKILL bridge hand-spawns nothing.** Five sites today, one per dispatch kind:

   ```
   $ grep -cE 'Spawn it as \*\*one background `Agent`\*\*|[Ss]pawn it as ONE background `Agent`' skills-src/conveyor/SKILL.md
   5
   ```

   Must read **`0`**. The alternation is load-bearing, because the five sites are not written alike:
   §3 / §3b / §3e open with *Spawn it as* then a bold-and-backticked *one background Agent*; §3c
   capitalises it — *Spawn it as ONE background Agent.* — and §3c-ci buries it mid-sentence as *and spawn
   it as ONE background Agent*. A single-literal grep silently misses two of the five, which is exactly how a
   vacuous version of this criterion would be written. A bare count of the word *Agent* would be non-zero
   forever and prove nothing.

2. **Executable — the RUNNER is the caller, not a printer.** Today it has no notion of the operation:

   ```
   $ grep -c 'dispatch-lane' skills-src/conveyor/runner.mjs
   0
   $ grep -c 'dispatch-lane\|dispatchLane' skills-src/conveyor/__tests__/runner.test.mjs
   0
   ```

   Both must be **≥ 1**, and `we:skills-src/conveyor/__tests__/runner.test.mjs` must pass with a **named case**
   asserting that a tick whose `decisions.spawnBuilds` is non-empty produces one `dispatch-lane` invocation per
   row through the runner's injected effect — and that a tick with all five lists empty produces none. 23 tests
   pass there today and none mentions dispatch.

   **Run it with `npx vitest run`, never `node --test`.** That file imports `vitest`, so the node runner dies
   with *"Vitest failed to access its internal state"* — a criterion that names the wrong runner goes red for
   the wrong reason and proves nothing about the code:

   ```
   $ node --test skills-src/conveyor/__tests__/runner.test.mjs
   Error: Vitest failed to access its internal state.
   # fail 1
   $ npx vitest run skills-src/conveyor/__tests__/runner.test.mjs
    Test Files  1 passed (1)
         Tests  23 passed (23)
   ```

3. **Executable — the board's session-only publish seam is gone.** One hit today, at
   `we:skills-src/conveyor/SKILL.md:835`:

   ```
   $ grep -c "the PUBLISH step is the SESSION's" skills-src/conveyor/SKILL.md
   1
   ```

   Must read **`0`**, with §8 removed per its own retirement clause (`we:skills-src/conveyor/SKILL.md:853-858`:
   *"when it does, delete this section and the periodic-publish habit with it"*).

4. **Mutation — each criterion must be reachable from the wrong side.** Restoring any one of criterion 1's five
   bullets raises its count off `0` and names the restored line. Reverting the dispatch call in
   `we:skills-src/conveyor/runner.mjs` to today's `emit`-only body (`:114-156`) reddens criterion 2's named vitest
   case — not merely the greps, which a comment mentioning `dispatch-lane` would satisfy. Neither criterion may
   pass against a runner that still only prints its surface.

5. **`npm run check:standards`** — no new errors and no new warnings against the baseline. Do **not** hard-code
   a number: it was **1 error / 1447 warnings** (3331 backlog items) at `f90ba961` on 2026-08-26, measured twice
   with identical results, and it moves most days. This preparation's own commit takes it to **1 error / 1446
   warnings** (measured twice, identical) — the one warning it clears is this card's previous 106-word digest,
   which was over the 100-word cap. That one error is the pre-existing stranded-hash card named
   under *Not in scope*. Run it **plainly and twice** — never through a pipe, because `… | tail` returns
   `tail`'s exit code rather than the gate's, and the loader is non-deterministic in the presence of any
   malformed card.

## Ownership note — sequences, does not duplicate

Unchanged in kind since 2026-07-28: this is a **roadmap / coordinator** epic. It owns the ordering, the residue
inventory above, and the finish line in `## Done when`. It is intentionally not nested under another epic
because it spans several (#2677, #2445, #2527, #2626, #2636) and now also borders #3029, the operation-engine
epic that carries #3096 / #3165 / #3323 / #3331 / #3332 / #3353. Each referenced item keeps its own scope.

**Prepared 2026-08-26.** The preparation replaced a DAG whose first two steps described a resolved decision and
a resolved epic, corrected the claim that #3118 was undecided, and — the load-bearing finding — established that
routing the SKILL's prose onto the operation (#3096) does **not** move dispatch off the session, because the
SKILL is the session's own instructions and `we:skills-src/conveyor/runner.mjs` is outside its scope. That gap
became slice S1.
