# Planner build (G2): grounding on the prototype and prior art for #3922
**Date**: 2026-09-22
**Point**: Most of the planner build already exists unwired on the prototype (the plan schema, the build-supervisor role, the per-task router); what is missing is the loop that runs a plan, step isolation, scripted steps and per-step supervision — and prior art (Aider architect/editor, LLMCompiler, Magentic-One) supports a code-run plan with strong-model planning and cheap-model steps.
**Research page**: `/research/planner-build-plan-and-execute/`
---

Session `prepare-planner-build`, 2026-09-22. Preparation only: nothing here rules #3922. Grounded on the prototype tip `da085d438` (`origin/lane/mechanical-dispatcher`), read-only.

## Part 1 — Grounding on the prototype

Verified: `git fetch -q origin lane/mechanical-dispatcher` → tip `da085d438fa49888f7d398aece50729fca325a12`. Every `path:line` below was read with `git show da085d438:<path>` (or `git show origin/main:<path>` where marked).

---

## 1. `we:scripts/lib/dispatch-contracts.mjs` — stage model, roles, routing entry points, verdicts, enums

**Stage model (story vs task).** `we:scripts/lib/dispatch-contracts.mjs:56` — `export const ROUTE_STAGES = Object.freeze(['story', 'task']);`. `routeDispatch` (`we:scripts/lib/dispatch-contracts.mjs:440-491`) branches on `options.stage`:
- `we:scripts/lib/dispatch-contracts.mjs:447` — `if (stage === 'story' && kind === 'build') return { ...selectSupervisor(profile, { scorecards }), spotCheck: null };` — a `story`-stage `build` never calls the provider cascade; it calls `selectSupervisor` instead.
- `we:scripts/lib/dispatch-contracts.mjs:451` — `role: stage === 'story' ? kind === 'build' ? SUPERVISOR_ROLE : 'lane-agent' : 'task-agent'` — the three roles in one line: `build-supervisor` (story+build), `lane-agent` (story, non-build kind), `task-agent` (task stage).
- `we:scripts/lib/dispatch-contracts.mjs:452-456` (story branch) picks a Claude tier only (`RECOMMENDATIONS.CLAUDE` forced, `we:scripts/lib/dispatch-contracts.mjs:453`); `we:scripts/lib/dispatch-contracts.mjs:457-474` (task branch) calls `selectProvider`.

**Roles.** `we:scripts/lib/dispatch-contracts.mjs:59` — `export const SUPERVISOR_ROLE = 'build-supervisor';`. The other two role strings (`'lane-agent'`, `'task-agent'`) are inline literals at `we:scripts/lib/dispatch-contracts.mjs:451`, not separately exported constants.

**`selectSupervisor`** — `we:scripts/lib/dispatch-contracts.mjs:608-631`. Picks a Claude/Antigravity/Codex candidate off a fixed ladder (`SUPERVISOR_LADDERS`, `we:scripts/lib/dispatch-contracts.mjs:604-606`, keyed by `risk/complexity`) using `SUPERVISOR_CANDIDATES` (`we:scripts/lib/dispatch-contracts.mjs:596-602`: agy-sonnet-4-6, codex-astra, claude-sonnet-5, agy-opus-4-6, claude-opus-5), and returns `{role: 'build-supervisor', provider, model, tier, backend, mode: 'acting', shadow, supervision: 'full', alternateBackend: null, auditTrail}`. Statute-tier paths or `architectural-decision`/`triage-research` force the hard rung `claude-opus-5` (`we:scripts/lib/dispatch-contracts.mjs:615-616`).

**`routeDispatch`** — `we:scripts/lib/dispatch-contracts.mjs:440-491`. Composes `selectProvider` + `selectSupervisionLevel` (task stage) or `selectSupervisor` (story+build). Returns `{mode, shadow, backend, spotCheck, role, provider, model, tier, supervision, alternateBackend, auditTrail}` (see `refused()` shape at `we:scripts/lib/dispatch-contracts.mjs:421-424` for the same field set on a refusal).

**`decideDispatchRoute`** (the #3717 entry point) — `we:scripts/lib/dispatch-contracts.mjs:1015-1168`. Composes `taskTypeFor` → profile build → `routeDispatch`, handles the `deliveryAgent:` override, size policy and supervision hold. Returns a record: `{kind, outcome, role, taskType, routed, executed, model, tier, supervision, spotCheck, risk, complexity, estimatedLoc, sized, sizeSource, override, refusal, supervisionEnforced, supervisionHold, auditTrail}` (built at `we:scripts/lib/dispatch-contracts.mjs:1127-1162`; refusal shape at `we:scripts/lib/dispatch-contracts.mjs:1170-1177`; role-path shape at `we:scripts/lib/dispatch-contracts.mjs:1026-1049`).

**`supervisionHold`** — `we:scripts/lib/dispatch-contracts.mjs:767-774`. `null` unless `enforce` is true AND `routing.supervision === 'full'` AND `routing.supervisor` is falsy. Since `decideDispatchRoute` never sets a `supervisor` field on a routed (task-stage) record, **every `full`-supervision code-change route is held once enforcement is on** — this is #3801/#3784/#3850's own finding, reproduced directly in this contract's shape.

**Verdict vocabulary.** `we:scripts/lib/dispatch-contracts.mjs:31` — `export const VERDICTS = Object.freeze(['accept', 'rework', 'reject']);`. Verdict modes: `we:scripts/lib/dispatch-contracts.mjs:510` — `VERDICT_MODES = Object.freeze(['acting', 'shadow'])`.

**`STORY_KINDS`** — `we:scripts/lib/dispatch-contracts.mjs:53` — `Object.freeze(['build', 'prepare', 'prepare-decision', 'investigate', 'fix', 'ci-heal'])`.

**TASK kinds** (code-change dispatch kinds vs role kinds) live in the sibling file, not here — see §2.

**The taskType enum.** `we:scripts/lib/dispatch-contracts.mjs:19` — `export const TASK_TYPES = Object.freeze([...Object.keys(PROVEN_TASK_ENVELOPES), 'triage-research', 'architectural-decision']);`. `PROVEN_TASK_ENVELOPES`'s keys (from `we:scripts/lib/provider-routing.mjs`, §3 below) are `doc-fix, bugfix, conflict-resolution, build-new-feature, self-fix, other`, so `TASK_TYPES` = `['doc-fix', 'bugfix', 'conflict-resolution', 'build-new-feature', 'self-fix', 'other', 'triage-research', 'architectural-decision']` (8 values).

**Who calls the story stage today.** Confirmed **nobody**, by grep across the whole branch:
```
git grep -n "stage: 'story'\|selectSupervisor(" da085d438 -- scripts   → zero hits outside dispatch-contracts.mjs itself and __tests__/
```
Every real caller of `decideDispatchRoute`/`routeDispatch` passes `stage: 'task'` or omits it: `we:scripts/conveyor/reconcile-fix-dispatch.mjs:562`, `we:scripts/gen-dispatch-routing-table.mjs:107`, `we:scripts/operations/dispatch-lane-io.mjs:370`, `we:scripts/operations/review-dispatch.mjs:603`. Every export in `we:scripts/lib/dispatch-contracts.mjs` tied to the story/supervisor path is tagged in-source `// @test-only-export-ok: contract for the G2 dispatcher wiring (no runtime caller in slice G1)` (e.g. `we:scripts/lib/dispatch-contracts.mjs:56-59, 596-631`), which is the module itself documenting the "nobody calls this yet" state.

**What a route returns (fields).** See the three shapes above (`routeDispatch`'s at `:451`, `decideDispatchRoute`'s at `:1127-1162`, role-path's at `:1026-1049`, refusal's at `:1170-1177`).

---

## 2. `we:scripts/lib/dispatch-task-type.mjs` — taskType derivation

**The three outcomes.** `we:scripts/lib/dispatch-task-type.mjs:141-190` (`taskTypeFor`): `outcome` is one of `'task-type'` (derived), `'role'` (authoring/judging, no taskType by nature), `'refused'` (fail closed, never guessed/defaulted).

**Code-change kinds.** `we:scripts/lib/dispatch-task-type.mjs:61` — `CODE_CHANGE_DISPATCH_KINDS = Object.freeze(['build', 'fix', 'ci-heal'])`.
**Role kinds.** `we:scripts/lib/dispatch-task-type.mjs:68` — `ROLE_DISPATCH_KINDS = Object.freeze(['prepare', 'prepare-decision', 'investigate', 'review'])`.
**Cause vocabulary.** `we:scripts/lib/dispatch-task-type.mjs:75` — `DISPATCH_CAUSES = Object.freeze(['conflict', 'review-finding', 'ci-failure'])`. An unknown non-empty cause is refused (`we:scripts/lib/dispatch-task-type.mjs:149-153`).

**The derivation table**, in order (`we:scripts/lib/dispatch-task-type.mjs:141-190`):
- no `kind` → refused (`:146-148`)
- unknown `cause` → refused (`:149-153`)
- `kind` in `ROLE_DISPATCH_KINDS` → `outcome: 'role'` (`:156-164`)
- `kind === 'fix'` and `cause === 'conflict'` → `taskType: 'conflict-resolution'` (`:166-168`)
- `kind === 'fix' | 'ci-heal'` → `taskType: 'bugfix'` (`:169-171`)
- `kind === 'build'`, every scope path is a doc path → `taskType: 'doc-fix'` (`:172-175`)
- `kind === 'build'`, no scope paths → refused (`:176-181`)
- `kind === 'build'`, ≥1 non-doc path → `taskType: 'build-new-feature'` (`:182`)
- anything else → refused (`:185-189`)

**`other`/`self-fix`/`conflict-resolution` after #3838.** `we:scripts/lib/dispatch-task-type.mjs:85-89` — `TASK_TYPES_WITHOUT_PRODUCING_KIND`: `self-fix` and `other` are **unreachable** ("no dispatch kind produces it" / "the catch-all; routing on it would be routing on 'we did not know'"); `conflict-resolution` is reachable **only** through the `conflict` CAUSE on a `fix`, never through a kind. This is #3801 Fork 2's ratified outcome, built. Confirmed no other producer exists: `we:scripts/lib/dispatch-contracts.mjs:87` (`TASK_TYPE_BY_CARD_KIND`) and `:392` (`deriveDispatchProfile`'s fallback) still have `other`-producing rows for the card-kind path, but `we:scripts/lib/dispatch-contracts.mjs:1019` (`decideDispatchRoute`) calls `taskTypeFor` directly and never consults `TASK_TYPE_BY_CARD_KIND`, so `other`/`self-fix` are unreachable **on the #3717 dispatch path** specifically (the card-kind table is a separate, older path used by `deriveDispatchProfile`, §9 below).

---

## 3. `we:scripts/lib/provider-routing.mjs` — `selectProvider`, `selectSupervisionLevel`, trust unit, thresholds

**`selectProvider` cascade** — `we:scripts/lib/provider-routing.mjs:425-649`. First-fit order: (1) Gemini/Antigravity fitness (`we:scripts/lib/provider-routing.mjs:447-471`) → (2) Codex fitness (`:476-500`) → (3) both together, high-stakes or thin-history (`:502-565`) → (4) Claude fallback by tier haiku/sonnet/opus (`:567-649`). Inputs: `task = {taskType, description}`, `context = {filesTouched, estimatedSize, scorecards, acceptanceTestable, model, capabilityRatings, capabilityCategory}` (`we:scripts/lib/provider-routing.mjs:420-424`).

Fitness criteria (`evaluateProviderFitness`, `we:scripts/lib/provider-routing.mjs:312-389`): not `architectural-decision`/`triage-research` (`:316-322`); no statute-tier file touched (`:325-332`); within `PROVEN_TASK_ENVELOPES` (`:335-341`); ≥1 clean verified trial for some model (`:361-368`); most recent trial for that model is clean (`:370-374`). **No `informative` requirement in fitness** — that only gates supervision level, not provider choice (see below).

**`selectSupervisionLevel`** — `we:scripts/lib/provider-routing.mjs:703-859`. Trust unit is **`{provider, model, subjectClass, taskType}`** (`we:scripts/lib/provider-routing.mjs:718-726` — `subjectClass` added post-#3845, keeps role/review-lens subjects from mixing with work subjects, #3801 Fork 3). Returns `'spot-check'` iff: most-recent verified trial clean (hard veto otherwise, `:787-789`) AND (no confirmed miss, or a `rootCause` note is on record, `:790-792`) AND trailing clean streak ≥ `requiredCleanStreak` (`minCleanStreak`, or `minCleanStreak + k` post-miss, `:793-797`) AND (not `requireInformativeTrial` or `hasInformativeTrial`, `:798-800`).

**N / thresholds.** `we:scripts/lib/provider-routing.mjs:144-154` — `DEFAULT_BACKDOWN_THRESHOLDS = {minCleanStreak: 5, requireInformativeTrial: true, k: 3}`. Risk-scoped placeholder overrides live in the sibling `we:scripts/lib/dispatch-thresholds.mjs:9-13` (`GRADUATION_THRESHOLDS_BY_RISK`: low `{minCleanStreak: 2, requireInformativeTrial: false}`, medium = the router default, high `{minCleanStreak: 8, requireInformativeTrial: true}` — marked `PLACEHOLDER` in its own docblock at `:3-7`).

**Where scorecards live.** `we:scripts/conveyor/run-scorecards.json`, loaded by the caller and handed in as plain data (`we:scripts/lib/provider-routing.mjs:11-12`; the module itself does zero fs reads).

**Statute-tier forcing.** `isStatuteTierPath` (`we:scripts/lib/provider-routing.mjs:192-196`: any path `docs/agent/` or `we:docs/agent/platform-decisions.md`) forces Opus in the Claude-tier branch (`we:scripts/lib/provider-routing.mjs:578-580`) and excludes Gemini/Codex fitness outright (`:325-332`).

**Ordered provider-preference table.** There is **no separate preference table** — the cascade's fixed evaluation ORDER *is* the preference: Gemini/Antigravity is checked before Codex before "both" before Claude (`we:scripts/lib/provider-routing.mjs:34-38` docblock, executed at `:444-649`). **"Favour Gemini" is already the cascade's own first-checked branch** (`we:scripts/lib/provider-routing.mjs:447-471`); making Gemini Flash "favoured once graduated" for a given `taskType` requires no new table — it requires (a) real clean trials for `{gemini|antigravity, <model>, <taskType>}` passing `evaluateProviderFitness`'s criteria, and (b) — separately, for spot-check supervision, not routing — an `informative` trial and a ratified promotion (see §6 below for why this has not happened yet even where trial counts look sufficient).

---

## 4. `we:scripts/operations/dispatch-task.mjs` + `we:scripts/operations/dispatch-task-io.mjs`

**What it launches.** ONE `claude --bg` background worker (Claude only — the sink calls `defaultClaudeProvider` from `we:scripts/operations/dispatch-lane-io.mjs`, `we:scripts/operations/dispatch-task-io.mjs:140-149`). It is **not** wired to `provider-routing`/`dispatch-contracts` at all — its `kind` is a free label (confirmed: `we:scripts/lib/dispatch-task-type.mjs` is never imported by `we:scripts/operations/dispatch-task.mjs` or `we:scripts/operations/dispatch-task-io.mjs`; `we:backlog/3801-*.md` line "Not in this decision" states this explicitly: "`dispatch-task` is not wired: its `kind` is a free label").

**Inputs** (declared, `we:scripts/operations/dispatch-task.mjs:294-313`): `brief` (string, required — the brief file IS the instruction), `session` (string, required — the agent name/run-record identity), `kind` (string, optional, default `'task'`, **free label**, validated only by shape-regex `we:scripts/operations/dispatch-task.mjs:170` `^[A-Za-z0-9][A-Za-z0-9._-]{0,63}$`, not by any enum), `item` (optional string), `permissionMode` (enum `PERMISSION_MODES`, default `'auto'`, `we:scripts/operations/dispatch-task.mjs:61,69`), `allowedTools` (optional string), `base` (default `'main'`), `expectedWithinMinutes`.

**How the model is chosen.** Comment at `we:scripts/operations/dispatch-task.mjs:303-304`: *"NOT named `model`: that is a control flag of the command line adapter, and a `model` input is refused at registration. A worker model rides `WE_DISPATCH_AGENT_ARGS`."* The sink (`we:scripts/operations/dispatch-task-io.mjs:118-165`) puts `extraArgs` (i.e. `WE_DISPATCH_AGENT_ARGS`, an env-var-carried argv array) FIRST in the spawn argv (`:133-137`), then this operation's own `--permission-mode`/`--allowedTools`.

**Run record shape.** The dispatch effect payload (`we:scripts/operations/dispatch-task.mjs:334-354`): `{num?, item?, launchKind, sessionSlug, brief, prompt, permissionMode, allowedTools, base, expectedWithinMinutes}`, `dispatch: true, idempotent: false`. The sink resolves it to `inFlight({dispatch: {launchKind, route: 'claude-bg', permissionMode, executor: null}, handle, expectedBy})` (`we:scripts/operations/dispatch-task-io.mjs:158-162`).

**Whether it can run in parallel.** Yes — each call is keyed by its own `session` slug; a **second call with the SAME slug** is refused (`planTask`, `we:scripts/operations/dispatch-task.mjs:130-168`, the `already-in-flight` branch at `:156-160`), but different slugs launch independent detached `claude --bg` processes concurrently with no shared lock between them.

**Does it wait for completion? Detached?** **Detached, does not wait.** The sink starts the CLI (`defaultSpawnAgent`/`defaultClaudeProvider`) and immediately returns `inFlight({handle, expectedBy})` (`we:scripts/operations/dispatch-task-io.mjs:158-162`) — there is no blocking wait inside this operation. Completion is reported later, out of band, by the worker itself calling `we:scripts/operations/completion-cli.mjs report` (the launch prompt names this explicitly, `we:scripts/operations/dispatch-task.mjs:85-94`), and the job view is a pure projection of run + completion + liveness records (`projectJobs`, `we:scripts/operations/dispatch-task.mjs:246-276`).

---

## 5. `we:scripts/operations/deliver-item-wrapper.mjs` — the current build flow, and where a per-step dispatch would plug in

**End-to-end flow**, `deliverItem` (`we:scripts/operations/deliver-item-wrapper.mjs:284-449`):
1. **Acquire lane** — `acquireLane({lane, sessionSlug, scope, item, claudeSessionId})` (`:309`).
2. **Claim** — `claimItem({item, sessionSlug, lanePath})`, routed through the declared `claim` operation (`:314-315`, `claimItem` itself at `:481-494`).
3. **Agent turn (ONE worker writes the whole card)** — `report = await runAgentToCompletion({item, sessionSlug, lane, attemptTag, provider, claudeSessionId})` (`:337`; `runAgentToCompletion` at `:971-1005`). This single, **awaited, blocking** call is where "one worker writes the whole card" lives; `report.outcome` gates everything downstream (`blocked` with no files → release + `not-ready`, `:349-354`; `blocked` mid-build → release + `blocked-mid-build`, `:356-364`).
4. **Verify/gate** — `runGateWithOneRetry({lane, item, sessionSlug, attemptTag, provider, claudeSessionId})` (`:370`); red or gate-blocked → release + finish.
5. **Converge** — `runConverge({lane: gate.lanePath, item}, {provider})` (`:390-391`; driven by the WRAPPER, not the agent, per the design amendment on #3627 named in the comment at `:384-389`). **The converge editor is always Claude**, regardless of build provider — stated explicitly: *"Choosing `codex` swaps the BUILD agent only; the convergence rounds still run under Claude... `DeliveryAgentProvider` was only ever defined over the build/resume spawn"* (`we:scripts/operations/deliver-item-wrapper.mjs:824-828`).
6. **Park-mode decision** — `decideParkMode({report, convergeVerdict, filesTouched: report.filesTouched, lanePath: gate.lanePath})` (`:396`, defined `:1769-1808`).
7. **Open PR** — `openPr({item, attemptTag, lane: gate.lanePath, park: parkDecision, report, slug})` (`:406-407`, defined `:1834-1862`).
8. Forward optional learning, then exit — never merges, never releases the claim; the drain lands it later (`:410-423`).

**Where one worker writes the whole card.** Step 3 (`runAgentToCompletion`, `:971-1005`) is the single point: it fills one minimal brief (`fillMinimalBrief`) and spawns ONE agent that must produce the entire diff, then reads back one `report`.

**Where a per-step (G2) dispatch would plug in.** Between steps 2 and 4: today's single `runAgentToCompletion` call would become a story-stage `routeDispatch(stage:'story', kind:'build')` (→ `selectSupervisor`, already built, §1) producing a plan (already schema'd, §8), then N task-stage `decideDispatchRoute` calls (§1/§4) — one per plan task, each optionally run by `dispatch-task` or an in-process script when the task's declared operation is scriptable (§8) — with results fed back through a supervisor verdict (`VERDICTS`, §1) before `runGateWithOneRetry`/`runConverge`/`openPr` run exactly as now, unmodified. Converge and the PR-open step are natural single choke-points for a multi-task build (see §10).

**`resolveDeliveryAgentProvider`** — `we:scripts/operations/deliver-item-wrapper.mjs:943-950`. Name → provider lookup over `DELIVERY_AGENT_PROVIDERS = {'claude-restricted': CLAUDE_RESTRICTED_PROVIDER, codex: CODEX_PROVIDER}` (`we:scripts/operations/deliver-item-wrapper.mjs:920-923`), default `'claude-restricted'` (`:933`). Throws by name on an unknown provider (`:946-949`).

**The Codex provider.** `CODEX_PROVIDER` (`we:scripts/operations/deliver-item-wrapper.mjs:830-916`): spawns via `defaultSpawnCodexAgent` (from `we:scripts/operations/codex-delivery-provider.mjs`), async/awaited (`:884-888`), records CPU (`:890`), records its own scorecard row (`recordCodexRunScorecard`, `:901-904`, `provider: 'codex', model: CODEX_DELIVERY_MODEL`), and its own thread id for resume (`:905-911`). Sandboxed by Codex's own permission profile, not this repo's hooks (`:817-822`).

**`we:scripts/operations/dispatch-providers/build.mjs`** — `deliverItemDetachedProvider` (`:88-134`). Spawns `DELIVER_ITEM_RUN_SCRIPT` (`we:scripts/operations/deliver-item-run.mjs`) DETACHED (never blocks the tick, `:59-81`), reads the item's `deliveryAgent:` marker (`readItemDeliveryAgentMarker`, `:120-121`) and passes `--provider=<vendor>` verbatim when set — *"THE DRIVER'S ONLY provider-selection logic, and it is deliberately not a judgment call"* (`:116-119`). Returns a durable `pid:<n>` handle (`:133`).

**`we:scripts/operations/dispatch-provider-registry.mjs`** — one frozen table, launch-kind → `{provider, modeEnv, defaultMode}` (`:77-119`). Five registered kinds today: `build, prepare, fix, prepare-decision, ci-heal` (`:78-118`); `investigate` still spawns its own agent from its own brief (`:72-73`). `dispatchProviderEntry` fails closed to `null` = "take the agent path" for any unregistered kind (`:160-165`).

---

## 6. Synchronous step executors, and graduation status of any Gemini/Flash tuple

**Synchronous executors that exist:**
- `we:scripts/lib/spawn-to-completion.mjs:66-152` — `spawnToCompletion`, the generic async-but-awaited (`await`-blocking) `child_process.spawn` wrapper replacing `execFileSync`; not model-specific, used underneath other executors.
- `we:scripts/codex-direct-task.mjs` — Codex-only. `buildCodexDirectTaskArgv` defaults `model = CODEX_MODEL` (the ratified `#x8wbivt` pin, imported from `we:scripts/lib/codex-model-routing.mjs`, `we:scripts/codex-direct-task.mjs:88-113,145,173`). It cannot run Gemini.
- `we:scripts/gemini-direct-task.mjs` — runs via the `agy` (Antigravity) CLI, and IS a generic model passthrough: `we:scripts/gemini-direct-task.mjs:39-45` docblock states the live `agy models` catalogue includes "a fast/cheap Gemini Flash tier for simple, low-judgment tasks (gemini-3.8-flash-high/medium/low, and the 3.7/3.6 predecessor generations)". Usage example at `we:scripts/gemini-direct-task.mjs:79`: `node we:scripts/gemini-direct-task.mjs --model=gemini-3.8-flash-high --task="..." --repo-root=<repo>`. **No validated model/effort recommendation is pinned** — "model/effort are optional passthroughs... no default pin or invented tier ladder" (`we:scripts/gemini-direct-task.mjs:59-61`). This file (or its per-step equivalent) is the executor Gemini Flash would run through for a G2 task step.
- `we:scripts/operations/codex-delivery-provider.mjs` — `defaultSpawnCodexAgent`, the delivery-specific Codex spawn `CODEX_PROVIDER.spawn` (§5) uses; Codex-only.

**`EXECUTOR_PROVIDERS`** (`we:scripts/lib/dispatch-contracts.mjs:46-50`) pins which provider each executor may claim: `codex-direct-task → [codex]`, `gemini-direct-task → [gemini, antigravity]`, `claude-subagent`/`claude-session → [claude]`.

**`we:scripts/lib/model-probation.json`** (exists ONLY on `da085d438`; does not exist on `origin/main`, confirmed by `git show origin/main:we:scripts/lib/model-probation.json` → `fatal: path ... does not exist`): two entries — `codex/gpt-6-astra` (`roles: {delivery: 'probation', 'advisory-review': 'probation'}`, since 2026-09-13) and `antigravity/gemini-3.1-pro` (`roles: {'advisory-review': 'probation'}`, since 2026-09-13). **No Gemini Flash entry exists in this file at all** — `gemini-3.8-flash-low` is absent from `we:scripts/lib/model-probation.json` on the prototype branch.

**`we:scripts/lib/model-capability-ratings.json`** — identical on both branches: `{"version": 1, "entries": []}` (only an `exampleEntry` template). Zero real external capability ratings on either branch.

**`we:scripts/conveyor/run-scorecards.json` tuple census (counted by `{provider, model, taskType, outcome}`):**

*On `da085d438`* (18 records, ALL missing `taskType` — a drift artifact per #3801's own finding): `codex/gpt-6-astra` ×13 (no taskType), `antigravity/gemini-3.1-pro` ×5 (no taskType). **Zero usable trial data for routing on the branch's own file.**

*On `origin/main`* (26 records, real `taskType`s): notably **`antigravity/gemini-3.8-flash-low/conflict-resolution` has 5 `landed` records**, all `verifiedBy: "independent-claude"` (2026-09-15 through 2026-09-19; item #3694, PRs #2288/#2291/#2292). This is exactly `minCleanStreak: 5` (`DEFAULT_BACKDOWN_THRESHOLDS`, §3). Also present: `codex/gpt-6-astra/bugfix` ×5 landed +2 reworked, `codex/gpt-6-astra/other` ×5 landed +1 reworked, `codex/gpt-6-astra/doc-fix` ×2, `codex/gpt-6-astra/conflict-resolution` ×1, `codex/gpt-6-astra/self-fix` ×1, `antigravity/gemini-3.1-pro/other` ×1 landed, `antigravity/claude-sonnet-4-6/other` ×1 rejected, `antigravity/gemini-3.8/other` ×1 landed, `claude-native/claude-sonnet-5/other` ×1 landed.

**Has ANY Gemini/Flash tuple graduated? No — for two independent, stackable reasons:**
1. **No `informative` field.** None of the 5 `gemini-3.8-flash-low/conflict-resolution` records carry the `informative: true` field `isInformativeRecord` requires (`we:scripts/lib/provider-routing.mjs:268-273`) — that field did not exist pre-#3888. Under the router's own `DEFAULT_BACKDOWN_THRESHOLDS` (`requireInformativeTrial: true`), `selectSupervisionLevel` for this exact triple returns `full` regardless of the clean streak (`we:scripts/lib/provider-routing.mjs:798-800`). It would only pass under the dispatch path's PLACEHOLDER low-risk threshold (`minCleanStreak: 2, requireInformativeTrial: false`, `we:scripts/lib/dispatch-thresholds.mjs:10`) — exactly the defect #3801 flags ("the automatic spot-check in those routes contradicts ratified rules 3 and 6").
2. **No ratified promotion act.** `we:scripts/lib/dispatch-supervision-promotions.json` (rule 6's checked-in transcript, per #3784's design) **does not exist yet** on `da085d438` (`git show da085d438:we:scripts/lib/dispatch-supervision-promotions.json` → `fatal: path ... does not exist`) — #3784 is not built, so there is no operator-ratified promotion record for ANY triple, Gemini/Flash included.

Separately, `selectProvider`'s FITNESS check (routing, not supervision) has no `informative` requirement (§3) — so on `main`'s data, `antigravity/gemini-3.8-flash-low` **would already be routed as `'gemini'`** for a `conflict-resolution` taskType within the proven envelope (200 LOC / 3 files, `we:scripts/lib/provider-routing.mjs:177`), even though its SUPERVISION level under the ratified defaults stays `full`. Routing eligibility and supervision graduation are two separate gates, and only the first is currently satisfied for this tuple.

---

## 7. `we:.claude/skills/batch-backlog-items/parallel-execute.workflow.js` — disjoint-lane / assembly model

**Important correction to backlog/3575's own description:** the file does not exist at `.claude/skills/...` in git (that copy is generated); the source is `we:skills-src/batch-backlog-items/parallel-execute.workflow.js` (748 lines at `da085d438`). Its own header states it **SUPERSEDES** the disjoint-partition + inline-integrate model backlog/3575 Fork 1 describes:

> `we:skills-src/batch-backlog-items/parallel-execute.workflow.js:13-14` — *"SUPERSEDES the #1933 disjoint-partition + inline-integrate model (F2 = DROP, ratified 2026-07-03). Under #2183 EVERY edit lands via a ready-to-merge PR and the drain is a fully independent optional lander the producer never launches or waits on."*

Concretely, on `da085d438` there is:
- **NO probe→partition, no serial-vs-concurrent split, no shared integration worktree, and NO single supervised merge.** (`we:skills-src/batch-backlog-items/parallel-execute.workflow.js:15-18`: *"NO probe→partition. There is no concurrent-vs-serial split, no confidence/monolith/merge-risk predicate, no serial lane, and no write-time file-lock layer"*.)
- Each item works in its **own lane clone**, claims its own item there, resolves, and **opens its OWN ready-to-merge PR** (`we:skills-src/batch-backlog-items/parallel-execute.workflow.js:2-3` meta description; phases at `:5-10`: Probe → Provision → Lanes → Finalize).
- **NO inline integrate step at all** — landing moves entirely to a separate, later, independently-run drain (`we:scripts/lane-drain.mjs`), which does its own rebase-retry/id-collision-heal/derived-regen (`we:skills-src/batch-backlog-items/parallel-execute.workflow.js:20-23`).
- Finalize (`:9`) only reconciles PR labels (#2216/#2478) and records a local ready-to-merge signal; explicitly *"NO integrate, NO drain launch"*.

**Consequence for #3575/#3922:** backlog/3575 Fork 1's recommended default ("reuse `we:skills-src/batch-backlog-items/parallel-execute.workflow.js`'s disjoint-lane assembly wholesale... assembly happens in ONE throwaway integration worktree... the orchestrating session performs the ONE merge") describes the **#1933 model that this file's own header says was DROPPED and ratified-dropped on 2026-07-03**. The mechanism that actually exists on both branches today is PR-fan-out with an independent drain, not a single-merge integration worktree. Any G2 design that leans on 3575 Fork 1's "one merge" premise needs to re-ground against the PR-fan-out architecture, not the superseded one.

---

## 8. Existing plan/step schema, step executor, "scriptable step" registry; can a plan step name a declared operation?

**Yes — a plan JSON schema already exists**, unwired, in `we:scripts/lib/dispatch-supervisor-contract.mjs` (137 lines, every export tagged `// @test-only-export-ok: contract for the G2 dispatcher wiring (no runtime caller in slice G1)`):

- **`PLAN_OUTPUT_SCHEMA`** (`we:scripts/lib/dispatch-supervisor-contract.mjs:18`) — exactly the shape #3922 asks for: `{storyRef: string, round: integer≥1, tasks: [{id, title, dependsOn: string[], profile: {taskType: enum(TASK_TYPES), estimatedLoc: integer≥1, filesTouched: string[], acceptanceTestable: boolean, risk: enum(RISKS), dependsOn: string[]}}]}` (schema built at `we:scripts/lib/dispatch-supervisor-contract.mjs:10-13`).
- **`planFromSupervisorOutput(output, options)`** (`we:scripts/lib/dispatch-supervisor-contract.mjs:47-55`) — validates a raw planner JSON blob against `PLAN_OUTPUT_SCHEMA`, builds each task's dispatch profile via `buildDispatchProfile` (from `we:scripts/lib/dispatch-contracts.mjs`), and runs the WHOLE plan through `validatePlan` (cycle detection, dependency-existence — `we:scripts/lib/dispatch-contracts.mjs:227-259`).
- **`VERDICT_OUTPUT_SCHEMA`** / **`verdictFromSupervisorOutput`** (`we:scripts/lib/dispatch-supervisor-contract.mjs:20,58-72`) — the supervisor's per-task judgment output (`verdict` from `VERDICTS`, `findings`, optional `newTasks`/`complete`), schema-validated the same way.
- **`validateContextPacket`** (`we:scripts/lib/dispatch-supervisor-contract.mjs:75-100`) — what the supervisor is HANDED each round (`phase: 'plan'|'verdict'`, `story`, optional `tasks`/`results`); explicitly states *"Packet text is supervisor context only. It is never supplied to the router."*
- **`SUPERVISOR_INVOCATIONS`** (`we:scripts/lib/dispatch-supervisor-contract.mjs:104-118`) — concrete, verified CLI transport notes for getting schema-constrained JSON out of each of the three candidate supervisor backends: `codex exec --json -s read-only --output-schema <FILE>` (verified via `--help`), `agy --mode plan -p --output-format json --json-schema <string|file>` (flags verified via `--help`; whether plan-mode prevents write-tool errors is marked **UNVERIFIED**), `claude -p --output-format json --tools "" --json-schema <inline>` (flags verified; tool-free supervisor round marked **UNVERIFIED**).
- **`we:scripts/lib/dispatch-supervision-tree.mjs`** (126 lines) — a pure `/wip` projection (`buildSupervisionTree`, `renderSupervisionTreeMarkdown`) that already knows how to render a plan's `tasks[].dependsOn`, parallel-eligible groups (via `computeParallelEligible`, `we:scripts/lib/dispatch-contracts.mjs:262-273`), and per-task lifecycle/status — again currently only fed by `we:scripts/operations/wip-report.mjs` for display, with **no live producer** of plan/result/verdict records to feed it (confirmed: `git grep -l "we:scripts/lib/dispatch-supervisor-contract.mjs\|we:scripts/lib/dispatch-supervision-tree.mjs" da085d438 -- scripts` → only `we:scripts/operations/wip-report.mjs`, no dispatch-path caller).

**Declared-operations registry — could a plan step name a declared operation to run mechanically?** The registry exists (`we:scripts/operations/run.mjs`, imports ~30 declared operations: `claim`, `resolve`, `scaffold`, `file-item`, `open-pr`, `verify`, `mutation-check`, `explore`, `dispatch-lane`, `dispatch-task`, `record-verdict`, `restart-runner`, `clear-stuck-session`, `priority-sync`, `tracker-refresh`, `docket-refresh`, `turn-digest`, `gap-sweep-status`, `land-advance`, `route-pr-outcome`, `pr-status`, `wip-agents`, `gate-health`, `suggest-next`, `review-prep`, `stage-pr-view`, etc. — `we:scripts/operations/run.mjs:29-101`). Each is a `compute`/`judge`/`confirm`/`effect` step declaration under the closed 4-kind vocabulary (`STEP_KINDS`, `we:scripts/operations/step-kinds.mjs:29`). **Nothing today lets a plan step name one of these by id and have the mechanical orchestrator invoke it directly** — there is no "operation id" field anywhere in `PLAN_OUTPUT_SCHEMA`'s task shape (only `id, title, dependsOn, profile`), and no code path resolves a task to `we:scripts/operations/run.mjs <op>`. This is architecturally straightforward to add (the registry already exposes stable op ids like `DISPATCH_TASK_OP = 'dispatch-task'`, `we:scripts/operations/dispatch-task.mjs:52`, and `CLAIM_OP`, `VERIFY_OP`, etc.), but it does not exist yet — it is exactly the "runs each step itself when a script can" half of #3922's ask, unbuilt.

---

## 9. Size/estimate machinery after #3839/#3842/#3843/#3849

**`estimatedLoc` field (#3839).** `we:scripts/lib/dispatch-contracts.mjs:390-397` (inside `deriveDispatchProfile`) — a `task`-only, points-distinct field: *"`estimatedLoc` (#3839, Fork 4 field of #3801) is the task-only dispatch estimate — estimated changed lines, distinct from `size` points. Only a `task` card may declare it... Declaring it on any other kind is refused, never silently accepted alongside a `size`."* Invalid combinations are named explicitly: `estimatedLoc:task-only` (non-task kind declares it, `:396`), `estimatedLoc:invalid` (task declares it but it's not a positive integer, `:397`).

**`SIZE_TO_ESTIMATED_LOC`** — `we:scripts/lib/dispatch-contracts.mjs:80` — `Object.freeze({1: 30, 2: 80, 3: 150, 5: 300, 8: 500, 13: 900})`, documented row-by-row at `:66-77` against real backlog size distribution (2,512 sized of 3,662 cards as of 2026-09-20; 1,148 unsized).

**`unsizedCardPolicy` (#3801 Fork 4 (b), built by #3843).** `we:scripts/lib/dispatch-contracts.mjs:776-782` — `UNSIZED_CARD_POLICIES = Object.freeze(['block', 'default-size'])`. `we:scripts/lib/dispatch-contracts.mjs:807-810` — `DEFAULT_SIZE_POLICY = {unsizedCardPolicy: 'block', defaultSize: 13, fixSizeSource: ['card-size', 'measured-diff', 'assumed']}` (checked into `we:scripts/lib/dispatch-size-policy.json`, read at the io edge). `MIN_DEFAULT_SIZE = 13` (`we:scripts/lib/dispatch-contracts.mjs:798`) — a `defaultSize` below 13 is refused by `validateSizePolicy` (`:832-840`) until #3784's rule-3/rule-6 fixes land. **NOTE:** `decideDispatchRoute` itself does NOT gate admission on `block` today — the comment at `we:scripts/lib/dispatch-contracts.mjs:1059-1061` states *"`block` does not gate admission here (that is the sibling slice)"* — so today an unsized `build`/etc. still dispatches, falling back to the largest band (`sizeSource: 'largest-band'`, `:1079`) exactly as before #3843. `FIX_SIZE_SOURCES` (`:790`) and `resolveFixSize` (`:906-928`) implement the ordered `fixSizeSource` chain for `fix`/`ci-heal` specifically (`REPAIR_KINDS`, `:893`), because the reconcile path passes no size at all.

---

## 10. Supervision — #3850's ruling for a single-worker lane; how it applies to a multi-step build

**#3850's ruling** (ratified 2026-09-22, `origin/main:backlog/3850-*.md`, `## Ruling`):
- **Fork 1 (a), ratified:** the review panel on the lane's own PR **is** the "full independent review" for a single-worker lane — recorded as the supervisor, and the PR of a `full` route "opens parked `review:pending`... and cannot land until the panel records `review:accepted`"; for `fix`/`ci-heal` (which push onto an existing PR) the hold is enforced at the LAND seam via the existing head-SHA re-park, never by the wrapper writing a label.
- **Fork 2 (a), ratified:** the hold binds every route whose EXECUTED vendor is not Claude (a delegated run); a Claude-executed `full` route is passed through at dispatch time and native work keeps today's escalation-rubric review policy unchanged.
- Explicitly carried, NOT ruled here: *"A planner build's supervisor: G2 (#3801 follow-up 1)"* (`## Not in this decision`).

**How this extends to a multi-step (G2) build.** #3850 Fork 1 (c) (rejected as the interim, but explicitly reopened by G2) reads: *"(c) A live supervising agent per lane (the story-stage `build-supervisor`). Rejected on merit: nobody supervises on this path... It becomes right only with the planner build (G2, #3801 follow-up 1), which would file its own decision."* (`origin/main:backlog/3850-*.md`, Fork 1 discussion). Combined with the already-built `selectSupervisor`/`SUPERVISOR_ROLE`/`SUPERVISOR_LADDERS` machinery (§1) — which picks a real supervisor candidate (Claude/Antigravity/Codex) by risk/complexity and returns `supervision: 'full'` unconditionally (`we:scripts/lib/dispatch-contracts.mjs:629`, hard-coded `'full'`, never `spot-check`, for the supervisor role itself) — the natural reading is: **the story-stage `build-supervisor` becomes the live, in-lane supervisor #3850 Fork 1 (c) needed and didn't have**, so per-task `full`-route holds could be satisfied by the supervisor's own accept verdict (`VERDICTS`, §1) INSIDE the build, with the existing PR-level review panel (#3850 Fork 1 (a)) still applying once, at the end, to the assembled diff — i.e. one PR at the end, reviewed once, exactly as #3850 already assumes for "a `dispatch-lane` launch", with the supervisor verdict providing the missing in-build check for each task's own route. **This composition is not ruled anywhere** — it is inference from the built contract shapes plus #3850's own stated reopen condition, not a decided design.

---

## 11. The `deliveryAgent:` marker (#3840/#3801 Fork 5)

**Fields.** `we:scripts/operations/delivery-agent-marker.mjs:39` — `DELIVERY_AGENT_MARKER_KEY = 'deliveryAgent'`; `:48` — `DELIVERY_AGENT_REASON_KEY = 'deliveryAgentReason'` (REQUIRED companion, per #3840/Fork 5 — *"a `deliveryAgent:` marker with no `deliveryAgentReason:` is refused at routing"*). Both are plain scalar frontmatter fields on the item's own `backlog/NNN-*.md`.

**Where read.**
- `we:scripts/operations/delivery-agent-marker.mjs:86-100` (`readItemDeliveryAgentMarker`) and `:114-132` (`readItemDeliveryAgentOverride`, reads BOTH fields in one pass) — the IO shell; never throws, degrades to `null` on any failure (unreadable file, unresolvable item, absent field).
- Called from `we:scripts/operations/dispatch-providers/build.mjs:120-121` (and its `we:scripts/operations/dispatch-providers/fix.mjs`/`we:scripts/operations/dispatch-providers/ci-heal.mjs` siblings, per the file's own docblock `:28`) — read in the PARENT process before the detached child spawns, then passed through as a plain `--provider=<vendor>` argv string (`:121`).
- Enforced/refused centrally in `we:scripts/lib/dispatch-contracts.mjs:1179-1198` (`normalizeOverride`) — called only for `MARKER_KINDS = ['build', 'fix', 'ci-heal']` (`:944`); refuses a vendor outside `DELIVERY_VENDOR_PROVIDERS = {'claude-restricted': 'claude', codex: 'codex'}` (`:939`), a marker with no reason, or a reason with no marker (`:1183-1194`).
- Consumed for vendor resolution at delivery time via `resolveDeliveryAgentProvider` (§5, `we:scripts/operations/deliver-item-wrapper.mjs:943-950`), which the `--provider=` argv flag ultimately feeds into `we:scripts/operations/deliver-item-run.mjs` (not read in this excerpt, but named as the target at `we:scripts/operations/dispatch-providers/build.mjs:53`, `DELIVER_ITEM_RUN_SCRIPT`).

**Not read for:** role kinds (`prepare`, `prepare-decision`, `investigate`, `review` are excluded from `MARKER_KINDS`) and the reconcile conflict path (stated as a limit in `origin/main:backlog/3801-*.md` Fork 5: *"the reconcile conflict path does not read the marker"*).

---

## Summary of what is and is not built for #3922 (G2), as of `da085d438`

**Built, unwired (ready to be wired):**
- The plan JSON schema (`PLAN_OUTPUT_SCHEMA`) and its validators (`we:scripts/lib/dispatch-supervisor-contract.mjs`).
- The story/task stage split and the `build-supervisor` role selection (`routeDispatch`, `selectSupervisor`, `we:scripts/lib/dispatch-contracts.mjs`).
- The per-task routing pipeline (`decideDispatchRoute`) that a task-stage plan item would call unchanged.
- A `/wip`-facing supervision-tree renderer (`we:scripts/lib/dispatch-supervision-tree.mjs`) that already expects plan/verdict/result records.
- A generic, model-agnostic executor for a Gemini/Flash step (`we:scripts/gemini-direct-task.mjs` via Antigravity) and for a Codex step (`we:scripts/codex-direct-task.mjs`), each provider-gated by `EXECUTOR_PROVIDERS`.
- A brief-file async dispatcher (`dispatch-task`) that can launch parallel, independent, non-blocking Claude workers keyed by session slug — the closest existing thing to "run one step in parallel", though currently Claude-only and kind-unenumerated.

**Not built:**
- Nobody calls the story stage or `selectSupervisor` at runtime.
- No plan step can name a declared operation to run mechanically (no such field in the schema, no resolver).
- `dispatch-task`'s `kind` is a free label, not a closed task-kind/cause vocabulary (#3730/#3801 follow-up 1's own open item).
- No ratified promotion record exists (`we:dispatch-supervision-promotions.json` absent) — so no `{provider, model, taskType}` triple, Gemini/Flash included, is currently promoted to `spot-check` under the ratified rules, even where raw clean-streak counts (on `main`) look sufficient.
- No G2-specific supervision design — #3850 explicitly carries "a planner build's supervisor" forward to this decision.
- The "single-integration-worktree, one merge" assembly model backlog/3575 Fork 1 recommends reusing has been superseded on-branch by a PR-fan-out + independent-drain model with no shared merge step at all.


## Part 2 — Prior art

Scope note: entries marked **[fetched]** were opened directly with WebFetch and quotes/numbers below come from that page. Entries marked **[search-only]** were seen only as WebSearch snippets — treat numbers there as plausible but unverified; a follow-up WebFetch would be needed to confirm exact wording.

---

## 1. Anthropic: "Building Effective Agents" — orchestrator-workers, routing **[fetched]**

https://www.anthropic.com/research/building-effective-agents

Anthropic's taxonomy names two of the five patterns directly relevant here. **Orchestrator-workers**: "a central LLM dynamically breaks down tasks, delegates them to worker LLMs, and synthesizes their results" — explicitly recommended for "coding products that make complex changes to multiple files each time." Unlike a fixed parallelization split, the orchestrator decides subtasks per-input rather than from a template. **Routing**: "classifies an input and directs it to a specialized followup task," with one named use being to send "easy/common questions to smaller, cost-efficient models like Claude Haiku 4.5 and hard/unusual questions to more capable models like Claude Sonnet 4.5" — the cheapest-capable-model idea, stated as a routing decision rather than a cascade. Caveat given directly: agentic systems "trade off latency and cost for better task performance," carry "higher costs, and the potential for compounding errors," and should get "extensive testing in sandboxed environments" — complexity should be added "only when it demonstrably improves outcomes."

## 2. Claude Code subagents — per-subagent model assignment **[fetched]**

https://code.claude.com/docs/en/sub-agents

Subagents are markdown files with YAML frontmatter (`name`, `description`, `tools`, `model`, plus `permissionMode`, `maxTurns`, `background`, etc.). `model` accepts `sonnet`/`opus`/`haiku`/`fable`/a full model ID/`inherit`, resolved in order: per-invocation override → subagent's own frontmatter → `CLAUDE_CODE_SUBAGENT_MODEL` env var → main conversation's model. This is a direct instance of "run each step on the cheapest capable model": e.g. a `code-improver` subagent pinned to `model: haiku` regardless of what model is driving the main session. Docs explicitly list "cost control: route expensive analysis to faster, cheaper models like Haiku" and "parallel research: run independent investigations simultaneously with separate subagents" as intended uses, and separately warn subagents "start fresh" with no conversation history — a context/integration cost that offsets the savings when a step needs shared context.

## 3. Aider architect/editor mode **[fetched]**

https://aider.chat/2024/09/26/architect.html

Aider splits "code reasoning" from "code editing": an Architect model describes how to solve the problem in prose; an Editor model turns that prose into an actual diff. Rationale quoted directly: the Architect "is asked to describe how to solve the coding problem" while "the Editor can focus all of its attention on properly formatting the edits without needing to reason much about how to solve the coding problem" — i.e. planning and mechanical formatting are different skills and can be priced/routed differently. Benchmark on Aider's code-editing eval: o1-preview (architect) + o1-mini (editor), and o1-preview + DeepSeek, both hit **85.0%** (SOTA at time of writing, "whole" format); o1-preview + Claude 3.5 Sonnet hit 82.7% with the faster "diff" format; a single model doing both roles (Claude 3.5 Sonnet solo, "diff") scored 80.5%, GPT-4o solo 75.2%. Net finding: pairing a strong planner with a cheaper/faster editor did not just save cost, it beat several strong single-model baselines outright — evidence that decomposing by role (plan vs. mechanically apply) is itself a quality lever, not merely a cost lever.

## 4. ReWOO — decoupled Planner / Worker / Solver **[search-only, not fetched]**

https://arxiv.org/abs/2305.18323

ReWOO ("Reasoning WithOut Observation") splits an agent into three modules: Planner drafts a full plan up front with placeholders for tool outputs it hasn't seen yet; Worker executes the tool calls to fill those placeholders; Solver synthesizes the final answer from plan + evidence. Because the plan is generated once, without interleaving live tool observations, ReWOO reports ~5x token efficiency and a 4% accuracy gain on HotpotQA versus interleaved reason-act loops (ReAct-style). The plan becomes an inspectable, static artifact before any execution happens — useful precedent for "planner writes the whole plan first, executor just runs it," though ReWOO's plan is a linear chain, not a DAG, and it does not parallelize.

## 5. LLMCompiler — DAG plans, parallel function calls **[fetched: arxiv abstract; GitHub README checked, no field-level example found]**

https://arxiv.org/abs/2312.04511 · https://github.com/SqueezeAILab/LLMCompiler

LLMCompiler names ReWOO explicitly as prior art it extends: "ReWOO... cite[d] to differentiate LLMCompiler's unique capabilities, such as parallel function calling and dynamic replanning, which are not supported by ReWOO." Three components: (1) **Function Calling Planner** emits a DAG of tasks with inter-dependencies; (2) **Task Fetching Unit** dispatches ready tasks (dependencies satisfied) to the executor as soon as they're unblocked; (3) **Executor** runs independent tasks concurrently. Reported vs. ReAct: up to 3.7x latency speedup, up to 6.7x cost savings, ~9% accuracy improvement. This is the clearest prior instance of "plan is a DAG with dependsOn edges, independent nodes run in parallel, dependent nodes wait." I could not confirm an exact published JSON schema for the task objects (id/dependencies/tool/args) from the README directly — the paper's code (not fetched) likely has it; treat the specific field names as inferred from the architecture description, not verified verbatim.

## 6. HuggingGPT — task planning → model selection → execution → integration **[fetched]**

https://arxiv.org/abs/2303.17580

Four stages, run by a central LLM (ChatGPT) coordinating specialist models hosted on Hugging Face: task planning (decompose the request into subtasks), model selection (pick the right expert model per subtask from function/description metadata), task execution (each expert model runs its assigned subtask), response generation (summarize/integrate results back to the user). This is an early "planner assigns typed steps to different specialized executors, then one integration pass" system, but the "executors" are different ML models by *capability* (vision, speech, etc.), not by *cost tier* of the same capability — a different axis of specialization than cheapest-capable-model routing.

## 7. RouteLLM — learned router between strong/weak model **[fetched]**

https://www.lmsys.org/blog/2024-07-01-routellm/ (paper: arXiv 2406.18665)

A router trained on Chatbot Arena preference data decides per-query whether a weak or strong model should answer, targeting a quality floor (e.g. 95% of GPT-4 quality) at minimum cost. Reported results: >85% cost reduction on MT-Bench at 95% of GPT-4 quality; 45% cost reduction on MMLU; 35% on GSM8K, same quality bar. Important caveat directly stated: routers trained only on Arena-style preference data "perform poorly at a near-random level" on out-of-distribution benchmarks like MMLU — the router's accuracy is tied to how well its training distribution matches the target task; adding task-specific labeled data closed most of the gap. Directly relevant to a planner/executor system: a router (or planner) that decides "which step kind can go to a cheap model" needs training/calibration data that resembles the actual step types, not a generic proxy.

## 8. FrugalGPT — LLM cascade **[fetched]**

https://arxiv.org/abs/2305.05176

Three cost-reduction strategies: prompt adaptation, LLM approximation, and LLM cascade (querying cheapest model first, escalating to a larger model only if the cheap answer looks unsatisfactory, up to the most expensive model). Reported: matches GPT-4 quality at up to 98% cost reduction, or beats GPT-4 accuracy by 4% at the same cost. This is the "cascade" variant of cheapest-capable-model: try cheap, escalate on failure — a fallback pattern rather than a one-shot classify-then-route pattern (contrast with RouteLLM).

## 9. Magentic-One (Microsoft/AutoGen) — orchestrator with task ledger + progress ledger **[fetched]**

https://microsoft.github.io/autogen/stable//user-guide/agentchat-user-guide/magentic-one.html

A lead Orchestrator does high-level planning and dispatches to specialist agents (web surfer, file surfer, coder, terminal). Two nested loops: an **outer loop** maintains a Task Ledger (facts, educated guesses, current plan); an **inner loop** maintains a Progress Ledger, where at each step the Orchestrator self-reflects on whether progress is being made and assigns the next subtask to the right specialist. Direct quote: "If the Orchestrator finds that progress is not being made for enough steps, it can update the Task Ledger and create a new plan" — i.e. built-in stall detection triggers replanning, rather than plan-once-execute-blindly. This is close prior art for "verification per step feeds back into the plan" rather than only verifying the final deliverable.

## 10. AutoGen — general multi-agent conversation framework **[search-only, not fetched]**

https://arxiv.org/abs/2308.08155 · https://microsoft.github.io/autogen/0.2/docs/Use-Cases/agent_chat/

AutoGen is the underlying framework Magentic-One is built on: customizable, conversable agents that combine LLMs, tools, and humans, composed to accomplish tasks by conversing with each other (including code-executing agents). It's the general substrate; Magentic-One is the specific orchestrator/task-ledger pattern built on top of it — cite AutoGen for "framework," Magentic-One for "planner/executor contract with a progress ledger."

## 11. SWE-agent — agent-computer interface, one agent per issue **[fetched]**

https://arxiv.org/abs/2405.15793

Not a multi-model planner/executor system — a single agent per task, but notable because its contribution is entirely about the *interface* the executor gets (a custom "agent-computer interface": file viewer/editor commands, structured repo navigation, sandboxed test execution) rather than the model. It reports 12.5% pass@1 on SWE-bench and 87.7% on HumanEvalFix, credited to interface design, not model choice — relevant supporting evidence that "acceptance check / tool ergonomics per step" materially changes success rate independent of which model runs the step.

## 12. OpenHands (formerly OpenDevin) — CodeAct agent + micro-agents **[fetched]**

https://arxiv.org/abs/2407.16741 · https://docs.openhands.dev/openhands/usage/agents

Generalist CodeAct agent (unifies actions into executable code) plus "micro-agents" — specialized, lightweight agents reusing the generalist's implementation but scoped to a narrow task via a short natural-language spec, intended to lower the bar for community-contributed specialists. Supports multi-agent delegation and sandboxed execution; evaluated across 15 tasks including SWE-bench and WebArena (abstract did not give the specific pass-rate numbers I could confirm — treat as unverified beyond "evaluated on SWE-bench-class benchmarks"). Relevant as an open, inspectable reference implementation of "generalist executor + narrow specialist executors sharing one core loop," which maps onto "deterministic tool vs. dispatched-to-a-model" step typing if the micro-agent is swapped for a script.

## 13. MetaGPT — role pipeline with SOPs **[fetched]**

https://arxiv.org/abs/2308.00352

Encodes human software-team roles (Product Manager, Architect, Project Manager, Engineer, QA Engineer per multiple secondary sources; the abstract itself only says "assign diverse roles to various agents") as a fixed pipeline of "Standardized Operating Procedures," where each role's structured output (PRD, design doc, task list, code, tests) becomes the next role's input. Abstract's own claim, without numbers: "MetaGPT generates more coherent solutions than previous chat-based multi-agent systems" on collaborative SWE benchmarks. This is closer to a fixed sequential plan template (not adaptively decomposed per task) than a genuine planner-writes-a-custom-plan system — worth citing as the "over-specified pipeline" end of the spectrum, contrasted with Anthropic's orchestrator-workers (subtasks decided per-input).

## 14. ChatDev — chat-chain, role-played phases **[fetched]**

https://arxiv.org/abs/2307.07924 (ACL 2024)

Similar to MetaGPT: role-played agents (design/coding/testing phases; secondary sources name CEO/CTO/programmer/tester roles, not stated in the abstract itself) communicate through a structured "chat chain," with "communicative dehallucination" as a mechanism to catch one agent inventing facts the other accepts uncritically. Abstract's finding: natural language communication works better for design-stage decisions, programming-language communication works better for debugging — an argument for typing steps by *what kind of artifact* the step produces (prose plan vs. code) and choosing the communication/verification mode accordingly. No quantitative code-quality numbers were in the abstract I read.

## 15. Devin (Cognition) — autonomous end-to-end agent, and its own self-published caveats **[fetched: Cognition's technical report]**

https://cognition.com/blog/swe-bench-technical-report

Cognition's own report on Devin's SWE-bench Lite result (13.86%, a ~7x jump over the prior best of ~2%) is unusually candid about methodology and failure modes, which makes it good evidence for "why decomposition/verification is hard" rather than for a good architecture to copy. Notable facts: evaluated on only 25% of SWE-bench (570/2,294 issues), capped at 45 minutes of runtime; data-contamination risk acknowledged for both Devin and baselines; when given the target unit tests directly, score jumped to 23% — i.e. having a concrete, run-time-checkable acceptance test roughly doubles success. Documented failure modes: editing the wrong file, only fixing one of several needed comparison operators, succeeding on some files in a multi-file change but not others (a whole-task failure caused by one incomplete sub-edit) — this is direct, vendor-acknowledged evidence for the "integration risk from partial multi-file completion" failure mode. Independent commentary (search-only, not fetched) frames Devin's initial framing as "first AI software engineer" as having been walked back toward "junior-engineer-scoped teammate."

## 16. OpenAI Codex (cloud) — isolated container per task, PR as output **[search-only, not fetched]**

https://developers.openai.com/codex/cloud/environments

Each Codex cloud task gets an isolated container, a fresh repo checkout, dependency setup from a project-defined setup script, no general internet access during the run, and produces a diff/PR at the end. This is the "worktree/sandbox per step, PR as the integration point" pattern at the level of a whole task rather than a single plan-step — relevant as an existing production instance of isolate-per-unit-of-work, though it isolates per *task*, not per *sub-step within one task's plan*.

## 17. Google Jules — async agent, plan-first, tests-in-the-loop **[search-only, not fetched]**

https://jules.google/

Per-task isolated cloud VM; writes a step-by-step implementation plan (via Gemini Pro) before touching code, executes the plan, runs the test suite as part of the loop, opens a PR. Same shape as Codex cloud: isolate-per-task, plan-then-execute, tests as the in-loop oracle, PR as the single integration artifact — another vendor converging on the same shape independently.

## 18. GitHub Copilot coding agent — GitHub Actions container, draft PR, human-gated CI **[search-only, not fetched]**

https://github.blog/news-insights/product-news/github-copilot-meet-the-new-coding-agent/

Runs inside an isolated GitHub Actions container per session, pushes commits incrementally to a draft PR as it works, and — notably — requires human approval before any CI/CD workflow runs on the agent's own PR (a security/trust gate specific to agent-authored code). Scoped explicitly to "low-to-medium complexity tasks in well-tested codebases": feature adds, bug fixes, test/doc extension, refactors — an explicit vendor statement of which step *kinds* are considered safe to hand to an autonomous agent versus not.

## 19. Cursor Plan Mode — reviewable plan before multi-file edits **[search-only, not fetched]**

https://cursor.com/docs/agent/plan-mode

Generates an editable Markdown plan (files touched, steps) before the agent executes multi-file changes; the plan can be hand-edited before execution starts. Positioned explicitly as a way to "catch a wrong approach in seconds instead of unwinding a bad multi-file change" — i.e. the plan's value is as a cheap, human-checkable point of intervention before the expensive/hard-to-undo execution phase, which is a strong argument for a typed, inspectable plan schema (this task's premise) over an opaque agent loop.

## 20. Martian — commercial LLM router **[search-only, not fetched]**

https://techcrunch.com/2023/11/15/martians-tool-automatically-switches-between-llms-to-reduce-costs/

Per-prompt router across 400+ models from 60+ providers, claiming 20–96% cost reduction vs. GPT-4 while matching or beating its quality on their internal RouterBench. Commercial proof that "route per-request to cheapest-capable-model" is a viable standalone product, independent of any particular agent framework — but note this is a query-level router (chat-style), not a plan-step-level router; I did not verify RouterBench's methodology directly.

## 21. Decomposition-risk and plan-quality-bottleneck evidence **[search-only, not fetched — general research-literature synthesis, individual papers not opened]**

Recurring findings across several 2025/2026 papers surfaced by search (not individually opened, treat as directionally indicative only): (a) agent failures are dominated by planning/comprehension gaps — "omission, misinterpretation, or inadequate verification of requirements" — more than by an inability to write syntactically correct code; (b) task-decomposition agents suffer a "knowledge barrier" where they split work along lines that don't match the domain's real structure, producing subtasks that don't correspond to anything meaningful; (c) failures often occur *mid-trajectory* (drift away from a valid plan, then no recovery) rather than only at final-answer generation, which argues for per-step checkpoints, not only an end-to-end acceptance test; (d) parallel-agent code editing on a shared working tree is described in vendor/practitioner write-ups as producing silent corruption (one agent's build running mid-refactor by another), motivating one-worktree-per-parallel-step as the practical mitigation, with conflicts deliberately deferred to an explicit merge/integration step where standard git tooling can catch them, rather than resolved live.

---

## Synthesis

**(a) Common planner/executor contract shape.** Across every system above that separates "decide what to do" from "do it" — ReWOO, LLMCompiler, HuggingGPT, Magentic-One, Aider architect/editor, Cursor Plan Mode, Jules — the shape converges on the same handful of parts: a planner emits a set of steps up front (or incrementally, as Magentic-One's Task Ledger does); each step carries an identity, a dependency relation to other steps (ReWOO's placeholders, LLMCompiler's explicit DAG edges), a designation of *what kind of actor* runs it (tool/function vs. a model, and in richer systems which model), and — in the more mature systems — an explicit acceptance signal (LLMCompiler's evidence-slots, Magentic-One's Progress Ledger self-check, SWE-agent/Jules's test execution). No system surveyed publishes a single canonical JSON schema field-for-field (I could not confirm LLMCompiler's own task-object schema directly), but the *shape* — id, dependsOn, kind/tool, inputs, and some acceptance check — recurs enough that it's a safe convergent design, not a novel proposal.

**(b) Which step kinds go to smaller/cheaper models — what the evidence actually says.** The strongest, most concrete evidence is Aider's: mechanical "turn this prose plan into a correctly formatted diff" work does *not* need the frontier model — the best-performing configurations paired a frontier reasoning model as planner with a cheaper/faster model as editor, and this beat several strong single-model baselines outright (85.0% vs. 80.5% for Sonnet solo). RouteLLM adds the more important caveat: a router's accuracy is contingent on training/calibration data resembling the actual task distribution — a router built on generic chat-preference data was "near-random" on an out-of-distribution benchmark. Applied to a build-task planner: routing "mechanical edit / test-writing / doc update" to a cheap model is well supported (Aider's numbers, GitHub Copilot's own scoping of its agent to "well-tested codebases... feature adds, bug fixes, tests, docs, refactors"); routing "cross-file architectural change" or "ambiguous requirement" to a cheap model is not supported by anything found — every vendor that states a scope explicitly (Copilot, Devin's post-mortem, MetaGPT's Architect role) keeps design/cross-cutting decisions on the strong model and pushes only bounded, locally-checkable work down.

**(c) Integration patterns.** Three patterns recur: (1) **single integrator** — one final synthesis/solver step reconciles all sub-results into one deliverable (ReWOO's Solver, HuggingGPT's response-generation stage); (2) **sequential apply with incremental commits** — the executor pushes each completed step as its own commit onto one branch/PR as it goes (Codex cloud, Jules, GitHub Copilot's draft-PR-with-incremental-commits); (3) **worktree/sandbox per unit of work, merged later** — isolate each parallel step's edits, defer conflict resolution to an explicit merge/integration point rather than letting concurrent edits collide live (the git-worktree-per-agent practitioner pattern; Codex/Jules/Copilot isolate per whole task, which is the same idea one level up). For a single PR as the final deliverable, pattern (3) at the sub-step level plus pattern (1) or (2) at the top (one script/agent that applies each worktree's diff in dependency order, or squash-merges into a staging branch, runs the full test suite, then opens the one outward-facing PR) is what the isolation-then-single-merge practitioner guidance converges on.

**(d) Supervision/verification: per-step vs. per-deliverable.** Evidence favors per-step verification wherever a cheap, concrete oracle exists — Devin's own report shows giving the agent the actual unit test roughly doubled its success rate (13.86% → 23%), and the general planning-bottleneck literature notes failures happen mid-trajectory with no recovery mechanism if nothing checks progress until the end. Magentic-One's Progress Ledger and stall-detection-triggers-replanning is the clearest built example of continuous per-step supervision feeding back into planning. But per-deliverable verification (one full test/build/lint pass on the integrated result) is still necessary even when every step passed its own local check, because integration itself is a failure point independent of any single step — Devin's own multi-file failure ("succeeded on some dataset files, missed others, whole task still failed") is a case where every individual edit may have been locally fine, but the *set* was incomplete. So the pattern is: cheap local acceptance check per step (does the diff type-check / does the unit test for this file pass) plus one full deliverable-level gate before the PR is called done — not one or the other.

**(e) Known failure modes and mitigations, keyed to what generated each finding.**
- *Wrong-file / incomplete multi-file edits* (Devin's technical report) → mitigate with an explicit "which files does this step touch" declaration per plan-step, checked against the actual diff before accepting the step.
- *Plan doesn't match the domain's real structure / hallucinated subtask boundaries* (search-literature synthesis, unverified in depth) → mitigate by having the strong planner model justify each split against the actual codebase (grounded in real files/interfaces), not an abstract task description; this is exactly what Cursor's Plan Mode and Jules's "read the codebase, then write the plan" ordering do.
- *Router/step-classifier miscalibration on unfamiliar task types* (RouteLLM's MMLU caveat) → mitigate by keeping the cheap-model eligibility list narrow and evidence-backed (mechanical edit, test-authoring, doc update) rather than trying to generalize a router across all step types from generic training signal.
- *Mid-trajectory drift with no recovery* (search-literature synthesis; Magentic-One's stall detection as the built countermeasure) → mitigate with a progress check that can trigger replanning, not just a final pass/fail.
- *Concurrent-edit corruption when steps run in parallel on a shared tree* (worktree-for-agents practitioner pattern) → mitigate with one worktree/sandbox per parallel step and an explicit merge step, never live concurrent edits to the same checkout.
- *Autonomous-agent overclaiming vs. actual reliability* (Devin's "first AI software engineer" framing vs. its later "junior-teammate, well-scoped tasks" repositioning, per search-only commentary) → mitigate by scoping what's dispatched autonomously to the same bounded categories GitHub Copilot's own docs state (bug fixes, tests, docs, refactors in well-tested code) and keeping ambiguous/cross-cutting work on the planner or a human.
