---
name: index-meta
description: "How the agent itself operates: memory-management policy + this index tree, propose-memory-on-reframe, context-meter (ask don’t estimate), hand-back-early in interactive loops, state-representing edits need no permission, persist-ratifiable-wording-live-in-decision-discussion, model routing (Opus orchestrates, Sonnet executes), model recurring cost, session cost-on-card accrual (close attributes session $ to the item worked), forward background progress, plain-language + review checklists, self-contained plans, POC-mode + demo-first pragmatism. Recall for working style, memory upkeep, or model/agent orchestration."
metadata: 
  node_type: memory
  type: reference
  originSessionId: 43c091c2-3478-4489-a078-8bb6c34d20bb
---

Agent Meta · Memory · Model Routing cluster — open a leaf with `node scripts/memory-resolve.mjs <N>` (or `--cat`):

- 9. Memory-Management Policy — index=TREE: always-loaded map+core-invariants; rules live in category sub-indexes; #1517/#1868
- 44. State-Representing Edits Need No Permission — REAL-state edits=default-do: apply+report; ask only on new scope
- 140. Persist Ratifiable Wording Live — in decision discussion, write proposed wording INTO the item the same turn; never make the user ask
- 55. Hand Back Early In Interactive Loops — collect first; build on explicit go; no early design→build→commit
- 62. Context Meter: Ask, Don't Estimate — I can't read context %; ask + use verbatim, never guess
- 81. Propose Memory When A Reframe Lands — discussion overturns approach → propose memory in-the-moment, not at /close
- 84. Plain Language & Review Checklists — no invented jargon; verify claims; checklist before larger changes
- 115. POC Mode Pragmatism — in POC impl details aren't critical; pick a default, keep moving
- 116. Demo-First Iteration — refine on a standalone demo/sandbox before bringing into real block pages
- 117. Self-Contained Plans — handoff plans carry full context; lead title+goal, surface via backlog
- 128. Forward Background Progress Into Chat — VS Code ext has NO /workflows TUI; forward via file-watcher re-invoke
- 134. Opus Orchestrates, Sonnet Executes — exec→Sonnet subagent; judgment stays Opus
- 135. Model Recurring Cost, Don't Gate It — recurring overhead MODELED (affine fit); every sample counts; #1505
- 144. Session Cost-On-Card Accrual — close accrues session $ to the card(s) worked; decision/prepare accumulate, workflow even-splits, slice/resolve skip
- [Parallel /workflow lane model](workflow-lane-model-policy.md) — Sonnet default, Opus for rare complex items, NEVER Fable for execution; orchestrator decides per-item
- [Autonomous loops are non-blocking — red-team gates, not prompts](autonomous-loops-non-blocking-red-team-not-prompts.md) — replace per-iteration human approval with a machine-adversarial gate + auto-landed lane→PR + retrospective revert; the user runs loops heavily so prompts kill throughput
- [Scoped approval beats global bypass](scoped-approval-beats-global-bypass.md) — for autonomous loops, auto-approve the narrow protected category (memory/skills path prefix), not `--dangerously-skip-permissions` globally; #2265
- [PR-open is the standard flow, not a question](pr-is-the-standard-flow-not-a-question.md) — every edit-task ends by opening a ready-to-merge PR automatically; the drain only lands open labelled PRs so a local lane commit is dead work; the global "push only when asked" rule is superseded here by the repo's sole land route (#104/#2183/#2290)
- [Complete the branch before labeling ready-to-merge](complete-branch-before-labeling-ready-to-merge.md) — the drain daemon (~60s) merges a labeled PR at its first review-accepted commit; push the WHOLE branch + run the full suite BEFORE creating the PR / applying ready-to-merge, else later commits strand on a merged branch (real: plateau-app #62→#63)
- [Scaffold hash ids, never hand-number](scaffold-hash-ids-never-hand-number.md) — new backlog items are born hash-keyed via `scaffold`; the drain assigns NNN at land (#2288). Never hand-pick a number (even from "next free id") — it collides with concurrent sessions and the collision-heal renumber can blank files (real: WE #558 blanked 6 → re-filed #560, prevention #561)
- [Verify before you claim](verify-before-you-claim.md) — never report landed/merged/passed/present from an exit-code-only check (`git ls-tree … && echo` is a false positive); confirm by content, in the freshly-fetched lane (not the stale primary), and from GitHub when local git looks off (real: WE #558 false "it landed")
- ["I approve" sets review:accepted](approve-verdict-sets-review-accepted-label.md) — the user saying they approve a PR IS the human verdict; swap its label review:human/review:pending → review:accepted so the drain lands it, without being asked
- [Drain-gated build→review→resolve loop](drain-gated-build-review-resolve-loop.md) — the user's "build-review-wait for drain-next" delivery cadence: build each item in a lane, independent SUBAGENT review before the PR (catches real bugs — don't rubber-stamp), verify live on a non-colliding lane server, ready-to-merge PR, clear agent review parks, resolve in a WE lane, next; serial (one build in flight), lanes for every edit
- [Decision explainer artifact](decision-explainer-artifact.md) — design rulings get a small SEPARATE side-by-side visual artifact (mini token-true replicas per option, before/after grammar table, honest counter-argument, one bolded recommendation), not prose; own URL, never overwrite the main mock; user flagged it a keeper for the AI design tools
- [Don't hedge toward stopping](dont-hedge-toward-stopping.md) — don't offer to stop / "wrap here?" / "needs your input" when there's buildable work and no genuine blocker; size, a needed default, or a cross-repo dance are NOT reasons to stop — decide the defaults and build → sight → review → land. Real blockers = unbuilt foundations or a human-reserved design decision. User: "why do you want to stop / stop trying to convince to stop without good reason"
