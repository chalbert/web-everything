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

**The fix belongs in the mechanism, not the agent's judgment.** The dispatching harness
(`we:scripts/verify-lane.mjs`'s sibling pattern; concretely, a `subprocess.Popen(...).wait(timeout=…)`
around the whole headless process, as this session's own `converge.py` already does) is ALREADY a
synchronous, mechanical wait — the orchestrator blocks until the process exits, no polling, no
notification, nothing for an agent to reason about. The bug is that `review-pr` hands control BACK
to the agent mid-operation with an unfinished background step and asks IT to decide how to wait —
the one thing a one-shot process structurally cannot do well. The right fix removes that decision
from the agent entirely: `review-pr` blocks internally until its own gate finishes, so a headless
caller never sees a "still running, come back later" state at all. Prompting the agent to poll
instead (a earlier draft of this card's `Done when` #2) is a workaround for the mechanism being
wrong, not a fix — dropped in favor of making the operation itself synchronous.

## Done when

1. **Executable** — a test drives `we:scripts/operations/run.mjs review-pr` in a fixture where the
   gate step backgrounds itself, and asserts the operation call ITSELF blocks (or the CLI's
   `review-pr` command blocks) until the gate resolves — no `--resume=<run-id>` hand-back required
   for the common case. A caller that legitimately wants async behavior can still ask for it
   explicitly; the default must not require a second turn that a one-shot process cannot have.
