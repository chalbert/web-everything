---
name: index-meta
description: "How the agent itself operates: memory-management policy + this index tree, propose-memory-on-reframe, context-meter (ask don’t estimate), hand-back-early in interactive loops, state-representing edits need no permission, persist-ratifiable-wording-live-in-decision-discussion, model routing (Opus orchestrates, Sonnet executes), model recurring cost, forward background progress, plain-language + review checklists, self-contained plans, POC-mode + demo-first pragmatism. Recall for working style, memory upkeep, or model/agent orchestration."
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
