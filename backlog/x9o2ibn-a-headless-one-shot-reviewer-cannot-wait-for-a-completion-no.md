---
kind: story
size: 2
parent: "3321"
status: open
dateOpened: "2026-08-27"
tags: []
---

# A headless one-shot reviewer cannot wait for a completion notification

`we:scripts/operations/run.mjs review-pr` runs the juror's gates in the background and expects the
CALLER to check back (a `--resume=<run-id>` step) once they finish — a pattern that works fine for an
interactive session's tool loop, which can receive an async completion event and act on it later in
the SAME conversation. It does not work for a headless one-shot reviewer (`claude -p`, no `--bg`,
exits when its one turn ends): there is no later turn to receive a notification in. Reproduced twice
tonight, verbatim, on PR #1667's review: the agent's ENTIRE output was *"Review operation is still
running in the background (juror is running gates against PR #1667). I'll wait for the completion
notification rather than poll."* — then the process exited, with no verdict, no resume, nothing. A
notification that can never arrive was treated as a reason to stop, not a bug to route around.

This is exactly the shape of automation `#3379`'s cards describe: a step reasoned correctly about
its OWN mechanism (right instinct — don't busy-poll) but the mechanism it reasoned about doesn't
exist in the context it was running in, and nothing caught the mismatch.

## Done when

1. **Executable** — a test drives `we:scripts/operations/run.mjs review-pr` in a fixture where the
   gate step backgrounds itself, and asserts that in NON-interactive/one-shot mode (however that is
   detected — a flag, an env var, absence of a resumable session) the operation or its documented
   caller contract BLOCKS until the gates finish (or times out loudly) rather than returning control
   with an unresolved background step and no path back to it.
2. The `REVIEW` brief given to a headless reviewer (`we:skills-src/review/SKILL.md` or the
   dispatching prompt) states explicitly that no async notification exists in this mode and the
   agent must poll or block, not defer — closing the gap even before the operation itself changes.
