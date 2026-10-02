---
bornAs: xvmk4h4
kind: epic
locus: plateau-app
status: open
blockedBy: ["4620", "4340"]
dateOpened: "2026-09-30"
preparedDate: "2026-10-01"
preparedAgainstSha: "9454ab40a3f4ab18a679690a4273fe76736f69c8"
tags: []
---

# Show every running job and builder hold with its actual owner and executor

Umbrella for honest running jobs and builder holds across configured constellation repos and authors, with distinct owner, supervisor, executor and model evidence. Delivery is split into #x74eqth, #xukxoy9, #xk7jz9n, #xv8d25t and #xowscy1; the prepared goal, Design and Test plan below remain the acceptance baseline.

## Split analysis and current delivery plan (2026-10-01)

User-authorized backlog-only split after the build exceeded 20 paths or 4 areas. This section is the split report in the card, rather than a separate report artifact. The original prepared plan below is preserved as historical design evidence; this section supersedes its single-consumer-change build order and conditional contract follow-up. No runtime implementation or proof is claimed.

Real-tree inspection used Plateau HEAD `2a38182`: we:../plateau-app/src/wip/progress-read.ts:52 already has readMoving; we:../plateau-app/src/wip/types.ts:202 already accepts schema 2; we:../plateau-app/src/wip/wip-read.ts:389 shares live-state and :417 collects dispatch observations; we:../plateau-app/src/wip/wip-model.ts:358 still marks holds unavailable. The contract predecessor x9jwbpi is resolved and its artifacts now exist, but we:contracts/plateau-progress-view.schema.json:185 and :329 have no validated executor/model or structured capacity/overlap extension. A WE-only contract slice is therefore required first, per we:docs/agent/platform-decisions.md#constellation-placement and the #4289 per-repo ruling. #4620 and #4340 remain open prerequisites despite code present in the inspected checkout: pin their landed interfaces before build.

### Could split

| Slice | Size | Predicted scope (exact paths in child frontmatter) | Paths / implementation areas | Blocked by |
| --- | --- | --- | --- | --- |
| #x74eqth — WE contract, populated examples and declarative validator | 2 | `we:contracts/plateau-progress-view.schema.json`; `we:contracts/plateau-progress-view.examples.json`; `we:contracts/plateau-progress-view.test.ts` | 3 / 1 | #x9jwbpi |
| #xukxoy9 — Plateau types, relay and browser acceptance | 2 | `we:../plateau-app/src/wip/types.ts`; `we:../plateau-app/src/wip/wip-source.ts`; `we:../plateau-app/src/wip/wip-source.test.ts`; `we:../plateau-app/src/wip/wip-relay-contract.test.ts`; `we:../plateau-app/wip-relay.js` | 5 / 2 | #x74eqth, #4620 |
| #xk7jz9n — Plateau standalone/delegated run adapter and tests | 3 | `we:../plateau-app/src/wip/progress-runs.ts`; `we:../plateau-app/src/wip/progress-runs.test.ts` | 2 / 1 | #xukxoy9 |
| #xv8d25t — Plateau persisted/tick hold adapter and tests | 3 | `we:../plateau-app/src/wip/progress-holds.ts`; `we:../plateau-app/src/wip/progress-holds.test.ts` | 2 / 1 | #xukxoy9, #4340 |
| #xowscy1 — Plateau shared collector, counts, view and publisher proof | 3 | `we:../plateau-app/src/wip/progress-read.ts`; `we:../plateau-app/src/wip/progress-read.test.ts`; `we:../plateau-app/src/wip/wip-read.ts`; `we:../plateau-app/src/wip/wip-read.test.ts`; `we:../plateau-app/src/wip/wip-model.ts`; `we:../plateau-app/src/wip/wip-model.test.ts`; `we:../plateau-app/src/wip/wip-view.ts`; `we:../plateau-app/src/wip/wip-view.css`; `we:../plateau-app/src/wip/wip-view.test.ts`; `we:../plateau-app/src/wip/wip-view.hostile.test.ts`; `we:../plateau-app/src/wip/wip-publish.test.ts`; `we:../plateau-app/scripts/wip-publish.ts` | 12 / 2 | #xk7jz9n, #xv8d25t |

Scopes use native locus qualifiers in machine frontmatter; prose uses WE-relative repo paths. Budgets above exclude one bookkeeping card path/area, which still leaves every slice below both limits. Each child has a real digest, explicit scope, test-first acceptance and assigned parts of the prepared proof. Sizes are re-estimated from the read code, not inherited from the former size 5.

### Could not split

| Candidate remainder | Failed condition | Unblocking action |
| --- | --- | --- |
| None within the prepared MVP | None | No additional scope deferred by this split. Exhaustive custom-path launch registration was already outside the MVP and remains a producer follow-up. |

DAG: x9jwbpi → #x74eqth; (#x74eqth, #4620) → #xukxoy9; #xukxoy9 → #xk7jz9n; (#xukxoy9, #4340) → #xv8d25t; (#xk7jz9n, #xv8d25t) → #xowscy1. Runs and holds can proceed independently once their own prerequisites clear. The contract is independently consumable; compatibility hardening deploys safely before publication; each adapter has contract-valid fixture replay without activating an incomplete publisher. The final story owns the integrated phone proof. None is dispatched merely because it was scaffolded.

Net flow: +5 stories; #4624 remains open as a storied epic, without size or build scope. The original #4620/#4340 prerequisites remain on the epic and on the consuming branches.

## Progress (original preparation)

Premise checked 2026-10-01 against WE `9454ab40a`, local `main`'s preparation brief, and Plateau `1888d29`. The supplied old filename now resolves to this card. Only this card is edited.

- **Old premise:** the existing activity sources could be extended into complete standalone coverage with a small adapter/view change. **Correction:** some Codex records already enter the reader, but they are delivery-thread mappings, not complete live-job observations. `we:scripts/operations/agent-activity-io.mjs:189-205` reads `{sessionSlug, threadId, at}` and supplies neither PID nor model; it appends these rows at :289. `we:scripts/operations/live-work.mjs:62-80` falls through to working when neither death nor waiting nor old activity is known. Do not carry that fallback into evidence-backed moving counts.
- Plateau already shares one live-state read between health and running (`we:../plateau-app/src/wip/wip-read.ts:153-168`); the projection at :217-238 drops executor/model/parent provenance. The current row type has none of those fields (`we:../plateau-app/src/wip/types.ts:165-180`), and the envelope remains schema 1 (:184). Thus the goal is not already delivered.
- **Standalone seams:** Codex writes a per-checkout default JSONL log (`we:scripts/codex-direct-task.mjs:814`); Gemini's direct worker uses agy and writes a per-checkout default JSONL log (`we:scripts/gemini-direct-task.mjs:535-536`). Gemini distinguishes requested from served model/backend and evidence (:574-575, :645). A configured model is not proof of the served model.
- Read-only host probe during preparation: the primary WE delivery-thread store contained 31 mappings; a sampled mapping had exactly `at`, `sessionSlug`, `threadId`. Across available lane Git directories, 70 default Codex logs existed, 66 nonempty; a sampled nonempty log had `thread.started`, `turn.started`, item events and `turn.completed`. There were 38 Gemini logs; one sampled log and the primary WE log contained `init` and `step_update` events with a conversation ID. These observations validate parseable source families, **not current liveness or exhaustive coverage**. No paid job was launched and no raw transcript was copied. Source locations are defined by `we:scripts/operations/agent-activity-io.mjs:191`, `we:scripts/codex-direct-task.mjs:814`, and `we:scripts/gemini-direct-task.mjs:535-536`; runtime sample counts are observations, not checked-in fixtures.
- Persisted holds alone are insufficient: `we:scripts/conveyor/build-dispatch-claim.mjs:166-178` returns only unexpired holds, while overlap refusals carry lease/rival evidence in `we:scripts/readiness/dispatch-plan.mjs:604-613`. Read both persisted holds and #4340's tick observations. The latter is a prerequisite, not a deployed panel: `we:backlog/4340-wip-shows-the-daemons-and-what-they-are-really-doing.md:3-6` still records an open story.
- **Old scope:** six Plateau files omitted types, collector/model, compatibility and integration tests. **Corrected scope:** the frontmatter includes these consumer boundaries and tests; WE sources are read-only integration evidence. New standalone collection and pure joins belong in proposed `we:../plateau-app/src/wip/progress-runs.ts`. No launcher or shared agent documentation change is hidden here.

## Design

### Dependency interfaces and delivery split

Placement follows `we:docs/agent/platform-decisions.md#constellation-placement` and `we:docs/agent/platform-decisions.md:1165` (surface contract, not computation). The design's run/hold payload is in `we:docs/agent/plateau-progress-view.md:98-109`; source ownership/cadence is at :119-132.

1. **x9jwbpi → #4620 → #4624.** The split is recorded at `we:backlog/4620-bring-standing-rules-and-ordered-priorities-into-the-live-pl.md:20-22`; x9jwbpi declares the schema, examples and validator at `we:backlog/x9jwbpi-publish-the-plateau-progress-view-contract-schema-2-with-val.md:12`. Neither the local tree nor local `main` contains the contract yet. Design against its declared schema-2 interface; do not pretend its final validator has been inspected. Before implementation, pin the landed revision and validate populated run/hold examples against it.
2. **Schema-2 seam:** consume `snapshotId`, `publisherId`, `sequence`, `observedAt`, `coverage`, per-source freshness, separate summary units, `runs` and `holds`. Runs need stable producer-qualified identity, explicit parent/logical-work links, repo/card/PR refs, description, role/origin, supervisor and executor `{provider, model, evidence}`, state and timestamps/next step. Holds need work ref, owner, raw and normalized reason, since/as-of, next step and related refs; capacity observations and overlap evidence must survive. Preserve source unknowns and raw unknown states. These are requirements from `we:docs/agent/plateau-progress-view.md:100-109`, not an assertion about an unlanded schema's exact property spelling.
3. **#4620 consumer seam:** extend its proposed progress collector and schema-1/2 compatibility, single-flight publisher and summary projection; preserve existing Flow items/actions, boot sequencing, stale handling and relay bounds. #4620's mechanism is specified in `we:backlog/4620-bring-standing-rules-and-ordered-priorities-into-the-live-pl.md:32-36`. A missing run source is unknown, never an empty successful collection.
4. **#4340 observation seam:** reuse its daemon/tick read and in-flight/hold observations once landed, rather than starting another daemon-status poll or panel. Expect tick timestamp plus in-flight/dispatched records and hold reason/lane/rule; accept only fields actually emitted. Missing owner, counterpart or usage remains explicit unknown. Reconcile its actual exported collector shape when the prerequisite lands.
5. **Per-repo delivery:** #4624 remains Plateau-only. If x9jwbpi omits any required run/hold field or fixture, propose a separate WE contract predecessor covering `we:contracts/plateau-progress-view.schema.json`, `we:contracts/plateau-progress-view.examples.json`, and `we:contracts/plateau-progress-view.test.ts`; land and validate it before this consumer. If launcher registration is needed for unattended exhaustive discovery, propose a distinct producer story with launcher and producer tests, not an incidental mutation from the display. This is the independently valid contract/consumer split ruled at `we:backlog/4289-design-multi-repo-couple-locus-delivery-e-g-we-plateau-app-2.md:18-24`; coupled delivery remains supported future work. This card-only task creates no siblings and changes no blocker metadata.

### Collection, attribution and joins

Implement proposed `collectProgressRuns({roots, now, io, liveState, daemonObservations})` and pure `projectProgressRuns(observations)` in `we:../plateau-app/src/wip/progress-runs.ts`. Return contract-conforming runs, holds, separate logical-work/job/held counts and per-source coverage. Inject filesystem/process/clock access. Collection failures return source-local unavailable/stale observations with retained last-good data and timestamps; malformed input never resets an age or creates a moving job.

- Resolve each producer's actual state home, independent of the publisher lane cwd. Review jobs are rooted by producer checkout or explicit override (`we:scripts/operations/review-job-store.mjs:28-33`); fix claims use the coordination owner (`we:scripts/conveyor/fix-claim-store.mjs:12-27`). Reuse the already collected live-state and tick result, supplementing bounded local metadata reads only once per publish cycle. No added GitHub calls or tab-specific collection.
- Discover standalone workers from configured producer roots and known checkout/lane inventories, including default logs and explicitly supplied log locations. Read bounded event metadata, never stream prompts/tool content to the relay. Extract Codex thread identity and Gemini conversation identity; use recorded launch/process evidence to bind cwd, executor and start identity. A root scan cannot discover every arbitrary custom log path: report uncovered producers, never claim global completeness from default-log discovery.
- Owner means the recorded accountable actor/system; supervisor means the parent controller; executor means the actual worker provider. Keep author separately when supplied; no author filter. Preserve requested model as requested evidence, reported model as reported evidence, and unknown when not attested. A session slug, process name, current default pin, or hold writer PID cannot establish actual model or current worker ownership.
- Deduplicate by producer-qualified stable run ID, with explicit alias links for the same job across a registry and log. PID alone is never identity: corroborate process start/cwd or explicit run binding. A completed/dead run overrides stale live-looking log/claim data. Missing liveness is unknown, not working. Waiting/stale/unknown jobs remain visible but are excluded from active moving counts. Preserve raw legacy state as evidence when its classification is less strict.
- Group supervisor and delegated executor under a repo-qualified card/logical-work ID only on explicit linkage: one work item, two distinct jobs. Multiple jobs without a known shared work ID stay ungrouped with incomplete logical-work coverage. Cardless, PR-only and unmatched jobs remain visible; identical card/PR numbers in different repos never join. A held card with several reasons counts once while retaining every reason.
- Project persisted holds and tick refusals together. Distinguish overlap (occupying ref plus safe repo-qualified file), needs-prepare (recorded preparer or unassigned), critical-Claude capacity (observed usage/limit, age and provenance), and unknown raw reason. Do not infer a capacity limit from the plan or relabel an expired historical refusal as current. Deduplicate by work/reason/source identity; use hold timestamp for since, or unknown if the tick proves only as-of. Missing remediation is an unassigned system incident with the next step unknown, never an invented handler or automatic human chore.

### Build order

First pin prerequisite interfaces and add populated fixtures; then implement collection/joins and model counts; wire the shared collector; render Moving and Flow/holds with full wrapping and source age; finally verify relay/client compatibility and real publisher behavior. Reuse native disclosure or the existing disclosure trait, preserving focus and expanded state (`we:docs/agent/plateau-progress-view.md:69`). Ship one Plateau consumer change after compatible contract support; do not enable a publisher shape before its consumers accept it.

## MVP

All observed build, prepare, standalone Codex, Gemini/agy, fix, ci-heal and review rows, regardless of author/repo/card binding; honest unknown attribution and partial coverage; separate logical-work/jobs/held counts; explicit overlap/preparation/capacity holds and system ownership. Keep the 120-second baseline and existing action/fork flows. Partial coverage is a visible limitation, not permission to omit the standalone adapters. Exhaustive registration, new dispatch policy, new paid probes and delivery/trend/PR-list features are outside this consumer slice.

## Done when

1. Fixtures for every producer family render role, origin, accountable owner, supervisor/executor and evidence-backed model or explicit unknown; standalone jobs do not require Claude registration.
2. A parent plus child yields one logical work item and two jobs; a duplicate record adds neither; cross-repo IDs remain distinct and unmatched work stays visible.
3. Overlap, preparation and capacity cases show distinct reason, observation age, actual owner or unassigned, counterpart/usage where known and the next system step. Holds do not manufacture human actions.
4. Finished/dead/waiting/stale/unknown jobs do not inflate active moving counts; missing/stale collection cannot produce a fresh zero or all-repos-complete claim.
5. Populated schema-2 data survives collector → publisher → relay → browser, with full descriptions at 320/390 px and schema-1 fallback preserved.

## Test plan

Add tests before implementation; use deterministic redacted event fixtures inline in the scoped test modules, no paid processes:

- `we:../plateau-app/src/wip/progress-runs.test.ts` (new): direct Codex and agy outside Claude; delivery mapping plus same-thread log dedup; Gemini requested/served mismatch; missing model/owner; explicit parent-child; cross-repo identical IDs; cardless jobs; PID reuse; completion followed by stale claim; waiting/stale/unknown states. Assert exact job/logical-work counts and provenance, not snapshots alone. RED today: adapter absent and legacy unknown liveness falls through to working.
- Capability — RED today (adapter absent). Same adapter suite: persisted hold plus duplicate tick refusal; expired hold; old tick; overlap counterpart; needs-prepare without assigned preparer; observed Claude usage/limit versus policy; unknown reasons; unreadable/truncated/oversized logs and custom paths outside configured discovery. Assert partial source coverage and no fabricated zero/owner/age. Use IO spies to enforce bounded reads and no network or launcher invocation.
- Capability — RED today (new join/count projection absent). `we:../plateau-app/src/wip/progress-read.test.ts`, `we:../plateau-app/src/wip/wip-read.test.ts`, and `we:../plateau-app/src/wip/wip-model.test.ts`: one shared live-state/tick collection, isolated source failure, retained last-good age, exact separate counts, no author/epic filter and no automatic human action for unassigned holds.
- `we:../plateau-app/src/wip/wip-view.test.ts` and `we:../plateau-app/src/wip/wip-view.hostile.test.ts`: full long descriptions, explicit unknown/partial states, owner distinct from executor, unsafe producer strings escaped, no raw transcript/absolute log path, keyboard disclosure preserved on refresh. RED today: executor/parent fields are absent from the projection.
- Capability — RED today (schema 2 absent from the current consumer). `we:../plateau-app/src/wip/wip-source.test.ts`, `we:../plateau-app/src/wip/wip-relay-contract.test.ts`, and `we:../plateau-app/src/wip/wip-publish.test.ts`: populated dependency-contract fixture, schema-1 compatibility, invalid/unknown-major rejection, payload limit, boot/sequence behavior and stale timestamps preserved. Verify contract-dependent expectations after x9jwbpi/#4620 land, not against guessed field names.
Run the scoped Plateau suites and its required repository gates. Mutation checks: remove standalone input, merge jobs by PID, promote requested model to served, or turn unknown source into zero; each must fail its corresponding assertion. No runtime tests are claimed executed by this preparation.

## Proof plan

1. Capture one sanitized existing observation per producer family and record source revision/as-of, mapped row, ownership and liveness evidence. Reuse normal activity; never launch paid jobs just for display. An unavailable producer is explicitly unproven/partial, not silently passed.
2. Replay those observations through the existing publisher and authenticated relay into the phone route; assert exact counts and a standalone Codex plus Gemini row absent from Claude listings. Inspect transmitted JSON for credentials, raw transcript content and absolute host paths: none may escape.
3. Compare real tick/hold and process-start observations at the same instant with the rendered rows, including one dead/stale case. Disconnect the publisher and confirm aged data becomes not-live without fresh counts. A screenshot alone does not prove attribution or liveness.
4. At 320/390 px check complete wrapping, headings/names, keyboard/focus, disclosure persistence and axe; capture screenshots. Record GitHub-spend deltas over two 120-second cycles plus a second tab against the unchanged baseline: this slice adds no calls.
5. Record actual commands/results and limitations here. Preparation verification uses `node we:scripts/backlog.mjs prepare-stamp 4624`, `node we:scripts/verify-lane.mjs` and the standards gate; repo prefixes denote location, not literal CLI arguments.

## Follow-ups

- If the contract lacks the required detail, file the WE-only predecessor described above before dispatching this consumer. Validate populated runs/holds, not merely empty arrays. Do not widen the current mixed-repo build implicitly.
- Durable standalone launch registration/heartbeat for arbitrary custom log paths is a separate producer deliverable if existing inventory cannot observe them. Preserve requested-versus-reported model and process-start identity. Keep coverage partial until live-proven; no new collector may treat transcript mtime alone as liveness.
- Resolve #4340's landed tick/hold interface and #4620's landed collector exports before starting the build. Those prerequisites remain blockers; a preparation stamp does not unblock them.
- Testing lesson: thread mappings and successfully parsed logs prove identity/history, not current execution. Add missing producer fixtures and proof here, never append shared agent docs. Independent human review of this preparation remains pending; no review or product proof is claimed.
