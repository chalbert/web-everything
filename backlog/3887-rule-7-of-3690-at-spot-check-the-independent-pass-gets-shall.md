---
bornAs: xd6uqr9
kind: story
size: 3
parent: "3383"
status: open
scaffoldedBy: "design-3784-supervision"
dateScaffolded: "2026-09-22"
scope: ["we:scripts/lib/jury-core.mjs", "we:scripts/operations/review-dispatch.mjs", "we:scripts/lib/dispatch-contracts.mjs", "we:docs/agent/dispatcher-runbook.md"]
relatedTo: ["3690", "3784", "3850", "3313", "3867"]
dateOpened: "2026-09-22"
tags: [dispatch, delegation, supervision, review]
---

# Rule 7 of #3690 at spot-check: the independent pass gets shallower, never absent

Rule 7 of we:docs/agent/platform-decisions.md#delegation-trial-record-graduation says the separate independent pass keeps full coverage and moves only in depth: a full independent review at `full`, and at `spot-check` the we:docs/agent/platform-decisions.md#every-pr-gets-a-look-advisory-floor shape — one tool-free juror, one round, the diff and the item card, capped findings, non-blocking, with a finding filing a follow-up item and the floor's cost and yield measured and reported. #3850 (ratified 2026-09-22) settled the `full` half: the supervisor is the review panel on the lane's own PR, held at the land seam. Nothing yet says what a `spot-check` route gets, so today it would get whatever the ordinary escalation reasons happen to give it — which for a clean small diff is nothing. Wire the floor to the computed supervision level.

**Home:** the prototype branch `lane/mechanical-dispatcher`. we:scripts/lib/jury-core.mjs and we:scripts/operations/review-dispatch.mjs also exist on `main`; the change is made to the branch copy, which is the one that can import we:scripts/lib/dispatch-contracts.mjs (branch only). Commit straight to the branch, no PR, one tracker note on #3383 per push; it reaches `main` through #3443.

**Order:** independent of the rule-4 and rule-5 cards — it reads the computed level, not any trial field — but it lands before #3784 flips the enforcement default, because a `spot-check` route that reaches no reviewer at all is the state rule 7 exists to forbid, and the flip is what first makes `spot-check` mean anything.

**The two obligations come with it and are not optional** (#3313's own words): a finding from the floor pass **files a follow-up item**, and the floor's cost and yield are **measured and reported** to the owning program. A floor with neither decays into noise; #3313 retires such a floor under the standing auto-disable contract rather than deepening it.

**Not in this slice:** whether a vendor could ever graduate past `spot-check` to a lighter or absent check — that reopens ratified rule 7 and is filed for later as its own decision card (#3867, "do not action without the operator revisiting it"). This card implements rule 7 as ratified.

**Not in this slice either:** the `full`-route supervisor, already ruled by #3850 and built by its own children.

## Done when

1. **Executable** — `npx vitest run we:scripts/operations/__tests__/review-dispatch.test.mjs` passes with new cases that fail before: (a) a route whose recorded supervision is `spot-check` resolves a reviewer seat that is tool-free, one round, capped findings, and marked non-blocking; (b) the same route with supervision `full` resolves the #3850 panel instead; (c) no route of either level resolves zero independent seats.
2. **Executable** — on the branch, a grep of we:scripts/ shows the floor seat carries no `review:*` label and appears in no `REVIEW_HOLD_LABELS` membership — per #3313, looking and blocking stay separate, and a review that cannot park cannot cost latency.
3. **Executable** — `npx vitest run we:scripts/lib/__tests__/jury-core.test.mjs` passes with a case that fails before: a floor-depth run records its verdict and its cost (juror count, rounds, tokens or wall time) in a field a report can read.
4. **Observable** — a finding recorded by a `spot-check` floor pass files a follow-up backlog item through the declared `file-item` operation, and the item references the PR and the finding.
5. **Observable** — we:docs/agent/dispatcher-runbook.md states, in one table row per level, what independent pass each supervision level gets and who enforces it.
