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

## The design

**`briefPath(root, kind)` gains a kind**, mapping `'build' | 'prepare' | 'prepare-decision'` to the three
existing briefs. Default stays `'build'` so no current caller changes. This part is uncontested.

**The dispatch effect launches all three planned lists.** Also uncontested in principle — but the first
draft stopped here, and two verified findings show that is not sufficient:

**The unscoped refusal at `we:scripts/operations/dispatch-lane.mjs:504-508` is BUILD-ONLY, and the prepare
branch never reaches it.** An earlier draft treated this as a blocker and then as an open design question.
Both were wrong, and the error was one word doing two jobs:

- the refusal tests `item.scope` — the **backlog item's `scope:` frontmatter**, which is precisely the thing a
  prepare-scope agent is dispatched to *write*;
- the `--scope` a prepare lane declares is the **lane-lease** scope, a different value from a different
  source.

A prepare dispatch never needs the item's `scope:`. It needs `specPath`, which `read()` already resolves two
lines earlier at `:499-503` and which the brief consumes as `{{ITEM_SPEC_PATH}}`. So the refusal stays exactly
where it is, guarding builds, and the prepare branch routes around it. There is nothing to research.

**And the lane scope is already decided, shipped, and running — it is not this card's to choose.**

| where | what it says |
| --- | --- |
| `we:skills-src/conveyor/SKILL.md:272` | a prepare's `--scope` is *"a single, distinct backlog file (`we:backlog/<num>-<slug>.md`), disjoint by construction"* |
| `we:skills-src/conveyor/prepare-scope-agent-brief.md:33-37` | *"Your PR's scope is KNOWN A PRIORI. You edit **exactly one file** — `{{ITEM_SPEC_PATH}}` … your lane's `--scope` is that one file, so the dispatcher's scope-lease board already knows this lane can never collide"* |
| `we:skills-src/conveyor/prepare-scope-agent-brief.md:56-57` | the `acquire` already runs it: `--scope=we:{{ITEM_SPEC_PATH}}` |

Two of those three files are in this card's own `scope:` list, and the SKILL line is the one *immediately
after* a line this card already cites. **The lane `--scope` for a prepare dispatch is `we:<specPath>` — the
item's own backlog file.** Recorded as the existing ruling, not as a pick.

*(Kept as a marker: an earlier round replaced a false confident claim with a manufactured open question and
then gated delivery on it. The first error was over-claiming; the second was over-correcting into a blocker
the repo had already answered in writing. Both cost a round.)*

**Second finding, smaller and settled: the session slug is per kind.**
`we:scripts/operations/dispatch-lane.mjs:170-172`'s `sessionSlugFor` hardcodes `conveyor-<num>`, while
`we:scripts/conveyor/tick-core.mjs:582-586`'s `releaseSessionForNum(num, prepareKindByNum)` derives
`prepare-<num>` / `prepare-decision-<num>` per kind. Dispatching a prepare under the build slug arms a
watcher that would release a session which was never created. `sessionSlugFor` must take the same `kind` and
agree with `releaseSessionForNum`.

**Note the second argument's real shape.** `releaseSessionForNum` takes a **`Map` of num → kind**
(`we:scripts/conveyor/tick-core.mjs:583` does `prepareKindByNum instanceof Map ? … : undefined`), not a bare
kind string — passing a string yields `undefined` and silently falls through to `conveyor-<num>`, so a test
written that way would pass while proving nothing. And the agreement is **already asserted**, correctly, at
`we:scripts/operations/__tests__/dispatch-lane.test.mjs:562-573` — with `new Map()`, plus a pinned residual
about zero-padded ids. This card **extends** that case to the two prepare kinds; it does not add a second one
beside it.

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
- `sessionSlugFor(num, kind = 'build') → string`, agreeing with
  `releaseSessionForNum(num, new Map([[num, kind]]))`.
- The lane `--scope` for a prepare kind is `we:<specPath>` — one file, per
  `we:skills-src/conveyor/SKILL.md:272`. The build path is unchanged and keeps the item's `scope:`.
- Guard entries are already produced per kind by `planPrepareSpawns` (`we:scripts/conveyor/tick-core.mjs:334`
  returns `newGuards`); the effect stamps the matching one exactly as it does for builds today.

## Tasks

1. Give `briefPath` a kind; throw on unknown.
2. Give `sessionSlugFor` the same kind, and make it agree with `releaseSessionForNum` (which takes a
   `Map` of num → kind, not a kind string).
3. Select the launch list and the brief from the resolved kind in the effect.
4. For a prepare kind, resolve the lane `--scope` to `we:<specPath>` — the item's own backlog file, per
   `we:skills-src/conveyor/SKILL.md:272` — and route past the build-only `scope:` refusal at `:504-508`,
   which stays untouched.
5. Stamp the matching guard entry per kind.
6. Tests with a stub spawner asserting which brief, which slug and which lane scope each kind receives.

## Delivery shape

Incremental behind `main`, one PR. Additive: with the default kind `'build'`, every existing call behaves
identically, so it can land before anything that depends on it.

## Done when

1. **Executable** — `npx vitest run we:scripts/operations/__tests__/dispatch-lane.test.mjs` passes a case
   where the planner yields a `spawnPrepareScope` entry for the requested item and asserts the **stub
   spawner is called once** with the scope-prep brief. It is called **zero** times today, which is the whole
   defect.
2. **Executable** — the same for a `spawnPrepareDecision` entry and the decision-prep brief. (That is the
   planner's **public** key at `we:scripts/conveyor/tick-core.mjs:859`. An earlier draft of this criterion
   said `decisionSpawns`, which is `planPrepareSpawns`'s internal local at `:340` — the same wrong-name error
   the prose section above was corrected for, left standing in the acceptance bar. A builder searching
   `decisions` for `decisionSpawns` finds nothing.)
3. **Executable** — a case asserting a build dispatch still receives
   `we:skills-src/conveyor/delivery-agent-brief.md` and that the spawner call is byte-identical to today's,
   so the additive claim is tested rather than asserted.
4. **Executable** — a case asserting an unknown kind **throws**, so it cannot silently fall back to the
   delivery brief.
5. **Executable** — a case asserting an item with **no `scope:` frontmatter**, routed as `prepare-scope`,
   dispatches successfully rather than throwing, and that the lane `--scope` it declares is `we:<specPath>` —
   the item's own backlog file. This is the case that fails hardest against a naive change, because the
   build-only refusal at `we:scripts/operations/dispatch-lane.mjs:504-508` sits directly in the path a naive
   change would route through.
6. **Executable** — `we:scripts/operations/__tests__/dispatch-lane.test.mjs:562-573` already asserts
   `sessionSlugFor(num) === releaseSessionForNum(num, new Map())` for the build kind. **Extend that case**
   (do not add a second one) to assert
   `sessionSlugFor(num, kind) === releaseSessionForNum(num, new Map([[num, kind]]))` for `prepare` and
   `prepare-decision` too, so a dispatched prepare and the watcher that retires it agree on the session name.
   Keep its pinned zero-padding residual intact.
7. **Mutation** — reverting the effect's launch list to `spawnBuilds` only reddens cases 1 and 2 by name;
   reverting the brief selector to its no-kind form reddens case 4; reverting `sessionSlugFor` to the
   hardcoded `conveyor-` form reddens case 6's **two new kind assertions** while its pre-existing build
   assertion stays green — which is what shows the extension added coverage rather than restating it.
8. `npm run check:standards` shows no new errors and no new warnings **against the baseline at build time**.
   Do not hard-code a number: this preparation PR itself moves it from **1435** to **1437** (two lock-point
   warns on `we:scripts/conveyor/tick-core.mjs` and
   `we:scripts/operations/__tests__/dispatch-lane.test.mjs`, disclosed in its own PR body), so a criterion
   naming 1435 would start the builder red through no fault of theirs.
