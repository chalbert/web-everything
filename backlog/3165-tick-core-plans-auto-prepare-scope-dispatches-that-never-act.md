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

## Located, 2026-08-25 — it is not a mystery, it is two lines

The original card said the effect "appears to be a no-op or unwired". It is unwired, and the exact seam is:

| where | what it does |
| --- | --- |
| `we:scripts/conveyor/tick-core.mjs:858` | the planner returns `spawnPrepareScope: prep.scopeSpawns` and `decisionSpawns` |
| `we:scripts/conveyor/tick-core.mjs:819` | it emits the `⚠ N auto-preparing scope: #NNN` note the operator sees |
| `we:scripts/operations/dispatch-lane-io.mjs:139` | the effect launches `match(decisions.spawnBuilds)` — **builds only** |
| `we:scripts/operations/dispatch-lane-io.mjs:52` | the brief path is hardcoded to the delivery-agent brief |

**Nothing anywhere consumes `spawnPrepareScope` or `decisionSpawns`** (grepped across
`we:scripts/operations/` and `we:scripts/conveyor/`: the only hits are the planner producing them). So the
plan is computed correctly, the note is printed correctly, and the launch list it feeds is discarded. That
is why the same items reappeared in the note on every call.

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

## The decided design

**`briefPath(root, kind)` gains a kind**, mapping `'build' | 'prepare' | 'prepare-decision'` to the three
existing briefs. Default stays `'build'` so no current caller changes.

**The dispatch effect launches all three planned lists**, not just builds. The planner already emits them
separately and already produces the matching guard entries, so the effect selects the launch list and the
brief from the same `kind` rather than inferring either.

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

1. Give `briefPath` a kind; throw on unknown.
2. Select the launch list and the brief from the resolved kind in the effect.
3. Stamp the matching guard entry per kind.
4. Tests with a stub spawner asserting which brief each kind receives.

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
5. **Mutation** — reverting the effect's launch list to `spawnBuilds` only reddens cases 1 and 2 by name;
   reverting the brief selector to its no-kind form reddens case 4.
6. `npm run check:standards` shows no new warnings against the 0-error / 1435-warning baseline.
