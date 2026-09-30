# Plateau as the operator's main progress view

Design proposal, 2026-09-30. Requested surface: `/wip` in Plateau. This document is the requested design artifact, not a new shared agent instruction. No product implementation or deployment is part of this change.

## Outcome and boundary

In one phone screen, answer: **what is moving, what landed, how flow is changing, and what is held and why?** System-owned problems must not turn into the operator's task list. A small, separate action section answers what actually needs the operator. The page replaces the manual progress reconstruction across chat, the plan artifact and the GitHub app; it does not become a second dispatcher or a second merge authority.

WE owns the versioned data contract and declarative conformance examples. Plateau owns collection adapters, aggregation, relay validation and UI. Reuse the existing publisher and relay. Existing WE operational readers are integration sources, not a precedent for adding product runtime to WE. Placement follows [we:docs/agent/platform-decisions.md, constellation placement](platform-decisions.md#constellation-placement) and [we:docs/agent/platform-decisions.md, surface contract](platform-decisions.md#surface-contract-not-computation). This is an operational contract proposal, not a ratified browser standard; the first build slice formalizes its schema and examples before runtime work.

Repo paths below use `we:` and `plateau-app:`. The external operator plan (daemon-delivery-plan in the home Claude directory) is host state, not a repo artifact. Runtime state homes must be resolved through their owners, never guessed from a lane's cwd.

## Survey: what exists and where it comes from

Source inspection at WE commit `81e0381e1`, Plateau commit `1888d29`, and locally available prototype ref `origin/lane/mechanical-dispatcher` at `6a2c8c1ab`. These are code observations, not claims about the currently deployed phone page or the current daemon counts. No fresh GitHub API calls were made for this survey. The prototype ref was not fetched, so its current remote tip is unverified.

There are two different `/wip` implementations to distinguish:

- **Plateau page:** `plateau-app:src/wip/wip-read.ts` reads backlog, build order, queue-store, runner-activity, local drain status and a shared live-state result for health and running sessions. It separately calls `gh pr list` for one repo (default WE, limit 100) and the cached merged-PR sweep. `plateau-app:src/wip/wip-model.ts` groups leaf cards under one epic (default 3383). It matches PRs by lane naming and picks one worst-state PR per card. Orphan PRs and other repos therefore cannot be represented reliably in the card list.
- **Prototype terminal report:** `we:scripts/operations/wip-report*.mjs` on the prototype branch reads land-advance, wip-agents, runner-activity, operator-queue, completions, a decision docket and merged PRs across swept repos. It renders Attention, Work items, Done, Next and Needs you. Its Done window is since the last report stamp, falling back to three hours, not an ET calendar day. It is **not the data source imported by Plateau's publisher**. Reuse its source meanings and joins where valid; do not scrape its formatted output or run its GitHub-heavy aggregate on every publish.

`plateau-app:scripts/wip-publish.ts` reads `readWip`, publishes outbound through one WebSocket, registers existing decision/telemetry asks and commands, and uses HTTP publishing as fallback. The configured read interval is 120 seconds, with debounced changes under backlog and conveyor triggering rereads. `plateau-app:src/wip/wip-agent.ts` otherwise has a 10-second default; preserve the explicit 120-second wiring. `plateau-app:wip-relay.js` stores and broadcasts the latest snapshot, validates schema 1 and bounds payloads to 900,000 bytes. `plateau-app:src/wip/wip-source.ts` distinguishes never-published from stale and uses a 600-second stale threshold. Preserve this transport and its authentication.

`plateau-app:src/wip/wip-decide.ts`, `plateau-app:src/wip/decision-forks-source.ts`, `plateau-app:src/wip/lane-map.ts`, and `plateau-app:src/wip/ask-session.ts` already support prepared forks, lane-aware context and questions. Keep those flows; do not turn progress refreshes into paid agent sessions.

| Operator need | Exists today | Gap and target |
|---|---|---|
| Progress and trend first | Epic resolved fraction; doing/queue counts; prototype Done window | No daily delivery scoreboard or comparable trend. Lead with moving, merged today, held, human actions and a time-labelled trend. |
| Builder builds and preparing, model/executor | live-state running rows carry role, work item, PR, activity and state; prototype sessions include supervisor/delegation words | Plateau wire rows omit model/executor. Distinguish builder, standalone Codex/agy, fix and ci-heal; deduplicate related sessions without hiding actual jobs. |
| Held work and why | Last-tick stalled reasons, unresolved blockers and runner-dependent dispatchability | Add scope-overlap counterpart, needs-prepare owner, critical-to-Claude capacity, held age and last observation. Hold is system flow, not a human action. |
| Merged today by kind | Prototype merged list; Plateau merged sweep detects stranded cards | Sweep has no mergedAt field and is not a delivery ledger. Add confirmed, deduplicated merges and classification with provenance. |
| Every open PR in all three repos, any author | One repo fetch, then epic/lane/card filtering and one selected PR per card | Independent PR collection keyed by repo and number; no author, card, branch-prefix or epic exclusion; group by current wait. |
| True operator work | Needs-you group; prepared fork UI | Pending review and red CI are incorrectly human work. Show human review, ready forks and explicit human-only escalations, with one plain description each. |
| Health and API budget | Four runner chips, seven live-state health sections, running panel | Add episode ownership, actual builder tick age, per-identity GitHub budget, last completed daemon pass, and observed overnight stop state. |
| Standing rules and priorities | External plan has rules, ordered priorities and history | Read-only projection with source revision/time; separate intended policy from observed configuration; no hard-coded copied limits. |
| Phone readability | Disclosure, short titles, mobile CSS | Model clips titles at 200 characters; CSS clamps titles; prototype tables truncate to 18-character title cells and 35-character rows. Remove clipping and ellipsis throughout the new path; one concise description wraps in full. |

### Why today's list feels like blockers

This mapping is derived from the actual branches in `plateau-app:src/wip/wip-model.ts` and the prototype report's attention rules. Counts of each kind in the deployed page were not sampled.

| Current row or attention rule | Correct home | Owner and operator threshold |
|---|---|---|
| `review:pending` currently says “You are the reviewer” | PR flow: waiting for review daemon | Review daemon; human only after an explicit human escalation. |
| `review:human` | Needs you, linked to its PR flow row | Operator; show the actual escalation reason and advisory readiness, not the current hard-coded assertion that every such PR edits gate rules. |
| Failed CI / ci-failed-no-fixer | PR flow: fix daemon or author continuation for drafts | CI-heal/fix, or draft author; missing handler is a health incident, not automatically an operator chore. |
| Changes requested / conflict / stale status tag | PR flow: fix daemon, conflict repair, or status reconciliation | Existing daemon, with active/queued/unassigned handler state. Escalate only on a recorded human-only requirement. |
| Open PR on resolved/parked card | PR flow plus bookkeeping reconciliation detail | System investigates mismatch; never hide the PR or auto-close it from this view. |
| `already-done` or merged-PR stranding | Held: reconciling delivered work | Existing hold router/reconciliation owns it. A merge match is not proof the full card is done; retain evidence and require explicit ambiguous-scope escalation before an operator action. |
| Scope overlap, prerequisites, needs-prepare, critical-to-Claude cap | Held work, grouped by reason with counts | Builder/preparer; link occupying job or dependency and show next machine step. Operator is not asked to raise caps. |
| Stalled/permission-blocked/finished-unreaped/dead session | Run flow and health | Supervisor/reaper; dead history is excluded from moving counts. A permission requirement becomes an action only when explicitly assigned to the operator. |
| Old PR, over capacity, runner down, no handler | PR ageing/health with an owner and last attempt | System incident. Keep visible even without a handler; do not silently label it auto-handled or discard it. |
| Open unprepared decisions / uncleared backlog | Held preparation / secondary backlog drill-down | Preparation system. Only ready-to-rule forks enter Needs you; the full docket remains reachable. |

No row moves to Needs you solely because it is red, old, lacks an owner, or cannot start. Conversely, a real human-only credential/permission emergency remains visible even when it is not a PR or decision. The progress page changes presentation and ownership labels, not authorization or autonomous-resolution policy.

## Target information architecture

Default scope is all three repos and all authors. Epic/repo filters are optional drill-downs and must not silently narrow global counts. Section order:

1. **Progress now.** As-of/connection line, compact counts for moving, merged today, held and needs you; trend text such as “4 landed in the last hour; 2 in the previous hour” and “Held 6, up 2 in an hour.” A small linked health/overnight status appears here; an observed emergency stop is prominent without replacing the scoreboard with a blocker list.
2. **Moving now.** Builds, preparing, standalone jobs, fixing/ci-heal and reviewing. Each row has one plain description plus short metadata: role, actual executor/model, elapsed time and last activity. Waiting-for-test-slot and idle/stale jobs are visible but not counted as actively moving. Parent/child sessions disclose under the logical work item; a jobs subtotal remains available.
3. **Landed today.** Total confirmed merges, by builder builds / card plans / prevention cards / tool fixes / other or unclassified. Latest three descriptions first, all reachable. Day is America/Toronto, with the boundary printed. A seven-day daily series accompanies the hourly comparison after history is available.
4. **Flow and holds.** Held counts by reason, oldest wait and the system's next step; then all open PRs by CI, review daemon, fix daemon, conflict, operator, ready for drain, author continuation, or unknown. Every group has a count and disclosure, including zero states. All PRs stay reachable, even without a card. Multiple blockers are retained in detail; one primary group avoids inflated totals.
5. **Needs you.** Explicit human-review PRs and ready decision forks, plus exceptional human-only escalations. One description and one relevant action link per entry. Human-review rows awaiting advisory or clean CI say “system preparing your review”; they count as pending human work but offer no premature approval prompt. Retain existing fork/ruling interactions.
6. **System health.** Episode summaries, owner/last remediation, GitHub budget and rate, builder tick age, review/fix/drain pass freshness, and overnight mode/stop reason/last check. Healthy detail is collapsed; missing evidence says unknown.
7. **Rules and priorities.** Read-only standing instructions and ordered priorities, source and revision time, disclosure for full selected text. Historical chat logs are excluded. Show intended limits separately from observed daemon configuration and flag disagreement.

Phone layout: single column at 320 CSS pixels; count tiles at most two across; no wide tables. One plain sentence per item, with natural wrapping and no ellipsis, line-clamp or hover-only evidence. Short descriptions are authored metadata, not mechanical truncation; fallback is the complete title. Repeated IDs never substitute for descriptions. Repo and ID are secondary links. Display a few complete rows then “Show all N”, rather than truncating each row. Preserve disclosure state and scroll position across updates. Native disclosure or existing disclosure traits, named landmarks, one h1, ordered headings, visible focus, text with status colour, and restrained live-region announcements. No timed auto-scroll or full-list screen-reader announcements.

Illustrative first screen (values are examples, not measured status):

> Progress · updated 1 minute ago
> 6 moving · 12 merged today
> 4 held · 2 need you
> 4 landed this hour; 2 in the previous hour
> Building: Restore reviews after a worker exits.
> Codex · model reported by executor · active 8 minutes
> Preparing: Make lane recovery safe after interruption.
> 2 held for overlapping files; 1 needs preparation; 1 awaits Claude capacity.


### Per-PR waiting chain (operator, 2026-09-30 ~11:30 AM: "This is the type of information that would be valuable in plateau")

For every open PR, the Flow and holds section shows its **waiting chain**, not just its labels:
- **Waiting on right now:** CI, the review daemon, the fix daemon, a conflict fix, or the operator — and **why**.
- **Queue and blocker:** when the fix daemon serializes overlapping PRs, show the order and the blocking PR plus the shared file, e.g. "#3033 waits behind #3103 — both touch we:scripts/pr-land.mjs".
- **Holder:** which daemon holds the PR (fix claim, live session) and since when.
- **Next steps:** e.g. "then the fix daemon applies the advisory changes, then review:human → operator".
- **Rough ETA** where one can be derived from recent step durations.

Source data, with no extra GitHub API calls: the fix-dispatch-daemon log ("refused scope-overlap … overlaps in-flight fix PR #N — serializing", "reconcile-refused live-process"), review-status/merge-status labels already in the snapshot, fix-dispatch claims, and dispatch run records.

## Proposed data contract

Canonical artifacts to add in slice 1: `we:contracts/plateau-progress-view.schema.json` and `we:contracts/plateau-progress-view.examples.json`. Names are proposed, not existing files. Existing `plateau-app:src/wip/types.ts` becomes a consumer of the WE definition; Plateau retains runtime validation. The contract is declarative and versioned; this design doc describes semantics until the schema lands.

### Envelope, identity and completeness

Schema 2 contains `snapshotId`, `publisherId`, monotonic `sequence` per publisher boot, `observedAt`, `timeZone`, `coverage`, `sources`, `summary`, `runs`, `holds`, `pullRequests`, `deliveries`, `actions`, `health`, and `policy`. Timestamps are UTC ISO instants; calendar buckets use America/Toronto including DST. `coverage.repos` names web-everything, plateau-app and frontierui, with per-repo completeness and last reconciliation time. IDs for PRs are full repo slug plus number; card IDs include repo and provisional-to-number aliases; run IDs include producer and stable run ID. A lane name or PID alone is not an identity.

Every source reports `{observedAt, lastSuccessAt, expectedEveryMs, staleAfterMs, status, complete, reason, cursor}`. Status is fresh / stale / unavailable / partial. Null means unknown; zero means a successful complete observation of none. Keep last good data visibly aged on read failure. A fresh publisher heartbeat must not refresh an old source timestamp. Retain unknown enum values as visible unknown states with raw codes; do not drop rows or infer success. Collections carry total, included and completeness; a bounded payload must disclose omissions and provide cached paging through the existing read-only ask channel. A page must never say “every PR” while coverage is partial.

| Field group | Required payload and semantics |
|---|---|
| `summary` | Moving logical-work count and jobs count; held card count; open PR count; confirmed merged today and completeness; human pending and actionable counts. These units remain separate and are never summed as “total work.” |
| `runs[]` | Stable runId, parentRunId/logicalWorkId, repo, cardRefs, prRefs, plain description, role (build/prepare/fix/ci-heal/review/session), origin (builder/standalone/daemon), supervisor and executor `{provider, model, evidence}`, state, startedAt, lastActivityAt, observedAt, nextStep. Unknown model is explicit; do not infer from a process name. |
| `holds[]` | Card/work ref, description, owner, rawReason, normalizedReason, since, asOf, nextStep, relatedRun/pr/card refs. Scope-overlap includes occupying ref and safe repo-qualified file evidence; needs-prepare identifies preparation status; critical-Claude-cap includes current observed usage/limit and policy provenance. Unknown reasons retain plain text. |
| `pullRequests[]` | Repo/number/url, full description/title, author if known, draft, headSha, updatedAt, CI checks for that SHA, review disposition/reason/advisory readiness, active handler, conflict state, waitReasons[], primaryWait, waitSince, source evidence. Author unknown is never a filter. |
| `deliveries` | Records keyed by repo/PR, mergedAt, merge SHA if known, description, cardRefs, kind, kindEvidence, origin/executor attribution; daily/hourly bucket counts and coverage windows. A session completing or a card resolving is not a merge. |
| `actions[]` | Stable ID, linked PR/fork/episode, description, operatorReason, ready flag, blocking system prerequisites, existing action URL or fork reference. A health episode and PR referring to the same escalation yield one action. |
| `health` | Episodes with severity, description, owner, openedAt, lastAttempt/result, escalation; daemon heartbeatAt AND completedPassAt/tickAt, expected cadence and paused reason; GitHub budget windows; overnight observed control state. |
| `policy` | Source kind/revision/observedAt, ordered priority descriptions+refs, selected standing-rule text, effective date if explicit, extraction status; observed config references distinct from desired rules. Read-only; no command or arbitrary markdown execution. |

### Owners, collection and cadence

Cadences below are target **publisher reads**, not instructions to reschedule the source daemons. Each daemon reports its own expected cadence; do not assume one timer for every daemon. Baseline publish/read remains 120 seconds. Cheap state-change events may publish sooner through one debounced, single-flight collector; expensive scans stay cached for the interval.

| Producer/store (existing unless noted) | Fields it supplies | Update / collection / route to Plateau |
|---|---|---|
| Builder claim/hold owners in `we:scripts/conveyor/build-dispatch-claim.mjs`, hold router in `we:scripts/conveyor/build-dispatch-hold-router.mjs`, queue-store and tick result | Build/prepare binding, holds, capacity reason and last tick | Owners write at claim/release/tick; Plateau adapter reads resolved coordination state every 120s and on a cheap change signal. Last-tick refusals are needed as well as persisted holds; absence from holds alone does not mean dispatchable. |
| Agent activity/live-work readers in `we:scripts/operations/agent-activity-io.mjs` and `we:scripts/operations/live-work-io.mjs`, review job store and fix claims | Run state, parents, role, PR/card links, activity | Reuse one collected result per cycle. Add model/executor projection from existing provenance. Standalone Codex/agy launch records not present in this registry require a producer adapter in Plateau; coverage stays partial until live-proven. Do not discover them solely through Claude agents. |
| Shared PR store in `we:scripts/lib/pr-snapshot-store.mjs`, written by existing daemon discovery; event-ledger follow-on #4281 | All open PRs, checks, labels, conflicts | Read the local persisted snapshot only every 120s. **Do not call `readSharedOpenPrs` as a read-only accessor:** `we:scripts/lib/pr-snapshot.mjs` refreshes via GitHub when stale. Current owner TTL is 75s, not a promise that every repo is being refreshed. Future webhook consumer folds events and reconciles completeness through the existing shared owner. |
| Drain `plateau-app:tools/drain-daemon/lib.mjs` and daemon history; future webhook PR ledger | Confirmed merges, ready/deferred flow, pass freshness | Read local pass history every 120s. Existing history has merged counts/PR numbers; rows lacking repo identity cannot become deduplicated cross-repo deliveries. Use per-repo evidence or show a partial observed tally. Event ledger ultimately supplies all authors and out-of-drain merges. |
| Health owner `we:scripts/conveyor/health-watch.mjs`, resolver `we:scripts/conveyor/health-watch-section.mjs` | Episodes, silences, last completed tick, remediation | Read its persisted state/episodes/stamp, not a new health tick with network probes. Every 120s, faster on persisted episode change. Surface silent source separately from healthy state. |
| GitHub throttle and `we:scripts/lib/gh-spend.mjs` | API consumption, headroom, reset, deferred requests and top callers | Local calls ledger and persisted hourly rollups, every 120s; last response headers supply budget facts. Keep App vs personal identity and REST vs GraphQL separate. No `gh api rate_limit` for display refreshes. |
| Runner-activity lease/status sources; local drain status | Builder/review/fix/drain heartbeat and completed work age | Read once per cycle with owner cadence thresholds. Alive process with stale completed tick is stalled, not healthy. Explicit pause differs from absence. |
| `plateau-app:src/wip/decision-forks-source.ts` and lane map | Pending ready forks and preparation state | Existing cached scan invalidated by backlog changes; refresh on demand through existing decision-forks ask. Main and lane provenance remain visible. |
| External operator plan and existing control files | Read-only rules/priorities; overnight desired policy versus observed stop | Local mtime/hash cache, read every 120s. Extract selected headings with provenance; do not publish the whole history. Overnight controller must publish mode, active stop, reason, since, last check and next check (new structured observation if absent). A plan saying STOP is not evidence processes stopped. |
| New Plateau progress history store | Hourly and seven-day trends | Append on accepted source updates, persist across publisher restarts, deduplicate by IDs; retain at least eight local calendar days. Relay continues to hold latest snapshot; it need not become a history database. |

All adapters feed `plateau-app:scripts/wip-publish.ts` → existing authenticated outbound relay → `plateau-app:src/wip/wip-live.ts` / same-origin API → view. Dev API and live publisher share the collector and classifier; neither should multiply reads per open tab. Watch the resolved state homes, not only the checkout-local conveyor folder. Never send credentials, absolute transcript paths or raw transcripts as part of this overview.

The publisher adds **zero fresh GitHub calls**. If a local source is missing/stale, show that fact. Initial backfill and slow reconciliation belong to the existing shared PR owner, budgeted once for all consumers, not once per phone or once per section. #4281 is open in this checkout and must not be assumed deployed. Upgrade to it when its state and cursor are available; the shared cache is the first shippable source. Existing all-author open-PR snapshots do not carry an author field; preserve rows with unknown author until the owner enriches them.

### Classification, counts and trends

PR primaryWait is a display projection, never a merge verdict. Precedence: explicit human disposition → draft author continuation → confirmed conflict → active/owed fix or ci-heal → pending/unknown CI → owed/active review → ready for drain → unknown. Preserve all waitReasons even when one wins. A draft with red CI belongs to its author, not a generic fixer. CI/review evidence must match headSha; outdated acceptance does not mean ready. Use daemon dispositions when available; interim label-derived evidence is marked as such. Missing CI is unknown, not green. No cross-repo numeric-ID collisions, title-only binding, or cardless-PR loss.

Merge kinds are mutually exclusive for the scoreboard, while origin remains a separate axis. Explicit prevention-card metadata wins; then card-only plan/preparation change; then a delivered builder build; then a tool/runtime fix; else other/unclassified. Thus a builder-produced tool fix is counted once as a builder build, with tool-fix attribution available in detail. Mixed card/code PRs require explicit delivery kind; ambiguous historical rows stay unclassified, not guessed from author or title. This avoids treating every bot PR as a build and does not count prevention-card filings as shipped runtime.

A confirmed merge is deduplicated by repo/PR across drain and webhook sources, with provenance retained. The numerator is merged PRs, not resolved cards, story points, commits or completed sessions. Daily buckets are local midnight to midnight; show today's partial day as partial. Trend compares the trailing 60 minutes with the immediately preceding 60 minutes, same coverage and scope. Held/moving change compares sampled gauges at the two boundaries; a missing baseline says “collecting history.” Seven-day chart labels counts and coverage per day; do not compare today's incomplete day to a full day as a percentage slowdown. Offline gaps, truncated history or newly added repo coverage invalidate the comparison instead of manufacturing zeroes.

GitHub budget shows last observed remaining/limit, observation age and reset time for each identity/resource; rate derives from the gh-spend ledger over a stated window. Do not sum overlapping usage counters, interpret invocation count as API points, assume a reset replenished a bucket without an observation, or imply attributed spend accounts for unobserved traffic. Show unattributed gaps and unknown budget explicitly.

### Compatibility and failure behavior

Deploy schema-2 consumer/relay validation before enabling the schema-2 publisher. Accept schema 1 during transition and project unavailable sections as unknown, never zero. Keep existing decision asks/commands intact. Reject malformed sections independently at collection boundaries; retain last good section with age. Relay rejects invalid envelopes, unknown major versions, oversized messages and older sequences from the same publisher boot; reconnect cannot make old source data fresh. On payload pressure, retain summary/completeness and supply cached pages through a bounded read-only ask; never silently trim the PR universe. Cap strings by rejecting invalid source data with a named error, not by inserting ellipsis into descriptions.

No new approval/merge/stop buttons are needed. This is observability plus the existing fork UI. A claimed overnight stop must report both desired state and observed stopped/running counts; until a structured controller observation exists, display “stop status unknown” with the last known evidence.

## Decision forks: coverage budget and home of standing rules

**Coverage fork (existing #x3qfyz4, fork 1).** A: passive local caches only, explicitly incomplete when the shared producer is absent or stale. B: one budget-limited shared producer reconciliation across three repos/all authors, with its proposed five-minute ceiling and 36 REST requests/hour allowance, pagination included. Existing lower limits and write reserves win. Those numbers are an unratified proposal from the existing card, not an authorized new spend policy. The page and publisher add no GitHub calls under either option. Ship passive cache reads now; complete coverage latency/backfill and any additional producer budget wait for this ruling. The refresh proposal must be tested against the producer's actual pagination cost before ratification.

**Policy-source fork (#x3qfyz4, fork 2).** The plan file contains conflicting snapshots: later September 29 limits differ from the older Standing rules/Overnight sections. Latest prose is not automatically authoritative machine policy. This needs an explicit ruling, not a silent parser heuristic.

- **A — Keep the external plan as the read-only source.** Publish operator-designated sections with dates, revisions and conflict warnings. Smallest change, but the instructions remain prose and can diverge from effective daemon settings.
- **B — Structured, versioned Plateau policy document; recommended eventual target.** Operator-maintained priorities/rules with explicit effective time and supersession, projected read-only in `/wip`; WE defines its shape. Import is reviewed before activation. Better provenance and machine comparison, but migration and authority must be agreed. The progress work alone does not make this document control daemons.

Slice 1 uses A as a reversible display adapter, with conflicts shown and no automatic precedence resolution. Only policy migration and any new producer refresh allowance depend on their respective rulings; slice 5 is held for the policy-source ruling. No fork is needed for progress-first ordering, existing relay reuse, or treating daemon-owned work as flow: the operator already specified those.

## Shippable slices and proof

1. **Progress-first overview using existing observations (size 5).** Define schema/examples and ship the header, moving rows, honest observed drain merges today and last-hour comparison, small human-only action list, plus read-only selected priorities/rules. Put existing machine backlog behind Flow disclosure; preserve existing decision links. Mark incomplete repo/merge coverage explicitly. Use local PR snapshots instead of new page-driven GitHub reads. This already beats the manual plan page: automatically refreshed movement and landed work next to current priorities, with age and uncertainty. It does not wait for the webhook ledger, seven-day history or policy migration.
2. **Complete running and held work (size 5).** Join builder/preparation, standalone Codex/agy, fix/ci-heal and provenance; detailed held reasons and owning system; retain unknown coverage until every producer is observed. Reuse the slice-1 envelope.
3. **Every open PR, grouped by wait (size 5).** Independent all-repo/all-author collection from local shared snapshots, precise wait grouping and human/advisory readiness; cached paging. No dependency on a new GitHub polling loop or on #4281 for the cache-based MVP. Event-ledger adaptation follows its availability.
4. **Delivery kinds and durable trends (size 5).** Per-repo merge history with verified mergedAt, immutable kind provenance, daily/hourly rollups and seven-day history. Local drain evidence remains a partial fallback. Complete all-author merged coverage depends on the PR event-ledger producer (#4281) with backfill/reconciliation; no fabricated completeness meanwhile.
5. **Health, overnight observation and ruled policy home (size 5).** Episode ownership, API ledger projection, liveness versus completed work, observed stop state and the selected policy source. Publish an explicit unknown when the current controller cannot attest to a stop. Implement the ruled source only after the decision; no daemon scheduling or policy changes in this story.

Existing #4340 owns the daemon panel/hold observations and is a prerequisite for the running/health extensions. Existing #4057 owns the Fleet panel; reconcile its scope before building the all-PR extension. Its stale/orphan-to-Needs-you routing conflicts with this operator request and must be replaced by explicit escalation routing, not copied.

Each story must carry a Design/MVP/Test/Proof plan and complete preparation before queueing. All are filed unqueued for review here; size is an estimate, not a readiness stamp. Their scopes name Plateau code even though the cards live in WE. Proposed new files are distinguished from inspected existing seams in the cards.

Acceptance cases for the build slices: operator PR with no card; two PRs on one card; same number in two repos; human review plus failed CI; draft CI failure; missing review handler; stranding false positive; active standalone job outside Claude listing; supervisor+child deduplication; stale tick with live heartbeat; shared-cache truncation; offline publisher; out-of-order delivery; duplicate merge event; missing model; ET midnight/DST; mixed merge kind; cold history; old API headers after reset; conflicting plan limits; stop requested while workers remain alive. Snapshot fixture outcomes must assert exact counts, owners and unknowns.

Product proof: phone-width rendering at 320/390px, no ellipsis/line-clamp, all PRs reachable, full descriptions visible, keyboard/focus and axe checks, and a real publisher → relay → phone-path probe with the laptop subsequently disconnected. Observe gh-spend before/after two cycles and an additional browser tab; the publisher must introduce no GitHub calls. Capture results on each card, not in shared agent documentation. Existing disclosure traits must be searched/composed before adding interactions.

Design-only verification for this change: run `node we:scripts/verify-lane.mjs` from this checkout (repo prefix denotes location, not a literal CLI argument); run the standards gate and record any environment limitation. No product code, commit, push or PR is authorized by this task.

## Filed work

- Decision #x3qfyz4 — shared PR completeness budget and rule/priority source (two forks).
- Slice 1: #xr8m6gs — Ship a progress-first Plateau overview that replaces the manual plan scoreboard.
- Slice 2: #xvmk4h4 — Show every running job and builder hold with its actual owner and executor.
- Slice 3: #xk6vumo — Show all three repos open PRs grouped by what each is waiting on.
- Slice 4: #x38a7l2 — Count confirmed deliveries by kind and show durable progress trends.
- Slice 5: #xj5krcc — Show system health API budget overnight stop evidence and the ruled policy source.

The new filing pass used `node we:scripts/operations/run.mjs file-item` with `--queue=false`; its content was then consolidated into the six overlapping card IDs already present in the working tree. Only this pass’s newly created duplicate cards were removed; existing IDs were preserved. All six remain unqueued. Dependency edges are recorded on the stories; the event-ledger dependency applies to complete delivery history, not the initial overview or cache-based PR view.
