---
bornAs: x2n4o16
kind: decision
parent: "3383"
status: open
relatedTo: ["3717", "3690", "3443", "3730", "3784", "3798", "3658", "3804"]
scope: ["we:scripts/lib/dispatch-contracts.mjs", "we:scripts/lib/dispatch-task-type.mjs", "we:scripts/operations/dispatch-lane-io.mjs"]
dateOpened: "2026-09-21"
preparedDate: "2026-09-21"
preparedAgainstSha: "7bdbe0c8a8fdd88b715e4094456b513823489179"
relatedReport: reports/2026-09-21-dispatch-routing-review-and-branch-health-grounding.md
tags: []
---

# Decision: review the five choices the #3717 dispatch-routing build made (forks A to E)

Review the five choices the #3717 build made on the prototype branch (commit `0f1d0fb8f`, pushed to `lane/mechanical-dispatcher`, no pull request) where the card left a call open. The worker chose the smallest reading at each fork and recorded the alternatives; nothing here is ratified. One card, not five: all five sit in one small area (`we:scripts/lib/dispatch-contracts.mjs`, `we:scripts/lib/dispatch-task-type.mjs`, `we:scripts/operations/dispatch-lane-io.mjs`) and are ruled together. Relates #3717, #3690 (the router's graduation model, now ratified as `#delegation-trial-record-graduation`), #3443, #3730, #3784 and #3658.

*Prepared 2026-09-21 (session prepare-3801-and-3768).* Research topic: [/research/dispatch-routing-build-review/](/research/dispatch-routing-build-review/). Session report: `we:reports/2026-09-21-dispatch-routing-review-and-branch-health-grounding.md`. Every citation below was re-read on the prototype tip `5ab89f87b` (read with `git show origin/lane/mechanical-dispatcher:<path>`; these files do not exist on `main`, so their `we:` cites resolve only on the branch). The forks keep their filed letters as Fork 1 (A) to Fork 5 (E).

## Why this is on the critical path

The operator's two stated goals are that delegation and graduation keep moving. #3717 is the router's first real caller, so it is the critical path of the delegation section of #3383's `## Priority order`. Its five choices wait on this review; nothing built on them can graduate to `main` (#3443) until they are ruled.

## FOUND (re-verified 2026-09-21)

- **Built and contained in the branch.** `git merge-base --is-ancestor 0f1d0fb8f origin/lane/mechanical-dispatcher` succeeds. One entry point: `decideDispatchRoute` (`we:scripts/lib/dispatch-contracts.mjs:790`) composes the `taskType` derivation (`we:scripts/lib/dispatch-task-type.mjs:141`), the profile, and `routeDispatch` (`we:scripts/lib/dispatch-contracts.mjs:415`), which itself calls `selectProvider` and `selectSupervisionLevel`.
- **"Every route resolves to Claude" is a drift artifact, not a property of the build.** The branch's `we:scripts/conveyor/run-scorecards.json` holds 18 records (16 `advisory-review`, 2 `fix`), none with a `taskType`. The 26 `session-delegation` trials the router was designed around exist only on `main` (landed 2026-09-18 and 09-19, after the 2026-09-14 merge base). Fed `main`'s file, the branch's own `decideDispatchRoute` routes a size-2 `fix` to `codex` / `gpt-6-astra` and a conflict-caused `fix` of size 2 to `antigravity` / `gemini-3.8-flash-low`, both at `spot-check` (the real reconcile caller passes no size, so its conflict route differs). So once the branch catches up with `main` (#3804), routes WILL leave Claude on the record. `build-new-feature` and `doc-fix` stay Claude: no trials exist for them.
- **The automatic `spot-check` in those routes contradicts ratified rules 3 and 6.** Called directly with the default thresholds, `selectSupervisionLevel` (`we:scripts/lib/provider-routing.mjs:666`) returns `full` for both triples. The dispatch path instead passes `thresholdsForRisk(profile.risk)` (`we:scripts/lib/dispatch-contracts.mjs:452`), and the low-risk entry of `GRADUATION_THRESHOLDS_BY_RISK` (`we:scripts/lib/dispatch-thresholds.mjs:9-13`, marked PLACEHOLDER) is a streak of 2 with no positive control. Rule 3 of `we:docs/agent/platform-decisions.md#delegation-trial-record-graduation` makes the positive control part of the bar and N the `DEFAULT_BACKDOWN_THRESHOLDS` value; rule 6 says promotion takes an explicit ratified act. With enforcement off these are only wrong values in the record, but they become live the day the record is read. That is #3784's work, not a fork here; it is ordered below.
- **Enforcement as built would hold every code-change dispatch.** `supervisionHold` (`we:scripts/lib/dispatch-contracts.mjs:714-721`) holds a `full` route that names no `supervisor`, and `decideDispatchRoute` never sets a `supervisor` field. With `WE_DISPATCH_SUPERVISION_ENFORCE=1`, a size-2 `build` is held ("names no supervisor"). Every code-change route is `full` today, so switching #3784 on as built stops the conveyor. Recorded for #3784; it interacts with Fork 1.
- **The override inherits the router's supervision level.** With `main`'s trials, an override to `antigravity` for a `bugfix` records `supervision: spot-check`: the level `codex`'s triple earned (`we:scripts/lib/dispatch-contracts.mjs:847` swaps `routed`, `:859` keeps `out.supervision`). Trust never carries across triples under the ratified rule, so this is a defect whatever Fork 5 rules.
- **`executed` is a constant, and the item marker makes it false.** `EXECUTABLE_PROVIDER = 'claude'` (`we:scripts/lib/dispatch-contracts.mjs:759`, written at `:856`). The branch's `build` provider already honours the per-item `deliveryAgent:` marker and passes `--provider=<vendor>` to the delivery wrapper (`we:scripts/operations/dispatch-providers/build.mjs:117-121`), which can run Codex on the branch. A Codex-delivered item is then recorded `executed: claude`, a false trial row.
- **Unsized mostly means "a task".** The validator forbids a `size:` on a `task` ("a task has none", `we:docs/agent/backlog-workflow.md:171`). On the branch today, all 192 tasks with `status: open` are unsized (202 counting active and parked ones), and all 381 open stories are sized. 112 of the 192 open tasks declare no `scope:`, and a dispatch with no scope is refused before sizing matters. The reconcile fix path passes no size at all (`we:scripts/conveyor/reconcile-fix-dispatch.mjs:521-526`). The 1,148 figure the build quoted counts decisions and epics too.
- **Two G1 defaults still produce `other`.** `TASK_TYPE_BY_CARD_KIND` maps `task` and `epic` to `other` (`we:scripts/lib/dispatch-contracts.mjs:83`), and `deriveDispatchProfile` falls back to `other` (`:392`). `decideDispatchRoute` does not use them, so "never produced" holds only on the #3717 path.
- **A second process-wide override already exists.** `DELIVERY_AGENT_PROVIDER` is read from the environment by `we:scripts/operations/fix-run.mjs` (docblock at `:111-118`) and the delivery run entry point, and it really changes who runs.
- **A Claude converge editor may also write in a delegated lane.** The delivery wrapper runs converge after the agent, and its editor stays Claude even when Codex delivers (`we:scripts/operations/deliver-item-wrapper.mjs:384-391`).

## Recommended path at a glance

| Fork | Default | Main alternative, and why it is excluded |
| --- | --- | --- |
| 1 (A) — is a single-worker launch routed as the work-doer | **(a) `task` for `build`, `fix`, `ci-heal` (keep the build)** | (b) `story`: forces Claude on every mechanical dispatch, so no route can ever leave Claude |
| 2 (B) — the three task types no kind produces | **(a) none is produced (keep the build)** | (c) default `other`: routes on "we did not know" |
| 3 (C) — role dispatches and the router | **(a) roles never call the router (keep the build)** | (c) a role stage: a second gate over the reviewer seat that `#reviewer-tool-surface-and-containment` already governs |
| 4 (D) — an unsized card | **(a) keep 900 lines; a task's estimate becomes a table row set later by a batched finding from measured task diffs** | (d) read a task as 80 lines now: no real size source, and automatic promotion is still live |
| 5 (E) — where the override lives | **(c) change it: the per-item `deliveryAgent:` marker, with a required reason, is the one override; retire both process-wide variables** | (a) keep: a process-wide variable overrides every dispatch the process launches |

## Settled by statute — not forks, built with the ruling whatever the forks say

- **Supervision is computed for the triple that runs.** An override or a marker never inherits the level another triple earned. Authority: `#delegation-trial-record-graduation` ("trust never carries across triples"). Today's defect is in FOUND.
- **`executed` records the vendor actually spawned,** not a constant, taken from the marker's own rule-4 fields (`executedVendor`) rather than a copy. A false `executed` writes a false trial row, and rule 1 of the same statute makes every read of the record governed. If a Claude converge editor also changed the lane's diff, the trial row says so.
- **`routed` stays the criteria's choice.** A human override is recorded beside it, never written over it (today `:847` overwrites it). This is the same separation `#agent-vendor-registry` rule 4 draws for the marker fallback (`requestedVendor`/`executedVendor` apart from `routedProvider`/`executedProvider`).
- **Promotion stays operator-only (rule 6), and enforcement waits for #3784.** Nothing here flips `WE_DISPATCH_SUPERVISION_ENFORCE`.
- **The header correction is #3798's,** and the "#3690 is not ratified" strings are #3784's.

## Fork 1 — (A) Is a single-worker code-change launch routed as the work-doer?

*The contract this rules:* whether a `dispatch-lane` launch of `build`, `fix` or `ci-heal` is routed and recorded as the agent that does the work, so it can be delegated and its trial counts against its own `{provider, model, taskType}`. The stage argument (`stage: 'task'`) is how the build expresses it.

*Fork-existence:* a `story`-stage route never calls `selectProvider` and forces Claude (`we:scripts/lib/dispatch-contracts.mjs:427-430`); a `task`-stage route runs the cascade (`:431-449`). One launch gets one stage, so the branches cannot coexist for the same kind.

- **(a) `task` for `build`, `fix` and `ci-heal` — recommended (the build's choice).** `decideDispatchRoute` passes `stage: 'task'` (`we:scripts/lib/dispatch-contracts.mjs:842`). A `dispatch-lane` launch starts ONE worker that writes the whole card; there is no task decomposition beneath it on this path. So the launched agent is the task agent, and routing it as one is the honest reading. One caveat, recorded rather than hidden: a Claude converge editor may also edit the lane after the agent (FOUND), so the trial row must say when it did. **Delegation trials:** trials accrue per `{provider, model, taskType}` exactly as `#delegation-trial-record-graduation` rule 3 measures them. **Supervision (#3784):** no route names a `supervisor`, so what satisfies a `full` route for a single-worker lane is delegated to #3784 (recorded there as a dated finding) and must be ruled before enforcement can go on.
- **(b) `story` for all three kinds.** The G1 contract lists `fix` and `ci-heal` beside `build` as story kinds (`STORY_KINDS`, `we:scripts/lib/dispatch-contracts.mjs:53`; `STORY_KIND_RUNGS`, `:89`). Rejected: the story stage forces Claude, so with `main`'s trials the codex `bugfix` and antigravity `conflict-resolution` routes found above disappear and no mechanical dispatch can ever be delegated. It also records no trial against a delegated triple.
- **(c) `story` for `build` only, `task` for `fix` and `ci-heal`.** The filed card's option (b). A `build` would go through `selectSupervisor` (`we:scripts/lib/dispatch-contracts.mjs:583`), which picks a *supervisor* from `role === 'supervise'` records. Rejected on merit: nobody supervises on this path; the launched agent writes the code, so the record would name a role nobody plays and route a writer on a supervisor's history. It becomes right only if a `dispatch-lane` build ever launches separate agents per task under it (the G2 dispatcher). That event is the trigger to file a new decision; nothing reopens this one.

**Skeptic:** SURVIVES-WITH-AMENDMENT → applied. Verified there is no task decomposition under a `dispatch-lane` build, but "one worker writes the whole card" was false: the Claude converge editor can also edit the lane. Now recorded on the trial row (FOUND, *Settled by statute*).
**Screen:** flagged(impl) → fixed. The first draft ruled the stage argument; the fork now rules the visible contract (the launch is routed and recorded as the work-doer), and the reopen condition names a concrete trigger.

## Fork 2 — (B) The three task types no dispatch kind produces

*Fork-existence:* a derivation either produces a type from evidence or produces it by default. Producing `other` by default is broken: it routes on "we did not know", which #3717 says must be unreachable.

- **(a) None is ever produced — recommended (the build's choice).** `self-fix` and `other` are unreachable; `conflict-resolution` comes only from a `fix` with the `conflict` cause (`TASK_TYPES_WITHOUT_PRODUCING_KIND`, `we:scripts/lib/dispatch-task-type.mjs:85-88`, asserted as a negative in its test). **Delegation trials:** `main` holds 10 `other` trials (6 codex, 3 antigravity, 1 claude-native) and 1 `self-fix`, and `codex|gpt-6-astra|other` is the one triple at `spot-check`. That history never informs a mechanical route. This card proposes no re-labelling of those rows. **Supervision:** none.
- **Amendment folded in:** the two G1 defaults that still yield `other` (`:83`, `:392`, FOUND) are removed or made to refuse in the same child, so no path produces it.
- **(b) Add a `self-fix` dispatch kind.** Rejected: it invents a kind nobody dispatches (`LAUNCH_KINDS` has none). Viable if a real self-repair dispatch appears.
- **(c) Map `other` to a default type.** Rejected: it routes the catch-all on the trust `other` earned, which is trust earned on unlabelled work.

**Skeptic:** SURVIVES-WITH-AMENDMENT → applied. Classification: close to settled by #3717 step 1 ("no default"), kept as a fork only so the operator ratifies it. False claim fixed: two G1 defaults still produce `other` (`:83`, `:392`); the child removes them.
**Screen:** clear. Contract: a mechanical route never runs on trust earned on unlabelled work.

## Fork 3 — (C) Role dispatches (`prepare`, `prepare-decision`, `investigate`, `review`) never call the router

*Fork-existence:* the router needs a `taskType`, and a role dispatch has none. Either the router gains a role path or roles stay outside it; one dispatch cannot be both routed and not routed.

- **(a) A role dispatch records `outcome: 'role', routed: null` and keeps its Claude spawn — recommended (the build's choice).** The kind decides it, so it is still mechanical (`decideDispatchRoute`, `we:scripts/lib/dispatch-contracts.mjs:801-822`). Amendment: the role record carries the tier `STORY_KIND_RUNGS` already names for the kind (`:89`), a table lookup, instead of `tier: null`. This deviates from #3717 step 2, which named `review-dispatch` as a router caller; the deviation is ruled here. Moving the *review* seat off Claude is already governed elsewhere: `#reviewer-tool-surface-and-containment` (#3675) moves the mandatory seats only after a replay parity gate, and `#delegation-trial-record-graduation` rule 7 lets any provider fill the reviewer seat. **Delegation trials:** no role trial is recorded against a work triple, which keeps work and review evidence apart (`routeDispatch` already filters `role === 'supervise'` records out, `:424`).
- **(b) Map `prepare` and `review` onto `triage-research` or `architectural-decision`.** Rejected: a guess, and both types force Claude at the router anyway.
- **(c) Give the router a role stage.** Rejected for `review`: a second gate over the reviewer seat that #3675's parity gate already owns. For `prepare`, `prepare-decision` and `investigate`, no delegation evidence exists at all, so a stage would route on nothing.

**Skeptic:** SURVIVES-WITH-AMENDMENT → applied. Citation scope: `#reviewer-tool-surface-and-containment` reaches `review` only, so (c)'s rejection is now split by kind. The role record carries the `STORY_KIND_RUNGS` tier, and the deviation from #3717 step 2 is named.
**Screen:** clear. Contract: role dispatches stay on Claude, are not routed, and never count as work trials.

## Fork 4 — (D) An unsized card

*Fork-existence:* one unsized card gets one estimated size, so reading a task as the largest band and reading it as a small band cannot coexist. What is ruled is where the number comes from; the value itself is a row in the auditable `SIZE_TO_ESTIMATED_LOC` table (`we:scripts/lib/dispatch-contracts.mjs:80`).

- **(a) Keep 900 lines for every unsized card now; a `task` row is added later by an ordinary batched finding from measured task diffs — recommended (the build's choice, with the future path named).** `estimatedLocForSize` (`we:scripts/lib/dispatch-contracts.mjs:737-742`) returns the `13` band, outside every envelope in `PROVEN_TASK_ENVELOPES` (`we:scripts/lib/provider-routing.mjs:163-169`). The cost is real: no unsized task can be delegated, and an unsized dispatch runs on the Opus rung. But no source for a task's size exists yet, and the dispatch path still promotes to `spot-check` on placeholder thresholds (FOUND), so a small estimate now would hand tasks to a non-Claude provider with lighter checking than the ratified rules allow. This matches how `#delegation-trial-record-graduation` rule 3 sets N: a config value changed by a batched finding against real data, never by a decision ceremony. **Trigger:** once #3784's rule-3 and rule-6 fixes land, a finding may propose the task row from the measured diff sizes of landed tasks.
- **(b) Refuse an unsized dispatch.** Rejected: it refuses every task.
- **(c) Derive a size from the declared scope.** Rejected: a new heuristic on a path meant to have none, and 112 of 192 open tasks declare no scope.
- **(d) Read a `task` as 80 lines now.** Rejected: the only number offered, "a task = 2" (`we:docs/agent/backlog-workflow.md:811`), is the batch context-budget floor ("tasks … aren't free"), not a size estimate. With automatic promotion still live, the skeptic's run routed an 80-line `ci-heal` to codex at `spot-check`.

**Skeptic:** REFUTED → flipped from (d) to (a). Citation scope: "a task = 2" is a batch-budget floor, not a size. "Stays at `full` until the operator promotes" was false today (placeholder thresholds promote automatically). 112 of 192 open tasks have no scope, and the reconcile path passes no size. Re-classified as a table row set by a batched finding, following rule 3's pattern for N.
**Screen:** clear. Contract: where an unsized card's estimate comes from, and who may change it.

## Fork 5 — (E) Where the provider override lives

*Fork-existence:* two override surfaces for one dispatch need a precedence rule and can disagree. So there is exactly one, and the options below are which one.

- **(a) `WE_DISPATCH_PROVIDER_OVERRIDE` plus `WE_DISPATCH_OVERRIDE_REASON` — the build's choice.** Read as default parameters at the IO edge (`we:scripts/operations/dispatch-lane-io.mjs:229-230`). Rejected on merit: a variable exported in the runner's environment applies to every dispatch that process launches, not one item, so a stale export silently re-routes the whole conveyor.
- **(b) Two declared `dispatch-lane` inputs (`--provider-override`, `--override-reason`), the filed card's form.** Rejected on merit: `dispatch-lane` is called by the tick, which runs mechanically (its declared input is `bookkeepingFile`, `expectedWithinMinutes`, `num`, `we:scripts/operations/__tests__/dispatch-lane.test.mjs:211`), so a flag reaches only hand dispatches and never the conveyor's own. It would also sit beside the marker, giving two overrides that can disagree.
- **(c) The per-item `deliveryAgent:` marker, with a required reason, is the one override — recommended.** It is already ratified as "a per-item choice of who delivers" (`we:docs/agent/platform-decisions.md#agent-vendor-registry` rule 4), and it is honoured for `build`, `fix` and `ci-heal` (`we:scripts/operations/dispatch-providers/build.mjs:117-121` and its `fix` and `ci-heal` siblings). Three amendments from the skeptic pass: (1) a `deliveryAgentReason:` field is required beside it, and a marker without one is refused, because #3717 requires every override to carry its reason and git's who and when is not a why; (2) the other process-wide variable, `DELIVERY_AGENT_PROVIDER`, is retired with the #3717 pair, for the same reason as (a); (3) the marker's fields stay the rule-4 fields (`requestedVendor`, `executedVendor`, `reason`), and the routing record references them rather than copying them into `routed`, which stays the criteria's choice. **Limits, stated:** the marker's vocabulary is the registered vendors (`claude-restricted`, `codex` today), so Antigravity cannot be forced until it has a descriptor (#3658), and the reconcile conflict path does not read the marker. Neither can execute anything else today anyway. **Delegation trials:** a marker-driven run is a real trial of its own triple. **Supervision:** that triple starts at `full`.
- **(d) No override at all.** Rejected: #3717 requires an explicit, recorded override.

```yaml
# Fork 5 (c): the override, in the item's own frontmatter
deliveryAgent: codex
deliveryAgentReason: "trial of codex on a scoped doc fix, operator 2026-09-22"
```

**Skeptic:** SURVIVES-WITH-AMENDMENT → applied. "The one override" was false while `DELIVERY_AGENT_PROVIDER` exists (now retired too). The marker had no reason field (now required). Rule 4's fields stay the source rather than being copied into routing fields (statute overlap with `#agent-vendor-registry` reconciled). Vocabulary and reconcile-path limits are stated.
**Screen:** clear after two weak reasons were struck: (a)'s "a record with no effect" (a defect already fixed under *Settled by statute*) and (b)'s "breaks a pinned test" (evidence, not merit).

## Order with the sibling cards (not a fork; stated so the ruling can sequence the builds)

1. The *Settled by statute* fixes and whatever Forks 2, 3 and 5 rule land on the branch together (one child, predicted touch-set below).
2. #3784 (rules 4 to 7, the promotion record, what satisfies `full` for a single-worker lane) lands before the enforcement switch is ever turned on, and before or with the #3804 catch-up, because the catch-up brings `main`'s trials in and with them the first automatic `spot-check` values.
3. #3798 (the router header) is independent.

### Review jury (provisional — pre-registered #2638)

Care level: `high`. This jury binds against the item's predicted scope and is re-checked against the real diff at PR open.

| juror | lens | grounding method | pre-registered expectation |
| --- | --- | --- | --- |
| correctness#1 | correctness | static-review | The change does what the spec says with no behaviour regression — every changed branch is exercised, and no test is missing, weakened, or gamed to pass while the behaviour is wrong. |
| correctness#2 | correctness | static-review | The change does what the spec says with no behaviour regression — every changed branch is exercised, and no test is missing, weakened, or gamed to pass while the behaviour is wrong. |
| security#1 | security | static-review | No untrusted input, secret, auth, or file/network path is left unguarded and the trust boundary is not widened — anything touching those earns an explicit security check. |
| security#2 | security | static-review | No untrusted input, secret, auth, or file/network path is left unguarded and the trust boundary is not widened — anything touching those earns an explicit security check. |
| simplicity#1 | simplicity | static-review | The change is the smallest one that solves the problem — it reuses what already exists and adds no dead code or needless abstraction. |
| simplicity#2 | simplicity | static-review | The change is the smallest one that solves the problem — it reuses what already exists and adds no dead code or needless abstraction. |
| standards-conformance#1 | standards-conformance | static-review | The change follows this repo's conventions and platform-native defaults, and does not diverge from a ratified standard or placement rule. |
| standards-conformance#2 | standards-conformance | static-review | The change follows this repo's conventions and platform-native defaults, and does not diverge from a ratified standard or placement rule. |
| claim-accuracy#1 | claim-accuracy | static-review | Every factual claim the change makes about the repo holds against the repo: a cited path:line names what is actually there, a quoted grep literal really matches, a stated count is the real count, a referenced id or link resolves, and anything the description says was changed appears in the diff. |
| claim-accuracy#2 | claim-accuracy | static-review | Every factual claim the change makes about the repo holds against the repo: a cited path:line names what is actually there, a quoted grep literal really matches, a stated count is the real count, a referenced id or link resolves, and anything the description says was changed appears in the diff. |

**Predicted touch-set (#2619)** under the defaults, for the one child the ruling carves: `we:scripts/lib/dispatch-contracts.mjs` · `we:scripts/lib/__tests__/dispatch-contracts-route.test.mjs` · `we:scripts/operations/dispatch-lane-io.mjs` · `we:scripts/operations/__tests__/dispatch-lane-routing-record.test.mjs` · `we:scripts/operations/dispatch-providers/` · `we:scripts/operations/delivery-agent-marker.mjs` · `we:scripts/operations/fix-run.mjs` · `we:scripts/operations/deliver-item-run.mjs` · `we:scripts/conveyor/reconcile-fix-dispatch.mjs`. All exist only on the prototype branch; the child is built there and graduates through #3443.

## Not in this decision

- `dispatch-task` is not wired: its `kind` is a free label, so its `taskType` is not derivable. Tracked on #3730.
- Supervision enforcement stays off (`WE_DISPATCH_SUPERVISION_ENFORCE`); turning it on is #3784.

## Done when

1. **Executable** — `grep -l '^## Ruling' we:backlog/*review-the-five-choices-the-3717-dispatch-routing*.md` lists this card (it fails until the operator has reviewed and a `## Ruling` section names the outcome for each of Forks 1 to 5).
2. A ruling that reverses a fork names the one-line change: Fork 1 is the stage argument at `we:scripts/lib/dispatch-contracts.mjs:842`; Fork 4 is a row in `SIZE_TO_ESTIMATED_LOC` (`:80`); Fork 5 (c) removes the environment pair at `we:scripts/operations/dispatch-lane-io.mjs:229-230` and reads the marker and its reason instead.
