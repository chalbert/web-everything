# Builder postmortem and automated per-build analysis

The first nine requested deliveries expose a coordination problem as well as implementation rework. Eleven recovered worker attempts consumed **31.81 worker-minutes**, **101,935 output tokens**, **395,132 cache-write tokens**, **4,683,698 cache-read tokens**, and **288 uncached input tokens**. Surrounding them were **39.27 minutes of wrapper verification** and **35.24 minutes in 33 refused dispatch operations**. These are different, sometimes overlapping clocks: **do not add them into a savings claim**. Seven preparation-to-build handoffs span another **91.63 item-minutes after last recorded liveness**, an exposure measure whose avoidable fraction is unknown.

Operator request: 2026-09-30; items #4295, #4331, #4335, #4336, #4338, #4457, #4480, #4544 in WE and #4341 in plateau-app (PR #188). This is a forensic report and an implementation design, not a claim that the proposed automation is running. Canonical report home is `we:reports/`, per `we:docs/agent/backlog-workflow.md#three-homes--nothing-stays-hidden`; the automation card mirrors this report. No changes were committed, pushed, queued for execution, or submitted as a PR.

## Measurement and limits

Sources were streamed one JSONL line at a time. Match the **first user message**, not incidental mentions later in a session. Eleven matches cover nine items: #4295 has a blocked 2026-09-29 attempt and a successful 2026-09-30 attempt; #4341 has a successful attempt and a later redundant attempt. Both #4341 sessions say `conveyor-4341b`; the slug alone is not a unique run identity. The other `b` suffixes follow **preparation** records, not necessarily failed builds. The nine build records report PRs 3037, 3057, 3063, 3065, 3069, 3071, 3074, 3048 and plateau-app 188 respectively; consult the evidence snapshot for authoritative item-to-PR mappings. Merge date is the operator-provided cohort boundary: dispatch records end at `pr-opened`, not merge, and do not prove a merge timestamp.

The supplied time-breakdown helper loads the full transcript and adds result-to-next-call time multiple times for parallel calls. This analysis instead pairs tool IDs, partitions the union of intervals, and deduplicates usage by assistant `message.id`, retaining its last usage record. For simultaneous tools, the earliest-started active call owns the wall interval. A mixed shell command is assigned to its dominant executed operation; an edit followed by a test is test-bearing time, **not pure test execution time**. Heredoc contents are excluded from command classification. Small edit durations round to zero; this does not mean no code was written.

**Model time is not directly observable.** The column below is worker wall minus tool intervals and known external gate intervals. It includes generation, reasoning, transport, scheduling, and unobserved idle. In #4480 the resumed transcript spans the external failed gate: its 1.43 minutes are removed from this residual, not mislabeled as thinking. Background admission versus test execution cannot always be separated from truncated tool output. Token counts are actual reported usage; cache reads are repeated processing, not unique source text or equivalent-price output tokens. No dollar conversion is inferred.

Explicit self-review/converge/jury rounds and tool sleeps: **zero in all eleven worker transcripts**. Test debugging and required mutation proofs are not self-review rounds. There is no evidence for claiming “needless self-review” savings here. Downstream independent PR review is outside these worker transcripts; unavailable review time and tokens are **unknown**, not zero. Preparation transcripts were not included in worker totals. Their lingering run records are analyzed separately. The referenced temporary bookkeeping files no longer exist. Complete dispatch-to-merge wall time is unavailable; the dispatch-to-gate endpoint below is a measured lower bound on delivery time.

[The evidence snapshot](data/2026-09-30-builder-postmortem.json) records each source path and transcript SHA-256, all tool call/result line pairs with durations, categories and output character counts, all 53 matching dispatch records in reduced form, and ten matched verify records. It is a **historical report attachment**, not a new operational store. The source index at the end resolves transcript aliases. All `L` references are physical JSONL lines, not displayed code line numbers inside tool output.

## Per-build accounting

| Worker / attempt | Wall min | Model | Tests min | Read / git / edit / other min | Model + unobserved min | External gate wait inside worker min | Tokens input / output / cache write / cache read | Self-review rounds | Tool errors / admission refusals |
|---|---:|---|---:|---|---:|---:|---|---:|---|
| 4295-blocked | 1.07 | Opus 5.5 | 0.00 | 0.02 / 0.08 / 0.00 / 0.00 | 0.96 | 0.00 | 16 / 5,187 / 40,533 / 183,842 | 0 | 0 / 0 |
| 4295 | 12.75 | Sonnet 5.5 | 10.42 | 0.22 / 0.04 / 0.00 / 0.02 | 2.05 | 0.00 | 66 / 19,054 / 75,292 / 1,792,871 | 0 | 1 / 1 |
| 4331 | 2.40 | Sonnet 5.5 | 0.88 | 0.02 / 0.01 / 0.00 / 0.00 | 1.49 | 0.00 | 32 / 13,556 / 43,845 / 558,098 | 0 | 1 / 1 |
| 4335 | 4.86 | Sonnet 5.5 | 2.97 | 0.03 / 0.00 / 0.00 / 0.01 | 1.84 | 0.00 | 34 / 17,395 / 46,550 / 584,905 | 0 | 2 / 1 |
| 4336 | 0.38 | Sonnet 5.5 | 0.03 | 0.02 / 0.00 / 0.00 / 0.00 | 0.33 | 0.00 | 12 / 3,187 / 16,846 / 92,693 | 0 | 0 / 0 |
| 4338 | 2.30 | Sonnet 5.5 | 0.71 | 0.02 / 0.01 / 0.00 / 0.00 | 1.55 | 0.00 | 24 / 16,620 / 58,498 / 468,340 | 0 | 1 / 1 |
| 4341 | 1.36 | Sonnet 5.5 | 0.57 | 0.01 / 0.00 / 0.00 / 0.00 | 0.76 | 0.00 | 26 / 7,194 / 28,421 / 300,746 | 0 | 0 / 0 |
| 4341-redundant | 0.21 | Sonnet 5.5 | 0.00 | 0.01 / 0.01 / 0.00 / 0.00 | 0.19 | 0.00 | 10 / 1,430 / 14,129 / 67,299 | 0 | 0 / 0 |
| 4457 | 0.56 | Sonnet 5.5 | 0.08 | 0.00 / 0.00 / 0.00 / 0.01 | 0.47 | 0.00 | 20 / 4,492 / 19,572 / 185,431 | 0 | 1 / 1 |
| 4480 | 3.57 | Sonnet 5.5 | 0.44 | 0.05 / 0.00 / 0.00 / 0.01 | 1.64 | 1.43 | 28 / 4,207 / 17,149 / 237,646 | 0 | 1 / 1 |
| 4544 | 2.35 | Sonnet 5.5 | 1.40 | 0.04 / 0.01 / 0.00 / 0.00 | 0.91 | 0.00 | 20 / 9,613 / 34,297 / 211,827 | 0 | 2 / 1 |

| Build | Dispatch → final recorded gate end, min | Gate time min | Gate runs / failed | Verify record IDs (prefix `verify-`) |
|---|---:|---:|---|---|
| 4295 | 26.40 | 9.81 | 1 / 0 | `1438541c-7bc1-45da-910a-6e9c5d23f9e0` |
| 4331 | 5.74 | 1.09 | 1 / 0 | `594235d3-4495-411e-9695-d673d58a0c96` |
| 4335 | 14.16 | 7.28 | 1 / 0 | `a10a05a8-69b8-4cf3-81f2-c9d1cc3d2df3` |
| 4336 | 9.32 | 7.01 | 1 / 0 | `9f4f7e2d-b9bb-472e-adf7-e2b363260c0f` |
| 4338 | 8.08 | 3.68 | 1 / 0 | `69783844-1104-40bb-b843-bf361fce9c5a` |
| 4341 | 3.11 | 0.55 | 1 / 0 | `20bd5025-8099-4afa-9e43-664f9889d84f` |
| 4457 | 3.92 | 1.34 | 1 / 0 | `44bdd057-64a7-4011-83ae-a823ba46ef0b` |
| 4480 | 8.07 | 3.83 | 2 / 1 | `5aac2c2f-3ad5-4de6-9c41-7323807d82da`, `8793f4ac-3d86-417f-b498-20d505c007fa` |
| 4544 | 8.76 | 4.70 | 1 / 0 | `455013db-57a7-466e-82d2-594d096d4d98` |

## Source index

Aliases below are used as `T<alias>:Lx–Ly`. Each match is against the first user message at line 3; source hashes and every tool interval are in the evidence snapshot.

- **T4295-blocked**: `~/.claude/projects/-Users-nicolasgilbert-workspace--lanes-web-everything-lane-17/94306334-691b-40b5-96f1-47296eec46bf.jsonl`.
- **T4295**: `~/.claude/projects/-Users-nicolasgilbert-workspace--lanes-web-everything-lane-23/3d9f6c3d-ea3b-4127-9814-19f38ba6717e.jsonl`.
- **T4331**: `~/.claude/projects/-Users-nicolasgilbert-workspace--lanes-web-everything-lane-8/d5dacdc3-6ba4-47fc-87ea-0e62fb33a734.jsonl`.
- **T4335**: `~/.claude/projects/-Users-nicolasgilbert-workspace--lanes-web-everything-lane-20/06557676-acca-42b8-b19a-bc276002587d.jsonl`.
- **T4336**: `~/.claude/projects/-Users-nicolasgilbert-workspace--lanes-web-everything-lane-20/b333b6fe-0fd0-4263-8a6e-e9200ec22b65.jsonl`.
- **T4338**: `~/.claude/projects/-Users-nicolasgilbert-workspace--lanes-web-everything-lane-16/c8acf82f-957b-41ca-a32d-c63db8b11503.jsonl`.
- **T4341**: `~/.claude/projects/-Users-nicolasgilbert-workspace--lanes-plateau-app-lane-1/d32442a1-4fdc-4f5b-a868-7bbec11f2370.jsonl`.
- **T4341-redundant**: `~/.claude/projects/-Users-nicolasgilbert-workspace--lanes-plateau-app-lane-2/f68b16e7-df8a-47bb-b4f9-11b528a3dbf7.jsonl`.
- **T4457**: `~/.claude/projects/-Users-nicolasgilbert-workspace--lanes-web-everything-lane-17/d49a167a-ce37-4695-bb90-d276414bb929.jsonl`.
- **T4480**: `~/.claude/projects/-Users-nicolasgilbert-workspace--lanes-web-everything-lane-16/24b009a3-1563-431e-83b7-fd46761b8536.jsonl`.
- **T4544**: `~/.claude/projects/-Users-nicolasgilbert-workspace--lanes-web-everything-lane-8/9a95b08b-6660-43c3-a8f6-9ee515696789.jsonl`.

Verify files above live under `~/workspace/.operations/coordination/build-dispatch-runs/`; use `stepTimings[0]` for start/end/duration and `verdict.checks[0]` for the tested SHA. Matching used checkout, session time, and nearest preceding worker, including plateau-app's implementation lane rather than WE's coordination lane. The later lane-23 verify at 11:19 was excluded: lane reuse is not evidence that it belongs to #4295. #4295-blocked and #4341-redundant ran no wrapper gate in the recovered records.

| Build | Repeated/failed work and recovery (transcript evidence) |
|---|---|
| #4295 | First attempt rejected incomplete scope and TODO acceptance criteria (T4295-blocked:L27–65). Successful attempt ran two broad suites (T4295:L109–111, L159–160), diagnosed nine fixture failures, repaired overlapping fixtures, and reran affected files (L121–173). One admission refusal, one failed relative `cd`, one BSD `sed` failure; broad suite still ran after the failed edit. No full broad rerun after the final fixes (L186). |
| #4331 | URL constructor/happy-dom fixture failure (L37–42), unescaped mutation-test regex (L54–60), generated comment swallowing CLI flags (L59–67), wrong expected error text (L71–93), one admission refusal, BSD `sed` failure, two `done` reports (L85–100). Mutation RED runs after a passing baseline are intentional proof, not waste. |
| #4335 | New test exposed a real two-dot/three-dot attribution defect (L43–66); this is useful discovery. One admission refusal discarded edits (L56–64); new lock test required an omitted sleep helper, then BSD `sed` failed (L92–105). Repeated targeted runs include actual fixes, so not all are redundant. |
| #4336 | One targeted successful test call, no tool error/retry (L34–42). Worker took 0.38 min but wrapper gate took 7.01 min. Required RED/live proof was skipped (L42). |
| #4338 | One admission refusal discarded the entire edit/test chain (L55–64); rename fixture incorrectly used staging via `git mv`; attempted `sed` correction failed (L71–77). Later eight RED cases on old code were deliberate mutation proof. |
| #4457 | Two new assertions incorrectly assumed lone bracket pairs trigger the existing detector (L43–48); one admission refusal discarded the correction (L49–54), then targeted green (L59–65). No live proof. |
| #4480 | New tests passed, but an existing test still asserted the old contract. Wrapper gate failed and resumed the same session; admission refusal (L42–43), failed BSD `sed`, and premature second `done` (L60–63), followed by Edit and targeted green (L64–76). Three `done` reports total (L27, L60, L70), one gate retry. |
| #4544 | Wrong tool name `bash` instead of `Bash` discarded first edit (L39–47); one admission refusal discarded test edits (L51–58). Three live agent-list reads refined different state dimensions (L23–35): useful probe refinement, not three identical reruns. Live/soak proof omitted (L66). |
| #4341 | Cross-repo path discovery (L16–26); module fixture outside Vite's root failed; failed BSD `sed` debug insertion (L49–67); moving fixtures under the repo exposed missing parent membership (L71–85). Full WIP rerun without an intervening edit cost 0.08 min (L76–78). Four RED cases against old code are intentional. Subsequent redundant session found PR #188 already landed (T4341-redundant:L25–43). |

## Ranked inefficiencies, causes and changes

Ranking considers observed cost and recurrence, not a sum of overlapping savings. “Exposure” means time spent in a problematic phase; it is not a promise that all of it disappears. The first five entries are filed cards. Costs within entries can overlap costs in another entry.

### 1. Dispatch repeatedly rediscovers blocked preparation — #xn7olnj

**Cost:** 33 refused dispatch operations consumed **35.24 operation-minutes**, before producing no launch. Seven preparation handoffs span **91.63 item-minutes** between `lastSeenLiveAt` and the next successful build launch. Breakdown: #4331 12.13; #4335 12.03; #4336 13.35; #4338 18.29; #4457 11.73; #4480 11.88; #4341 12.23. These are not worker/model minutes. They can overlap each other and refused reads. Last-seen is not actual completion, so the 91.63-minute total is **not established idle time**.

**Evidence:** dispatch records named in the attachment retain `status: in-flight` for preparation even after a later build has opened a PR. The seven stale preparation UUIDs are `5d4b6d72-bd24-4343-b4f1-ea31c6f7c927`, `700799b8-af89-47bb-82cc-bec8e0ac3c72`, `fa12265b-54a1-4b6d-954e-a1c3529918bb`, `64120194-2727-4a93-ba79-c8f7b303b01d`, `ad499b95-89d0-4e33-98bd-7078844536ee`, `fd149143-0dbf-4e5a-8efa-ad45a26702e9`, and `61583d74-74ed-4aee-aff5-9f67f4c58385`. Prefix each with `dispatch-lane-` and suffix `.json`. Their `effects[0].lastSeenLiveAt` and the subsequent build's `effects[0].startedAt` reproduce the arithmetic. T4331:L15–16, T4335:L15–16, T4336:L15–16 and T4341:L22–26 corroborate the actual new worker starts; they cannot account for pre-spawn waiting.

Refused-operation breakdown (sum of recorded step durations, including local/remote reads; not CPU time):

| Item | Refused attempts | Recorded minutes |
|---|---:|---:|
| #4331 | 5 | 4.91 |
| #4335 | 5 | 4.61 |
| #4336 | 2 | 3.17 |
| #4338 | 4 | 3.30 |
| #4341 | 3 | 4.94 |
| #4457 | 4 | 4.45 |
| #4480 | 5 | 6.40 |
| #4544 | 5 | 3.47 |

The attachment includes `sourceLineRefs` for each operation file, so the summarized step timings and stale status can be checked without reading its embedded prompt.

**Root cause supported by records:** preparation terminal state is not authoritatively propagated to dispatch eligibility, which repeatedly falls back to listing/clock heuristics. Some refusals are legitimate live-worker protection; the report does not claim every refused read was unnecessary. **Change:** persist terminal preparation outcome with the original effect identity, reconcile it once, invalidate cached eligibility on relevant state changes, and use a cheap local in-flight check before expensive planning. Preserve positive liveness protection and crash reconciliation. This removes repeated identical scans and completion-by-timeout as the normal handoff, rather than shortening a timeout blindly.

### 2. Test scope and evidence are rediscovered across stages — #x990o2k

**Cost:** #4295 spent **10.42 minutes** in test-bearing calls, of which **7.65 minutes** were two broad calls (4.21 + 3.44). The second ran after a failed edit. Across the cohort the wrapper spent **39.27 minutes** verifying; #4336 alone spent **7.01** despite a 0.38-minute worker. These gross costs identify an optimization target, **not 39.27 minutes of proven redundant work**. #4341 has one directly observed no-edit repeat of the WIP suite, **0.08 minute**.

**Evidence:** T4295:L109–111, L159–160, L172–186; T4336:L34–42 and verify `9f4f7e2d…`; T4341:L71–78. #4295's first broad run found nine failures, so retaining cross-file regression coverage matters. A changed tree justifies rerunning affected tests. Cache only evidence for identical inputs, never a result from before the edit.

**Root cause:** workers choose broad shell commands while the wrapper independently selects the gate, with no shared step evidence explaining selection, input identity, admission delay or reuse. **Change:** route both through the existing diff-selected verification planner; expose impacted test selection and a content/environment-keyed evidence receipt. Separate admission wait, execution and orchestration time. Reuse only an exact matching tree/dependency/toolchain/environment/suite receipt, run new impacted tests, and preserve the final required gate. First instrument #4336 to establish whether its seven minutes are queueing, dependency fanout, or execution; those causes are not distinguishable from the retained verify summary.

### 3. Shell chains can fail edits yet continue tests or report success — #x3jdaea

**Cost:** **six observed BSD `sed` failures across six builds**. #4295 ran **3.44 minutes** of tests after the intended correction failed (also counted in entry 2). #4480's stale contract test required a **1.43-minute red wrapper gate**, resume and a **2.39-minute second gate**; the second is necessary validation after repair, not inherently waste. #4331 and #4480 both emitted premature `done` records after failed corrections. Avoidable cost is bounded by these observed phases; no causal claim that `sed` caused #4480's *first* gate failure.

**Evidence:** T4295:L159–173; T4331:L85–100; T4335:L96–105; T4338:L71–77; T4341:L54–67; T4480:L60–76. T4331 explicitly acknowledges that its semicolon-separated report ran after `sed` failed. Pipeline exit status also masks test failures behind `tail`/`grep`: a tool's `is_error=false` is not a green test.

**Root cause:** code mutation, tests and completion share untyped shell chains, while the completion protocol trusts a free-standing `done` assertion. **Change:** use structured portable edits with match assertions, explicit subprocess exit status/structured test results, and a completion receipt bound to the latest tree and required proof. A failed prerequisite cannot execute its dependent test or report. A wrapper must distinguish `implementation-ready` from `verified` and invalidate an earlier receipt on resumed edits. Do not add more review rounds to compensate for missing step semantics.

### 4. Builders learn the allowed test interface by rejection — #x3eknop

**Cost:** **seven admission refusals across seven builds**. The seven assistant messages containing those calls reported **8,025 output tokens**, 13,229 cache-write and 253,146 cache-read tokens (plus 14 uncached input). These are whole-message costs, not an estimate of tokens exclusively attributable to the rejected command. Four refusals discarded bundled edits; all required corrective turns. The hook's own elapsed time was tiny; token generation and replay are the relevant cost.

**Evidence:** T4295:L115–122; T4331:L75–81; T4335:L56–66; T4338:L55–64; T4457:L49–60; T4480:L42–47; T4544:L51–58. Edit collateral occurs in #4335, #4338, #4457 and #4544. Admitted replacements succeeded in reaching the test runner. The brief is labeled “PROTOTYPE, not live” in the first user message despite being used to dispatch; it also leaves the full gate to the wrapper while hooks teach multiple raw-shell exceptions.

**Root cause:** the permitted test capability is expressed as prose plus shell-pattern refusals instead of the interface the worker calls. **Change:** provide one structured targeted-test operation that applies admission automatically, validates scope and returns a result receipt. Generate the worker's available operations from the same declarations as the guard, remove obsolete prototype language, and separate edits from test requests. Keep admission limits; eliminate trial-and-error command spelling.

### 5. Readiness and delivered identity are checked too late — #x2fm88t

**Cost:** #4295's blocked attempt (**1.07 min**) plus the redundant #4341 worker (**0.21 min**) consumed **1.28 worker-minutes and 312,446 processed tokens**, including cache reads. Breakdown: 6,617 output, 54,662 cache-write, 251,141 cache-read and 26 uncached input. Do not call all 312,446 newly generated tokens. The 11-hour interval between #4295 attempts is not charged as continuous waste.

**Evidence:** T4295-blocked:L27–65 identifies missing enforcing call sites and TODO acceptance criteria. T4341-redundant:L25–43 finds commit `7ca974e`/PR #188 already implementing the card; dispatch `9d1abb62…` nevertheless launched it. Both successful and redundant #4341 sessions reused the same slug. Build routing's WE coordination lane and plateau-app implementation lane differ.

**Root cause:** prepared scope did not cover end-to-end enforcement, and cross-repo delivery identity did not stop a subsequent spawn. **Change:** preparation must list enforcing call sites and executable acceptance criteria, and build admission must consume a durable repo-qualified item→attempt→PR→landed mapping. Record successful cross-repo resolution through the existing terminal/reconciliation path, with a final pre-spawn recheck and unique attempt ID. Do not use session slug, lane number or a WE-only PR lookup as delivery identity.

## Remaining observed inefficiencies and non-findings

These are not dropped because they fall below the top five. The complete interval ledger in the attachment retains every tool step, including successful work.

- **Over-reading / context replay:** read-classified outputs total **394,043 characters**, not measured tokens. The blocked #4295 attempt alone returned **62,662 characters** from read-category calls; whole files were read and then overlapping regions revisited (T4295-blocked:L27–45). Its entire 1.07-minute/229,578-token cost is already in entry 5; no defensible finer allocation is available. Successful #4295 read outputs total 93,870 characters (T4295:L15–173). #4331 reads the whole Vitest config and listings (L29–31); some of that is relevant to its URL failure. Change: an indexed scope/call-site brief with bounded excerpts and tracked read ranges; flag repeated identical content, not every repeated path. The 4.68 million cache-read tokens are context processing, not proof that 4.68 million tokens were unnecessarily read.
- **Fixture/environment mismatch:** #4331's happy-dom URL, mutation regex and generated comment repairs (L37–67); #4341's external temp-module resolution and missing parent fixture (L49–85); #4338's staged rename (L63–77); #4457's incorrect detector assumption (L43–60); #4335's omitted helper (L92–105). Relevant test-bearing phase totals are **0.88, 0.57, 0.71, 0.08 and 0.69 minutes** respectively (#4335 last two test calls only). These are upper bounds including useful validation, not wholly avoidable waste. Root causes differ: incompatible environment fixtures, incorrect test semantics and generated-code syntax. Changes: reuse repo-native fixture builders and Node path utilities; validate generated scripts syntactically; make mutation filters structured and ensure baseline selected-test counts are nonzero.
- **Wrong tool/cwd interface:** T4544:L39–47's lower-case `bash` call failed before any edit; its call latency rounds to 0.00 min but forced regeneration of a large heredoc. T4295:L143–147's relative `cd` failed and downstream commands continued. Both are covered by the typed-step/interface changes above. Do not invent per-call token cost where the usage message also contains other content.
- **Incomplete proofs passed to the next stage:** #4295 omitted its proof script; #4335 omitted sabotage/live proofs; #4336 omitted RED/live proof; #4457 omitted live proof; #4480 omitted RED/live proof; #4544 omitted health/soak proof (final assistant lines indexed above). Worker success is not proof-plan completion. Future downstream rework cost is **unavailable**, not zero and not included in savings. Make acceptance/proof obligations structured in preparation and reconcile them at completion (entries 3 and 5), without turning every omission into another self-review round.
- **Repeated outcome reports:** #4331 twice, #4480 three times, with intermediate red state. Their extra reporting tool time is under 0.02 min; the correctness race matters more than command latency. Receipts and attempt revisions remove this race (entry 3).
- **Admission versus compute waits:** some 120-second-plus shell calls include admission waiting; retained result excerpts do not reliably expose the split. Wrapper verification is 39.27 minutes measured, including the 1.43 minutes also inside #4480's transcript. There are no worker polling/sleep loops or explicit self-review rounds to eliminate. Keep these as zero observed counts with downstream coverage marked unknown.
- **Purposeful negative tests:** #4331 mutation gates, #4338's eight old-code failures, #4341's four old-code failures, and #4335's attribution regression discovery provide evidence. A naive “FAIL text = inefficiency” classifier would penalize these and reward untested delivery. Test intent and source revision must travel with each result.

## Automated postmortem system — #xp1wbuo

### Existing seams to extend

Reuse `we:scripts/conveyor/run-rating.mjs`: `pairToolEvents`, `classifyToolCall`, `computeTimeShares`, `sumTokens`, `classifyRunWaste`, `rateTranscript`, `toScorecardRow`, `rateAndRecordSession`, `flagWaste`, `topWasteCauses` and `rollupByDemand`. Reuse `we:scripts/conveyor/run-scorecard-store.mjs` for validated append and its machine-wide path resolver. Do not create a postmortem database, second run ledger or tracked live JSON file.

Current gaps observed in the implementation: `readTranscriptLines` materializes transcripts; `extractTurns` accepts every assistant record without message-ID coalescing; category totals can overlap while only the residual uses a union; absent thinking-token metadata becomes “idle”; repetition uses exact call signatures without tree/proof intent; per-cause token estimates are proportional to call counts. Existing waste keys cover only six causes and do not include the preparation handoff, false completion or redundant cross-repo delivery. `toScorecardRow` needs to preserve the new metric/evidence fields rather than dropping them. `appendRunRating` currently skips missing-evidence ratings: that cannot satisfy an every-terminal-build coverage requirement.

The existing `we:scripts/operations/deliver-item-wrapper.mjs#settleTerminal` is the terminal worker/wrapper seam. **`pr-opened` is not `landed`.** Join the existing PR-observed retirement/land reconciliation in `we:skills-src/conveyor/build-dispatch-daemon.mjs` to finalize a landed build record. Reuse reaper reconciliation for killed/orphaned processes and resume the same logical attempt. Existing Codex run-quality recording remains; normalize provider event formats through the shared rating input. This follows `we:docs/agent/platform-decisions.md#deterministic-core-thin-judgment`.

### MVP behavior and record

1. **Capture identity before work:** repo-qualified item, dispatch run/effect ID, unique attempt ID, worker session UUID/path, provider/model, lane/implementation repo, base/tree identities and start time. Link prepare, worker, verify, PR and eventual terminal outcome. Slug is display-only. Persist terminal timestamps at their source.
2. **Schedule on every terminal outcome:** landed, failed, blocked, not-ready, killed, timeout and abandoned. Produce a provisional summary at wrapper completion; reconcile to a terminal revision at land/failure. A durable pending operation in the existing operation-run machinery survives crashes. A terminal failure without any transcript still produces an evidence-incomplete record with null usage; it is not silently skipped. Collection failure never changes the build verdict or holds its lane.
3. **Stream and normalize:** parse JSONL incrementally, coalesce usage by provider message identity, pair tool IDs, retain bounded evidence offsets/hashes. Compute union wall occupancy, tool service time separately, admission wait, gate execution, polling/idle, model/unobserved residual, read bytes and repeated ranges, selected-test intent/input hashes, failures, recovery episodes, review rounds/findings, retries, and wrapper/prepare/land timings. Malformed/truncated tails retain known measurements with a coverage flag. Do not label all unexplained time as thinking or idle.
4. **Extend one canonical scorecard row schema:** append versioned rating revisions carrying `buildAttemptId`, `revision`, `supersedes`, terminal lifecycle, phase intervals, usage, coverage, and cause evidence. Use `subjectClass: work-agent` for worker metrics and the existing driver distinction for orchestration attribution, joined by attempt ID; rollups select latest logical revision and cannot sum both provisional and terminal rows. Preserve required provider/model/rubric fields, validation and secret scrub. Idempotency key: `(repo, runId, effectKey, attemptId, analysisVersion, sourceDigest, terminalRevision)`. Add dedup/compare-and-append inside the existing store's write serialization with `requireLock: true` (its default best-effort unlocked fallback cannot guarantee filing dedup), not a second file. History remains immutable; late evidence produces a revision.
5. **Compare with a rolling baseline:** use the prior 30 complete, distinct terminal builds in the preceding 30 days, grouped by repo, dispatch kind, model and story-size band. Exclude this attempt and superseded revisions. Compute median and p90 wall, phase shares, usage and failure/retry rates; compare successes to successes and failures to failures. Require at least 10 comparable samples; otherwise label cold-start and use absolute recurrence counts only. Report both gross cost and directly established avoidable cost. A regression flag requires a ratio threshold (for example 1.5× median) **and** an absolute materiality threshold (2 min or 5,000 output tokens), with rubric-versioned configuration. These are MVP defaults to validate, not ratified universal performance targets.
6. **Detect recurrence and file once by cause:** deterministic cause keys such as `prepare-terminal-unsettled`, `unchanged-input-test-repeat`, `edit-failed-dependent-step-ran`, `test-interface-admission-reject`, and `already-delivered-dispatch`; key by mechanism/owner, not error prose, item number or model. Trigger when independently evidenced in at least 2 of the last 10 distinct builds. A single serious correctness defect can be flagged for review without fabricating recurrence. Search existing open cards, including this report's five cards; update their evidence/cost window instead of creating duplicates. Use the declared `file-item` operation for a new card and the guarded existing card writer for updates. Store filing intent, cause key and resulting card ID on the canonical scorecard revision; include a deterministic cause marker on the card so crash recovery can discover an already-written card. Serialize claim/filing through existing operation-run effects; crash after write must not file twice. A recurrence after resolution appends evidence to the known lineage and proposes reopening/follow-up under the same cause identity.
7. **Keep judgment bounded:** deterministic metrics first; optional LLM attribution receives only flagged excerpts and prior cause candidates under a recorded token budget. Ambiguous causes remain `unclassified` and cannot auto-file a speculative diagnosis. Store confidence and supporting line references. Intended RED proof, input-changing reruns and independent review findings are excluded from needless-work classification. Auto-filing needs a causal signature and measured cost, not just a slow run.

### MVP deliverables and proof plan

Extend the rating/parser, row projection/store validation, terminal scheduling/reconciliation, baseline rollup and cause-keyed filing adapter in the existing modules. Start with the five causes above; expose coverage and unknown values alongside metrics. This is an 8-point story, not permission to replace the store or rewrite dispatch. Existing conflict postmortem #4365 is adjacent; reuse its scorecard approach, do not duplicate its conflict-specific detector.

- **Replay:** stream these eleven source transcripts plus the matched operation records through the new analyzer without live writes. Recover nine delivered-item cohorts, two extra attempts, ten gate runs with one red, seven admission refusals, six BSD `sed` errors, zero explicit self-review rounds, and the token totals above. Reconcile wall partitions within timestamp precision. The historical attachment is the reference output, not the production destination.
- **Adversarial fixtures:** overlapping tools, duplicate usage events, one message with multiple tool calls, malformed final line, missing transcript, child-session references, cross-repo lane mismatch, reused slug, late merge, killed worker and concurrent terminal events. Prove no negative residual, inflated wall/tokens, missing failure row or duplicate latest attempt. Large synthetic JSONL proves bounded source-content memory; pending tool/usage identity metadata may scale with event count and must have an explicit limit/spill strategy.
- **False-positive tests:** a mutation RED run and a rerun after a source change must not trigger repeated-test waste. A required independent review with findings must not count as self-review. A long gate with no queue timing remains unattributed, not “queue contention.” Missing usage is null rather than zero.
- **Baseline and filing:** replay two builds with the same cause; exactly one card is filed through `file-item`. Third recurrence updates it. A second cause creates a separate card. Restart after each boundary (scorecard append, filing intent, card write, result receipt); no duplicate cards or lost evidence. Verify a resolved-card recurrence policy and cold-start behavior. Prove metrics are read from `run-scorecard-store`, with no new operational data store.
- **Live graduation:** run one harmless successful builder delivery and one deliberately failing build in isolated lanes with a driver and an independent observer using the repository's prototype proof discipline. Observe the actual terminal event, canonical persisted scorecard, source line refs, bounded analyzer usage, baseline comparison and cause-card update. Exercise a post-PR failure and a landed event; a green unit test alone does not prove this wiring. Compare an optimized cohort against the baseline without weakening required tests/proofs. Keep the feature experimental until both terminal paths and crash recovery are observed.

The automated pass's own wall time, tokens, parse coverage and filing effects are recorded through the same machinery. Otherwise the optimization loop can itself become the next source of unmeasured overhead.

## Validation of this report change

The reconciliation probe passed for eleven attempts/nine items, seven admission refusals, six BSD sed failures, ten matched gates/one red, the output-token total, and wall partitions (within rounding). A separate streaming probe resolved every retained tool-use/result line pair back to its original JSONL event. All six cards were created through `node we:scripts/operations/run.mjs file-item --queue=false`; none retains scaffold acceptance placeholders. The automation card is a bodyless `relatedReport` mirror, so the report is exposed through the backlog.

`npm run check:standards` passed with **0 errors / 2,758 warnings** using temporary admission storage (`LANE_POOL_ROOT`) and a temporary Git index/object directory. The default invocation could not write the sandbox-excluded host admission locks; the first isolated invocation also rejected intentionally untracked report files and two card locus references. The references were corrected. For final validation only, intent-to-add entries were placed in the temporary index so the untracked-artifact gate could inspect the proposed patch without committing or modifying the real index. No runtime code changed, so no runtime unit suite or rendered-template accessibility gate was required. `git diff --check` passed; the new files were also checked for trailing whitespace.
