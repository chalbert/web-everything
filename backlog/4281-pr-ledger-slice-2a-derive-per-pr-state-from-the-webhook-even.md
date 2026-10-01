---
bornAs: x0lxgal
kind: story
size: 5
parent: "4075"
status: open
scope:
  - we:scripts/conveyor/pr-events-worker/core.mjs
  - we:scripts/conveyor/pr-events-worker/worker.mjs
  - we:scripts/conveyor/pr-events-worker/bootstrap.mjs
  - we:scripts/conveyor/pr-events-worker/wrangler.toml
  - we:scripts/conveyor/pr-events-worker/__tests__/core.test.mjs
  - we:scripts/conveyor/pr-events-worker/__tests__/replay.test.mjs
  - we:scripts/conveyor/pr-events-worker/__tests__/worker.test.mjs
  - we:scripts/conveyor/pr-events-worker/__tests__/bootstrap.test.mjs
dateOpened: "2026-09-27"
preparedDate: "2026-10-01"
preparedAgainstSha: "1e4425d3d9e32aa10a7168c775b3882833d0ee99"
tags: []
relatedTo: ["3007", "3038"]
---

# PR ledger slice 2a: derive per-PR state from the webhook event feed

Fold the webhook feed into persistent per-PR state in the existing Durable Object: head SHA, draft, labels, latest check conclusion per name per SHA, latest review observation, merged/closed. Add read-token-authenticated `GET /prs` returning state and event deltas on the existing sequence. Handle empty check-event PR arrays through a repo-qualified SHA-to-PR index and seed existing open PRs with one first-deploy `gh pr list` invocation per repo.

This remains a substrate for [#3007](/backlog/3007-make-the-review-verdict-ledger-the-merge-authority-labels-be/) and [#3038](/backlog/3038-promote-the-jury-ledger-from-a-working-tree-sidecar-to-a-sha/), not their authority flip or store migration. Plateau #4621 is a downstream consumer with additional history requirements; see Follow-ups.

## Progress

Premise checked against checkout `1e4425d3d9e32aa10a7168c775b3882833d0ee99`; preparation brief read from local `main` at we:skills-src/conveyor/prepare-item-worker-brief.md:1–23. No implementation is part of this preparation.

- **Old premise:** folding the compact log supplies the requested PR state. **Correction:** the parser records draft only when true, captures label deltas rather than a label snapshot, and accepts no `converted_to_draft` action (we:scripts/conveyor/pr-events-worker/core.mjs:29–34, :85–103). Additive parsing changes are required; absent legacy fields must remain unknown, not become false/empty. Source probe: authenticated `GET /prs` returned 404 and parsing `converted_to_draft` returned null; current routing ends after `/events` (we:scripts/conveyor/pr-events-worker/core.mjs:200–213).
- **Old premise:** empty check PR arrays were seen in real webhook traffic for #2708. **Correction:** the fixture is reconstructed from a real REST timeline; it explicitly says empty arrays came from REST after merge/branch deletion and earlier SHAs were unrecoverable (we:scripts/conveyor/pr-events-worker/__tests__/pr-2708-replay.fixture.mjs:1–5). It supports a regression scenario, not a claim about captured deliveries.
- **Old scope:** core, Worker shell, and core tests only. **Correction:** add bootstrap CLI and tests, SQL-shell persistence tests, replay assertions, and binding documentation. Those new CLI/test files are proposed. The existing SQL adapter owns only events/meta and the Object exposes append/touch/read, with one global object across repos (we:scripts/conveyor/pr-events-worker/worker.mjs:16–44). Existing replay tests exercise memory storage, not Durable Object persistence (we:scripts/conveyor/pr-events-worker/__tests__/replay.test.mjs:14–27).
- **Retention constraint:** count/age pruning removes event rows, and delivery deduplication searches those same rows (we:scripts/conveyor/pr-events-worker/core.mjs:117–125; we:scripts/conveyor/pr-events-worker/worker.mjs:23–27). A retained event log alone cannot reconstruct durable state after pruning. Current cursor reset/gap/page semantics must remain compatible (we:scripts/conveyor/pr-events-worker/core.mjs:130–145).
- **Downstream boundary:** #4621 already requires checking this producer and filing a separate follow-up if merge instants, kind evidence or historical coverage remain missing (we:backlog/4621-count-plateau-deliveries-today-by-explicit-merge-intent.md:24, :45). This card does not promise those fields or complete merge history.

## Design

The following is the proposed implementation contract; current extension seams are cited above.

1. **Pure fold, durable projection.** Keep parsing/folding/storage interfaces in we:scripts/conveyor/pr-events-worker/core.mjs and SQLite/Cloudflare calls in we:scripts/conveyor/pr-events-worker/worker.mjs, following we:docs/agent/platform-decisions.md#state-lives-where-its-nature-dictates (vendor shell rule at :3667–3673). Key PR rows by repository full name plus number; key check observations by repository, SHA and check name. Store suite conclusions separately by app so suite events cannot overwrite named runs. Store latest review observation with its SHA and sequence; it is not GitHub's aggregate review decision or a conveyor verdict.
2. **Explicit observed state.** Extend compact PR records with explicit boolean draft, supplied label-name snapshots and lifecycle state; accept `converted_to_draft`. Preserve existing delta fields for `/events` consumers. Missing legacy fields do not clear known values. Fold accepted observations in append-sequence order, recording each row's last sequence. Lifecycle events alone change the PR head/lifecycle; an old-SHA check/review must never replace the current head. Closing distinguishes merged from closed-unmerged; reopening clears closed state. No title, body or login storage (existing privacy test: we:scripts/conveyor/pr-events-worker/__tests__/core.test.mjs:44–51). This is latest received evidence, not a guarantee against upstream out-of-order deliveries.
3. **SHA association.** Persist `(repo, SHA) → set of PR numbers` from PR lifecycle events and bootstrap. Retain prior-head associations so late checks remain attached to their own SHA. Empty check PR arrays use only that repo's index; multiple PRs sharing a SHA all receive the observation. Store unmatched checks by repo/SHA and attach them when a matching PR arrives; never guess a PR or join across repos. Retention of the event feed must not erase projection/index rows. Unknown SHAs remain unknown.
4. **Atomic mutation and restart.** Insert event, advance sequence, update projection/index and prune in one SQLite transaction; duplicate retained deliveries do not fold twice. New tables initialize additively inside the existing Object, without replacing its identity or resetting its head (current constructor and routing: we:scripts/conveyor/pr-events-worker/worker.mjs:31–44). On upgrade, replay retained records once with a durable projection-version marker; expose partial coverage because earlier events may already be gone. Preserve the existing bounded delivery-deduplication window; do not promise unlimited exactly-once delivery.
5. **One read, two explicit positions.** Add `GET /prs?cursor=N&limit=L` using the same fail-closed read-token check as `/events` (we:scripts/conveyor/pr-events-worker/core.mjs:200–210). Return the existing event envelope plus `prs`, `stateCursor` and coverage metadata in one Object read. `cursor` continues to mark the returned delta page; `stateCursor = head` marks the full current projection. A paged response can therefore have `cursor < stateCursor`; readers must not apply those older deltas over the snapshot. Missing/invalid/future cursors reset deltas but still return the snapshot; gaps are explicit and never imply complete history. Leave `/events` unchanged. Coverage identifies observed-since sequence, retained replay boundary and per-repo bootstrap status; unknown fields remain nullable.
6. **First-deploy bootstrap.** Proposed we:scripts/conveyor/pr-events-worker/bootstrap.mjs runs outside the Worker with operator GitHub credentials. One explicit `gh pr list --repo … --state open --limit … --json number,headRefOid,isDraft,labels,state` invocation per configured repo supplies a baseline; hitting the chosen limit is marked potentially truncated, never complete. Capture the ledger cursor before listing. Import through proposed `POST /prs/bootstrap`, protected by a separate `PR_EVENTS_BOOTSTRAP_TOKEN` binding documented in we:scripts/conveyor/pr-events-worker/wrangler.toml; neither read token nor webhook secret grants this write. Validate compact input and repo identity, use an idempotent import ID, and append seed records on the same sequence. Seed only fields without a newer observation than the captured cursor, so a concurrent close/synchronize/label change wins. Failed/truncated runs retain an explicit incomplete status and can be retried deliberately; no scheduled GitHub polling is added. Checks/reviews absent from this baseline remain unknown until observed. Closed-before-bootstrap PRs are outside baseline coverage.

The wake-only rule remains intact: this endpoint does not merge, write labels, replace the drain's authority, or migrate verdict/jury ledgers (we:docs/agent/platform-decisions.md#event-driven-land-is-wake-only, :3730; existing consumer contract at we:scripts/lib/pr-events.mjs:10–17).

## MVP

Implement the six clauses above within the declared scope: additive compact fields and pure projection, persistent SQL rows/index, authenticated snapshot-plus-delta route, one-time upgrade replay, explicit coverage, and an operator-run seed CLI. Keep the #2708 fixture's original provenance and null SHAs; add synthetic cases in tests rather than inventing missing historical data. No Plateau adapter, merge gate, daemon polling change, historical reconciliation or live deployment is included in this build slice. Adding SQL tables requires no new Object class; retain the existing binding/migration identity (we:scripts/conveyor/pr-events-worker/wrangler.toml:19–26).

## Test plan

- Extend we:scripts/conveyor/pr-events-worker/__tests__/core.test.mjs: draft true→false→true; labels snapshot/delta; missing legacy fields; head changes; close/merge/reopen; same-name checks on two SHAs; suite/run separation; review submission/dismissal; empty/multiple PR arrays; late association; null SHA; same SHA and PR number in different repos; duplicate deliveries and pruning. Preserve privacy and `/events` cursor/auth tests (existing cases at :44–69 and :73–99).
- Add snapshot/delta HTTP cases there: no/invalid/future cursor, gap, pagination with `cursor < stateCursor`, bad/missing read token and missing binding; read credentials cannot seed. Assert complete response shape and unknown/coverage semantics, not just status 200.
- Extend we:scripts/conveyor/pr-events-worker/__tests__/replay.test.mjs to assert #2708's merged state, label fold and check association, plus unchanged daemon wake behavior. Existing signed-delivery harness and full redelivery cases are at :14–51; wake assertions are at :71–91.
- Proposed we:scripts/conveyor/pr-events-worker/__tests__/worker.test.mjs must exercise actual SQLite-backed Object behavior in a local Worker runtime: restart with same storage, additive upgrade from events/meta-only storage, pruning, atomic rollback under injected projection failure, and one-read snapshot/delta consistency. A memory-only mock cannot establish these properties.
- Proposed we:scripts/conveyor/pr-events-worker/__tests__/bootstrap.test.mjs uses injected process/HTTP boundaries: one list invocation per repo, strict compact-field mapping, limit saturation, command/import failure, wrong write token, retry/idempotency, and a close/head/label webhook between list start and import. Assert baseline cannot revive a closed PR or erase newer state. Never require live credentials in the unit suite.

## Proof plan

1. **Before/after executable:** run the worker-directory suite with `npx vitest run we:scripts/conveyor/pr-events-worker/__tests__/` (resolve the `we:` prefix to this checkout before invoking). First add the `/prs` signed-delivery/read assertion: it must fail against the current 404 route, then pass with the implementation. Existing tests alone passing is not proof of this feature.
2. **Storage proof:** run a local Worker with persistent test storage, submit signed lifecycle/check/review fixtures, read authenticated `/prs`, restart, and compare state and cursor. Force count/age pruning, then show snapshot state survives while old cursors report a gap. Exercise the seed CLI against a fake `gh` executable and the running local endpoint; record the concurrency and retry results. Keep commands, expected/actual JSON and exit codes with the implementation review evidence, excluding tokens.
3. Run `node we:scripts/verify-lane.mjs` from the checkout after resolving the repo prefix; it must finish green, including standards checks. Preserve existing event-client regression coverage in we:scripts/lib/__tests__/pr-events.test.mjs (read-only regression target outside implementation scope).
4. Deployment remains a separate operator step (we:scripts/conveyor/pr-events-worker/wrangler.toml:8–12). Do not describe local tests as deployed proof. After deployment, its owner must verify authentication, bootstrap coverage and a real delivery before any consumer relies on this projection.

## Done when

All MVP state transitions, SHA association, durable restart/pruning, bootstrap races and the snapshot/delta contract pass the tests above; the executable fails before and passes after; `/events` clients still pass; coverage explicitly excludes unavailable history. This card's completion supplies observed PR state, not merge authorization or complete delivery counts.

## Follow-ups

- Plateau #4621 must inspect the shipped contract before queueing its successor. Actual merge instants/SHA, available kind evidence, bounded historical coverage and reconciliation belong in the separate producer follow-up it already calls for (we:backlog/4621-count-plateau-deliveries-today-by-explicit-merge-intent.md:45, :67); do not infer delivery timestamps from receipt-time `at` (we:scripts/conveyor/pr-events-worker/core.mjs:83, :89). Retain partial operation until that seam is proven.
- #3007's authority flip and #3038's shared jury store remain separate work; this observational projection does not settle their policy or storage decisions.
- Track durable-state retention/compaction, unlimited delivery deduplication and upstream out-of-order reconciliation separately if needed. This slice preserves observed sequence order and makes no historical-completeness claim.
- Testing lesson for implementation: the current replay harness proves the pure core and daemon client together, not SQL persistence (we:scripts/conveyor/pr-events-worker/__tests__/replay.test.mjs:14–27). Record local-runtime setup and actual evidence in this card/review; do not append shared agent documentation as part of this job.
