## Priority order

Updated: 2026-09-21 by delivery worker `priority-sync` — added 1, dropped 3, moved 0, flagged 19, renumbered 124; new lines wait for a worker to write their why. Derived by the rules below from the ranker and this card's own goal; the orchestrator dispatches from the top of band A and never chooses order. Whoever files, resolves, re-scopes or blocks a #3383 card updates this section in the same push; the `check-priority` command of we:scripts/prototype-tracker.mjs, run with `--ref=origin/main --strict`, fails on drift.

**Scope.** Every open card under #3383, plus the open slices of open epic children (the walk stops at a resolved card). A card resolved on `main` or on this branch counts as resolved. A card with `status: active` is claimed: listed at the end, never ordered. Ranker signals: the `suggest-next` operation (through we:scripts/operations/run.mjs, with `--json --parent=3383`) on `main` (it ranks Tier A only and prints at most 50 rows, so leverage for the rest was read from the loader `we:src/_data/backlog.js` on `main`). Leverage is 0 for almost every card, so most ties fall to size, then number.

**Rules — re-apply exactly as written.**

0. **The mechanised system first.** The critical path is this epic's own acceptance and target shape: Done-when 1 (a background process runs a PR through fix, review and land with no interactive turn), Done-when 2 (a blocked case reaches a person by notification), and the target shape (a dispatcher that owns queueing and capacity, a supervisor that watches every agent, then graduation from the branch to `main`). Each card gets a tier: **P0** the branch-health chain; **P1** the fix-review-land cycle (dispatch, verify, land); **P2** watch, notify, report; **P3** on-path support that removes no cycle step; **OFF** not on the path. A card gets P0 to P3 only if its line can name the manual step it removes or the blocker it clears; otherwise it is OFF. OFF cards stay listed but sink below the on-path cards of their band, and their line says why. Cards that are not under #3383 are ordered here only when their line is marked `operator-added` (see the delegation section); every other card outside #3383 appears only in the last lists.
0a. **Delegation to other providers first (operator, 2026-09-21).** The delegation stack (Codex, Antigravity, provider routing) ranks first among on-path work, right after the health chain and before band A. The SECTION's position is pinned by the operator; the order inside it is derived by rules 1 to 5 (dependencies, then leverage, then size, then number).
1. **Dependencies first.** A card never precedes a card in its `blockedBy`, or one its title says it is "downstream of"; a card whose blocker is claimed or outside this epic goes to the end of its band. The health chain (#3768 first, then #3653, #3674, #3772) comes before every band because nothing may graduate before it. That is the one deliberate break of band order.
2. **Bands, in this order.** **A** dispatchable now: agent-ready (ranker Tier A), no open design point, no operator file or policy. **B** design first: an epic, or a card that states a design to settle or an open fork; these stay uncleared until settled. **C** needs an operator ruling: a decision, or anything that touches the operator's deployed files or policy (launchd job, deployed command, hooks, trust settings, approval policy). A card never sits in an earlier band than its blocker.
3. **Within a band:** tier (rule 0), then ranker leverage descending, then smaller size (task, then story points, then epic or decision), then number. Prepared decisions go first in band C, as the ranker does. An epic with open slices is a container line placed just above its best-ranked slice; the slices keep their own lines.
4. **Pinned by operator.** A line marked `pinned by operator` is never moved by an agent; agents insert around it. None today.
5. **One line per card:** `N. #card · size · band · why`. On-path lines say the manual step removed or the blocker cleared. Size is story points, or `task`, `epic`, `decision`.

**Health chain (rule 1) — before every band**

1. #3768 · 5 · B · Clears: the branch fails check:standards with 15 errors, which blocks graduating anything to main (worker branch-health is on it); first by rule 1 though its design calls are open.
2. #3653 · 3 · A · Clears: CI cannot be switched on for the prototype branch, so no check gates what lands on it.
3. #3674 · 3 · A · Clears: the branch has zero CI, so the drain waits forever on its test-check gate.
4. #3772 · 3 · B · Clears: no merge policy, so the branch drifts behind main and graduation stalls; decide it before graduating.

**Delegation to Codex and Antigravity (operator priority) — before band A**

5. #3696 · 5 · A · operator-added · Clears: the card is open although the Antigravity default recommendation landed on 2026-09-15 (`049d64039`, 73 router tests pass); close it out so the list shows only what is left.
6. #3717 · 5 · A · Removes: a person choosing the dispatch provider by hand; the router has no caller, so every worker still starts on Claude. The critical path of this section.
7. #3369 · epic · A · operator-added · Container: decouple dispatch from the Claude CLI; its slices are ordered on their own lines.
8. #3704 · 8 · A · operator-added · Clears: the card is open although the tool-free Codex review seat landed (PRs #2115 and #2117, opt-in through `REVIEW_PR_CODEX_ADVISORY`); confirm what is left, then close or re-scope.
9. #3580 · epic · B · operator-added · Container: the Codex delivery provider for build, fix and ci-heal exists only on the prototype branch, opt-in, with one accepted run (#2169); no slice covers an Antigravity provider or graduating it to main.
10. #3630 · 5 · B · operator-added · Clears: the card is open although the branch's Codex delivery provider already reuses its isolation argv; confirm what remains (lane-pool lease, a live proof), then close or re-scope; follows #3580.
11. #3658 · decision · C · Clears: every new provider hand-edits one shared table, so an Antigravity provider collides with other lanes; needs a prepare pass before the ruling.

**Band A — dispatchable now**

12. #3486 · 3 · A · Graduation slice: the review step of the runner still runs only from the branch, not main.
13. #3468 · task · A · Clears: the agent brief tells workers to resolve the card before any PR exists.
14. #3474 · task · A · Removes: a person syncing a stale checkout by hand before a review can be dispatched.
15. #3656 · task · A · Clears: a fix dispatch leaks its lane when writing the scratch file fails, shrinking capacity.
16. #3657 · task · A · Clears: lane acquire prints npm output into the lane path, so a fresh lane can be unusable.
17. #3669 · task · A · Removes: freeing lanes held by dead processes by hand.
18. #3489 · 2 · A · Clears: the runner sync pass loops on merge conflicts, so queued items never become ready.
19. #3647 · 2 · A · Clears: a good review is marked blocked-on-infra when a logging step fails, so it never lands.
20. #3718 · epic · A · Container: mechanise the orchestrator turn; its slices are ordered on their own lines.
21. #3731 · 2 · A · Clears: the drain daemon clone refresh fails and it sits far behind main, so landing stalls.
22. #3659 · 3 · A · Clears: the advisory review comment never surfaces, which the clear-human race guard needs.
23. #3725 · 3 · A · Clears: lane availability is miscounted, so dispatch launches too few or too many.
24. #3727 · 3 · A · Clears: review and fix dispatch ignore the shared ceiling, so re-armed PRs launch in a burst.
25. #3729 · 3 · A · Clears: a stale ci:failed label parks a green PR so it never lands.
26. #3730 · 3 · A · Removes: the orchestrator hand-writing the job record for each brief-file worker.
27. #3755 · 3 · A · Clears: the tick that starts dispatch has no failure backoff and collides on its status file.
28. #3612 · 5 · A · Clears: nothing caps concurrent lanes; one freed lane once launched 42 sessions at once.
29. #3643 · epic · A · Container: wire the remaining launch kinds (Done-when 1); its slices are ordered on their own lines.
30. #3640 · 5 · A · Removes: a person driving fix dispatch; wires it to its wrapper (Done-when 1).
31. #3641 · 5 · A · Removes: a person driving prepare (scope) dispatch; wires a harness for it (Done-when 1).
32. #3642 · 5 · A · Removes: a person driving ci-heal dispatch; wires a harness for it (Done-when 1).
33. #3644 · 5 · A · Removes: a person driving prepare-decision dispatch; wires a harness for it (Done-when 1).
34. #3645 · 5 · A · Removes: the agent-driven lifecycle brief for build dispatch; wires the deliver-item wrapper (Done-when 1).
35. #3720 · 5 · A · Removes: the orchestrator queueing the next work by hand when something completes.
36. #3750 · 5 · A · Clears: finished sessions are counted as live workers, and the first live apply of ci-heal and conflict-fix is untried.
37. #3724 · 5 · A · Removes: the orchestrator running many commands by hand to learn what landed and what is owed.
38. #3593 · epic · A · Container: a standing supervisor that catches agents' instruction slips; its slice is ordered on its own line.
39. #3594 · 8 · A · Adds the watch step: a report-only scanner for agents that claim to wait but do not.
40. #3646 · task · A · Clears: the runner cannot stop on a signal in the middle of a pass, so a restart needs a kill.
41. #3677 · task · A · Removes: hand-grepping decision traces to learn what one item is doing.
42. #3487 · 3 · A · Graduation slice: crash-loop and idle-with-queue alerting reaches the operator only from the branch; waits for #3486.
43. #3721 · 3 · A · Removes: hand-reaping finished-but-alive review, fix and ci-heal sessions that still hold lanes.
44. #3726 · 3 · A · Removes: composing the handoff and state read by hand; waits for #3724.
45. #3624 · 5 · A · Clears: live review or build sessions sit idle at a prompt for hours and nothing notices.
46. #3719 · 5 · A · Removes: the orchestrator working out which pending decisions bear on the work in flight.
47. #3736 · 5 · A · Removes: reading wide wip tables on a phone, and hand-queueing Attention findings.
48. #3553 · 2 · A · Adds a skill line so agents use branch-sync, keeping the branch from drifting; small.
49. #3518 · 3 · A · Keeps the replacement dispatcher's prompt prefix stable so cache reads stay cheap; a cost constraint, not a blocker.
50. #3723 · 3 · A · Refreshes the decision docket when work completes; helps the operator read, removes no dispatch step.
51. #3670 · 5 · A · Clears: about 78 of 84 gh calls are unthrottled, so a busy runner can hit rate limits mid-cycle.
52. #3476 · task · A · Off path: a lint gap in a scan script; no step of the cycle depends on it.
53. #3587 · task · A · Off path: file-item cannot queue a decision or epic; the queue command still can.
54. #3714 · 1 · A · Off path: bugs in the container exec helper; the operator deferred container work (see #3621).
55. #3479 · 2 · A · Off path: one command for the filing chain; filing stays with the person by the epic's own design.
56. #3713 · 2 · A · Off path: test gap in a container guard; the operator deferred container work (see #3621).
57. #3715 · 2 · A · Off path: pin a container base image by digest; the operator deferred container work (see #3621).
58. #3754 · 2 · A · Off path: a hook blocks a read-only sed of a card; friction for agents, not a cycle step.
59. #3566 · 3 · A · Off path: moves a filing skill onto the file-item verb.
60. #3569 · 5 · A · Off path: a capacity-monitor page for the operator; no dispatch step reads it.
61. #3666 · 5 · A · Off path: live probe of Grok as an extra bulk dispatch provider; current providers already run the cycle.
62. #3667 · 5 · A · Off path: live probe of DeepSeek and Qwen as extra dispatch providers; current providers already run the cycle.
63. #3668 · 5 · A · Off path: live probe of Cursor's headless CLI as an extra dispatch provider; current providers already run the cycle.
64. #3397 · 3 · A · Clears: the supervisor has no deliberate reload path; blocked on claimed #3443, cannot start yet.
65. #3398 · 3 · A · Clears: runner down or stuck alerts only reach a log nobody watches (Done-when 2); blocked on claimed #3443, cannot start yet.
66. #3562 · 5 · A · Off path: standing pass that keeps the top decisions prepared; blocked on #3277 outside this epic.
67. #xoppas2 · 3 · A · Off path: the reports-dir fix is already in and its Done-when passes; the card is open only to be closed out (inserted when a rename made it visible to the gate; the priority-order owner may re-place it).

**Band B — design first (uncleared)**

68. #3773 · 2 · B · Clears: review briefs carry an unresolved double-brace token, so reviewers get a broken header.
69. #3742 · 3 · B · Clears: open-pr reports complete though no pull request exists, so a landing looks done when it is not.
70. #3752 · 3 · B · Clears: a hand dispatch can end without doing the brief or subscribing to an idle notice, so the orchestrator waits blind.
71. #3777 · 3 · B · Removes: the orchestrator choosing dispatch order by hand, and the 50-row cap that hides 13 scoped cards; this section is the manual first pass for it.
72. #3743 · 5 · B · Clears: the tick has no start gate, so it can dispatch while an earlier day's PRs are still open.
73. #3745 · 5 · B · Removes: hand-wiring the tick hook; emits the settings fragment as data, never applied by the build.
74. #3751 · 5 · B · Clears: one red verify record blocks any second verify, and environment-only failures turn docs-only work red.
75. #3765 · 2 · B · Clears: the reaper planner crashes on a null session row.
76. #3776 · 3 · B · Clears: finished session rows stay in the agents list for good, so live workers are miscounted; settles how rows leave and who may delete.
77. #3781 · 3 · B · Removes: a person syncing a stale checkout by hand before the orchestrator's reads; settle with #3752 and #3474 whether reads and dispatch share one clone.
78. #3744 · 5 · B · Clears: the reaper cannot tell a stop worked and re-stops about 570 finished sessions per run (built on the branch, graduation owed).
79. #3771 · 5 · B · Clears: background workflow runs die silently, so the orchestrator waits on work that is gone.
80. #3775 · 5 · B · Removes: the orchestrator running about eight commands by hand to see what is building, stuck and next.
81. #3778 · 5 · B · Removes: the orchestrator running about eight commands by hand at session start; leans toward extending #3775, so it follows #3775.
82. #3779 · 5 · B · Removes: hand-composing the live sections of the handoff each session; needs the dead-row rule (#3776) and the liveness rule (#3775); overlaps #3759.
83. #3625 · epic · B · Container (unsliced): per-lane health rollup and orphan detection, the watch step of the epic.
84. #3741 · 3 · B · Clears: the jury launcher returns a whole result into the caller's context; a path and summary is enough.
85. #3774 · 3 · B · Speeds verify by giving docs-only changes a narrower run; removes no step.
86. #3780 · 3 · B · Removes: hand-composing the reply's closing tail; the design may end at "keep as instructions", which builds nothing; follows #3778.
87. #3737 · 5 · B · Sets concurrency limits from measured host data on a dated review; today's numbers are a guess.
88. #3770 · epic · B · Adds a design-review gate before clearing, which is what unlocks the design-first band; sequence with #3746, both change planQueueing.
89. #3740 · epic · B · Container (off path): one intake operation for planned work; its slices are ordered on their own lines.
90. #3746 · 3 · B · Off path: track intake, additive key and provenance inputs on file-item.
91. #3753 · 5 · B · Off path: track intake, the strict one-line contract.
92. #3757 · 5 · B · Off path: track intake, read-only reconciler of owed lines.
93. #3758 · 5 · B · Off path: track intake, the ingest engine.
94. #3760 · 5 · B · Off path: track intake, worker result adapter.
95. #3576 · 3 · B · Off path: auto-prepare for build items, open fork unresolved; ranker leverage 1001 does not lift it above on-path cards (rule 0).
96. #3759 · 5 · B · Off path: track intake, orchestrator handoff adapter.
97. #3761 · 5 · B · Off path: track intake, pending-intake ledger at land.
98. #3749 · 2 · B · Off path: rebuild of the decision docket page for the operator; no dispatch step reads it.
99. #3766 · 2 · B · Off path: tidy-up of a helper copied in three places.
100. #3671 · 3 · B · Off path: telemetry tool-use counts; a design decision is still open.
101. #3747 · 3 · B · Off path: track intake, lint so a tracker note cannot carry a free-text owed list.
102. #3597 · 5 · B · Off path: standing pass that re-verifies queued scope; open fork unresolved.
103. #3763 · 5 · B · Off path: track intake, one-time backfill sweep.
104. #3764 · 5 · B · Off path: track intake, learnings and escalation adapter.
105. #3738 · 8 · B · Off path: usage-by-role aggregation over telemetry.
106. #3784 · 5 · B · Clears: the dispatch supervision gate is still off by default although #3690 is ratified, so a full-level route with no supervisor is never held; settle the design, then switch it on.

**Band C — needs an operator ruling**

107. #3748 · 3 · C · Clears: background workers run in untrusted checkouts, so committed permissions are ignored and they stall on prompts; touches the operator's Claude trust settings.
108. #3605 · decision · C · Ready to ratify. Clears: a cleared item silently drops out of dispatch when its hash id is renumbered.
109. #3463 · decision · C · Clears: an unresolvable sync conflict never reaches the dispatch that owns the touched files.
110. #3627 · decision · C · Rules what context a dispatched agent gets; #3628 and #3629 follow from it.
111. #3628 · decision · C · Downstream of #3627: mechanical lane acquisition for every dispatched agent type.
112. #3629 · decision · C · Downstream of #3627: the minimal-context wrapper for review and fix dispatch.
113. #3682 · decision · C · Clears: tick cadence is tied to gate duration, so mechanical passes starve behind slow checks.
114. #3767 · 2 · C · Clears: the deployed wip command is hand-edited and drifts from source; touches the operator's deployed command.
115. #3756 · 5 · C · Clears: nothing runs the reaper or alerts when the runner is down; schedules on the operator's machine.
116. #3769 · 5 · C · Clears: nothing stops the main session editing and committing itself; a hook policy the operator must approve.
117. #3655 · decision · C · Clears: idle peer sessions and orphaned watchers linger after their target resolves.
118. #3681 · decision · C · Clears: long-running daemons have no health check, staleness detection or live reload.
119. #3686 · decision · C · Names the liveness guarantee that the reaper, workflow and watcher cards all lean on.
120. #3722 · decision · C · Rules whether the session and the runner are one system or two; fixes the orchestrator's role.
121. #3639 · decision · C · Two runners on disjoint parts of the queue; not needed while one runner serves the queue.
122. #3648 · decision · C · How the POC branch keeps its own running record; documentation, not a cycle step.
123. #3598 · epic · C · Container (off path): approval-granularity policy for auto-queue; the operator's policy, not a cycle step.
124. #3599 · 3 · C · Off path: per-epic approval policy for auto-queue; the operator's policy.
125. #3739 · 3 · C · Off path: repoint the telemetry collector's launchd job; touches the operator's deployed job.
126. #3672 · decision · C · Off path: a contained playground mode for open-ended experiments.
127. #3563 · decision · C · Off path: whether the backlog guard should refuse any hand-written card; a policy call.
128. #3558 · task · C · Off path: widens that guard; build only after #3563 is ruled.
129. #3575 · decision · C · Off path: parallelising a build below the item level.
130. #3601 · decision · C · Off path: which approval levels ship and their default; the operator's policy.
131. #3621 · decision · C · Off path: OS-level isolation per lane; the operator deferred active work on it.
132. #3676 · decision · C · Off path: act on heavy commands that overrun a container budget; container work is deferred.
133. #3707 · decision · C · Off path: dispatch-origin attribution for velocity metrics.
134. #3734 · decision · C · Off path: whether benchmark data may act as a capped prior for supervision graduation.
135. #3762 · decision · C · Off path: track intake, when the worker Owed block stops being soft.

**Claimed (`status: active`) — listed, not ordered**

- #3492 · task · claimed · review-dispatch's spawned review session hard-fails on a momentarily-full lane pool
- #3467 · task · claimed · The conveyor's own long-running runner process runs bare and unwrapped on main -- nothing detects its own code
- #3459 · 3 · claimed · itemNumFromRef returns null for a retried lane PR (attempt-tag letter, e.g. lane/3441b-...), making the PR inv
- #3441 · task · claimed · A build-dispatch agent whose PR merges must resolve its own backlog item, not leave it active forever
- #3443 · epic · claimed · Graduate origin/lane/mechanical-dispatcher to main in small, independently reviewable pieces
- #3447 · 2 · claimed · Require check:health in the test-plan checklist for any PR stamping preparedDate on a decision with Fork secti
- #3783 · 5 · claimed · Build the concurrent-baseline comparison harness for delegation trials (child of #3718; filed by the #3690 preparation PR #2363). Part of the delegation stack: rule 0a would place it in the delegation section, after #3717 (the router caller its trial pairs feed) and before band A; not ordered while claimed.

**Owed, no card yet — not ordered** (from this card's own notes; each needs a card once its scope is re-read).

- Graduate the reaper pure planner to `main` first and alone (built on this branch under #3744).
- Graduation G2: routing, the supervisor loop, and the supervision tree in the wip report; and the tag-script pid check.
- The collector design-review result, when it lands.
- The tracker note 4 (items 15 to 23) that was never written; re-derive it from the epic if still wanted.

**Off-path, not ordered — not #3383 cards.** Listed so nothing is silently dropped.

- off-path #3735 · decision · parent #3054: whether a `review:human` approval carries across a push that only merges `main` into the branch.
- off-path #3782 · 3 · claimed, no parent: codex-direct-task's scratch clone points origin at the real remote, so the draft-only rule is prompt text over a push-capable checkout; filed by the #3690 preparation PR #2363, outside #3383, so not ordered.
- off-path: the operator clearing list (the `list` action of we:scripts/conveyor/queue.mjs) is session-local and empty; it is not a priority list.
