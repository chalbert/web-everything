---
bornAs: xe8y12n
kind: story
size: 2
status: open
scope: ["we:scripts/conveyor/ci-heal-mark.mjs", "we:scripts/conveyor/rearm-review.mjs", "we:scripts/review-set-label.mjs", "we:skills-src/conveyor/fix-agent-ci-brief.md", "we:scripts/conveyor/reconcile-core.mjs", "we:scripts/conveyor/reconcile-pass.mjs", "we:scripts/conveyor/health-watch.mjs", "we:scripts/conveyor/health-smells/review-label-missing.mjs", "we:scripts/conveyor/__tests__/ci-heal-mark.test.mjs", "we:scripts/__tests__/review-set-label.test.mjs", "we:scripts/conveyor/__tests__/reconcile-core.test.mjs", "we:scripts/conveyor/__tests__/health-watch.test.mjs", "we:scripts/conveyor/health-smells/__tests__/review-label-missing.test.mjs", "we:scripts/conveyor/__tests__/rearm-review.test.mjs", "we:scripts/conveyor/__tests__/reconcile-pass.test.mjs"]
dateOpened: "2026-10-01"
preparedDate: "2026-10-01"
preparedAgainstSha: "026425e9e4a9c067851692c796ec0620879dabcb"
tags: []
---

# A PR with no review label after a CI heal is re-armed, never left invisible

After a successful CI-heal re-push, an open PR with a positively observed empty `review:*` family must regain `review:pending`. An open agent PR that remains without a review label across two fresh observations must surface as a health episode. Existing review dispositions remain protected; this does not approve or merge a PR.

## Progress

Preparation checked against main/HEAD `026425e9e4a9c067851692c796ec0620879dabcb` on 2026-10-01.

- **Original premise:** PR #3239 was reportedly rebased and CI-healed at 14:12 ET on 2026-10-01, then remained without any `review:*` label for 3.5+ hours. This is the filing's incident report, not a timeline independently verified during preparation. Replay its reported state without claiming the heal caused the label removal.
- **Corrected premise:** the dispatcher launches a worker and returns a handle; it does not observe completion or push the branch (we:scripts/operations/ci-heal-pr-dispatch.mjs:142-159). The brief pushes first and then invokes the completion marker (we:skills-src/conveyor/fix-agent-ci-brief.md:365-379). That marker only calls re-arm for an existing acceptance (we:scripts/conveyor/ci-heal-mark.mjs:204-223); the shared decider refuses an empty review family (we:scripts/review-set-label.mjs:343-364).
- **Observed local probe:** calling `decideSetLabel` with `to: 'rearm', currentLabels: []` returned `allowed: false`. Passing a synthetic open #3239 with empty labels/checks/comments and no agents to `planReconcile` returned no dispatch and `nothing-owed`, phase `open`. This follows the classifier fallback (we:scripts/progress-board.mjs:602-606), owed table (we:scripts/conveyor/reconcile-core.mjs:348-351), and fallback refusal (we:scripts/conveyor/reconcile-core.mjs:2082-2085). The original claim that an unlabelled PR is *never* considered again is too broad: CI-red and conflict phases precede the review-label check (we:scripts/progress-board.mjs:578-605). The confirmed gap is missing review dispatch, not universal invisibility to all repair paths.
- **Scope correction:** replace the dispatch-time fix with the post-push marker and shared label mutation boundary, plus their tests. Retain reconciliation for diagnostic visibility, and add the health IO/evaluator/tests: reconciliation is a pure per-call plan (we:scripts/conveyor/reconcile-core.mjs:1348-1354), while durable two-observation episodes belong to `stepEpisodes` (we:scripts/conveyor/health-watch-core.mjs:339-400). The existing conflict smell does not detect an empty family (we:scripts/conveyor/health-smells/review-label-conflict.mjs:30-44).
- **Policy compatibility:** preserve the ratified stale-acceptance reset and content-preserving restamp rule in we:docs/agent/platform-decisions.md:5811-5816 (`#fix-claim-verdict-reset-on-head-move`). The new empty-family case implements this card's explicit goal; it must not weaken the human hold or overwrite a concurrent verdict (we:scripts/review-set-label.mjs:346-387). Correct the brief's blanket “never touch” wording around its completion handoff (we:skills-src/conveyor/fix-agent-ci-brief.md:433-448); do not alter the governing rule.

## Design

1. **Repair at completion.** Extend the post-push handoff in we:scripts/conveyor/ci-heal-mark.mjs:204-223 with a distinct missing-family mode. Preserve its accepted-only path. Route both through the shared re-arm CLI/decider, adding an explicit `--only-if=missing` mode rather than making ordinary re-arm calls accept empty labels. The existing accepted-only flag is validated at the child's fresh-read boundary (we:scripts/conveyor/ci-heal-mark.mjs:143-155; we:scripts/review-set-label.mjs:905-923).
2. **Fail closed at mutation.** Missing-family mode requires a successful, schema-valid label read, an OPEN PR, and a live head matching the heal's pushed SHA. Re-read at the child boundary; any `review:` prefix, including an unknown label, refuses this mode. Missing/null/malformed labels are unknown, never an empty family: the current CLI normalizes absent labels to `[]`, so preserve read validity before that normalization (we:scripts/review-set-label.mjs:1017-1025). Add pending without approving; remove a stale landing signal/red-team acceptance using the existing re-arm removal rules (we:scripts/review-set-label.mjs:379-387). Preserve unrelated labels and leave the accepted-only path's guard intact. Report write/refetch failure truthfully; a healed branch may still have a failed handoff. Do not claim an atomic compare-and-swap beyond the provider's actual capabilities.
3. **Expose the gap independently.** Add a named missing-review diagnostic to the reconcile result before phase-specific early exits, without suppressing existing repair, draft, stand-down, claim or liveness decisions. The alert is orthogonal to dispatch. Agent attribution must reuse `isAiGeneratedPr`, whose existing definition requires at least one substantive commit and all substantive commits AI-authored (we:scripts/lib/ai-pr-authorship.mjs:143-148). Supply evidence from the IO shells using the existing commit fetch seam (we:scripts/lib/pr-limit.mjs:155), rather than guessing from branch names. This criterion is for diagnostics, not permission to mutate review labels.
4. **Persist health observations in the existing framework.** Add we:scripts/conveyor/health-smells/review-label-missing.mjs (proposed), using the same missing-family predicate as reconciliation. Enrich health PR rows with attribution/read-validity evidence; the current probe supplies neither commits nor label validity (we:scripts/conveyor/health-watch.mjs:518-531). Key episodes by repository and PR; use `openAfter: 2`, `closeAfter: 1`, alert-only behavior. Include open drafts in the diagnostic, while retaining their dispatch protections. A failed read is a skipped observation, not a clean observation. Reuse episode persistence/deduplication (we:scripts/conveyor/health-watch-core.mjs:339-400) and automatic smell discovery (we:scripts/conveyor/health-smells/index.mjs:10-18).

Here “longer than one tick” means two consecutive fresh successful PR observations, not two evaluations of cached data. The existing health GitHub cadence is 15 minutes (we:scripts/conveyor/health-watch.mjs:87,815); record observation timestamps in proof output. This card does not promise a two-minute alert or add another polling service.

## MVP

- Implement the explicit missing-family completion mode, fresh-head/read checks, shared mutation path, and accurate brief/comment/result wording.
- Add the reconcile diagnostic and health episode using one exported predicate in we:scripts/conveyor/reconcile-core.mjs (proposed), with attribution at the IO edges. No new dispatch kind, automatic acceptance, or blanket relabelling sweep.
- Cover the post-push CLI, label decision boundary, reconcile output, health probe enrichment, and persistent episode lifecycle in the scoped tests. No runtime implementation is part of this preparation change.

## Test plan

- Extend we:scripts/conveyor/__tests__/ci-heal-mark.test.mjs:159's real-CLI harness to demonstrate post-heal missing-family re-arm, unchanged accepted-only behavior, and truthful outcomes after read/write/budget failures. Calling the dispatcher alone must not add pending.
- Extend we:scripts/__tests__/review-set-label.test.mjs:2889-2910 with missing-mode cases: truly empty family; unrelated labels; existing pending/changes/human/accepted; unknown `review:*`; malformed/missing labels; closed/merged PR; wrong or changed head; concurrent verdict appearing at the child's read; repeated invocation. Ordinary re-arm with no verdict must still refuse. Verify stale landing/red-team labels are removed only on the permitted transition.
- Extend we:scripts/conveyor/__tests__/reconcile-core.test.mjs with the synthetic #3239 state: missing-review diagnostic, no invented fixer, and normal review eligibility after pending is applied. Cover CI-red/conflicted/draft/claimed/live/stand-down variants without changing their dispatch protections. Exercise real shell enrichment through the existing reconciliation integration harness, not only a fabricated attribution boolean.
- Add we:scripts/conveyor/health-smells/__tests__/review-label-missing.test.mjs (proposed): first sample pending, second opens one episode, later samples do not duplicate it, valid restored labels close it, restart preserves it, failures/cached reads do not advance it. Cover human/mixed/unknown authorship, unrelated labels, unknown review labels, drafts, and identical PR numbers in different repos. Extend we:scripts/conveyor/__tests__/health-watch.test.mjs to prove raw probe evidence survives normalization.
- **Must refuse on error:** failed/malformed label, head or state reads never authorize pending; partial mutation is never reported as verified success.
- **Must cover every content kind:** source, docs-only, config-only, and data-only healed PRs obey identical label/read/head guards. Content type neither bypasses the guard nor excludes a legitimate handoff.

## Proof plan

Executable regression command after adding the proposed cases: run `npx vitest run` with these repo-relative test arguments (strip `we:` when invoking): we:scripts/conveyor/__tests__/ci-heal-mark.test.mjs, we:scripts/__tests__/review-set-label.test.mjs, we:scripts/conveyor/__tests__/reconcile-core.test.mjs, we:scripts/conveyor/__tests__/health-watch.test.mjs, and we:scripts/conveyor/health-smells/__tests__/review-label-missing.test.mjs. Show the new missing-family cases failing on the preparation SHA and passing with the implementation; existing cases must remain green.

Replay the reported #3239 shape in a temporary forge/CLI fixture with a successful heal push and no review labels. Capture pushed SHA, completion result, provider read/write trace, final labels, reconcile plan and health transitions. Prove pending is restored before ordinary review selection, and withholding the label write produces exactly one health episode after two fresh samples. Use the existing real-CLI harness as the execution seam (we:scripts/conveyor/__tests__/ci-heal-mark.test.mjs:159), with fake forge IO only; do not mutate historical #3239 or present synthetic data as its actual timeline. Run `node` on we:scripts/verify-lane.mjs and `npm run check:standards` before delivery.

## Done when

1. The new executable regressions fail on the old empty-family handoff and pass after the fix; the proof includes the real completion-to-label path.
2. No existing review disposition is overwritten by missing-family recovery, and unreadable state is never treated as absence.
3. A persistently unlabelled open agent PR yields one durable health episode, with failed/cached observations excluded from the count.

## Follow-ups

- Recover the original #3239 event history separately if available; determine which writer removed the last review label. The present evidence proves the recovery gap, not that removal's cause.
- The existing authorship rubric recognizes Claude/Anthropic identities (we:scripts/lib/ai-pr-authorship.mjs:20-34). Broader vendor attribution is separate work; do not silently invent a competing definition in this detector.
- Retain the testing lesson here: probe the actual post-push completion CLI and fresh mutation boundary; a dispatcher-only unit test cannot prove a completion repair (we:scripts/operations/ci-heal-pr-dispatch.mjs:147-159).
