---
bornAs: xlvbbat
kind: story
size: 3
parent: "3383"
status: open
scope: ["we:scripts/lib/review-escalation.mjs", "we:scripts/pr-land.mjs", "we:scripts/merge-ai-prs.mjs", "we:scripts/operations/review-pr.mjs", "we:scripts/operations/review-pr-io.mjs", "we:scripts/lib/__tests__/review-escalation.test.mjs", "we:scripts/operations/__tests__/review-pr.test.mjs"]
dateOpened: "2026-09-21"
relatedTo: ["2412", "2450", "2952", "3137", "3343", "3796", "2912"]
tags: [review, escalation, fail-closed, statute, net-diff]
---

# The review escalation fails OPEN when the net diff basis is degraded: a statute PR was auto-cleared

When the net diff cannot be resolved (basis reason ref-unresolved), the producer label, the review-pr read and the drain all score an EMPTY file list, so no escalation fires and a statute edit (PR #2420, we:docs/agent/platform-decisions.md) was auto-cleared to review:accepted. It must fail CLOSED: fall back to the GitHub API file list, and with no list at all treat the PR as needs-human with reason basis-degraded. Seams: we:scripts/lib/review-escalation.mjs, we:scripts/pr-land.mjs, we:scripts/merge-ai-prs.mjs, we:scripts/operations/review-pr.mjs.

## FOUND (2026-09-21, read in code on main at 860fc0bc; the live PR was not re-run)

**The incident.** PR #2420 ("docs(backlog): #3804 advisory follow-up ...", 9 files, one of them we:docs/agent/platform-decisions.md, the STATUTE layer) was reviewed with the banner "DEGRADED BASIS (`ref-unresolved`) ... the file list may be inflated" and "the touch-set could not be scored (no net changed-file list)". The review loop then set `review:accepted` instead of `review:human`. The orchestrator caught it only because it knew the PR touched the statute, and swapped the label back by hand before merge. Earlier that day #2407 and #2415 escalated correctly because their basis resolved.

**Why it is fail-open: the scorer is right, the EMPTY LIST is what clears.** Run against `main`:

| input to `scoreEscalation` | result |
|---|---|
| `changedFiles: []`, `diffHunks: null` (what a degraded basis hands it) | `escalate: false`, no reasons |
| the same 2 files incl. we:docs/agent/platform-decisions.md, `diffHunks: null` (an API file list) | `humanRequired: true`, statute reason `unevaluable` (whole-file fail-closed) |
| a backlog-only API file list, `diffHunks: null` | `escalate: false` (not over-escalated) |

So the design already fails closed on a statute file whose hunks it cannot read (we:scripts/lib/gate-config.mjs `statuteAnchorEditKind` at line 680 returns `unevaluable`). It cannot fail closed on a file it was never told about.

**Where the empty list comes from.** `resolveNetDiffBasis` (we:scripts/merge-ai-prs.mjs, line 2580) returns `{ok:false, reason:'ref-unresolved'}` when neither `origin/<head>` nor `<head>` resolves in the checkout that runs it. `computeNetDiffChangedFiles` then returns `changedFiles: []` with `scored: false`, and `computeNetDiffPaths` returns `paths: []`. Four seams then treat that as "nothing found":

1. **The review-pr `read` never scores at all.** we:scripts/operations/review-pr.mjs line 807 takes `humanRequired` from the PR's LABELS only (`detail.humanRequired`), and line 1748 hands that to the panel reducer. On a degraded basis `netChangedFiles` is `[]` (line 783), `assertDeclaredShapeHolds` returns `null` ("nothing to score", line 522) and `earnedShape` is `null`. A PR that reaches this step with no `review:human` label and a degraded basis has nothing that can raise the gate, so a clean panel yields `accept`. `decideSetLabel` in we:scripts/review-set-label.mjs then only refuses `accepted` when the label is already present. The GitHub API file list is already in hand on this path (`detail.diffStat`, we:scripts/review-detail.mjs line 135, the same list the review comment's "Findings" section printed) and is used for display only.
2. **The producer label (`pr-land`) has no API fallback.** we:scripts/pr-land.mjs `applyReviewEscalationLabel` (comment at lines 844 to 848, call at 881, rubric at 907) scores `computeNetDiffSignals` alone. A basis miss gives an empty list and no label; the comment says so on purpose ("a signal-fetch miss degrades to no-escalate").
3. **The drain has the fallback, but not for a double miss.** we:scripts/merge-ai-prs.mjs lines 3991 to 4002 read `gh pr view --json files` when the net basis is unscored, then swallow a failure of that read too (`catch { /* score on the manifest signals alone */ }`), which is again an empty list and no escalation.
4. **`decideReviewGate` lets an accept win before it looks at the score.** we:scripts/lib/review-escalation.mjs line 2266: `review:accepted` returns `merge` first, and the fresh score only matters if the acceptance is stale. So once an unlabelled PR is accepted on a degraded basis, no later pass re-scores it.

**Not established (the builder must reproduce it first):** whether the producer seam (2) also missed on #2420, or the `review:human` label was absent for another reason (for example the hunk-level narrowing judging that edit not a rule-body change). Also not established: why the read's basis was `ref-unresolved` at all (we:scripts/operations/review-pr-io.mjs line 249 says that path is for a head this clone has not fetched; card #3796 recorded the same open question). That root cause is a separate fix; this card is about not clearing when it happens.

## The fix

One pure function, one home: in we:scripts/lib/review-escalation.mjs, `resolveEscalationBasis({ net, apiFiles })` returns the file list to score plus a `basisState`:

- `net` when the net basis scored (today's behaviour, unchanged);
- `api-list` when it did not but a GitHub API file list is available (`gh pr view <n> --json files`, or `detail.diffStat` where the read already has it): score that list with `diffHunks: null` (so a statute path fails closed to the whole-file gate and a backlog-only list clears), and stamp `signals.basisDegraded` with the net reason;
- `none` when neither exists: `scoreEscalation` returns `humanRequired: true` with the reason `basis-degraded` and treats the PR as touching the statute layer and the gate policy.

`scoreEscalation` takes the state as one more input (default `net`, so every existing caller scores exactly as before). Then wire the four seams to it: the review-pr `read` re-scores on a degraded basis and ORs the result into `humanRequired` (and, when it is derived rather than label-sourced and the PR lacks `review:human`, makes sure the verdict routes to the sanctioned label writer instead of an accept); the `pr-land` producer; the drain's double miss; and `decideReviewGate` keeps its accept-first order but the accept path can no longer be reached with `humanRequired` derived from a degraded basis.

No decision card: the brief for this card settled the two policy questions it could have raised (an API list that clears is trusted, no list at all is needs-human), and the direction is the repo's standing one ("over-firing costs a person once; under-firing is silent", we:scripts/lib/gate-config.mjs, the header above `STATUTE_PATHS`).

## The wider class: places that read the net diff and default to "nothing found" (FOUND, not fixed here)

- **Blast-radius term.** `scoreEscalation` scores `blastRadius` over `basisFiles` (we:scripts/lib/review-escalation.mjs line 689 onwards); an empty list gives no signal, so a degraded basis under-scores blast radius exactly like the statute term. Same fix, same function.
- **Touch-set score / care level.** `assertDeclaredShapeHolds` (we:scripts/operations/review-pr.mjs line 522) returns `null` on an empty list, so an UNDER-declared care level is never refused on a degraded basis; `deriveCareLevel` scores `none` from an empty list.
- **Engine-tier gate.** `basisTouchesEngineTier(score)` (we:scripts/merge-ai-prs.mjs line 3061) reads `score.basisFiles`, so an empty list reads "no engine-tier file". Currently latent: the caller returns `false` regardless until #3493 wires it (line 3079).
- **Roster reconcile at PR open.** we:scripts/pr-land.mjs passes `rubric.basisFiles || changedFiles` to `resolveRosterReconcile`; an empty list picks no lenses and raises no human-alignment reason.
- **Claim-accuracy / citation scope.** we:scripts/operations/review-pr.mjs line 1667 sets `citationScope` to `[]` on a degraded basis, and the comment says enforcement is deliberately skipped, so a juror finding that cites a file outside the PR is not filtered on that run. This is the mildest member (it widens what a juror may cite, it does not clear a PR).
- **Checked and fail-closed, so NOT in the class:** `deriveResolutionBasis` (we:scripts/lib/review-render.mjs line 213) returns `null` on an empty list; we:scripts/review-set-label.mjs leaves `reviewedDiff` empty on an unscored basis, so the accept falls back to SHA identity, the stricter path; `shouldReparkForTestTampering` takes `netDiffScored` explicitly.

## Done when

1. **Executable** — `npx vitest run we:scripts/lib/__tests__/review-escalation.test.mjs` passes with new cases that fail today: (a) a PR whose file list includes we:docs/agent/platform-decisions.md and whose net basis is `ref-unresolved` escalates to `review:human` with the statute reason; (b) with NO file list at all it escalates with the reason `basis-degraded` and `humanRequired: true`; (c) a backlog-only PR with a degraded basis and an API file list is NOT escalated; (d) every currently passing escalation test still passes, including the default-`net` case (no `basisState` given scores exactly as before).
2. **Executable** — `npx vitest run we:scripts/operations/__tests__/review-pr.test.mjs` passes with a new case: `shapeReadFinding` on a `ref-unresolved` read whose `detail.diffStat` names we:docs/agent/platform-decisions.md returns `humanRequired: true` even though the PR carries no `review:human` label, and a clean panel does not yield an accept.
3. **Executable** — `npx vitest run we:scripts/__tests__/pr-land.test.mjs we:scripts/__tests__/merge-ai-prs.test.mjs` passes with new cases: the producer scores the API list when the net basis is unscored, and the drain's double miss (net unscored AND the `gh pr view --json files` read throws) escalates with `basis-degraded` instead of scoring an empty list.
4. **Reviewable** — the four "Where the empty list comes from" seams each name the one shared function; no seam re-derives the fallback inline. The wider-class list above is re-checked and any member found still fail-open is filed as its own card, not silently absorbed.
