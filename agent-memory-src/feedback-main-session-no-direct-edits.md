---
name: feedback-main-session-no-direct-edits
description: "The main/interactive session is the orchestrator only — it never runs Edit/Write or git commit/add itself, not even for a small doc change; delegate to a subagent or the conveyor instead"
metadata:
  node_type: memory
  type: feedback
  originSessionId: 8ce35886-a48e-475e-a17a-305df96bfb6a
---

**The main/interactive session never edits directly — it delegates everything, including small doc edits, to a
subagent or the conveyor.** Its job is to acquire the lane, brief the delegate, and relay the result back — not
to hold the pen itself.

**Why:** the operator watched the main/interactive session driving `#3383` (the mechanical-dispatcher epic)
hand-run lane acquisition, `verify-lane.mjs`, and `open-pr` itself one night, for what was only a small doc-only
change. The correction, verbatim: *"main session should not be allow do make any edit by itself"* and *"all
should be delegated. you are the orchestrator only."* The smallness of the change was exactly what made it
tempting to skip delegation — which is why the correction landed on a small doc edit rather than a large one.

**How to apply:** before any `Edit`/`Write` against repo files, or any `git commit`/`git add`, from the main
session in this repo — hand it to a subagent (working inside its own lane clone) or the real conveyor instead.
This applies even to edits that feel faster to "just do myself": a one-line backlog-card update, a memory note,
a typo fix. None of those are exempt; the rule is about who holds the pen, not how big the diff is.

Codified in `we:backlog/3383-a-background-mechanical-dispatcher-replaces-the-interactive.md`'s own "Working
doctrine (2026-09-01, continued)" section. Related: [[delegate-by-default-the-loop-only-orchestrates]] (the Opus
loop delegates by default and only orchestrates) — that memory carves out a narrow "work below the spawn floor"
exception for a single in-context edit; this epic's own operator correction draws the line tighter for
`#3383`'s repo writes specifically: no exception, every `Edit`/`Write`/`git commit` against this repo goes
through a delegate, however small.
