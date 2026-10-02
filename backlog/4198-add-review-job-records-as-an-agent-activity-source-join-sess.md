---
bornAs: x0uad06
kind: story
size: 3
parent: "3931"
status: open
blockedBy: ["3932"]
scope: ["we:scripts/operations/item-activity.mjs", "we:scripts/operations/item-activity-io.mjs", "we:scripts/operations/run.mjs", "we:scripts/operations/__tests__/item-activity.test.mjs", "we:scripts/operations/__tests__/item-activity-io-real.test.mjs", "we:scripts/operations/__tests__/run.test.mjs"]
dateOpened: "2026-09-25"
preparedDate: "2026-10-02"
preparedAgainstSha: "ec42b8635de1191cc9778a6a5aa59485ac5cef36"
tags: []
---

# Add review-job records as an agent-activity source; join sessions + jobs to a PR/card by id

Deliver a single-PR/card JSON activity query that includes review jobs alongside sessions, with lifecycle, completion outcome and transcript pointers. Reuse the review-job ingestion already present in we:scripts/operations/agent-activity-io.mjs:258-286 and the join resolver in we:scripts/operations/agent-activity.mjs:191-223. The remaining work is the item-scoped operation and evidence projection, not another job-source implementation: the existing operation accepts only `all` and `prToCard` (we:scripts/operations/agent-activity.mjs:242-254), and its projection omits transcript and outcome fields (we:scripts/operations/agent-activity.mjs:166-177).

## Progress

Preparation premise audit (2026-10-02; implementation not performed):

- **Old premise:** #3932 never enumerates detached review jobs. **Correction:** its reader already calls `listAgentsWithReviewJobs`, marks job rows and supplies their log path (we:scripts/operations/agent-activity-io.mjs:258-286). Job rows already share the session-name resolver; distinct input rows are preserved (we:scripts/operations/agent-activity.mjs:191-223). The original goal remains incomplete because the operation exposes the full listing and drops those evidence fields (we:scripts/operations/agent-activity.mjs:166-177,242-254).
- **Old scope:** two new modules and one unit suite. **Corrected scope:** retain those files and add operation registration plus CLI and real-IO tests. Registration must follow the existing reader/declaration binding at we:scripts/operations/run.mjs:273-276. Reuse the shared PR map rather than inventing a second join (we:scripts/operations/pr-ownership-io.mjs:39-61).
- **Old identity claim:** matching `review-<pr>` suffices. **Correction:** parsing includes repository tags, and the map keys are repository-qualified (we:scripts/conveyor/session-slug.mjs:27-35; we:scripts/operations/pr-ownership-io.mjs:48-59). Equal PR numbers in different repositories must remain distinct.
- **Old transcript claim:** Claude and Codex both use a Claude project transcript. **Correction:** Claude/job paths are assembled at we:scripts/operations/agent-activity-io.mjs:274-284, but Codex rows currently contain a thread id and no transcript path (we:scripts/operations/agent-activity-io.mjs:189-203). A missing provider-specific path must remain unknown, never a fabricated Claude path.
- **Old read-only wording:** dead records are pruned yet the query was described as entirely read-only. **Correction:** the shared listing removes dead-pid records (we:scripts/operations/review-job-store.mjs:108-119). Preserve that existing local cleanup; the new operation must add no dispatch, GitHub write or workflow mutation.
- **Old completion premise:** completion storage is future work. **Correction:** the store already reads and enumerates records (we:scripts/operations/completion-store.mjs:138,240-246); records contain outcome, run id, session id and timestamps (we:scripts/operations/completion-record.mjs:83-97). Reuse these with incarnation checks, not slug-only attribution.

## Design

These are implementation requirements for the remaining slice, grounded in the existing seams above:

1. Add a declared `item-activity` operation in we:scripts/operations/item-activity.mjs (new), with an injected reader in we:scripts/operations/item-activity-io.mjs (new). Register it in we:scripts/operations/run.mjs beside the existing binding at line 273. Follow the compute-only declaration pattern at we:scripts/operations/agent-activity.mjs:230-254; use the normal CLI JSON envelope, with the filtered result under `verdict`.
2. Require exactly one selector: positive integer `pr`, or a card id (numeric or existing hash form). Reject missing, both, and malformed selectors. `repo` defaults to `we` for a PR query; support canonical constellation keys through we:scripts/lib/constellation-repos.mjs:33-35. A card query covers all constellation repositories. The result is `{runs, gaps}`; a successful no-match is `runs: []`, while unavailable required PR metadata is an explicit error/gap, not proof of no activity.
3. Assemble source rows with `createAgentActivityReader`, then resolve all rows before filtering so parent inheritance still works (we:scripts/operations/agent-activity.mjs:184-211). Fetch PR metadata through injected read-only IO: view the requested PR, or list candidate PRs for a card and view additional PR identities encountered in source/completion rows as needed. Build the map with `buildPrToCardMap` (we:scripts/operations/pr-ownership-io.mjs:53-61). Use repository keys internally and the constellation mapping for GitHub slugs (we:scripts/lib/constellation-repos.mjs:4-10). Allow supplied map/metadata fixtures without network calls. Do not invoke reconciliation or dispatch to obtain this map.
4. Project the existing run identity, role, join reason, PR/card, state and timestamps, then attach source evidence by row id. Preserve multiple runs for the same item, including concurrent fixer and review rows. Do not change the shared resolver's output contract just for this consumer (current projection: we:scripts/operations/agent-activity.mjs:166-177). Carry `transcriptPath` for Claude and job rows; derive `lastEventAt` and transcript age from a successful file stat, otherwise return null with an evidence gap. File mtime is activity evidence, not a success verdict. Preserve the existing role vocabulary, including `inspect` (we:scripts/operations/agent-activity.mjs:52-54).
5. Include terminal completion records so a finished job remains queryable after its live record disappears. Reuse the completion-store readers and schema cited above. Match repository/slug and incarnation: reject foreign session ids with the existing predicate (we:scripts/operations/completion-record.mjs:140-157), and reject completions older than the observed start of a new same-slug run. Keep terminal status distinct from liveness; missing/invalid evidence yields a null outcome and a gap. Emit one row for a matched live/completion incarnation, not duplicate rows. The store is latest-per-slug, so this is not an exhaustive attempt-history API (we:scripts/operations/completion-store.mjs:54-57).
6. Expose the job log as the primary review transcript using `jobLogPath` (we:scripts/operations/review-job-store.mjs:40-41). Include available nested juror pointers from associated operation-run evidence: telemetry supports `sessionId`, `lens` and `transcriptFile` (we:scripts/operations/run-record.mjs:124), and Claude judge ids derive from run id plus lens (we:scripts/lib/judge-spawn.mjs:780-793). Read the configured run store (we:scripts/operations/run-store.mjs:55-58), use recorded paths/identities, and verify existence before advertising a readable file. Unknown run linkage or unavailable transcripts must be explicit gaps. Codex pointers must resolve from native provider evidence, never by reinterpreting a thread id as a Claude session id (we:scripts/operations/agent-activity-io.mjs:199-203).

## MVP

Ship the selector validation, shared-source/map reuse, filtered projection, completion-incarnation join, primary transcript pointer and available nested juror pointers together. New implementation and tests are limited to the declared scope. Existing stores, resolver, slug parser and PR-map helper are dependencies to consume, not rewrite. Live UI, streaming, transcript-content introspection and exhaustive attempt history are outside this slice. The foundation's current full-listing contract remains at we:scripts/operations/agent-activity.mjs:242-254.

## Test plan

- In new we:scripts/operations/__tests__/item-activity.test.mjs, cover PR and card selection; both/neither/invalid selectors; successful empty match; live review plus fixer as two rows; same PR number in different repositories; unmapped PR retained for PR selection; direct card sessions and parent inheritance. Exercise actual `resolveAgentActivity`, not a stub of its expected output (we:scripts/operations/agent-activity.mjs:191).
- Cover completion-only finished runs, live/completion deduplication, a reused slug with an older completion, foreign session ids, absent/invalid records, unknown outcomes and truthful evidence gaps. Use the real completion record schema (we:scripts/operations/completion-record.mjs:78-97).
- In new we:scripts/operations/__tests__/item-activity-io-real.test.mjs, create temporary real job records/logs, completion/run records and session transcripts. Verify a live pid is included and a dead pid is pruned through the real store, log stat/path resolution, missing files and native-provider evidence. Retain the store's existing behavior tested at we:scripts/operations/__tests__/review-job.test.mjs:102-134. Inject process/network boundaries and temporary store roots so tests never enumerate or prune resident jobs.
- Extend we:scripts/operations/__tests__/run.test.mjs for registration, parsed selectors, invalid input and the actual JSON envelope. Exercise IO metadata failure separately from a valid empty response. Ensure no effect sink or dispatch is invoked.
- Run these affected suites plus existing we:scripts/operations/__tests__/agent-activity.test.mjs and we:scripts/operations/__tests__/review-job.test.mjs, then `npm run check:standards` and `node we:scripts/verify-lane.mjs` (strip the documentation-only `we:` locus when executing repo-relative commands).

## Proof plan

For implementation acceptance, observe an already-running review job and its actual PR/card metadata; do not launch a review merely to exercise this read. Run `node we:scripts/operations/run.mjs item-activity --pr=<n> --repo=we --json`, then the corresponding `--card=<id> --json` query. Capture commands, selected identities and returned JSON. Verify the review row has `role: review`, state/start time, the expected PR/card join and a primary pointer resolving to a real non-empty job log. Verify any returned nested juror pointers on disk; record unavailable evidence explicitly. If a fixer is concurrently active, prove both rows survive. After natural completion, repeat the query and compare its outcome with the actual completion record, ensuring it no longer appears live. Also demonstrate an empty valid query and cross-repository disambiguation. If no live job is available, report live proof pending; fixture success alone does not fulfill this criterion. Primary log and completion evidence come from we:scripts/operations/review-job-store.mjs:40-41 and we:scripts/operations/completion-store.mjs:138.

## Done when

The declared CLI returns only the selected PR/card's runs, with repository-safe joins, concurrent runs preserved, completion-incarnation checks and truthful transcript evidence; all Test plan cases pass and the real-job Proof plan is recorded. No second review-job ingestion mechanism is introduced: the existing source remains we:scripts/operations/agent-activity-io.mjs:258.

## Follow-ups

- Keep test lessons here: isolate all store roots and test actual filesystem evidence, because listing already performs dead-record cleanup (we:scripts/operations/review-job-store.mjs:116). No shared agent-document edits are needed for this slice.
- A full historical attempt index is separate work: the current completion path is keyed only by slug (we:scripts/operations/completion-store.mjs:55-57).
- Record any missing producer linkage discovered during nested-juror proof as a follow-up; do not manufacture paths or silently claim complete transcript coverage. The current Codex activity row has no native path (we:scripts/operations/agent-activity-io.mjs:199-203), while operation telemetry can carry one (we:scripts/operations/run-record.mjs:124).
