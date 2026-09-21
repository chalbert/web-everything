---
name: model-tier-for-codex-gemini-wrapper
description: Which Claude subagent tier to use when dispatching Codex/Gemini delegation work
metadata:
  type: feedback
---

When delegating a task to Codex or Gemini/Antigravity (via `scripts/codex-direct-task.mjs`/`scripts/gemini-direct-task.mjs`), a Claude subagent wrapper is always required — the orchestrating session's own standing rule ("ask subagent, never you" for anything touching the repo, including Bash) means it can never shell out to these scripts directly itself, even though the scripts themselves need no Claude in the loop at all.

Pick the wrapper's model tier by how much real judgment the task needs, not by default:

- **Haiku**: the wrapper just launches Codex/Gemini and relays its output — no independent verification, no diff-reading, no test-running, no landing decision. Fine for low-stakes dispatch-and-report tasks.
- **Sonnet (or better)**: the wrapper must read the actual diff, run real tests, judge correctness, and decide whether to land. Reserve this tier whenever real judgment is on the line — a session's real evidence found this layer catches things Codex/Gemini's own self-report misses (a leaked-secret-in-log bug, a silent filename-quoting data-loss bug), so don't downgrade it just to save tokens on anything that will actually land in the repo.

**Why:** confirmed directly by the user ("Haiku might be fine though... could we mechanize this") after a long delegation-heavy session where every Codex/Gemini dispatch defaulted to a full Sonnet wrapper regardless of whether real verification was actually needed — wasteful under token pressure.

**Update 2026-09-21 (operator ruling, typed in the orchestrating session: "Ok for operation"):** a DECLARED OPERATION run through `node we:scripts/operations/run.mjs <op>` is exempt from the "ask subagent, never you" rule above — the orchestrating session may run one itself (ad hoc shell, investigation and edits still go to a subagent; recorded on backlog #3188, which stays open). So the "always required" claim in the first paragraph no longer holds for a launch that goes through a declared operation. Direction: once a `delegate-task` operation exists, a mechanical wrapper (a script/operation, no model) replaces the Haiku launch-and-relay wrapper; the Sonnet-or-better verification tier stays for anything that will land. `delegate-task` is NOT built yet (no such operation on `main` or the prototype branch as of this date; the design lives in the orchestrating session's notes), and the wrapper is expected to be the provider port of `dispatch-lane` rather than a separate path (backlog #3717). Until it exists, the Haiku guidance above is still what to do.
