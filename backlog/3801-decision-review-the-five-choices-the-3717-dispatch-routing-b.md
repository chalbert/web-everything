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
| 3 (C) — are role dispatches routed by the same graduation model as work | **(c) same core, roles as subject classes (ratified at operator review, 2026-09-21)** | (a) roles never call the router (the build's choice): rejected as the end state, kept only as the interim for the three authoring roles |
| 4 (D) — what dispatch does with a card that declares no size | **(b) block: hold it and send it to prepare to author a size; an operator setting may supply a default size instead (ratified at operator review, 2026-09-21)** | (a) assume 900 lines for every unsized card: kept as a setting value (`default-size: 13`), no longer the default |
| 5 (E) — where the override lives | **(c) change it: the per-item `deliveryAgent:` marker, with a required reason, is the one override; retire both process-wide variables (ratified at operator review, 2026-09-21)** | (a) keep: a process-wide variable overrides every dispatch the process launches |

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

## Fork 3 — (C) Are role dispatches (`prepare`, `prepare-decision`, `investigate`, `review`) routed by the same graduation model as work?

*Ratified at operator review, 2026-09-21: (c).* Restated from the filed form ("role dispatches never call the router"): the fork now rules whether a role dispatch is inside the one graduation core.

*Fork-existence:* a role dispatch is either inside the graduation core or outside it; one dispatch cannot be both routed and not routed. The router needs a subject to key trust on, and a role dispatch had none.

- **(a) A role dispatch records `outcome: 'role', routed: null` and keeps its Claude spawn (the build's choice).** Rejected as the end state at operator review: it leaves the reviewer seat and the authoring roles outside the trust model and creates two mechanisms that drift, and rule 1 of `#delegation-trial-record-graduation` already makes any change to the record governed wherever it is read. Kept only as the interim for `prepare`, `prepare-decision` and `investigate` until their subject key and positive control are prepared. While it holds, the role record carries the tier `STORY_KIND_RUNGS` already names for the kind (`we:scripts/lib/dispatch-contracts.mjs:89`) instead of `tier: null`. The kind decides it, so it is still mechanical (`decideDispatchRoute`, `:801-822`).
- **(b) Map `prepare` and `review` onto `triage-research` or `architectural-decision`.** Rejected: a guess, and both types force Claude at the router anyway.
- **(c) Same core: role dispatches are subject classes in the one graduation and routing model — recommended, ratified.** Decided on merit, not on what is built.
  - **The trust key.** Trust is per `{provider, model, subject}` and never carries across subjects. The subject is the `taskType` for work, the role kind for a role, and the lens (correctness, security and so on) for a review seat. Work and reviewer evidence stay in separate subject classes.
  - **The same rules as work.** The evidence bar has the same shape (a clean streak, a positive control, a hard veto after a miss; `#delegation-trial-record-graduation` rule 3). Demotion is computed and promotion is an explicit ratified act (rule 6). The verification floor never goes away (rule 7).
  - **No graduated candidate means Claude.** This is how `build-new-feature` and `doc-fix` already resolve with no trials, so absent evidence is handled by the model and is no reason to keep roles out of it.
  - **The entry gate is capability, not trust.** A provider is a candidate for a tool-bearing seat only if it can be held to the declared-operations surface, inside the containment (`#reviewer-tool-surface-and-containment` clauses 1 and 2). A streak never grants authority (rule 2). A provider that cannot be reduced to that surface is not a candidate, whatever its record.
  - **Review specifics.** The seat's positive control is the labelled replay corpus, including PR #2107. #3675's replay parity gate is that seat's evidence bar, so it is the same gate and not a second one, and the tool-bearing Codex seat inherits the #2107 veto (clause 4). A reviewer from a different provider than the builder is preferred, never required (rule 7).
  - **Consequence for #3717.** `review-dispatch` becomes a router caller, as #3717 step 2 named, so the deviation from step 2 shrinks to the three authoring roles.
  - **The one open piece, stated not hidden.** The subject key and the positive control for `prepare`, `prepare-decision` and `investigate` were never prepared. Until they are, those three resolve to Claude (fork (a) as the interim above). A follow-up prepares them.
  - **Delegation trials:** no role trial counts against a work subject. **Supervision:** a review subject starts at `full`.

**Skeptic:** SURVIVES-WITH-AMENDMENT → applied to the filed form (citation scope: `#reviewer-tool-surface-and-containment` reaches `review` only; the role record carries the `STORY_KIND_RUNGS` tier; the deviation from #3717 step 2 is named). **Operator review, 2026-09-21:** the operator reversed the recommendation. The filed (c) was rejected as "a second gate over the reviewer seat", and its first restatement was deferred on readiness reasons. Neither is a merit reason. Graduation is one concept for work and seats, and the operator ratified (c) in principle.
**Screen:** restated at operator review. Contract: role dispatches are subject classes in the one graduation core; the capability gate and the evidence source differ per subject, the concept does not.

## Fork 4 — (D) What does dispatch do with a card that declares no size?

*Restated and ratified at operator review, 2026-09-21: (b), with the settable fallback. The other relevant choices are kept as filed options, below.* The filed form asked which constant an unsized card is read as. The fork now rules whether dispatch assumes a size at all, and lets the operator choose the fallback.

*Fork-existence:* an unsized card is either dispatched on an assumed size or held until a declared one exists; one card cannot be both. What is ruled is the default behaviour and what the operator may set; the size values themselves are rows of the auditable `SIZE_TO_ESTIMATED_LOC` table (`we:scripts/lib/dispatch-contracts.mjs:80`). Size is Fibonacci story points (relative effort and uncertainty, `we:docs/agent/backlog-workflow.md` sizing guide), which the table converts to estimated changed lines for the router's proven envelopes (`we:scripts/lib/provider-routing.mjs:163-169`).

*What is true today (checked at review):* the dispatch gate is `scope:`, not `size:`. An unscoped card is held as `unshaped-no-scope` and auto-prepared for scope (`we:scripts/readiness/dispatch-plan.mjs`, `we:scripts/conveyor/tick-core.mjs`); an unsized but scoped card is dispatched, and `estimatedLocForSize` reads the absent size as the `13` band (`we:scripts/lib/dispatch-contracts.mjs:737-742`), outside every proven envelope. Nothing in the build path requires `preparedDate`. Tasks carry no `size:` by validator rule (the no-double-count rule for the burndown), and stories are always sized.

- **(a) Assume a constant size for every unsized card (the build's choice: 900 lines, the `13` band).** Kept as a setting value (`default-size: 13`), no longer the default. On merit it conflates "unknown" with "should-split large": every unsized task runs on the Opus rung and can never be delegated, and the only trace is `sized: false`.
- **(b) Block: an unsized card is not dispatched; it goes to prepare, which authors the size — recommended default.** A declared size, reviewed at prepare, is better evidence than a constant. Consequences: (1) *tasks* need a declared estimate that is NOT points (a distinct frontmatter field), because putting `size:` back on a task would double-count the burndown; (2) *stories* are already required to be sized, so this mostly aligns the router with the validator; (3) "prepared" for this gate means shaped plus sized (a declared `scope:` and a declared size or estimate, both authored by prepare), NOT the `preparedDate` stamp. By a rough grep, about 634 of 646 open tasks and stories carry no `preparedDate`, so a stamp-required gate would stall nearly the whole backlog; that wider admission rule is a separate follow-up (below).
- **(c) Derive a size from the declared scope.** Rejected on merit: an unmeasured heuristic, when prepare can declare the number and a reviewer can check it.
- **(d) Read a task as a small band (80 lines) now.** The number is not a constant in code. It is a setting value (`default-size: 2`) the operator may choose, an explicit and recorded act (rule 6). Constraint: any `default-size` below `13` makes unsized cards eligible for delegation on an unmeasured number. The dispatch path still promotes to `spot-check` on placeholder thresholds (FOUND), so a value below `13` must not be enabled before #3784's rule-3 and rule-6 fixes land. The only number the filed card offered, "a task = 2" (`we:docs/agent/backlog-workflow.md:811`), is the batch context-budget floor, not a size estimate.

```yaml
# Fork 4: the dispatch policy for a code-change card with no declared size
unsizedCardPolicy: block     # default. Or: default-size
defaultSize: 13              # read only when unsizedCardPolicy is default-size; a point from SIZE_TO_ESTIMATED_LOC
```

Every dispatch that used a fallback records `sized: false` and where the number came from (the setting's name and value), so a route decided on an assumed size is never indistinguishable from one decided on a declared size.

**The size source for `fix` and `ci-heal` — default ruled at operator review, 2026-09-21; the other values stay as settable options.** The reconcile path passes no size (`we:scripts/conveyor/reconcile-fix-dispatch.mjs:521-526`), so `block` alone would stop conflict fixes. The default is an ordered chain, and every step is a valid setting.

```yaml
# Where a fix or ci-heal dispatch takes its size from. The default is the ordered chain.
fixSizeSource: [card-size, measured-diff, assumed]   # default. Any one value, or another order, is a valid setting: card-size | measured-diff | assumed | policy
```

- **`card-size` (first).** The declared size of the item the PR was built from. Checked at review: the reconcile path already looks the item up (`findItemFn` in `we:scripts/conveyor/reconcile-fix-dispatch.mjs`), so this is a small change to pass `item.size` through. It yields nothing when the item is missing or is an epic or a deleted card, and the chain moves on.
- **`measured-diff` (second).** The line count of the PR being repaired, a real measurement. The path already falls back to the PR's own changed files for scope (`scopeSource: 'pr-diff'`, `resolveFallbackScope`). Unverified: how closely a repaired diff's size tracks the size of the fix. It affects only this step.
- **`assumed` (last).** The band constant, so Claude and never delegated. It always resolves, so a `fix` or `ci-heal` is never blocked by Fork 4's `block` policy.
- **`policy` (not in the default chain).** Follow `unsizedCardPolicy`. Valid only with `default-size`; under `block` it stops conflict fixes.

*No runtime effect yet on this path:* the reconcile fix spawn is the Claude provider either way, so the route only records what would have been chosen (`routed` versus `executed`). The chain matters once this path can execute a non-Claude provider.

**Skeptic:** REFUTED at the filed form → flipped from (d) to (a); then **reversed at operator review, 2026-09-21** to (b) with the fallback as a setting. Kept from the skeptic pass: "a task = 2" is a batch-budget floor, not a size; "stays at `full` until the operator promotes" was false today (placeholder thresholds promote automatically), which is why a `default-size` below `13` waits for #3784. The filed reasons for keeping 900 ("no source for a task's size exists yet", "automatic promotion is live") were readiness and sequencing, not merit; the sequencing is now a constraint on the setting, not a reason to pin tasks to the top band.
**Screen:** restated at operator review. Contract: whether dispatch waits for a declared size, where an unsized card's fallback comes from, and who may set it.

## Fork 5 — (E) Where the provider override lives

*Ratified at operator review, 2026-09-21: (c). An override never bypasses Fork 4's block on unsized cards: the marker picks the provider, and admission is decided before routing.*

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

## Ruling

Ratified 2026-09-21 by the operator at an interactive review of all five forks. Forks 1, 2 and 5 keep or settle the build's direction where stated; Forks 3 and 4 reverse the build and are multi-part. The *Settled by statute* fixes are built with this ruling whatever the forks say, and the build order is in *Order with the sibling cards* below.

- **Fork 1 — ratified, (a).** `stage: 'task'` for `build`, `fix` and `ci-heal`. Carried: the trial row records when a Claude converge editor also edited the lane; what satisfies a `full` route for a single-worker lane is #3784's and must be ruled before enforcement is switched on.
- **Fork 2 — ratified, (a).** `self-fix` and `other` are never produced; `conflict-resolution` only from a `fix` with the `conflict` cause. Carried: the two G1 defaults that yield `other` (`:83`, `:392`) are removed or made to refuse in the same child.
- **Fork 3 — ratified, (c), restated.** Role dispatches are subject classes in the one graduation core; no graduated candidate resolves to Claude; capability (the declared-operations surface) is the entry gate; `review-dispatch` becomes a router caller. Carried: `prepare`, `prepare-decision` and `investigate` stay on Claude (fork (a) as the interim) until their subject key and positive control are prepared. This REVERSES the build, so it is not a one-line change like the ones named in *Done when*: the routing record needs a role or lens subject axis, and `we:scripts/operations/review-dispatch.mjs` is expected to join the child's touch-set (verify at slicing).
- **Fork 4 — ratified, (b), with the settable fallback.** Ratified: block an unsized card and send it to prepare (a scope-plus-size gate, not the `preparedDate` stamp); the operator may set `default-size` instead, kept as a setting (13 is the old 900-line behaviour, 2 is the old 80-line option). Also ruled: the size source for `fix` and `ci-heal` (`fixSizeSource`) defaults to the ordered chain `card-size`, then `measured-diff`, then `assumed`, so those dispatches are never blocked; every value stays a settable option (`policy` is valid only with `default-size`). Unverified, carried: how closely a repaired diff's size tracks the fix's own size, which affects only the `measured-diff` step. This also REVERSES the build, so it is not the one-line change *Done when* names for Fork 4: it needs the dispatch admission for unsized cards, a task estimate field distinct from points, and the prepare brief to author the size; the child's touch-set is expected to widen (verify at slicing).
- **Fork 5 — ratified, (c).** The per-item `deliveryAgent:` marker with a required `deliveryAgentReason:` is the one provider override. Both process-wide variables are retired: `WE_DISPATCH_PROVIDER_OVERRIDE` with `WE_DISPATCH_OVERRIDE_REASON` (`we:scripts/operations/dispatch-lane-io.mjs:229-230`), and `DELIVERY_AGENT_PROVIDER` (`we:scripts/operations/fix-run.mjs`). The marker's fields stay the `#agent-vendor-registry` rule-4 fields; the routing record references them, and `routed` stays the criteria's choice. Limits, stated: the vocabulary is the registered vendors (`claude-restricted`, `codex` today), so Antigravity cannot be forced until it has a descriptor (#3658), and the reconcile conflict path does not read the marker. A marker-driven run is a real trial of its own triple, which starts at `full`. Also ruled at review: an override never bypasses Fork 4's block on unsized cards, because admission is separate from routing; an unsized card with a `deliveryAgent:` marker is still held for prepare. Carried, not ruled: what the marker means under a planner build (the planner or the task agents) is for the G2 decision (follow-up 1).

**Follow-ups surfaced by the review (none filed yet):**

1. *The planner-plus-small-models build (G2).* Today a `dispatch-lane` build is one worker. The router contract already carries the split: `stage: 'story'` with kind `build` returns the `build-supervisor` (planner) role, and `stage: 'task'` returns a `task-agent` that may leave Claude. Nothing calls the story stage yet. When it does, the `build` launch flips to the story stage (Fork 1) and the per-task launches take the task stage. It needs: a closed task-kind and cause vocabulary for per-task dispatches, because `dispatch-task`'s `kind` is a free label today (Fork 2, #3730); a rule on who may declare a task's type; a possible `self-fix` kind if a rework loop appears (the contract has a `rework` verdict); a size source for tasks (Fork 4); and what satisfies `full` supervision (#3784).
2. *One graduation and routing policy over work and reviewer seats — the principle is ratified in Fork 3; this follow-up carries the configuration.* Configuration per operation and task type of the proof required and the level, with the parameters (N, k, thresholds, the size table, overrides with reasons) editable by the operator and promotion recorded as the explicit ratified act (rule 6). Fixed, never configurable: the verification floor (rule 7), the repo-level `none`, raise-only for high-risk and statute-tier work, and the separation of authority (typed operations) from trust (level). Placement of the schema versus a product UI is for that decision.
3. *A stamp-required build gate.* Fork 4 gates on shaped-plus-sized. A wider rule that blocks any build dispatch for a card with no `preparedDate` would, by a rough grep, hold about 634 of 646 open tasks and stories, so it needs a staged rollout (for example new cards first) and a staleness rule (`we:scripts/readiness/prep-staleness.mjs`). Not filed.
4. *Prepare the authoring roles' subject key and positive control.* What is the subject and what counts as proof for `prepare`, `prepare-decision` and `investigate`? Until this is prepared those three stay on Claude (Fork 3 interim).

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
2. A ruling that reverses a fork names the change: Fork 1 is the stage argument at `we:scripts/lib/dispatch-contracts.mjs:842` (kept as built); Fork 5 (c) removes the environment pair at `we:scripts/operations/dispatch-lane-io.mjs:229-230` and reads the marker and its reason instead. Forks 3 and 4 reverse the build and are multi-part; the *Ruling* section names each part (Fork 4 is no longer a single row in `SIZE_TO_ESTIMATED_LOC`).
