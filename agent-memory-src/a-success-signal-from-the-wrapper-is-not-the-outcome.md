---
name: a-success-signal-from-the-wrapper-is-not-the-outcome
description: Exit codes, parse checks and piped tails report on the WRAPPER, not on the work — name the post-condition in the world and query that instead. Recall before writing "done"/"ok"/"fixed" on the strength of a command that returned 0, or before trusting a dispatched agent's own report.
metadata:
  type: feedback
---

A green signal from the thing that *ran* the work is not evidence the work happened. Three of these in one
session, all the same shape:

- `npm run check:standards | tail -1` returns **tail's** exit code, never the gate's. It went into commit
  messages, PR bodies and agent briefs — so the briefs taught agents to verify the wrong way too.
- `edit && python3 -c 'ast.parse(...)' && echo fixed` proves the file is **valid Python**, not that the edit
  landed. It printed success for a failed edit twice.
- `run_agent` returned `ok` on **exit code 0**. PR #1641's conflict resolver exited 0 having written 50 bytes
  ("I'll stop polling and wait for the monitor event") and never touched the branch. An agent that declines
  the work exits exactly as successfully as one that does it.

**Why:** each reads a proxy sitting *next to* the outcome — the last process in a pipe, the parser, the
shell's view of a child. The proxy is genuinely green; it is answering a different question. The failure is
silent and self-congratulatory: it manufactures a confident "done" that nothing downstream re-checks.

**How to apply:** before writing done/ok/fixed, name the post-condition **in the world** and query that.
Capture a gate's status on its own line, never through a pipe. Verify an edit by grepping for its content.
Verify a dispatched agent by the state it was sent to change — for a conflict resolver, `gh pr view --json
mergeable` reading `MERGEABLE`, not the agent's report. The durable conveyor already does this:
`scripts/operations/dispatch-lane-io.mjs` notes the agent listing "carries no exit status, no outcome" and
judges builds by PR verdict (`merged`/`pending`/`parked`/`closed`) instead.

Related: [[129-feedback_prove_before_claiming_fixed]] (prove a fix on the real surface),
[[grep-every-name-you-cite-in-prose]], [[10-feedback_skeptic_finding_is_a_hypothesis]].
