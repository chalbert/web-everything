# Review and delivery state ledger: target product design

Research snapshot: 2026-09-30. **Proposal, not a ratification or an authority flip.** Operator request: preserve review state independently of GitHub, reduce repeated API reads, and support one company using several git hosts. This document records the checkout evidence, measurement, target, and migration. No runtime code is changed.

The ledger was partly built. The jury logbook is real; the verdict ledger is still shadow-only; operational claims are separate local stores; GitHub remains the review gate's effective authority. Finish the existing discovery work first, then move produced decisions to a durable authority. A database alone does not eliminate external-fact reads.

## Governing rules and placement

The governing references are we:docs/agent/platform-decisions.md#constellation-placement, we:docs/agent/platform-decisions.md#state-lives-where-its-nature-dictates, we:docs/agent/platform-decisions.md#operations-declared-once-callers-generated, and we:docs/agent/platform-decisions.md#event-driven-land-is-wake-only.

- **WE standard:** portable event definitions, identity and capability contracts, schema/conformance vectors. This design is preparatory; it does not mint a standard or new glossary vocabulary. Ratified definitions must be authored in the canonical spec data before implementation.
- **Frontier UI:** reusable folds, store implementations, ingestion normalization and git-host adapter implementations. Existing WE-resident runtime modules below are evidence of the current placement, not permission to add another WE runtime. Extract/reuse them; do not copy their folds.
- **Plateau product:** credential-holding service, tenant authorization, hosted database, webhook endpoints, background reconciliation/projection jobs, operations console, retention and recovery administration. The product composes the FUI substrate. A company workspace spans connections to several hosts; it is not synonymous with a GitHub organization.
- Existing WE scripts become clients/compatibility entry points. Any implementation story must resolve physical FUI/product placement in preparation; scopes below identify the current consumers, not a new permanent implementation home.

Settled direction: shared operational state at product, local process guards remaining local, an interim git transport for verdict durability, and per-arc forge ports. DO/D1 was a lean, not a ratified database selection. This proposal does not silently replace the pending git-transport implementation or the sole merge writer.

## Inventory: authoritative state versus mirrors

Paths below identify repository evidence. HOME-relative locations are runtime locations, described separately from repo paths. Environment overrides mean source defaults are not proof of a running daemon's configuration; no service deployment or private payload inspection was performed.

| State / evidence | Storage today | Authority today and gap |
| --- | --- | --- |
| Review holds and acceptance; ready-to-merge | GitHub `review:pending`, `review:changes`, `review:human`, `review:accepted`, `ready-to-merge`; we:scripts/review-set-label.mjs and we:scripts/lib/pr-merge-gate.mjs | GitHub labels drive the gate. Writers also stamp comments. Removing a label can change effective state; the verdict ledger has not replaced this. |
| Coverage and attributed clearance | GitHub comments: reviewed-sha, reviewed-diff/contribution witnesses, human clearance, escalation/park reasons; we:scripts/lib/review-escalation.mjs and we:scripts/review-set-label.mjs | Comments supply evidence the current readers reconstruct. SHA/digest coverage is not event identity. A bot marker is not independently authenticated human intent. |
| Advisory review | GitHub advisory labels and head-bound advisory comments; we:scripts/lib/advisory-labels.mjs | Latest parsed comment determines advisory freshness; labels mirror the outcome, but readers fetch both. Separate from permission to merge. |
| Round/status decoration | GitHub `review-round:N` and review status tags; we:scripts/conveyor/review-round-tag.mjs and we:scripts/conveyor/review-status-tag.mjs | Round tag is explicitly informative, derived from supplied real state. Do not import it as an authoritative jury round. |
| CI and parking | GitHub checks, draft/mergeability/closed state; derived `ci:*` labels and park comments; we:scripts/conveyor/reconcile-core.mjs | CI conclusions and merges are external facts. Labels are locally produced classifications of those facts, currently read back in discovery. |
| Jury logbook | Gitignored we:.conveyor/jury/ by default, `CONVEYOR_JURY_DIR` override; we:scripts/lib/jury-ledger.mjs | Local authority for recorded jury history. One validated append-only JSONL per subject and one shared fold; no proof every review emits it. #2966 remains open. |
| Jury event schema | we:scripts/lib/jury-core.mjs | #2654 defines roster-picked, juror-running, finding, verdict, round-advanced. #2641 supplies persistence/fold, replacing #2500's persistence while retaining per-lens verdicts. It is not a complete delivery event schema. |
| Verdict/shadow agreement ledger | HOME-level verdict-ledger directory, one JSONL per repo; `WE_VERDICT_LEDGER_DIR`; we:scripts/lib/verdict-ledger.mjs | Local shadow observation. Identity is repo + PR + append order; coverage witnesses are attributes. Lock failure can append with `unlocked:true`. Ephemeral CI writes can disappear. Current ordering must not be reversed before the authority cutover. |
| Queue | we:scripts/conveyor/queue-store.mjs; logical we:.conveyor/queue.json under pinned/state-home root, with legacy fallback | Local authority for cleared items, not a GitHub mirror. `CONVEYOR_STATE_ROOT` / `CONVEYOR_QUEUE_FILE` select the home. |
| Run scorecards | we:scripts/conveyor/run-scorecard-store.mjs; logical we:.conveyor/run-scorecards.json under machine state home | Local append-only logical history in an atomically rewritten JSON store. Provider/model/rubric keyed. Former we:scripts/conveyor/run-scorecards.json is a legacy migration input, not the current default. |
| Generic action claims | we:scripts/operations/action-store.mjs and we:scripts/operations/coordination-root.mjs; operator HOME workspace coordination directory | Per-resource attempt JSON, atomic creation, owner tokens/revisions, heartbeat and reconciliation. Local authority for action ownership; mutable records, not an immutable review history. |
| Operation runs and build dispatch | we:scripts/operations/run-store.mjs; default we:.operations/runs/; `OPERATION_RUNS_DIR` overrides | Durable local step/effect/resume state. The build launchd example pins a coordination subdirectory named `build-dispatch-runs`; daemon jobs also have a HOME-level daemon-jobs home. Do not assume all callers use one path. |
| Build/prepare claims and cooldowns | we:scripts/conveyor/build-dispatch-claim.mjs and we:skills-src/conveyor/build-dispatch-daemon.mjs | Local claims/resume records and item-prepare-dispatch-claims under coordination root. Preserve ownership/attempt semantics; not reconstructed from PR labels. |
| Fix/CI-heal ownership | we:scripts/conveyor/fix-dispatch-claim.mjs, we:scripts/conveyor/reconcile-fix-dispatch.mjs and we:scripts/conveyor/fix-procedure.mjs | Actual atomic local claim is per repo/kind/PR; current code explicitly corrects the earlier assertion that generic action-store covered every path. The fix procedure adds `conveyor fix-begin — fix claim held` / `conveyor fix-end — fix claim released` comments; the real lock is the local claim, not those GitHub markers. |
| Infra-blocked recovery | we:scripts/conveyor/infra-blocked.mjs; we:.conveyor/infra-blocked.json with override | Local authority for outage/backoff/resume intent. This module still has a checkout-root default; do not infer queue's newer state-home default applies to every store. |
| PR snapshots / already-done / PR limits | we:scripts/lib/pr-snapshot.mjs, we:scripts/readiness/already-done-cache.mjs, we:scripts/lib/pr-limit.mjs | GitHub-derived caches (TTL, mutation dirtiness, per-SHA artifacts); local PR-limit overrides are operator intent. Cache presence does not make GitHub facts locally owned. |
| Webhook wake feed | we:scripts/conveyor/pr-events-worker/core.mjs and we:scripts/conveyor/pr-events-worker/worker.mjs | Existing SQLite-backed Durable Object event table, deduplicated delivery IDs, sequence cursor; **already a hosted store implementation**, but only a bounded wake feed. 5,000 events / seven days, no complete PR projection yet. |
| Webhook consumer cursors | we:scripts/lib/pr-events.mjs; HOME-level pr-events role status files | Local cursor/health, default-off opt-in. Healthy sleep 10 minutes; feed polled every 15 seconds; stale after one hour without delivery. Events wake readers which still re-read GitHub. |
| Spend and throttle | we:scripts/lib/gh-throttle.mjs and we:scripts/lib/gh-spend.mjs; runtime calls.jsonl, hourly spend rows/cursor and admission state | Local telemetry/budget accounting, not review authority. API headers supply observed bucket counters. Invocation counts and attributed points are different measurements. |
| Work definitions and delivery artifacts | we:backlog/*.md; git branches/commits/PR refs; request transport via we:scripts/lib/git-transport-branch.mjs and we:.github/workflows/apply-review-request.yml | Git owns durable work definitions and code; host owns PR lifecycle facts. Review request transport exists; verdict ledger transport remains open #3255. Local manifests, scope leases, process locks and drain history are additional coordination/artifact evidence, not a substitute verdict authority. |

The review core (we:scripts/lib/review-core.mjs) is a pure decision library, not another persistence store. The target should unify identity and event access without conflating jury findings, clearance, action claims, run effects, telemetry and external observations.

## Backlog inventory (status read from frontmatter)

DONE means `resolved` in this checkout. A resolved decision means the call was made, not that its implementation shipped. The search covered all we:backlog/*.md bodies for ledger/logbook, state store/database/SQLite, GitLab/Bitbucket/multi-host, webhooks and rate limits; unrelated UI persistence and payment webhook cards are excluded.

| DONE | One-line result |
| --- | --- |
| #2500 | Persisted review-pipeline/per-lens ledger, succeeded by the jury logbook. |
| #2654 | Defined the five jury event types and validator. |
| #2641 | Built durable jury JSONL and shared fold/live tree. |
| #2652, #2655 | Disposition reduction and ledger-trailed roster overrides. |
| #2864 | Bound jury freshness to reviewed head. |
| #2626 | Ruled local versus shared operational state and product migration trigger. |
| #3214 | Ruled interim git transport for verdict authority; implementation is separate. |
| #3215, #3217 | Added drain-applied holds and shadow would-clear recording paths. |
| #3174 | Ruled mutation/read split and per-arc git-host ports; not a completed multi-provider product. |
| #3699 | Ruled a shared PR-state feed approach to recurring rate pressure; not completion of every webhook slice. |
| #4052, #4155 | Pinned daemon state roots and moved scorecards outside clones. |
| #4309, #4375 | Added spend reports and daemon response-header capture. |
| #4151, #4358 | Reduced agent-side wait polling; resident daemon reads still remain. |

| OPEN | One-line remaining work |
| --- | --- |
| #3007 | Verdict ledger merge authority, phase 2; phase 1 is shipped shadow recording. |
| #3255 | Implement the already-ruled durable/shared verdict git transport. |
| #3216 | Rule write-miss behavior before making the ledger authoritative. |
| #3929, #3930 | Close remaining hold-writer bypasses and retain checker history across repos. |
| #3038 | Move jury logbook to a shared durable home. |
| #2966 | Emit convergence rounds into the jury log rather than private temporary trails. |
| #2742 | Stand up the shared product operational store when the tracked trigger fires. |
| #2893 | Implement the enforce-flip predicate, CI probes, durable seam evidence and write gate. |
| #3179 | Replace forgeable human-clearance marker with ledger evidence. |
| #4281 | Derive per-PR state from webhook feed, including SHA-to-PR indexing. |
| #4282 | Move review/fix discovery and shared snapshots to that PR ledger. |
| #4283 | Let the drain consume the feed directly and lengthen healthy polling. |
| #4284 | Make labels display-only after verdict authority and shared storage are ready. |
| #3886 | Webhook-versus-polling decision remains open despite partial implementation; reconcile status at ratification. |
| #2743, #3070 | Complete direct wake/advance wiring; distinguish these from PR state storage. |
| #4086 | Multi-machine daemon placement/coordination; “multi-host” here means machines, not GitLab support. |
| #4497 | Correct throttle default-cost accounting; distinct from header-delta report estimates. |
| #3276 | Make preparation review state machine-readable. |
| #3164, #2926, #2836 | Jury type, reduce/result disagreement and source-byte hygiene gaps. |
| #4381, #4523 | Health filing-claim race and integration with the health-episode pipeline. |
| #3595 | Plateau Loop console product surface; consumer of shared state. |

No dedicated shipped GitLab/Bitbucket delivery adapter was established by this search. #3174 supplies the seam ruling; this proposal's adapter decision narrows the product delivery scope without reopening that seam.

## Spend: observed totals and inferred ownership

Probe: `node we:scripts/lib/gh-spend.mjs report --hours=6 --by=caller+op` (remove the `we:` locus when invoking from this checkout). A subsequent JSON capture near 11:44–11:46 UTC on 2026-09-30 provides the frozen table below. The earlier text run reported 42,392 points; the later capture reports 42,828 as concurrent activity continued. These are rolling report buckets, not six isolated benchmark runs.

App GraphQL: **42,828 points / six report hours = 7,138/hour**. Attributed: 28,511; estimated-without-headers: 0; unattributed: 14,317 (33.4%); seven unknown-point invocations; 4,546 invocations and 7,779 observed responses. App REST/core separately used 9,685 points; never add it to the GraphQL budget. Other identities are excluded.

| Selected caller / operation | Attributed points / six hours | What the call sites establish |
| --- | ---: | --- |
| we:scripts/pr-land.mjs `pr view` | 7,919 | Mostly repeated mergeable/mergeStateStatus in the wait loop; also labels. External-dominant, not a pure own-state read. |
| we:scripts/pr-land.mjs `pr checks` | 1,534 | External required-check conclusions. |
| we:scripts/readiness/dispatch-plan.mjs `pr list` | 5,007 | Includes already-done merged-PR searches through we:scripts/operations/dispatch-lane-io.mjs; external merge facts, reusable in a delivery index. |
| dispatch-plan / pr-land commit views | 1,810 | External commits for PR-limit classification via we:scripts/lib/pr-limit.mjs; cache by head identity. |
| we:scripts/pr-land.mjs `pr list` | 431 | PR existence/discovery, external-dominant. |
| we:skills-src/conveyor/reconcile-fix-dispatch-daemon.mjs snapshot | 3,144 | Mixed owned labels/classification and external head/check/PR state. |
| we:scripts/conveyor/parked-pr-conflict-watch.mjs snapshot | 3,119 | Mixed review disposition and external conflicts. |
| dispatch-plan snapshot | 901 | Mixed open state and labels. |
| pass / run / build / review discovery | 2,024 | 625 + 535 + 500 + 364; mixed fields and purposes. |
| All other attributed calls | 2,622 | Includes mutations, comment writes, human sessions and smaller reads; not claimed as eliminable reads. |
| Unattributed | 14,317 | Cannot assign to owned state, external facts, or mutations. |

Method: inspected we:scripts/pr-land.mjs (label read and mergeability loop), we:scripts/readiness/dispatch-plan.mjs (already-done enrichment), we:scripts/lib/pr-limit.mjs, we:scripts/lib/pr-snapshot.mjs, the review/fix daemons, advisory parser and label writer. The reporter attributes deltas of X-Ratelimit-Used; intervening bypass traffic can be charged to the next observed response. No exact per-field cost or ownership can be recovered from that telemetry.

**Planning estimate, not a measurement:** classify 16,701 points as external-dominant; the mixed discovery pool is 9,188. Assuming 25–50% of that mixed pool serves reconstruction of produced review/delivery decisions gives **2,297–4,594 points / six hours (383–766/hour, 5–11% of total)** directly reading our own state. The corresponding external-fact portion is about **21,295–23,592 (50–55% of total)**. Another 6% is the unclassified/mutation tail and 33% is unattributed. This deliberately does not label every PR-list read “our state”; some label reads inside the external-dominant bucket make this conservative. There is no observational lower bound proving the assumed 25% allocation.

The larger saving is **not re-polling external facts we have already ingested**, as well as reading owned decisions locally. Replace discovery reads with shared event-derived views, cache commit facts per SHA, and wake landing checks on changes. Preserve one fresh pre-mutation probe. To refine the estimate, instrument read purpose, requested fields, cache result, identity and actual response cost in the implementation slice; compare matched activity windows and keep unknown spend visible.

## Target product: one history, several projections

A tenant workspace has host connections, repositories and review subjects. A subject key is `(tenantId, connectionId, repositoryId, changeId)` using opaque stable IDs. Store provider kind and host instance (including enterprise/self-hosted origin) on the connection. Repo slug and PR number are display aliases. Renames update aliases; repository transfers need an authorized remapping event. Human identity mappings are explicit across hosts, never inferred from matching login text.

The append-only ledger is authoritative for **commands we accept and decisions we produce**: review requested; roster/round events; finding and disposition; human hold/clearance; dispatch intent/claim transition; park/unpark; queue admission; projection request/result. Preserve the existing jury and verdict payloads as versioned event families, with one canonical fold per family. A single logical history does not require one giant file or one table for every heartbeat. Existing action/run stores retain their operational semantics; terminal transitions reference the common subject, run and event IDs.

Proposed envelope: schemaVersion, eventId, tenant/connection/repository/subject IDs, streamSequence, eventType, actor and authentication provenance, occurredAt, receivedAt, source, sourceDeliveryId, commandId/idempotencyKey, causationId, correlationId, expectedRevision, payload, and evidence references. Coverage carries head SHA and versioned diff/contribution witnesses. Neither SHA nor content digest replaces subject/event identity. Record policy and fold versions so a replay can explain the decision at the time.

Accepted commands use authorization and expected-revision checks. Commit the event and pending projection intent atomically; acknowledge only after durable commit. A retry of the same command returns its existing event. GitHub labels/comments are outbox projections keyed by event and target, with attempt/result receipts. Projection lag is visible and does not erase a decision. Delivery is at least once with idempotent effects; do not promise exactly-once network writes.

External observations remain a distinct family: head/base changes, CI runs/check conclusions, human reviews/comments, merge/close, protection rules and permissions. Git host/CI remains the origin authority for those facts. The ledger records observations and freshness, not a claim that we now own the forge. A merge success is only recorded after observing the external result, never inferred from a sent request.

## Ingestion, reconciliation and adapter boundary

Reuse the existing signed webhook receiver and cursor protocol. Today it accepts selected pull_request, completed check_suite/check_run, and submitted/dismissed review events. It omits issue comments, pending check transitions and some draft/edit transitions; its compact records deliberately omit text and actor provenance. Therefore it cannot yet replace the comment readers or constitute a trusted human-command stream. Extend normalized facts only when required; sensitive bodies should be separately authorized evidence with bounded retention.

Durably enqueue before acknowledging ingestion. Deduplicate by connection + delivery ID; preserve receipt order separately from provider occurrence time. Out-of-order deliveries must not resurrect old heads, approvals or completed checks. Bind checks to run/check identity and SHA; check events with empty PR arrays need the SHA-to-PR index identified by #4281. Missing/ambiguous associations schedule a targeted refresh, not an optimistic green result.

Bootstrap at a captured cursor: enumerate open PRs and the bounded closed/merged history needed for already-done queries, then replay newer events with version checks. Mark completeness per repository and field. An absent record only means “not present” when coverage is complete; otherwise query the host or hold. A feed snapshot without historical merge coverage cannot replace already-done searches.

Use one budgeted reconciliation owner per connection, not every daemon's fallback storm. Proposed starting cadence: active repositories every ten minutes with jitter, inactive repositories hourly, targeted probes on cursor gaps, ambiguous ordering or imminent mutation. Tune from observed spend/freshness. Cursor gap/reset requires rebootstrap. A healthy HTTP response is not proof no event was missed; track endpoint health, cursor continuity and last successful reconciliation separately from idle delivery age.

GitHub does not automatically redeliver failed webhook deliveries, so reconciliation and explicit redelivery handling are necessary ([GitHub documentation](https://docs.github.com/en/webhooks/using-webhooks/handling-failed-webhook-deliveries)).

Keep the ratified **per-arc** ports: read/discovery; review projection; PR creation; land checks/merge. Mutations stay within their declared operation homes; read callers use the shared reader seam. Add portable event normalization and explicit capabilities (head-conditional merge, checks, review actions, label/comment projection, delivery cursors). Unsupported capability means refusal or a declared manual workflow, not invented GitHub semantics. GitHub first; GitLab and Bitbucket implementations require real provider-specific conformance evidence later. Never introduce the already-rejected monolithic ForgeProvider.

## Storage choices and tenancy

| Choice | Fit | Limitation / recommendation |
| --- | --- | --- |
| Existing JSON/JSONL files | Current shadow logs; simple export/replay; offline evidence | Keep during migration. Scattered files and fail-soft locks cannot serve distributed authority. Files are not a mandatory intermediate rewrite. |
| SQLite on one host | Local development/deployment, atomic event + outbox transaction, indexed projections | Recommended local tier. All writers use one service or database authority. Do not share a WAL file across machines; [SQLite requires WAL participants on the same host](https://www.sqlite.org/wal.html). |
| SQLite-backed Durable Objects | Existing webhook deployment substrate; serialized writes per tenant/repo stream; hosted product authority | Recommended first hosted option, pending #xhoof4g. Keep SDK details in IO shells. [Cloudflare recommends SQLite-backed new namespaces](https://developers.cloudflare.com/durable-objects/api/sqlite-storage-api/). D1 may serve rebuildable cross-repository reporting; it must not become a second write authority. |
| Hosted relational SQL (for example PostgreSQL) | Alternative for broader product queries and deployment requirements | Credible alternative, but an additional service/operations choice here. Evaluate with the same transaction, tenant isolation, restore and export probes; no benchmark advantage claimed. |
| Git transport | Already-ruled interim durable verdict home | Honor #3255 unless explicitly superseded. It preserves sharing but still couples availability and pushes to a git host; not the final host-independent product store. |

Partition streams by tenant/repository, not provider alone; scope every query, idempotency key, credential and webhook routing lookup to a tenant connection. Cross-repository company views are projections. Authorization must check both tenant membership and operation capability; connecting GitHub does not grant access to another host. Store credentials outside event payloads. Define tenant export, deletion/retention policy and evidence redaction without rewriting the logical decision trail (use explicit redaction records and controlled evidence deletion).

## Consistency and failure behavior

| Failure / conflict | Required behavior |
| --- | --- |
| Human edits an owned label on GitHub | Record attributed drift. An authorized hold requests a hold through the command policy; removing a hold or adding accepted never grants clearance alone. Unknown provenance holds the subject for reconciliation. Project canonical state after recording the attempted edit and explaining rejection; do not silently erase human intent. |
| Human requests clearance | Authenticated operation with actor/role, reason, expected revision and coverage; retain existing independence/human-review rules. GitHub may remain an input surface only through a verified command adapter. |
| Lost or reordered webhook | Detect gaps when possible, reconcile independently, invalidate affected freshness, never treat missing check data as success. Late events cannot roll current state backwards. |
| Store unavailable / append fails | No new acceptance or dispatch acknowledgement. Retain already committed history; fail closed at the authority gate. A pending local intent is not an accepted decision. Resolve #3216 before flipping. |
| GitHub unavailable / projection fails | Keep committed decision and retry outbox with bounded backoff. Show projection pending. Cannot claim external merge/check success. |
| Crash after host write before receipt | Reconcile by event marker/external effect identity before retry; a duplicate comment must not cause another decision. |
| Competing writers | Compare expected stream revision and deduplicate command IDs. Fence action claims in the store; keep process liveness checks local. This does not authorize another merge writer or a token-fenced main failover. |
| New head after acceptance | Re-evaluate existing coverage logic; stale evidence holds. Preserve exact SHA checks at merge and live checks/protection verification. |
| Corrupt tail / unknown schema | Quarantine, expose incomplete projection, stop authority for affected subjects; never interpret tolerant empty reads as clearance. |
| Disaster recovery | Back up authoritative events, outbox, identity mappings and schema versions separately from the forge. Restore to an isolated instance, replay folds, invalidate leases, reconcile external effects since checkpoint, then resume the sole writer. Preserve event IDs to deduplicate replay. Acknowledged-event loss tolerance and backup RPO must be explicit product promises; this design does not assert a zero-loss deployed service. |

The wake log's seven-day/count retention is not an audit retention policy. Durable review history needs its own retention/export contract and a tested restore. Read models and telemetry can expire independently. Backups and a database provide reliability only when recovery is exercised.

## Migration and measurable first slice

1. **Measure without moving authority.** Preserve this baseline; tag read purposes, selected caller buckets, cache hits/misses and fallback reasons. Track total App points as well as selected reads, backlog throughput, time-to-review and unknown spend.
2. **Finish #4281 and #4282.** Build PR projections on the existing feed; use them for review/fix discovery. Bootstrap/reconcile missing fields. Keep live mutation gates. No new duplicate discovery service.
3. **MVP extension #xe3xtio.** Add dispatch-plan and parked-conflict discovery consumers, covering merged-history completeness for already-done lookups. These measured list/snapshot buckets total **9,027 points/six hours** (5,007 + 901 + 3,119). Target at least **60% reduction: about 903 points/hour** at matched activity. This extends #4282 rather than reimplementing it. An open-PR-only feed cannot earn that target; the story includes historical coverage and reports misses honestly.
4. **Wake landing waits and drain.** Use #4283 plus targeted changes to the landing wait reader to avoid repeated mergeability/check polling. These are external facts, so preserve fresh pre-mutation checks. The MVP alone does not promise a fall below 5,000/hour; roughly 2,138/hour must be removed from this observed baseline, and the unattributed third must be investigated.
5. **Durable produced-state history in shadow.** Complete #3255 or explicitly supersede its transport through a ratified follow-up. Complete writer coverage (#3929, #2966), shared jury storage (#3038), human provenance (#3179), and discrepancy history (#3930). Import legacy rows with source IDs and uncertainty; never synthesize a trusted acceptance from a label. Existing stores are migrated per family, with one authority per family throughout.
6. **Flip authority only after evidence and a ruling.** Resolve #3216 and #x6qtydn, prove durable write/recovery and full writer coverage, compare shadow outcomes through the existing #3007 agreement period and enforce prerequisites. Then atomically commit decision plus outbox before projecting labels. The current shadow writer's label-first behavior is intentionally unchanged until this flip. #4284 follows; old direct writers must be disabled or routed through the command seam.
7. **Product rollout.** Resolve #xhoof4g and #x5hq3h1; migrate shared state to Plateau, keep local process locks local, demonstrate tenant isolation/export/recovery, and only then add another live git-host adapter. Rollback after authority cutover rolls back consumers while preserving ledger authority; it must not silently resurrect labels as truth.

MVP acceptance: replay duplicate/out-of-order/missing webhook cases, empty check PR associations, empty versus incomplete snapshots, human label changes, closed/merged history and stale feed; assert unchanged mutation eligibility. Run a real daemon shadow/canary with replayable captured inputs, then matched six-hour spend windows at comparable PR/tick volume. Require >=60% selected-bucket reduction, no increased REST fallback storm, no duplicate dispatch or missed eligible work, and no freshness regression beyond the chosen reconciliation bound. Expose a rollback flag and cache age; preserve live verification on every effect. Tests alone do not prove deployed savings.

## Decision and delivery cards

- #xhoof4g — unresolved storage substrate and local tier; recommends SQLite locally and SQLite-backed DO authority at product, optional derived reporting.
- #x6qtydn — source-of-truth boundary refinement: human edits, durable acknowledgements, drift and failure; coordinates with #3216, not a duplicate verdict-ledger epic.
- #x5hq3h1 — adapter product scope and portable identity; preserves #3174's per-arc ports.
- #xe3xtio — measurable discovery MVP extension, blocked by #4281/#4282. Filed unqueued because this is design work awaiting review.

All four remain open; none is ratified by this document. Existing backlog statuses were inventoried, not rewritten.
