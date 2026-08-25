---
bornAs: x5qc0lw
kind: story
size: 5
status: open
parent: "3029"
relatedTo: ["3161", "3147", "3160"]
tier: pinned
dateOpened: "2026-08-17"
preparedDate: "2026-08-25"
tags: [operations, epic-3029, conveyor, prepare, orchestration-load]
scope:
  - we:scripts/operations/dispatch-lane-io.mjs
  - we:scripts/operations/dispatch-lane.mjs
  - we:scripts/operations/__tests__/dispatch-lane.test.mjs
  - we:scripts/conveyor/tick-core.mjs
  - we:skills-src/conveyor/prepare-scope-agent-brief.md
  - we:skills-src/conveyor/prepare-decision-agent-brief.md
---

# tick-core plans auto-prepare-scope dispatches that never actually spawn

we:scripts/conveyor/tick-core.mjs's planTick computes a prep.scopeSpawns plan for unscoped held items (visible live as a "⚠ N auto-preparing scope: #NNN ..." notes entry), but calling we:scripts/operations/dispatch-lane.mjs --num=<one of those items> does NOT actually trigger that scope-prep dispatch. Confirmed repeatedly tonight (2026-08-17) across #3150, #2786, #2831, #2968, and #3137 — each repeatedly appeared in the plan's auto-preparing-scope notes across multiple dispatch-lane calls, but claude agents --json never showed a corresponding conveyor-<num> background session actually spawn for scope-prep. Worked around for #3150 by adding a scope: field to the item directly (bypassing the auto-prep path entirely) rather than fixing the underlying gap. The plan step correctly identifies the need; the effect step that should act on it appears to be a no-op or unwired. Needs the same treatment #3161 asks for on dispatch-lane's build path generally: either wire the scope-prep dispatch through to a real spawn, or have the plan step report explicitly why it did not dispatch (per #3161's reasoning) rather than silently repeating the same unfulfilled plan on every call.

## Located, 2026-08-25 — CORRECTED after independent review

**The first version of this section was wrong at its premise and its design. Both corrections are kept,
because the error is the same one this repo keeps paying for: a universal claim ("nothing consumes this")
drawn from a partial grep.**

The false claim was *"nothing anywhere consumes `spawnPrepareScope` or `decisionSpawns`"*. It failed twice
over: the grep covered only `we:scripts/operations/` and `we:scripts/conveyor/`, never `we:skills-src/`
where the consumers actually live; and it searched `decisionSpawns`, the planner's **internal local**, while
the public key is `spawnPrepareDecision`. Searching the wrong name is *why* the consumers were missed.

**What is actually true:**

| where | what it does |
| --- | --- |
| `we:scripts/conveyor/tick-core.mjs:858-859` | the planner returns `spawnPrepareScope` and `spawnPrepareDecision` |
| `we:scripts/conveyor/tick-core.mjs:819` | it emits the `⚠ N auto-preparing scope: #NNN` note the operator sees |
| `we:skills-src/conveyor/runner.mjs:87-89` | the runner normalizes all three lists into its `dispatch` surface and **emits** them |
| `we:skills-src/conveyor/SKILL.md:262,271,273` | the prose instructs a session to hand-spawn each entry |
| `we:scripts/operations/dispatch-lane-io.mjs:139` | the operation launches `match(decisions.spawnBuilds)` — **builds only** |

So the lists are **consumed and surfaced, not discarded.** The defect is narrower and more precise than the
first draft claimed: a planned prepare is surfaced to a human or a session, which must then spawn it by
hand, because `dispatch-lane` — *"the only thing in this repo that starts an agent"*, in its own header —
does not cover prepare kinds. The original symptom stands exactly as reported: calling
`dispatch-lane --num=<an auto-preparing item>` does nothing, because that item is not in `spawnBuilds`.

That is still the thing blocking out-of-session prepare. It is just not a dropped list.

**The agent mandates already exist and are substantial** — `we:skills-src/conveyor/prepare-scope-agent-brief.md`
(15.7 KB) and `we:skills-src/conveyor/prepare-decision-agent-brief.md` (18 KB). Neither is reachable, because
`briefPath()` takes no kind. So this card writes no new agent brief; it connects two that were authored and
left unrouted.

**Why this is worth doing before the bigger prepare work.** The operator's direction is that prepare should
run out of the main session, dispatched by an operation, converging on the conveyor daemon owning it
(#3160's contract). The conveyor already has the whole apparatus for that — prepare guards with TTLs,
re-dispatch gates, PR-terminal retirement (`we:scripts/conveyor/tick-core.mjs` §prepare guard), a singleton
runner. This card is the missing connection in a path that is otherwise built, so it delivers
out-of-session prepare sooner and with less new code than building the operation first.

## The design — and the OPEN question review exposed, which is not mine to guess again

**`briefPath(root, kind)` gains a kind**, mapping `'build' | 'prepare' | 'prepare-decision'` to the three
existing briefs. Default stays `'build'` so no current caller changes. This part is uncontested.

**The dispatch effect launches all three planned lists.** Also uncontested in principle — but the first
draft stopped here, and two verified findings show that is not sufficient:

**BLOCKING — the unscoped refusal. `we:scripts/operations/dispatch-lane.mjs:504-508` throws when an item has
no `scope:`.** Today that line is unreachable: `dispatch-plan` holds an unscoped item as `unshaped-no-scope`
and auto-prepares it, so it never reaches `spawnBuilds`. Resolving `launch` from `spawnPrepareScope` routes
control straight into it — and **every prepare-scope target is unscoped by definition**, because being
unscoped is what put it in that list. As first drafted, this card would have converted a silent no-op into a
thrown error on 100% of its own primary case.

The refusal is **not** dead weight to delete. Its own comment gives the reason: an empty `--scope` declares
a lane that owns no paths, so the scope-lease collector would let an overlapping sibling launch beside it.
Lane isolation depends on it.

**So the real question this card must answer is: what does a prepare-scope dispatch declare as its scope?**
Three candidates, none yet chosen, and the choice needs the lane-lease semantics checked rather than
assumed:

- **(a)** the item's card file alone — a prepare authors its own card, so that may be the honest write-set;
- **(b)** a sentinel meaning "no path lease", if the collector can express one without failing open;
- **(c)** keep the refusal for builds and give prepares a different lease path entirely.

Recorded as an open design question rather than picked. Guessing it is exactly what produced the first
draft, and the repo has now paid for that four times in one session.

**Second finding, smaller and settled: the session slug is per kind.**
`we:scripts/operations/dispatch-lane.mjs:170-172`'s `sessionSlugFor` hardcodes `conveyor-<num>`, while
`we:scripts/conveyor/tick-core.mjs:582-586`'s `releaseSessionForNum` derives `prepare-<num>` /
`prepare-decision-<num>` per kind. Dispatching a prepare under the build slug arms a watcher that would
release a session which was never created. `sessionSlugFor` must take the same `kind` and agree with
`releaseSessionForNum` — a test asserting the two functions agree for all three kinds is the right shape.

**Dispatch stays ONE per call.** `dispatch-lane --num=<N>` resolves that item's kind and launches that
item's agent. It does not become a batch dispatcher — the conveyor's tick already decides multiplicity, and
making the operation loop would put a second scheduler in front of the one that exists.

**Rejected: reporting why it did not dispatch instead of dispatching.** The original card offered that as an
alternative, citing #3161. It is the wrong half here: #3161 is about a call that legitimately declines
(already in flight, guard live) explaining itself, which stays #3161's job. A planned prepare that is
silently dropped is not a decline — it is a lost launch, and the fix is to launch it.

## Interfaces

- `briefPath(root, kind = 'build') → string`. Unknown kind throws rather than silently falling back to the
  delivery brief — handing a scope-prep agent the 39 KB delivery mandate is the failure this guards.
- The effect's return gains `launchKind: 'build' | 'prepare' | 'prepare-decision'` beside `launch`, so a
  caller and the run record both show which agent was started.
- Guard entries are already produced per kind by `planPrepareSpawns` (`we:scripts/conveyor/tick-core.mjs:334`
  returns `newGuards`); the effect stamps the matching one exactly as it does for builds today.

## Tasks

0. **Answer the scope question above first** — it gates everything else, and the answer needs the
   scope-lease collector's behaviour checked against an empty or sentinel scope, not reasoned about.
1. Give `briefPath` a kind; throw on unknown.
2. Give `sessionSlugFor` the same kind, and make it agree with `releaseSessionForNum`.
3. Select the launch list and the brief from the resolved kind in the effect.
4. Stamp the matching guard entry per kind.
5. Tests with a stub spawner asserting which brief and which slug each kind receives.

## Delivery shape

Incremental behind `main`, one PR. Additive: with the default kind `'build'`, every existing call behaves
identically, so it can land before anything that depends on it.

## Done when

1. **Executable** — `npx vitest run we:scripts/operations/__tests__/dispatch-lane.test.mjs` passes a case
   where the planner yields a `spawnPrepareScope` entry for the requested item and asserts the **stub
   spawner is called once** with the scope-prep brief. It is called **zero** times today, which is the whole
   defect.
2. **Executable** — the same for a `decisionSpawns` entry and the decision-prep brief.
3. **Executable** — a case asserting a build dispatch still receives
   `we:skills-src/conveyor/delivery-agent-brief.md` and that the spawner call is byte-identical to today's,
   so the additive claim is tested rather than asserted.
4. **Executable** — a case asserting an unknown kind **throws**, so it cannot silently fall back to the
   delivery brief.
5. **Executable** — a case asserting an **unscoped** item routed as `prepare-scope` dispatches successfully
   rather than throwing. This is the one that fails hardest against the naive change, and it cannot be
   written until task 0 is answered — which is why task 0 gates the card.
6. **Executable** — a case asserting `sessionSlugFor(num, kind)` equals `releaseSessionForNum(num, kind)`
   for all three kinds, so a dispatched prepare and the watcher that retires it agree on the session name.
7. **Mutation** — reverting the effect's launch list to `spawnBuilds` only reddens cases 1 and 2 by name;
   reverting the brief selector to its no-kind form reddens case 4; reverting `sessionSlugFor` to the
   hardcoded `conveyor-` form reddens case 6.
8. `npm run check:standards` shows no new warnings against the 0-error / 1435-warning baseline.
