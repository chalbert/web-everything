---
bornAs: xaibmeu
kind: story
size: 8
parent: "3029"
status: open
dateOpened: "2026-08-13"
preparedDate: "2026-08-25"
relatedTo: ["3037", "3095", "3097", "3118", "3147", "3165", "3239", "3331", "3332", "2612"]
scope:
  - we:skills-src/conveyor/
  - we:scripts/operations/
scopeRationale: "Switches the conveyor SKILL's dispatch bridge — BOTH the step-3 build half and the step-3b prepare half, the latter absorbed from #3147 — to call the already-declared operation, and (per the round-3 review of #1211) hardens stampLiveness/assertHandleNotLive/createDispatchObservers in scripts/operations/ against an unverified claude agents --json shape before the first live dispatch."
tags: [plateau-loop, delivery, operations, conveyor, dispatch]
---

# Route the conveyor's build dispatch through the declared dispatch-lane operation

#3037 declared and registered the dispatch operation, but the conveyor still dispatches the old way: the runner
surfaces `decisions.spawnBuilds` and the main-session bridge spawns each one with the harness `Agent` tool
(`we:skills-src/conveyor/SKILL.md` §3). Two dispatch paths now exist and only one records a durable handle, so a
restart still loses a build the bridge launched. Switch the bridge to call the operation per surfaced launch and
delete the hand-spawn prose.

## Reconciled 2026-08-26 — this card is the survivor of a THREE-way duplicate

**The near-miss, written up here because this is the file a reader opens again.** Three open cards described
one rewiring, and any two of them claimed at once would have collided on the same edits to
`we:skills-src/conveyor/SKILL.md`:

| card | filed | what it said |
| --- | --- | --- |
| **#3096** (this card) | **2026-08-13** | route the build dispatch through `dispatch-lane`, plus the liveness hardenings and the first live run |
| #3147 | 2026-08-16 | wire steps 3 **and 3b** onto the operation; scope of the SKILL file alone |
| #3239 | 2026-08-21 | the tick executes `spawnBuilds` by hand instead of through `dispatch-lane` |

**#3096 survives because it was filed FIRST**, three days before #3147 and eight before #3239 — not because it
was the best-written of the three (it was not; #3147 carried executable criteria and this one carried prose).
Filing order is the tie-break because the surrounding tree already cites *this* number for exactly this
rewiring — `we:backlog/3095-give-the-dispatch-observer-a-real-completion-signal-liveness.md` ("#3096 is what
changes that"), `#3118`, `#3331`, `#3332`, `#3037` and `we:docs/agent/platform-decisions.md` all point here —
so promoting a later card on quality would mean rewriting those citations, which is the move that manufactures
duplicates in the first place.

**#3147 and #3239 are now `status: resolved` with `graduatedTo: "3096"`.** Neither was deleted. Everything
unique in them was folded into this card BEFORE they were collapsed — the fold is itemised in *What was
folded in* below, so `graduatedTo` here is a true statement about absorbed scope and not a silent drop.

**Known cost, stated rather than hidden: this card is now oversized.** It was `size: 3` for the build half
alone; it now carries the build half, the prepare half absorbed from #3147, five liveness hardenings and a
first-live-run verification. `size: 8` is the honest floor and it sits ON the split bar, not under it. A
`/split` pass before this is dispatched is the right next move — the natural seam is *skill rewiring* (steps 3
and 3b) versus *liveness hardening + first live run* (`we:scripts/operations/`), which are already separate
scope entries above. Splitting was deliberately NOT done here: this reconciliation's job is to make the
duplicate set honest, and slicing the survivor in the same pass would have changed what the citations above
resolve to while they were being repointed.

### What was folded in

**From #3147 — all of it unique, none of it carried anywhere else:**

1. **The step-3b PREPARE half.** #3096 was builds-only. Step 3b (`spawnPrepareScope`) is now in scope — see
   *The prepare half* below. Nothing else on the tree carries the SKILL-side prepare call: `#3165` made the
   *operation* able to launch it, and `#3332` covers the two kinds the operation still cannot launch, but the
   skill-side call for prepare existed only on #3147.
2. **Executable Done-when criteria** — greps with counted before/after values and a mutation case. This card
   had a prose *Acceptance* paragraph and no runnable criterion; #3147's are now *Done when* below, with their
   counts re-run at this head rather than copied.
3. **The `Not in scope` enumeration** of the three other spawn sites, so a builder does not migrate them by
   accident.
4. **The `#3118` Fork-1 position and the runner boundary** — why this card names the operation in the skill's
   prose but declines to create a spawn site in `we:skills-src/conveyor/runner.mjs`.
5. `preparedDate: "2026-08-25"`, inherited rather than discarded — #3147 had been through a prepare pass and
   this card had not, and throwing that away would have un-readied the survivor.

**From #3239 — nothing unique in prose.** Its body is one paragraph restating the build-half routing plus a
`TODO` Done-when. Its one real asset was an in-code citation, not text: the
`<!-- @operation-home-ok: … -->` marker at `we:skills-src/conveyor/SKILL.md:77`, which suppresses the #3224
scan on the tick-core line. That marker has been repointed at this card in the same commit, so the suppression
now names a live item rather than a resolved duplicate.

### Two stale citations corrected while folding (they were wrong at `origin/main`, not merely aged)

- **#3147 claimed the marker reads `@operation-home-ok: #3239` and that #3239's frontmatter reads
  `bornAs: 3239`.** Both are false here. Re-read in this lane: the marker reads
  `@operation-home-ok: #3239`, and
  `we:backlog/3239-the-conveyor-tick-executes-spawnbuilds-by-hand-instead-of-th.md:2` reads `bornAs: 3239`.
  The *identity* claim was right — the marker does point at #3239 — but every string it was stated in was
  wrong.
- **#3147's quoted grep block** listed `grep -rl 3239 backlog/ skills-src/` as returning this card, #3239's
  own card, `3286` and `we:skills-src/conveyor/SKILL.md`. Re-run at `origin/main` `9f9cb310` it returns four
  files, but a **different** four: `3147`, `3286`, `3288`, `3289`. Neither #3239's own card nor the SKILL
  contains the literal `3239` at all — both spell it `3239`. This is the third retraction in that block's
  history, and the reason is the same each time: the count was corrected without re-running the command at the
  commit carrying the correction. `#3286` is the prevention card for exactly this and now has a fourth fixture.

## The prepare half — step 3b (absorbed from #3147)

`we:skills-src/conveyor/SKILL.md` step 3b hand-spawns one prepare-scope agent per
`decisions.spawnPrepareScope` entry, filling `we:skills-src/conveyor/prepare-scope-agent-brief.md` by hand and
spawning the in-session `Agent` tool — the same shape as step 3, with the same failure mode.

**Step 3b now HAS an operation to call. This changed on 2026-08-26 and it is why the prepare half could be
folded here at all.** `#3165` resolved (PR #1581, merged `3f472152`) and widened the operation from one launch
kind to three. Measured in this lane at `origin/main` `9f9cb310`, not recalled:

| where | what it says now |
| --- | --- |
| `we:scripts/operations/dispatch-lane.mjs:106` | `export const LAUNCH_KINDS = Object.freeze(['build', 'prepare', 'prepare-decision']);` |
| `we:scripts/operations/dispatch-lane-io.mjs:191-193` | the shell matches `decisions.spawnBuilds`, `decisions.spawnPrepareScope` **and** `decisions.spawnPrepareDecision` |
| `we:scripts/operations/dispatch-lane-io.mjs:93` | `briefPath(root = REPO_ROOT, kind = 'build')` — it now takes a kind |
| `we:scripts/operations/dispatch-lane-io.mjs:98` | an unknown kind THROWS rather than falling back to the delivery brief |

*(#3147's own body, and this card's earlier drafts, both stated the pessimistic pre-#3165 reading — "the
operation launches `match(decisions.spawnBuilds)` — **builds only**", cited at
`we:scripts/operations/dispatch-lane-io.mjs:139`. That was true when written and is false now; the line has
moved and the behaviour has changed. It is corrected rather than deleted because a builder who reads #3147's
collapsed body will meet the old claim there.)*

So both steps collapse to the same one-line invocation, differing only in the launch kind the tick core
already assigned. **Doing step 3 without step 3b is still refused** — that was #3147's *Delivery shape*
argument and it survives the merge: a half-migration leaves two dispatch mechanisms live inside one skill for
the SAME kind of work, which is worse than either end state. (It is not refuted by the *Not in scope* section
below: leaving fix / CI-heal / decision spawns hand-rolled is an accepted end state for kinds the operation
cannot launch, which is a different thing from splitting one kind's migration across two landings.)

## The seams to watch

- **The operation shells its OWN tick read.** The bridge must pass its live bookkeeping as `--bookkeepingFile`
  or the read runs guard-less (`guardsFrom: 'none'` on the verdict). Note that the operation forwards only the
  `bookkeeping` key — `config` and `signals` are dropped and reported as `droppedBookkeeping`, so a runner using
  non-default TTLs gets the shipped ones instead; check that before switching.
- **The first LIVE dispatch happens here.** #3037 asserted the `claude --bg --session-id …` argv and never fired
  it. This item settles what a background session's permission mode and isolation default have to be
  (`WE_DISPATCH_AGENT_ARGS` is the knob), and whether the brief's step 1 works from a background agent.
- **The agent-runner CLI backend ruling**
  ([#agent-runner-cli-backend](../docs/agent/platform-decisions.md#agent-runner-cli-backend)) may want to own the
  spawn instead. This item is where the two designs meet; if the ruling wins, the operation becomes its caller.
- **~~Land #3095 first or with this.~~ DONE — #3095 is `status: resolved` (`dateResolved: 2026-08-16`).** The
  observer can now resolve a finished build off its PR, so a real dispatch no longer leaves an entry the waker
  re-reports forever. Kept struck rather than deleted because the sequencing constraint is why this card sat
  open, and a reader of the old text needs to know it lifted.
- **`blockedBy: ["3037"]` was cleared on 2026-08-26.** #3037 is `status: resolved`; the declaration it was
  waiting on exists. The frontmatter was stale, not load-bearing — every prose statement of this card's own
  ordering already treated #3037 as done.
- **`#3331` is a live PROBE against this card's central assumption, and it should answer before the first
  dispatch.** It asks whether `claude --bg` honours `--session-id` at all. If it does not, the minted handle
  can never match a listing and every hardening below is guarding a comparison that structurally cannot
  succeed. That is a different defect from the five here (which assume the match CAN work and harden how a
  failed read is interpreted), so #3331 is `relatedTo`, not absorbed — but do not spend the live run before
  reading its answer.

## It carries the other half of #3037's acceptance

Ruled by the independent review of PR #1211, and written into #3037's own acceptance rather than left in a
footnote: **the clause "a lane IS dispatched through the declared operation … with the same scope-lease
arbitration … verified against a real queue" is REASSIGNED here.** #3037 delivered the declaration, the
structural holds and the durable handle; nothing has ever been dispatched, and the lease is taken by the agent
running `lane-pool acquire` from the brief — a path that has not executed. This item is where that clause is
met, so #3037 is not fully accepted until this one is.

Named classes of defect only a live run can catch (from the same review, so they are checked here and not
rediscovered): a background session's permission mode (the agent's first act is `bash` inside a `$( … )`, and a
prompt there stalls it holding a handle that reads `running` forever); whether `--session-id` really pins the id
that `claude agents` reports back; whether `-n` is the session-name flag; what the child inherits from a
conveyor runner's environment (`spawnAgent` passes no `env`); and the agent's lane acquisition racing the
parent's assignment, which is the entire reason the in-flight guard exists.

## Carried from PR #1211's round-3 review — must land before the first live dispatch

The round-3 independent review of #3037's PR **accepted with a named residual**: `stampLiveness` and its two
siblings trust the *shape* of `claude agents --json` on a surface nothing in the repo has ever observed. The
review ruled this could not be fixed honestly blind (a fourth guess at an unverified CLI surface) and reassigned
it here, where the payload becomes real. Full finding: H1/H2 of the round-3 review on PR #1211.

**The risk, stated plainly:** if the liveness listing ever comes back in a shape the code does not expect, the
guard reads it as "the agent is dead" and dispatches a SECOND agent onto the same lane about two minutes later
— while the verdict still reports `dispatchLiveness: 'claude-agents'`, the label for "checked against a real
listing and found clear." The failure looks like the strong guard, not like a degraded one.

**Every line number below was RE-READ in this lane at `origin/main` `9f9cb310` on 2026-08-26, and every one of
them had moved.** The originals were written against the tree at PR #1211 and had drifted by 60-180 lines as
`#3095` and `#3165` landed. None of the five fixes has landed — that was checked too, by grepping for the
identifiers each one would introduce: `lastSeenLiveAt` returns **0** hits under `we:scripts/`, no
`DISPATCH_GUARD_LISTING_GRACE_MINUTES` exists, no `__fixtures__/` directory exists under
`we:scripts/operations/`, and all four compare sites still do a bare `String(x) === handle`. The work is
entirely outstanding; only the coordinates changed.

1. **Capture one real `claude agents --json` payload during this item's own live run and pin the field name to a
   fixture.** Everything below rests on `sessionId` being the right key — the `#3030` spike's account of it, per
   `stampLiveness`'s docblock at
   [we:scripts/operations/dispatch-lane-io.mjs:326](scripts/operations/dispatch-lane-io.mjs), was narrower than
   the CLI in the one place it mattered, and no code path in the repo has ever run `claude --bg --session-id …`
   and then listed it back. Land the fixture (e.g.
   `we:scripts/operations/__fixtures__/claude-agents-payload.json`) before touching the three functions below, so
   their fix is checked against something real rather than another guess.

2. **A non-empty listing that yields zero usable ids must read as `unreadable`, not as "everyone is gone."**
   Three call sites share the exact-match assumption and must all change together:
   - [we:scripts/operations/dispatch-lane-io.mjs:326-347](scripts/operations/dispatch-lane-io.mjs) — `stampLiveness`.
     Line **340** builds `listed` from `sessions.map((s) => String(s?.sessionId ?? '')).filter(Boolean)`; if
     `sessions` is a non-empty array but `listed.size === 0` after that filter (every element lacked a usable id),
     return the `unreadable` branch (currently we:scripts/operations/dispatch-lane-io.mjs lines **337-339**) instead
     of falling through to line **342**'s `listed.has(...)` comparison, which stamps `live: false` on every row.
   - [we:scripts/operations/wake.mjs:319-346](scripts/operations/wake.mjs) — `assertHandleNotLive`. Same shape:
     `sessions` is checked for `Array.isArray` (we:scripts/operations/wake.mjs lines **334-339**) but never for
     "parsed fine, yielded nothing matchable" before the `.some()` compare at line **340**. A non-empty-but-unmatchable
     listing must throw the same "could not be told" refusal as the not-an-array branch, not fall
     through to "not listed, therefore safe to close out."
   - [we:scripts/operations/dispatch-lane-io.mjs:753-825](scripts/operations/dispatch-lane-io.mjs) —
     `createDispatchObservers`. Line **811**'s `sessions.find((s) => s && String(s.sessionId) === handle)` has the
     same hole; a non-empty, no-match listing must report an observer error (like the `!Array.isArray` throw at
     lines **809-810** of we:scripts/operations/dispatch-lane-io.mjs) rather than falling into the `unresolved`
     branch at lines **819-824**.
3. **Compare session ids case- and whitespace-tolerantly**, or state in each docblock why an exact match is
   deliberate. All the exact-match sites above
   (we:scripts/operations/dispatch-lane-io.mjs lines 340/342 and 811, we:scripts/operations/wake.mjs line 340)
   currently do `String(x) === handle`; normalize both sides (e.g. `.trim().toLowerCase()`) before comparing,
   since a CLI that echoes the id in a different case turns every dispatch into a double-dispatch under the
   current exact match.
4. **Age `live: false` from `lastSeenLiveAt`, not `startedAt`.** `dispatchStillHolds`
   ([we:scripts/operations/dispatch-lane.mjs:344-374](scripts/operations/dispatch-lane.mjs), the `entry?.live ===
   false` branch at lines **358-363**) currently has nothing but `startedAt` plus the listing grace
   to decide how long a `live:false` reading is trusted. Persist a `lastSeenLiveAt` timestamp on the run's
   effect entry the first time a listing read confirms `live: true` for it (the natural write point is wherever
   the observer or the guard read next stamps the entry back to the run store), and use that field — falling back
   to `startedAt` only when it was never set — as the anchor for the listing-grace comparison. This means a single
   bad read right after a real "seen alive" cannot release the item; two consecutive bad reads, spaced by the
   grace window, can.
5. **Give the guard its own listing grace, larger than the observer's.** Today both readers share one constant:
   `DISPATCH_LISTING_GRACE_MINUTES = 2` at [we:scripts/operations/dispatch-lane.mjs:131](scripts/operations/dispatch-lane.mjs),
   consumed directly as the guard's default (`listingGraceMinutes = DISPATCH_LISTING_GRACE_MINUTES` at
   we:scripts/operations/dispatch-lane.mjs line **347**, re-read at line **360**) and re-derived as
   `LISTING_GRACE_MS` for the observer at
   [we:scripts/operations/dispatch-lane-io.mjs:115](scripts/operations/dispatch-lane-io.mjs). Their costs of being
   wrong differ by roughly 100x: the observer's wrong answer (`unresolved`) writes nothing, while the guard's
   wrong answer starts a second agent in the same lane clone. Add a distinct, larger constant (e.g.
   `DISPATCH_GUARD_LISTING_GRACE_MINUTES`) and pass it as `dispatchStillHolds`'s default for `listingGraceMinutes`
   instead of reusing the observer's constant, with a docblock stating why the two differ.

   *(Note the docblock at we:scripts/operations/dispatch-lane.mjs:129 argues the opposite — that the observer
   should derive from this constant "rather than carrying a second number that could drift from it." That
   reasoning is sound for drift and wrong for asymmetric cost. Whichever way this lands, the docblock has to
   change with it; do not leave it asserting a rule the code no longer follows.)*

## Interfaces (absorbed from #3147)

The skill's prose collapses to one invocation per surfaced dispatch, for BOTH steps:

```
node we:scripts/operations/run.mjs dispatch-lane --num=<NNN> [--bookkeepingFile=<path>] --json
```

`--num` is the only required input. The operation's own `read`/`plan` steps already shell
`we:scripts/conveyor/tick-core.mjs`, resolve the item, pick the brief for the kind the tick core assigned, and
compute the guard entry — so the skill passes the item number and nothing else. It must not re-derive the plan
or pre-fill a brief. (Pass `--bookkeepingFile` per *The seams to watch* above, or the operation's own tick read
runs guard-less.)

**The runner is OUT of scope, and naming it would be wrong.** `we:skills-src/conveyor/runner.mjs` has no
dispatch site: it only normalises the tick's decisions and emits them (`tickSurface`, and `runLoop`'s injected
`emit`). Creating one would make the headless runner spawn agents itself, which is exactly the question
`#3118` exists to settle. This card names the operation in the skill's PROSE and stops one step short of the
runner call on purpose.

*(Absorbed from #3147, including its correction: #3147 carried `blockedBy: ["3118", "3165"]` for three rounds
and retracted the `#3118` half. The premise supports the SCOPE, not a blocker — declining to create a runner
spawn site is precisely what stops this card pre-empting #3118, and a card that AVOIDS a question is not
blocked by it. `we:scripts/readiness/dispatch-plan.mjs` requires every `blockedBy` resolved before an item is
ready, so an open `kind: decision` in `blockedBy` would have made this card undispatchable until a human
ratifies. `#3118` is `relatedTo` here for the same reason.)*

**Where #3118's ruling points, stated rather than left implicit.** #3118's *Recommended path* now reads
**(c) call the existing `dispatch-lane` operation** — "the runner calls it per surfaced dispatch" — with the
WE-native in-process runner moved to excluded alternatives. So this card sits squarely on the default side of
that fork: what it asks the skill to do IS the ruling's direction. The runner spawn site the ruling implies is
#3118's to create when it is ratified, not this card's.

## Not in scope (absorbed from #3147)

The three other spawn sites in the skill, enumerated from the file rather than named as a range: **§3c** (fix
dispatch, line 521), **§3c-ci** (CI-heal, from line 584) and **§3e** (drive a cleared decision, line 680).
They are separate prose sites, and `dispatch-lane` cannot launch two of their kinds at all — `spawnFixes` and
`spawnCiHeals` have no route and are `#3332`'s job.

Not spawn sites: **§3d** says outright *"No guard, no spawn … this dispatches **no** agent and consumes **no**
lane"*; **§3f** (infra-blocked) contains no spawn or `Agent` at all; and there are **no "panel spawns" in step
4** — grepping `we:skills-src/conveyor/SKILL.md` for `panel` returns **0**.

*(#3147 recorded two earlier drafts getting this wrong in opposite ways — one named a range "3c–3e" that does
not exist, the next named §3d, §3f and panel spawns that do not spawn. Both were written from the card rather
than from the file. Carried here so the same mistake is not made a third time.)*

## Acceptance

The conveyor dispatches builds **and prepare-scope launches** only through the declared operation, one live
dispatch has been observed end to end (agent started, handle recorded, run resumable after a restart), the
scope-lease arbitration has been exercised by that live agent's own `acquire`, the SKILL no longer instructs a
hand-rolled `Agent` spawn for either, and the five liveness-reading hardenings above are landed and each
covered by a test that reddens when the fix is reverted.

## Done when (absorbed from #3147 — counts RE-RUN at `origin/main` `9f9cb310`, not copied)

1. **Executable** — grepping `we:skills-src/conveyor/SKILL.md` for `dispatch-lane` returns hits inside **both**
   step 3 and step 3b. Counted, not assumed — run from the repo root:

   ```
   $ grep -o dispatch-lane skills-src/conveyor/SKILL.md | wc -l
   1
   ```

   That single hit is line 77, the `@operation-home-ok` marker in the tick-core table, which is neither step.
   So the criterion is that the count rises to at least **3** *and* that the two new ones fall within those
   steps. A bare whole-file count would already be non-zero and prove nothing.

2. **Executable** — the hand-spawn prose is gone from steps 3 and 3b. The literal to match is
   ``Spawn it as **one background `Agent`**`` — bold and backticked, as actually written. Counted rather than
   estimated:

   ```
   $ grep -n 'Spawn it as \*\*one background `Agent`\*\*' skills-src/conveyor/SKILL.md
   251:   - Spawn it as **one background `Agent`** with the filled brief as the prompt (default `run_in_background`).
   279:   - Spawn it as **one background `Agent`** with the filled brief as the prompt. It acquires its lane, predicts the
   680:  - Spawn it as **one background `Agent`**. It acquires its lane, prepare-holds the decision, runs the
   ```

   Line 251 is step 3, line 279 is step 3b, line 680 is §3e (the decision spawn, out of scope). The count must
   fall **3 → 1**, with line 680 the survivor.

   Line 521 is **not** in that set: §3c writes ``Spawn it as ONE background `Agent`.`` — capitalised and
   differently worded, so it never matched this literal. (#3147 recorded two wrong versions of this criterion:
   one listed 521 as a must-remain occurrence and gave the count as 4 → 2; an earlier one specified
   `Spawn it as one background Agent` with no markup, which matches **zero** times — a criterion that would
   have "passed" while the prose sat untouched.)

3. **Mutation** — restoring either step's prose reddens case 2 by name, and the count returns to 3.

4. **Executable** — a live dispatch through the operation records a run entry whose handle is found again by
   `stampLiveness`, and the run resumes after the dispatching process is killed. This is the clause reassigned
   from #3037 above; it is the one criterion here that cannot be met without actually starting an agent, and it
   should not be attempted before `#3331`'s probe answers.

5. **Mutation** — each of the five hardenings has a test that reddens when the fix is reverted, including the
   one that matters most: a non-empty `claude agents --json` listing yielding zero usable ids must read as
   `unreadable` and NOT release the guard.

6. `npm run check:standards` — no new errors and no new warnings against the baseline measured at build time.
   (Do not hard-code a number. It was 1 error / 1436 warnings at `9f9cb310` on 2026-08-26, and it moves most
   days; the one error there is a pre-existing stranded-hash card unrelated to this item.)
