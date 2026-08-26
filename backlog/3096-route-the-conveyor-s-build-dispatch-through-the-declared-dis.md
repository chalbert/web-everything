---
bornAs: xaibmeu
kind: story
size: 3
parent: "3029"
status: open
dateOpened: "2026-08-13"
preparedDate: "2026-08-25"
blockedBy: ["x3gvcun"]
relatedTo: ["3037", "3095", "3097", "3118", "3147", "3165", "3239", "3331", "3332", "2612"]
scope:
  - we:skills-src/conveyor/SKILL.md
scopeRationale: "Switches the conveyor SKILL's dispatch bridge — BOTH the step-3 build half and the step-3b prepare half, the latter absorbed from #3147 — to call the already-declared operation. ONE file, and `scope:` now names it at FILE level rather than the directory, so this slice is provably disjoint from #x3gvcun's. The scripts/operations/ half (five liveness hardenings + the first live dispatch) was split out to #x3gvcun on 2026-08-26 and is no longer in this card's touch-set."
tags: [plateau-loop, delivery, operations, conveyor, dispatch]
---

# Route the conveyor's build dispatch through the declared dispatch-lane operation

#3037 declared and registered the dispatch operation, but the conveyor still dispatches the old way: the runner
surfaces `decisions.spawnBuilds` and the main-session bridge spawns each one with the harness `Agent` tool
(`we:skills-src/conveyor/SKILL.md` §3). Two dispatch paths now exist and only one records a durable handle, so a
restart still loses a build the bridge launched. Switch the bridge to call the operation per surfaced launch and
delete the hand-spawn prose.

## Split 2026-08-26 — this card is now the SKILL half only

The reconciliation the day before (PR #1599) left this card at `size: 8`, ON the split bar, carrying two
unrelated bodies of work behind its two `scope:` entries. It has been sliced along exactly that seam. **The
seam was verified in the code before cutting, not taken from this card's word for it** — steps 3 and 3b are
entirely prose in one file (`we:skills-src/conveyor/SKILL.md`, lines 251 and 279), and the five hardenings are
entirely code in another directory (`we:scripts/operations/`), with no shared symbol between them.

| slice | scope | size | carries |
| --- | --- | --- | --- |
| **#3096** (this card) | `we:skills-src/conveyor/` | **3** | steps 3 + 3b rewired onto the operation; the hand-spawn prose deleted |
| **#x3gvcun** | `we:scripts/operations/` | **5** | the five liveness hardenings from PR #1211's round-3 review + the first live dispatch |

`3 + 5 = 8` — the points are conserved, not laundered. Neither slice was resolved and nothing was renumbered.

**This card is `blockedBy: ["x3gvcun"]`, and that edge is the whole safety argument.** Today the conveyor
hand-spawns and never consults the dispatch guard at all, so the un-hardened liveness read is unreachable. The
moment THIS card lands, the conveyor's next tick routes through the operation — which is the first real
dispatch, straight into the guard #x3gvcun exists to harden. Landing this half first would fire the exact
double-dispatch the other half prevents. The other half ships valid on its own (a hardened guard, a real
payload fixture and a proven live dispatch are all wanted regardless of what the skill says), so this is
incremental delivery, not a chain that delivers nothing until the end.

### Where each of the 16 inbound citations now points — NOTHING was repointed

**No citing file was edited.** Every existing `#3096` reference still resolves to this card, which is why the
number stayed here even though most inbound citations want the OTHER half: this card's title and slug name the
routing, they are frozen in its filename, and rewriting 16 files' citations while slicing is the precise move
the reconciliation refused (it would change what those citations resolve to mid-flight) — and one of the 16 is
`we:docs/agent/platform-decisions.md`, a statute. So the citations were preserved by **keeping the card and
adding this map**, not by touching them. A reader arriving from any of them is routed in one hop:

| citer | what it cites #3096 for | now carried by |
| --- | --- | --- |
| `we:skills-src/conveyor/SKILL.md:77` (`@operation-home-ok` marker) | "routing the spawnBuilds and spawnPrepareScope halves through the operation is its own item" | **#3096** — the marker gets *more* accurate, so it is left untouched |
| `we:backlog/3037-*.md:150` | "Routing the bridge through it is #3096" | **#3096** |
| `we:backlog/3037-*.md:173,180` | the reassigned "a lane IS dispatched … scope-lease arbitration" clause | **#x3gvcun** |
| `we:backlog/3095-*.md:34,209` | "#3096 is what changes that" / "until #3096 lands real dispatch" | **#x3gvcun** |
| `we:backlog/3097-*.md:86` | H1 of #3096 (the false docblock claims) | **#x3gvcun** |
| `we:backlog/3102-*.md:78` | "gone" collapsing *finished cleanly* and *died* | **#x3gvcun** |
| `we:backlog/3110-*.md:48` | "real dispatch hasn't [happened] per #3096" | **#x3gvcun** |
| `we:backlog/3118-*.md:241` | "a prerequisite of routing the conveyor" | **#3096** |
| `we:backlog/3118-*.md:559-561,608` | "the first end-to-end live dispatch" | **#x3gvcun** |
| `we:audits/backlog-health-audit.md:571` | the dangling `we:scripts/operations/__fixtures__/claude-agents-payload.json` path | **#x3gvcun** |
| `we:backlog/3331-*.md` | the probe against the handle-match assumption | **#x3gvcun** (`relatedTo`, still not a blocker) |
| `we:backlog/3332-*.md` | the remaining two launch kinds' skill-side routing | **#3096** |
| `we:backlog/3147-*.md`, `we:backlog/3239-*.md` | `graduatedTo: "3096"` on both collapsed duplicates | **#3096** — still true; the fold landed here and this card still holds both halves' history |
| `we:backlog/3288-*.md`, `we:backlog/3289-*.md` | fixtures for the stale-claim / stale-locus prevention cards | **#3096** — and this split adds two more, below |
| `we:docs/agent/platform-decisions.md:3172` | the statute's build pointer | **#3096** — deliberately NOT edited (a statute edit is out of scope) |

### Two more of this card's own claims were wrong and are corrected in #x3gvcun

Re-read at `origin/main` `c8d92db7` while cutting the seam. Recorded here because #3288/#3289 already cite this
card as a fixture for exactly this failure mode, and because a reader of the text below meets the old claims:

- **"no `__fixtures__/` directory exists under `we:scripts/operations/`" is FALSE**, and was false when
  written. The directory has existed since `b1c154ee` (2026-08-14). Only the *file*
  `we:scripts/operations/__fixtures__/claude-agents-payload.json` is missing — which is what `we:audits/backlog-health-audit.md:571` reports.
- **"all four compare sites" mis-counted.** Three call sites were enumerated; the "fourth" was the `listed`
  Set path, a different shape. A genuine unnoticed fourth *file* exists —
  `we:scripts/operations/explore-io.mjs:822` — and is named out of scope in #x3gvcun with its reason.

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

> **That split HAPPENED on 2026-08-26, in its own pass, and the seam was where this paragraph predicted — see
> *Split 2026-08-26* above.** The size is now `3`, not `8`, and the sentences below that say "this card
> carries the hardenings and the live run" are true of the pre-split card only. #x3gvcun carries them now.

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
- **~~The first LIVE dispatch happens here.~~ MOVED to #x3gvcun in the 2026-08-26 split.** It settles what a
  background session's permission mode and isolation default have to be (`WE_DISPATCH_AGENT_ARGS` is the knob)
  and whether the brief's step 1 works from a background agent. Kept struck rather than deleted because the
  ordering it implies is now this card's `blockedBy` edge: by the time this card is claimed, the live run has
  already happened and its answers are settled facts, not open questions for the builder here.
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
- **~~`#3331` is a live PROBE … do not spend the live run before reading its answer.~~ MOVED to #x3gvcun.**
  The probe guards the live run, and the live run is no longer this card's. #3331 stays `relatedTo` on both
  slices — its answer still tells a reader here whether the operation this card routes to can match a handle at
  all — but the "do not spend the live run first" constraint is #x3gvcun's to honour.

## Moved to #x3gvcun in the 2026-08-26 split — the `scripts/operations/` half

Two sections that stood here are now the body of
[#x3gvcun](x3gvcun-harden-the-three-claude-agents-liveness-readings-then-make-t.md), moved verbatim with their
line numbers re-read at `c8d92db7` and the two false claims above corrected:

- **"It carries the other half of #3037's acceptance"** — the reassigned "a lane IS dispatched … verified
  against a real queue" clause from PR #1211's review, and the named classes of defect only a live run can
  catch. **#3037 is still not fully accepted until that clause is met** — it is met in #x3gvcun now, not here.
- **"Carried from PR #1211's round-3 review"** — the five liveness-reading hardenings to `stampLiveness`,
  `assertHandleNotLive` and `createDispatchObservers`, with the risk statement (a bad listing read looks like
  the strong guard, not a degraded one) and the `DISPATCH_LISTING_GRACE_MINUTES` docblock conflict.

Nothing was dropped. This card no longer touches `we:scripts/operations/` at all.

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

**Added by the 2026-08-26 split, and named first because it is the largest thing this card no longer does:**
everything under `we:scripts/operations/` — the five liveness hardenings and the first live dispatch. That is
#x3gvcun. This card touches **exactly one file**, `we:skills-src/conveyor/SKILL.md`; a diff here that reaches
into `scripts/operations/` has crossed the split seam.

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

The conveyor dispatches builds **and prepare-scope launches** only through the declared operation, and the
SKILL no longer instructs a hand-rolled `Agent` spawn for either. Both steps move together — a half-migration
leaves two dispatch mechanisms live inside one skill for the SAME kind of work, which is worse than either end
state.

**The live run and the liveness hardenings are NOT part of this card's acceptance any more** — they are
#x3gvcun's, and this card is `blockedBy` it, so they will already have landed when this one is claimed.

## Done when (absorbed from #3147 — counts RE-RUN at `origin/main` `c8d92db7` on 2026-08-26, not copied)

Criteria 4 and 5 of the pre-split list (the live dispatch, and the mutation tests for the five hardenings)
moved to #x3gvcun with the work. What remains is the skill half, and **all three code criteria below fail
today** — re-run at `c8d92db7`, the counts are unchanged from `9f9cb310`:

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

4. `npm run check:standards` — no new errors and no new warnings against the baseline measured at build time.
   (Do not hard-code a number. It was **1 error / 1438 warnings** at `c8d92db7` on 2026-08-26 — measured twice,
   identical both runs — and it moves most days; the one error there is the pre-existing stranded-hash card
   `backlog/x10eju0-*.md`, unrelated to this item. Run it **twice** and compare: the loader is
   non-deterministic in the presence of any malformed card.)
