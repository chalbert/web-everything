---
kind: story
size: 3
status: open
scope: ["we:scripts/operations/probation-heal-run.mjs", "we:scripts/operations/dispatch-lane-io.mjs", "we:scripts/operations/ci-heal-pr-dispatch.mjs", "we:scripts/lib/provider-routing.mjs", "we:scripts/lib/dispatch-contracts.mjs", "we:scripts/conveyor/ci-heal-mark.mjs", "we:scripts/operations/__tests__/probation-heal-run.test.mjs", "we:scripts/operations/__tests__/dispatch-lane-integration.test.mjs", "we:scripts/operations/__tests__/ci-heal-pr-dispatch.test.mjs", "we:scripts/lib/__tests__/provider-routing.test.mjs", "we:scripts/conveyor/__tests__/ci-heal-mark.test.mjs", "we:scripts/conveyor/__tests__/reconcile-core.test.mjs", "we:scripts/conveyor/ci-heal-owed.mjs", "we:scripts/conveyor/__tests__/ci-heal-owed.test.mjs", "we:scripts/operations/__tests__/dispatch-lane-build-wiring.test.mjs"]
dateOpened: "2026-10-01"
preparedDate: "2026-10-01"
preparedAgainstSha: "197ececcec2edbd007de7ea4b38f68b962d0e025"
tags: []
---

# CI heals routed to Antigravity die without an outcome, so a red PR is held instead of healed

Reported incident, 2026-10-01: PR #3373 had red soak-replay-gate CI and two CI-heal dispatches recorded as model=claude-sonnet-4-6, executor=antigravity, handles pid:43273 and pid:94262. The operator reported both processes gone without outcomes, a zero-of-three attempt count, and a held repair. These are incident inputs, not independently verified live observations in this preparation. Earlier quota exhaustion is a hypothesis, not an established cause. Preserve the goal: settle a heal executor that exits without an outcome as a failed attempt with diagnostic evidence, select an eligible retry outside an exhausted quota pool, and replay #3373.

## Progress

Preparation corrected the original scope of generic dispatch, provider quota holds, and dispatch unit tests:

- The probation provider launches the heal wrapper and returns a detached PID handle; it does not wait for an outcome (we:scripts/operations/dispatch-providers/probation-worker.mjs:137-165). Actual heal completion belongs to we:scripts/operations/probation-heal-run.mjs:89-101, with the completion CLI bridge at lines 233-237. A normal worker return with no diff already completes as escalated-needs-human (lines 149-169); a rejected wrapper promise only logs and sets exit code 1 (lines 331-336). Therefore “quota failure always loses completion” is not supported; exceptional wrapper exit is a concrete missing terminal-write path.
- The durable attempt count is trusted PR heal-marker comments, not a separate attempt ledger (we:scripts/conveyor/ci-heal-mark.mjs:48-69). The wrapper calls the heal marker only after a successful push (we:scripts/operations/probation-heal-run.mjs:206-210). Reconciliation reads that count and enforces its cap (we:scripts/conveyor/reconcile-core.mjs:1837-1841). Failed/no-push attempts can consequently leave the durable count unchanged.
- A dead detached wrapper past startup grace currently yields unresolved, explicitly without inferring success (we:scripts/operations/dispatch-lane-io.mjs:2609-2622). The separate dispatch guard releases confirmed absent work after its grace (we:scripts/operations/dispatch-lane.mjs:713-727); these are different mechanisms. The reported held PR requires its actual record and claim evidence, not a diagnosis from a dead PID alone.
- Quota support already exists: Antigravity persists backend-specific holds and reads active reset times (we:scripts/lib/antigravity-run-evidence.mjs:7-55); its launcher consults a hold before spawning (we:scripts/gemini-direct-task.mjs:415-429). The generic helper reads latest provider scorecard quota state (we:scripts/lib/provider-quota-hold.mjs:4-18). Probation selection currently filters/ranks by task, scope, veto, and trial history without consulting quota holds (we:scripts/lib/provider-routing.mjs:379-413). Corrected scope targets that selector and its routing boundary, reusing the existing hold reader rather than adding a competing store.
- Scope now includes wrapper, observer, PR marker accounting, routing, and their regression tests. The durable cap remains the governing contract (we:docs/agent/platform-decisions.md:5527-5528, anchor `conveyor-multi-repo-model`). No general dispatcher retry policy or new provider trust policy is proposed.

## Design

1. Give each launched CI heal an attempt identity distinct from its reusable session slug, bound to repository, PR, examined head, and dispatch record/handle. Persist the identity before starting the worker. Record terminal failure with available exit/signal, bounded diagnostics, and structured quota evidence; missing diagnostics must say unknown, never infer quota exhaustion from silence. Catch wrapper failures at the outer completion boundary. Keep successful completion semantics intact (existing boundary: we:scripts/operations/probation-heal-run.mjs:89-101,233-237,331-336).
2. Recover an orphaned CI-heal attempt only after confirming its owned wrapper is dead, startup grace has elapsed, and no matching terminal outcome exists. Make settlement repeatable and idempotent across observer ticks/restarts. Scope this to CI-heal records; preserve live/unknown liveness and ambiguous ownership refusals. A failed heal is a known unsuccessful outcome, not a successful repair or a generic effect eligible for blind replay: the observer distinguishes resolved findings from executor-level failed effects (we:scripts/operations/effect-observer.mjs:52-65,91-100). Release only the settled attempt's hold; never another repair's claim.
3. Extend durable PR attempt markers to represent failure truthfully, without saying “rebased & re-pushed” when nothing was pushed. Count trusted failure markers alongside legacy successful heal markers, deduplicated by attempt identity. Retried marker writes must not spend the cap twice; retain an owed write until durable publication is confirmed. Extend the existing owed-write mechanism to distinguish attempts, since its current key is repository/PR/kind (we:scripts/conveyor/ci-heal-owed.mjs:13-22). Never let a persistence error reopen an uncounted retry. Preserve legacy marker counting and author validation (we:scripts/conveyor/ci-heal-mark.mjs:48-79), and the existing reconciliation cap (we:scripts/conveyor/reconcile-core.mjs:1837-1841).
4. At the CI-heal routing boundary, load current quota evidence and pass availability into pure probation selection (we:scripts/operations/ci-heal-pr-dispatch.mjs:86-96; we:scripts/lib/provider-routing.mjs:379-413). Exclude active holds before ranking. Reuse backend identity/reset semantics (we:scripts/lib/antigravity-run-evidence.mjs:7-44); do not treat Antigravity Claude and Gemini as one quota pool or claim absence of a hold proves available quota. Select another otherwise-eligible provider, respecting existing scope, veto, simple-only, supervision, and cap rules. If none qualifies or evidence cannot be read safely, return a visible refusal, never silently fall through to an exhausted default.

## MVP

Deliver one bounded CI-heal path: terminal wrapper exception handling plus dead-wrapper recovery, durable failed-attempt counting, and hold-aware retry routing. Keep routing changes limited to CI heals; reuse quota evidence and completion machinery. No general effect retry engine, provider promotion, raised cap, automatic clearing of human escalations, or changes to other repair kinds.

The implementation scope above includes tests. Existing dispatch provider and quota evidence modules are grounding dependencies; only expand scope into them if necessary to carry the attempt identity or reuse evidence safely. Any such expansion must be explicit before implementation.

## Done when

- **Executable:** the regression command in Test plan fails on the pre-change tree for a confirmed dead CI-heal wrapper with no terminal write, then passes after implementation: one failed attempt is durable, its cause is visible, and the next eligible route excludes an actively held backend.
- **Must — errors:** unreadable liveness/ownership, failed durable publication, exhausted cap, or no eligible provider refuses retry visibly. A live worker is never settled by elapsed time alone.
- **Must — all inputs:** source, docs, config, data, mixed and empty scopes retain existing routing and post-worker guard checks; accounting/routing changes cannot bypass hook integrity, path/scope, diff envelope, gate, or checker requirements (we:scripts/operations/probation-heal-run.mjs:119-127,152-199).
- #3373 is replayed from captured evidence, with before/after attempt count, completion, hold and route observations. Preparation itself does not launch a heal or alter the PR.

## Test plan

Add regression cases to the scoped tests, then run from the WE root (the `we:` prefixes below identify repository paths; strip that prefix when invoking the command): `npx vitest run` with we:scripts/operations/__tests__/probation-heal-run.test.mjs, we:scripts/operations/__tests__/dispatch-lane-build-wiring.test.mjs, we:scripts/operations/__tests__/ci-heal-pr-dispatch.test.mjs, we:scripts/lib/__tests__/provider-routing.test.mjs, we:scripts/conveyor/__tests__/ci-heal-mark.test.mjs, we:scripts/conveyor/__tests__/ci-heal-owed.test.mjs, and we:scripts/conveyor/__tests__/reconcile-core.test.mjs. Run the scoped integration suite separately using `npx vitest run --config` with we:vitest.integration.config.ts and we:scripts/operations/__tests__/dispatch-lane-integration.test.mjs; the integration command is defined at we:package.json:30.

Cover wrapper exception before/after worker launch; nonzero worker with no diff; quota evidence versus unknown exit cause; confirmed dead, live, unknown, and grace-period handles; existing terminal outcome; repeated observation and duplicate marker publication; two distinct attempts sharing a session slug; legacy success comments and untrusted forged failures; cap exhaustion; failed marker write; active/expired backend holds; eligible alternative and all-candidates-held refusal. Verify a settled attempt cannot clear another attempt's claim. Include source/docs/config/data/mixed/empty scopes and unchanged critical/veto/simple-only refusals. Inject stores, clock, spawner and PR writes so tests cannot consume host quota or mutate PRs.

Run the lane gate via `node` with we:scripts/verify-lane.mjs, including `npm run check:standards`. Demonstrate the new regression failing on the baseline for the intended missing behavior, not a fixture/setup error.

## Proof plan

Before implementing, capture #3373's dispatch records, exact head/checks, trusted comments, completion rows, owned process identity, wrapper log tails and backend hold evidence. The card's incident report alone cannot establish cause. Replay those inputs through the real observer → durable accounting → reconciliation → route boundaries with injected external writes. Observe one failed attempt per launched identity, no duplicate after restart, a bounded diagnostic cause, and an eligible alternative route while the exhausted backend is held. Keep the PR red until actual repair/check evidence changes it; accounting success is not CI success.

After implementation, run an isolated process probe that launches a CI-heal-shaped wrapper and forces exit before terminal publication; observe recovery through the normal polling path. Separately exercise graceful quota failure and terminal completion. For a live #3373 replay, first verify it is still open and applicable; if it has moved or closed, retain an evidence-backed replay fixture instead of rewriting history or reopening it. Record actual observations and remaining unknowns in this card.

## Follow-ups

- Record any testing lessons here; do not append to shared agent documentation in this job.
- If captured evidence reveals a different #3373 cause, correct the diagnosis and affected scope while preserving the failed-attempt/retry goal. Do not weaken an existing safety refusal merely to reproduce the incident wording.
- General retry policy, cross-kind orphan recovery, and provider-wide quota unification are outside this story; escalate a required policy change instead of silently choosing it.
