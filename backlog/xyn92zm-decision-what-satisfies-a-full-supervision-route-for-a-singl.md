---
kind: decision
parent: "3383"
status: open
scope: ["we:scripts/lib/dispatch-contracts.mjs", "we:scripts/operations/deliver-item-wrapper.mjs", "we:scripts/operations/fix-dispatch-wrapper.mjs", "we:scripts/operations/dispatch-lane.mjs"]
relatedTo: ["3784", "3801", "3690", "3717", "3313"]
dateOpened: "2026-09-21"
preparedDate: "2026-09-21"
preparedAgainstSha: "70452a2f44e60fc0cf4b2e6476a50909842f5729"
tags: []
---

# Decision: what satisfies a full supervision route for a single-worker lane, before dispatch supervision enforcement is switched on

Rule the one point #3801 Fork 1 carried into #3784: a dispatch-lane launch of build, fix or ci-heal is one worker, and every such route is full today, but no route names a supervisor, so enforcement as built holds every code-change dispatch. The ratified statute (we:docs/agent/platform-decisions.md#delegation-trial-record-graduation, rule 7) says a full route gets a full independent review. This card rules what counts as that review for a single-worker lane, where it is checked, and which routes it binds.

*Prepared 2026-09-21 (session slice-3717-after-ruling), from the #3801 ruling, #3784's findings and the ratified statute. No research topic: the question is internal to this repo's review path, and every citation below was read on the prototype tip `5ab89f87b` (`git show origin/lane/mechanical-dispatcher:<path>`; `we:scripts/lib/dispatch-contracts.mjs` and the two wrappers exist only there).*

## Why this is on the critical path

#3801's ruling (Fork 1, "Carried") says what satisfies a `full` route for a single-worker lane "must be ruled before enforcement is switched on". #3784 is the card that switches enforcement on, so it is `blockedBy` this card. Delegation is the operator's first stated goal, and supervision enforcement is what makes a delegated route safe to execute.

## FOUND (checked 2026-09-21 on `5ab89f87b`)

- **The hold.** `supervisionHold` (`we:scripts/lib/dispatch-contracts.mjs:714-721`) returns a hold for a `full` route that names no `supervisor`, and `decideDispatchRoute` never sets one. With `WE_DISPATCH_SUPERVISION_ENFORCE=1`, every `build`, `fix` and `ci-heal` dispatch is held (the #3801 prep reproduced it on a size-2 `build`).
- **One worker, no supervisor role.** A `dispatch-lane` launch starts one worker that writes the whole card (#3801 Fork 1 (a), ratified). The only supervisor the contract knows is a `build-supervisor` chosen by `selectSupervisor` (`we:scripts/lib/dispatch-contracts.mjs:583`) at the story stage, which no caller uses; #3801 rejected routing a single worker that way (Fork 1 (c)).
- **What review a build lane's PR gets today.** After the agent, the delivery wrapper runs converge (a panel plus a Claude editor in the same lane, `we:scripts/operations/deliver-item-wrapper.mjs:384-391`), then `decideParkMode` (`:1758-1774`) picks the PR mode: `park` with a `review:*` label for a statute path, a needs-human outcome, a converge escalation or an escalation score, otherwise `label-on-green`, which lands on a green gate. Only the three `REVIEW_HOLD_LABELS` (`review:pending`, `review:changes`, `review:human`; `we:scripts/lib/review-escalation.mjs:1676`) hold a merge. So a delegated build whose PR trips no escalation reason reaches `main` with no blocking independent review.
- **A fix or ci-heal pushes onto an existing PR.** `we:scripts/operations/fix-dispatch-wrapper.mjs` updates the bounced PR in place (`pushLaneRef`, `:579`); it does not open a new one.
- **What the statute already fixes.** Rule 7: at every level the orchestrator reads the diff and runs the close-out gate itself; the separate independent pass is "a full independent review at `full`", and at `spot-check` the one-juror advisory shape of `#every-pr-gets-a-look-advisory-floor`. Rule 6: with no ratified promotion act, a triple stays at `full`. Any provider may fill the reviewer seat.

## Recommended path at a glance

| Fork | Default | Main alternative, and why it is excluded |
| --- | --- | --- |
| 1 — what counts as the full independent review for a single-worker lane | **(a) the review panel on the lane's own PR, as a merge hold: the dispatch records it as the supervisor, and the PR cannot land without `review:accepted`** | (b) the in-lane converge pass: its editor changes the diff it judges, so it is not independent |
| 2 — which routes the requirement binds | **(a) every route whose executed vendor is not Claude (a delegated run)** | (b) every `full` route, Claude included: re-rules the review policy of native work, which the delegation statute does not govern |

## Supported by default — not forks

- **Promotion stays operator-only (rule 6)** and the promotion record is #3784's design point 2. Nothing here promotes a triple.
- **The `spot-check` shape is already ruled** by rule 7 (the advisory floor). This card rules `full` only.
- **Enforcement stays off until #3784 flips it.** This card rules what the gate checks, not when it turns on.
- **The trial row records a Claude converge edit** (#3801 Settled by statute), whatever this card rules.

## Fork 1 — What counts as the full independent review for a single-worker lane

*Fork-existence:* the gate must accept some named check as the supervision a `full` route requires, or it holds every code-change dispatch forever (FOUND). Two different checks can each be called "the review", and the gate can read only one rule.

- **(a) The review panel on the lane's own PR, as a merge hold — recommended.** The dispatch records the supervisor as that PR review (so `supervisionHold` no longer holds it), and the obligation moves to land: the PR of a `full` route opens parked `review:pending` whatever its escalation score, and cannot land until the review panel records `review:accepted`. For a `fix` or `ci-heal`, which pushes onto an existing PR, the same hold applies to that PR after the push. This is the "full independent review at `full`" rule 7 names: fresh validators who did not write the diff, as `#agent-convergence-independent-validation` requires, and it already exists as the parked path of today's review flow. Any provider may sit in the seat, a different one from the builder preferred. **Delegation trials:** the panel's verdict is the independent result the trial row is scored against. **Supervision:** at `spot-check` the PR takes the advisory floor instead, per rule 7.
- **(b) The in-lane converge pass counts as the review.** Rejected on merit: converge's editor is Claude writing in the same lane after the agent (`we:scripts/operations/deliver-item-wrapper.mjs:384-391`), so the panel judges a diff its own loop changed, which is peer agreement, not independent validation. Its verdict also does not hold a merge (`decideParkMode` can still return `label-on-green`).
- **(c) A live supervising agent per lane (the story-stage `build-supervisor`).** Rejected on merit: nobody plays that role on this path, and #3801 Fork 1 (c) already rejected routing a single worker as a supervisor. It becomes right only with the planner build (G2, #3801 follow-up 1), which would file its own decision.
- **(d) The rule-7 floor alone (the gate plus a diff read).** Rejected on merit: the floor is what every level gets, so `full` would mean no more than `spot-check`, and rule 7 names a separate full review at `full`.

**Skeptic:** SURVIVES-WITH-AMENDMENT → applied (one self-review pass). Attack: "the review is post-hoc, so it is not supervision". Answer: rule 7 defines the independent pass by depth, not by timing, and the merge hold is what makes it binding; the amendment is the explicit merge hold in (a), without which a `label-on-green` delegated PR lands unreviewed (FOUND). Attack: "a fix has no new PR". Answer folded in: the hold applies to the existing PR after the push.
**Screen:** clear. Contract: a `full` route is never held for lacking a live supervisor, and never lands without a blocking independent review.

## Fork 2 — Which routes the requirement binds

*Fork-existence:* the router returns `full` for Claude's own routes too (for example every `build-new-feature` route, which has no trials). Either the Fork 1 hold binds those as well or it does not; one PR cannot both be held and not held.

- **(a) Every route whose executed vendor is not Claude — recommended.** The statute governs "a delegated agent's trial record" (its title and scope): the trust unit is a delegated triple, and a Claude-executed run is the baseline that record is compared with, not a delegated trial. Native Claude work keeps today's review policy (the escalation rubric and `#every-pr-gets-a-look-advisory-floor`). The binding reads `executed`, the vendor that actually ran (#3801 Settled by statute), so a marker-forced Codex run is bound even when the criteria routed Claude. **Delegation trials:** every delegated trial gets a full review until its triple is promoted. **Supervision:** unchanged for Claude routes.
- **(b) Every `full` route, Claude included.** Rejected on merit: it re-rules the review policy of native work (every such PR would park for the panel), which is `#every-pr-gets-a-look-advisory-floor`'s and the escalation rubric's subject, not the delegation statute's. If the operator wants that, it is its own decision.
- **(c) Routes whose `routed` provider is not Claude.** Rejected on merit: `routed` is what the criteria chose, not who wrote the diff. A route recorded `routed: codex, executed: claude` is Claude's work, and a marker-forced Codex run routed to Claude would escape the hold.

**Skeptic:** SURVIVES-WITH-AMENDMENT → applied (one self-review pass). Attack: "rule 6 says every triple stays at `full`, so Claude must be held too". Answer: rule 6 sets the level inside the delegation record; which PRs that level holds is this fork, and binding native work would extend the statute past its own scope. Amendment: the binding reads `executed`, not `routed` (option (c) states why).
**Screen:** clear. Contract: which PRs the `full` hold applies to.

## Not in this decision

- The promotion record, rules 4 to 6 and the per-risk threshold table: #3784's design points.
- The `spot-check` depth: already rule 7.
- A planner build's supervisor: G2 (#3801 follow-up 1).

## Done when

1. **Executable** — `grep -l '^## Ruling' we:backlog/*what-satisfies-a-full-supervision-route*.md` lists this card (it fails until the operator has ruled and a `## Ruling` section names the outcome of Forks 1 and 2).
