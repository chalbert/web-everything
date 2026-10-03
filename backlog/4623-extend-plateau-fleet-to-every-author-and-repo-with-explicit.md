---
bornAs: xk6vumo
kind: epic
locus: plateau-app
status: open
blockedBy: ["4620"]
dateOpened: "2026-09-30"
preparedDate: "2026-10-01"
preparedAgainstSha: "bbc6bd0264cc3794d0f78f0c8d3dbb76ec6f92fa"
tags: []
---

# Show all three repos open PRs grouped by what each is waiting on

Coordinate the contract, passive collection, waiting-chain evidence, cached transport and phone UI slices to keep every open PR across web-everything, plateau-app and frontierui visible regardless of author, card or branch name. Show the per-PR waiting chain: current wait and reason, queue/blocker/shared file, holder and since when, next steps, and an evidence-based rough ETA. Machine waits remain flow; only explicit human work enters Needs you. The requested behavior is in we:docs/agent/plateau-progress-view.md:83–92 and its Classification section.

## Progress

The original preparation below is retained as design lineage. The split report at the end records newer source observations and the filed predecessors; its dependency wiring supersedes the earlier proposed-only split. No implementation is claimed.

Preparation inspected WE `bbc6bd0264cc3794d0f78f0c8d3dbb76ec6f92fa` and the local Plateau sibling `29db1bb1df050b7134c7aa03c241a737f83a454e`; these are source observations, not a deployed-product probe. Read the worker brief from local main. No runtime implementation or network refresh was performed.

- **Old premise:** an all-PR adapter plus view/decision edits could consume a complete waiting-chain source. **Corrected:** the current reader calls one-repo `gh pr list` and retains limited fields (we:../plateau-app/src/wip/wip-read.ts:253); the model selects the worst PR per card and clips titles (we:../plateau-app/src/wip/wip-model.ts:147–158,198). An independent repo/number collection is still needed. Searching the current WIP view found no Fleet panel; recheck #4057 on landing and extend its surface if present rather than adding a duplicate.
- **Cache evidence:** the passive store resolves its home and reads persisted JSON without GitHub (we:scripts/lib/pr-snapshot-store.mjs:42–70). The fetching owner has no author field, a 75-second TTL, and an explicit truncation flag (we:scripts/lib/pr-snapshot.mjs:39–45,94–106). Missing author must remain unknown; stale/truncated/missing repo observations cannot establish complete current coverage. Never call the refresh-on-miss accessor at we:scripts/lib/pr-snapshot.mjs:124.
- **Waiting-chain evidence:** the dispatcher already orders candidates by waiting time, human-review tie-break and PR number, then emits `queuePosition` and a reason naming blockers/shared file (we:scripts/conveyor/reconcile-fix-dispatch.mjs:1450–1485). This is an observed pass's order, not a durable global FIFO. Its CLI formatter preserves repo/PR/reason but not a separate structured queue-position field (we:skills-src/conveyor/reconcile-fix-dispatch-daemon.mjs:674–678,765–780). Do not invent a queue by sorting PR update times.
- **Holder evidence:** claims are keyed by repo/kind/PR, not head SHA (we:scripts/conveyor/fix-claim-store.mjs:30–56). Current acquisition preserves `meta.claimedAt` across live refreshes (we:scripts/conveyor/fix-dispatch-claim.mjs:122–132); heartbeat time is not start time. Read/list helpers default to including expired claims and can silently skip corrupt entries (we:scripts/conveyor/fix-claim-store.mjs:87–102). Distinguish expired/unreadable evidence from proven absence; do not treat a lease as proof of an actively working process.
- **Scope correction:** the original scope omitted wire types, CSS, source/client acceptance, dev API and paging transport tests. Add those implementation seams and a browser proof test; remove speculative decision-controller edits because this slice links existing forks rather than changing decision commands. The proposed adapter and browser test do not exist yet. This remains a Plateau implementation scope; the separate WE contract increment below must precede it.
- **Dependency drift:** #4620 is prepared but its contract half was split to 4756 (we:backlog/4620-bring-standing-rules-and-ordered-priorities-into-the-live-pl.md:20–22; we:backlog/4756-publish-the-plateau-progress-view-contract-schema-2-with-val.md:13). No progress schema files exist in this checkout or local main. Current consumers still require schema 1 (we:../plateau-app/src/wip/types.ts:184; we:../plateau-app/src/wip/wip-source.ts:37; we:../plateau-app/wip-relay.js:211). Design below targets the prepared interface, not an asserted landed contract. Keep `blockedBy: ["4620"]`; recheck the in-flight contract and #4620 before build.

## Design

### Contract dependency and per-repo split

Placement follows we:docs/agent/platform-decisions.md:143 (#constellation-placement) and :1165 (#surface-contract-not-computation). The recorded #4289 option-a split is explicit in we:backlog/4756-publish-the-plateau-progress-view-contract-schema-2-with-val.md:13. Do not dispatch mixed-locus scope or place product readers/classifiers in WE.

1. **WE predecessor, proposed, not filed here:** extend 4756's landed schema/examples/conformance test at we:contracts/plateau-progress-view.schema.json, we:contracts/plateau-progress-view.examples.json and we:contracts/plateau-progress-view.test.ts with the PR collection, waiting chain and cached-page request/response shapes described below. If the in-flight contract already includes them, verify its vectors instead of creating duplicate work. An independently useful result validates examples without Plateau and rejects malformed refs, missing freshness and inconsistent collection counts. Land this before the Plateau consumer; add its dependency before dispatch if a new card is necessary. Do not edit 4756 or #4620 in this preparation.
2. **Plateau successor, this card:** consume that revision after #4620. Its prerequisites are the schema-2 envelope (`snapshotId`, publisher boot identity, sequence, source freshness and repo coverage), shared collector/section-failure boundary, summary/actions projection, schema-1 fallback and relay/client rollout from #4620. This card adds PR rows, waiting-chain adapters, cached paging and the Flow UI. The frontmatter scope is deliberately the canonical Plateau-locus partition; all evidence paths in this body use the requested WE-relative prefix.

Proposed contract additions are design requirements, not existing symbol claims. Each PR carries full repo slug/number, URL, full description, nullable author, draft, head SHA, head-bound CI/review evidence, all wait reasons, one primary wait, handler, wait-since and source references. Its waiting chain carries current owner/reason; queue position plus blockers (PR or build/card ref, shared repo-qualified file, observation time); holder kind/identity/claimedAt/liveness; ordered conditional next steps; nullable ETA with sample count/window/method and uncertainty. Unknown data has a reason, not an invented value. A collection records known total, included count and completeness; unknown universe total is null, distinct from known cached membership.

### Passive collection and classification

Build the proposed PR adapter behind #4620's collector, shared by publisher and dev API. Read exactly the configured three repo stores via the owning resolver. Retain all rows, including operator branches, cardless PRs, unknown authors, multiple PRs for one card and duplicate numbers in different repos. Validate repo identity, fields, timestamp, count, limit and truncation beyond the store's minimal JSON guard. Preserve the last good observation with its original age on failure. Dirty markers invalidate freshness. A fresh publish never refreshes producer evidence.

The display precedence is explicit human disposition → draft author continuation → confirmed conflict → active/owed fix or ci-heal → pending/unknown CI → owed/active review → ready for drain → unknown, retaining every reason (we:docs/agent/plateau-progress-view.md, Classification section). CI/review must attest to the current head; labels alone do not certify acceptance. Do not infer merge readiness from missing CI, absence of a handler or an old green advisory. Unknown enum codes remain visible. Human-review rows retain system prerequisites and count once as pending human work, becoming actionable only when prerequisites are met. Keep existing fork links. This projection does not authorize approval, dispatch or merge.

### Waiting chain and estimates

Read bounded local daemon log tails, claim records and available run records through injected IO; resolve log locations from installed producer configuration, never assume checkout-local state. Recognize the cited repo-qualified refusal format and retain source offset/time. Parse only recognized queue reasons; an unrecognized format remains visible raw evidence with unknown structured fields. A log mtime is not a refusal timestamp. Rotation, undated text and incomplete passes invalidate claims about current order. Prefer newer trustworthy disposition over old refusal text; retain old text as historical evidence. Builds can be blockers too. Never re-run the dispatcher or query GitHub to reconstruct its queue.

Use `claimedAt` for holder age and heartbeat/lease expiry separately. Require repo/PR/session evidence for run joins; a PID or PR number alone is insufficient. A stale claim or missing handler becomes an explicit system-owned unknown, not an operator chore. Show the latest known wait and its observation age even when start time is unavailable.

Next steps are conditional descriptions of the observed route: for example overlap clears → fixer applies change → current-head CI → review → drain eligibility. They are not promises that every PR traverses every step. ETA is a display estimate only: from matching completed step records, take the median duration per needed step over a stated recent window, require at least three valid samples per estimated step, and add known serial predecessors' estimates. Report range/sample provenance; missing start/end, stale queue, cycles, insufficient samples or unknown human duration yields “ETA unknown” with reason. Never estimate from label age or claim TTL. Validate both computable and unknown ETA paths; collecting richer duration history is not a prerequisite to honestly displaying unknown today.

### Transport and phone surface

Keep #4620's 120-second collector and authenticated relay. Existing wiring is at we:../plateau-app/scripts/wip-publish.ts:73,97,104; relay payload cap and ask allowlist are at we:../plateau-app/wip-relay.js:19,287,357. Add a bounded read-only PR-page ask to that allowlist and publisher handlers, backed solely by the accepted collection. Request includes snapshot identity and opaque cursor; response includes the same identity, coverage, totals and next cursor. Bound page bytes below the relay cap. Expired snapshots return an explicit restart response; never union pages from different snapshots. Paging/offline failure preserves displayed rows and marks the remainder unreachable rather than complete. Extra tabs and page asks perform no collection refresh or agent invocation.

Render all primary groups, counts and disclosure, including empty groups, with one fully wrapped description per PR and reachable chain details. Reuse native disclosure already used by the WIP view (we:../plateau-app/src/wip/wip-view.ts:250); no custom disclosure listeners. Preserve disclosure/focus/scroll on updates. Treat title, raw reason, links and paths as untrusted text; permit safe links only and never publish absolute host paths/transcripts. CSS currently clamps descriptions (we:../plateau-app/src/wip/wip-view.css:146); remove clipping on the new flow path. No new approval/merge/stop control.

## MVP

1. Ship the validated PR contract increment first, then integrate with #4620's collector, schema-2 consumers and summary/actions. Enable publisher output only after consumers accept it.
2. Publish all locally observed PRs from three repos with honest coverage and exact repo/number identities. Replace this flow's one-repo network read with passive data; do not accidentally retain both paths. #4620's unrelated existing merged-history reader is not silently counted as this adapter's traffic.
3. For every row display current wait, owner/reason/age, queue/blocker/shared-file evidence, holder/since, conditional next steps and rough ETA or a specific unknown reason. No all-PR or complete-chain claim when inputs are partial.
4. Provide bounded cached paging, pending-versus-actionable human counts and phone-readable grouped rows. No author/card/epic filter changes global totals. Preserve existing decisions.

## Test plan

Tests use fixture state homes, injected clock/IO and network/process spies, never live claims. Expected pre-build failures are absent PR adapter/chain rows, schema-1-only acceptance and omitted cardless PRs; capture those failures rather than merely declaring them red.

- **Capability — Red today (not yet executed):** WE predecessor conformance vectors: complete and partial repo coverage, unknown totals, overlap with PR and build blockers, expired holder, known/unknown ETA, page identity/cursor and old-schema compatibility. Reject negative durations/counts, malformed repo refs, absent source freshness, included greater than known total and unknown major versions.
- Proposed adapter tests plus collector/read/model tests: exact membership for operator/cardless PR, two PRs per card and same number in three repos; unknown author; corrupt/missing/stale/dirty/truncated cache; one failing repo; last-good retention and no false zero. Assert all primary groups sum to included unique PRs. Check every precedence boundary, draft plus red CI, human review plus failed CI/advisory, unknown labels, missing handler, stale-head CI/review, and duplicate action evidence.
- **Capability — Red today (not yet executed):** Chain fixtures: the current producer refusal text, shared directory/file, build blocker, multiple predecessors, expired/reacquired claim preserving or resetting start correctly, old-head diagnostic claim, partial/rotated/undated logs, stale order, malformed line and cross-repo collisions. ETA cases include known sample medians, insufficient samples, missing endpoints, cycles and unknown human wait. Negative durations never enter samples. Assert no dispatch/refresh/API calls.
- **Capability — Red today (not yet executed):** Relay/publisher/API/live/source tests: schema-1 fallback; new fields round-trip; unknown versions rejected; older sequence ignored; reconnect/new boot; oversize payload; snapshot-bound paging union exactly equals fixture membership without duplicates; stale cursor, offline publisher and hostile cursor rejected without invoking a command. Repeat from two clients with unchanged collector-read count.
- **Capability — Red today (not yet executed):** View and hostile-input tests: full descriptions and safe links/text, all rows reachable, operator prerequisites visible without early approval, pending review/fix remain Flow, decision links unchanged, disclosure/focus preserved. Add proposed we:../plateau-app/tests/wip-progress.spec.ts for browser checks, using the repository's browser harness when building: 320/390px, keyboard traversal, visible focus, landmarks/heading order, no clipping/overflow, restrained live announcements and axe. Run focused WIP suites plus affected relay tests and Plateau's required gate; contract predecessor runs its conformance test separately.

## Proof plan

Implementation proof is outstanding; preparation does not claim a working product.

1. Save a sanitized local snapshot fixture per repo with producer timestamps and a manifest of repo/number identities. Run the real publisher → relay → same-origin browser path; compare the union of rendered/paged rows and grouped counts to that exact manifest, not to a later GitHub list. Prove partial coverage wording with a missing and a truncated repo.
2. Capture a real overlap refusal plus contemporaneous claim/run evidence. Verify the page's blocker/shared file/holder/start against those sources; then observe a subsequent pass clearing or changing the wait. If current logs cannot attest order/time, show unknown and record the producer gap rather than manufacturing a chain. Exercise the known ETA path with controlled completed-run fixtures and the real insufficient-history path as unknown.
3. Observe two 120-second publish cycles and a second tab, with process/network instrumentation and attribution from the local GitHub spend ledger. Require zero calls from this PR adapter, paging and extra tab; account separately for unrelated daemon/legacy history activity. A quiet host ledger alone is insufficient attribution proof.
4. Drive 320/390px browser screenshots, keyboard and axe checks. Load all pages, disconnect the publisher, reconnect and replay an older snapshot; confirm age/coverage remain honest and old pages never contaminate the accepted snapshot. Record commands, source identities, results and limitations on this card.

## Follow-ups

- Before dispatch, reconcile the actual 4756 contract revision and #4620 consumer interfaces; file the WE-only contract increment if missing and make it a predecessor. Preserve this card's #4620 edge. The present preparation does not claim those dependencies have landed.
- Reconcile #4057's Fleet scope at build time; preserve this operator-specified human-only routing. #4624 owns broader running/held-work projection; consume its evidence if available without making complete standalone-job discovery a hidden dependency.
- If installed producer logs lack stable pass identity/timestamps or structured blocker refs, propose a separate producer-observation contract and owner implementation. Do not expand this card into daemon scheduling, refresh spending or a new polling service. #4281 can later replace the passive cache source; it is not required for this MVP.
- Testing lesson: log mtime, claim heartbeat and PR updated time are different from wait start; snapshots are not authoritative completed-run history. Keep these regression fixtures here, not in shared agent documentation. Broader ETA history collection and producer author enrichment are separate improvements.

## Preparation verification

2026-10-01: `node we:scripts/backlog.mjs prepare-stamp 4623` wrote the preparation date and inspected WE SHA; status stays open. `node we:scripts/check-backlog-item.mjs 4623` passed without warnings; diff whitespace check passed. Required `node we:scripts/verify-lane.mjs` passed: no related executable tests for this card-only edit, followed by `npm run check:standards` with 0 errors and 4,609 repository-wide warnings. Product tests/proofs above remain future implementation acceptance, not claimed results. Only this card changed; no implementation, shared-doc edit, commit, push or PR.

## Split report — 2026-10-01

User-authorized backlog-only split after the PR-size gate refused the 26-path build. This inline report replaces a separate report artifact to honor that scope. Converted #4623 in place to an open, unsized epic; retained its #4620 blocker, goal and complete prepared Design/Test/Proof plan. All children were created through `node we:scripts/operations/run.mjs scaffold` with single-quoted values, explicit parent, scope, digest and dependency edges. Machine scope keys retain each owning repo qualifier; prose source paths use the requested WE-relative prefix.

### Investigation update

Read actual Plateau source at SHA `2a38182a53a32e12633c135dc4daecff5e5b101d`. Schema 2 now exists at we:../plateau-app/src/wip/types.ts:201, the passive count reader at we:../plateau-app/src/wip/progress-read.ts:70 and shared collection calls at we:../plateau-app/src/wip/wip-read.ts:445. The legacy open-PR fetch still exists at :409, and the model still collapses per-card PRs at we:../plateau-app/src/wip/wip-model.ts:152. No proposed PR/chain/page adapter exists yet; their homes are additions at these inspected boundaries. The existing ask injection, cached API, relay validation and view provide separate testable seams, cited on each child.

The 4756 card is resolved and its schema/examples/conformance artifacts now exist. The requested PR collection, chain and page contract still needs the filed increment below. #4620 remains open: retain it as an actual collection prerequisite, not just a prose mention. Existing CSS already wraps descriptions at we:../plateau-app/src/wip/wip-view.css:197; build probes must supersede older clamp assumptions. These are source observations, not deployed proof.

### Could split

| Story | Deliverable / size | Predicted scope | Paths / areas | Blocked by |
| --- | --- | --- | --- | --- |
| [#4892](/backlog/4892-extend-the-plateau-progress-contract-with-pr-collections-and/) | WE contract / 3 | `we:contracts/plateau-progress-view.schema.json`, `we:contracts/plateau-progress-view.examples.json`, `we:contracts/plateau-progress-view.test.ts` | 3 / 1 | None; #4756 resolved |
| [#4893](/backlog/4893-collect-and-classify-every-cached-pr-across-the-three-platea/) | Passive collection and classification / 3 | `we:../plateau-app/src/wip/types.ts`, `we:../plateau-app/src/wip/progress-prs.ts`, `we:../plateau-app/src/wip/progress-prs.test.ts`, `we:../plateau-app/src/wip/progress-read.ts`, `we:../plateau-app/src/wip/progress-read.test.ts`, `we:../plateau-app/src/wip/wip-read.ts`, `we:../plateau-app/src/wip/wip-read.test.ts`, `we:../plateau-app/src/wip/wip-model.ts`, `we:../plateau-app/src/wip/wip-model.test.ts` | 9 / 1 | #4620, #4892 |
| [#4894](/backlog/4894-enrich-plateau-pr-waits-with-local-blocker-holder-and-eta-ev/) | Waiting-chain evidence and ETA / 3 | `we:../plateau-app/src/wip/progress-prs.ts`, `we:../plateau-app/src/wip/progress-prs.test.ts`, `we:../plateau-app/src/wip/progress-waits.ts`, `we:../plateau-app/src/wip/progress-waits.test.ts`, `we:../plateau-app/src/wip/wip-read.ts`, `we:../plateau-app/src/wip/wip-read.test.ts` | 6 / 1 | #4893 |
| [#4900](/backlog/4900-serve-snapshot-bound-cached-pr-pages-through-the-plateau-rel/) | Cached page transport / 5 | `we:../plateau-app/src/wip/progress-pages.ts`, `we:../plateau-app/src/wip/progress-pages.test.ts`, `we:../plateau-app/src/wip/wip-source.ts`, `we:../plateau-app/src/wip/wip-source.test.ts`, `we:../plateau-app/src/wip/wip-live.ts`, `we:../plateau-app/src/wip/wip-live.test.ts`, `we:../plateau-app/src/wip/wip-api.ts`, `we:../plateau-app/src/wip/wip-api.test.ts`, `we:../plateau-app/src/wip/wip-publish.ts`, `we:../plateau-app/src/wip/wip-publish.test.ts`, `we:../plateau-app/src/wip/wip-agent.test.ts`, `we:../plateau-app/src/wip/wip-relay-contract.test.ts`, `we:../plateau-app/scripts/wip-publish.ts`, `we:../plateau-app/wip-relay.js`, `we:../plateau-app/scripts/wip-relay.test.mjs` | 15 / 3 | #4893 |
| [#4901](/backlog/4901-render-all-plateau-pr-waits-and-cached-pages-in-the-phone-fl/) | Phone Flow and end-to-end proof / 3 | `we:../plateau-app/src/wip/wip-view.ts`, `we:../plateau-app/src/wip/wip-view.css`, `we:../plateau-app/src/wip/wip-view.test.ts`, `we:../plateau-app/src/wip/wip-view.hostile.test.ts`, `we:../plateau-app/tests/wip-progress.spec.ts` | 5 / 2 | #4894, #4900 |

Counts include the named implementation/test touch sets; reserving one card close-out adds one path and at most one area, so the largest slice remains 16 paths / 4 areas. Re-estimation totals 17 points, replacing the original underestimated 5; no epic points remain. Exact frontmatter scopes are file-level to avoid serializing unrelated work. New files are identified as proposed on their cards rather than cited as existing.

### DAG and incremental delivery

`(4620 + 4892) → 4893; 4893 → (4894 ∥ 4900); (4894 + 4900) → 4901`. Arrows mean predecessor blocks successor. Parent edges are grouping only. #4756 is a satisfied predecessor recorded as lineage, not a stale blocker on the now-startable contract slice.

The contract delivers independently validated fixtures. Collection delivers a passive summary/actions projection and replayable full local membership with new wire fields held until consumer acceptance. Waiting evidence and transport can proceed independently on disjoint files: unknown-compatible chain data makes this safe. Transport exposes accepted cached membership through bounded read-only requests while the existing UI keeps working. The final view joins them and owns the complete browser proof. Each slice is size ≤5 and batchable once its blockers resolve; none is immediately dispatched by this split.

### Could not split

| Candidate | Failed condition | Unblocking action |
| --- | --- | --- |
| None within #4623's MVP | No unresolved design fork or uninvestigated required seam remains. | None. Richer producer timestamps/history/author enrichment remain the already-recorded Follow-ups, not hidden implementation prerequisites. |

All five split-safety conditions hold: volume rather than a design fork, five named homes, bounded re-estimated stories, independent chain/transport branches, and compatible fixture-driven intermediate states. No implementation, shared agent doc changes, commits, pushes or PRs are part of this work.
