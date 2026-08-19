---
name: orchestrating-session-should-delegate-mechanical-fixup-loops
description: main orchestrating session drifted into hands-on lint-debugging/regex iteration itself instead of delegating; user called it out as "polluting" the session — recognize the drift trigger, not just the existing delegate-by-default rule
metadata:
  type: feedback
---

Doing multi-round mechanical fixup work (debugging a lint regex, iterating a scratch file against a linter,
hand-editing to satisfy a gate) directly in the main orchestrating session is a violation of the
already-established "delegate by default" rule, not a new rule — but it slipped anyway, so the trigger is worth
naming explicitly.

**Why:** 2026-08-17, filing a small backlog item, a `locus-prefix` lint gate rejected the draft twice. Instead
of authoring the content once and handing the whole file-and-land sequence to a subagent, I iterated inline —
reading the linter source, building a scratch copy, running the linter against it repeatedly, sed/python
patches — several tool calls of pure mechanical debugging in the main loop. The user said: "you do a lot in
this session, it should only be orchestrating and this is polluting it." This is the concrete failure mode of
the "delegate by default" rule (the loop orchestrates and delegates BY DEFAULT; canon:
docs/agent/backlog-workflow.md#model-routing) — the rule was already known, but a gate bouncing a draft a
couple of times didn't register as "this is now mechanical work," it just felt like "finishing what I started."

**How to apply:** The trigger isn't task size, it's task SHAPE. Once a step becomes "iterate against a
deterministic checker until it passes" (a lint gate, a test suite, a formatter), that is exactly the
below-floor mechanical work the delegate-by-default rule already says spawns rather than stays inline — hand
the REST of the sequence (fix remaining gate errors, commit, land, dispatch review) to a subagent immediately
on the first bounce, rather than after finishing the debugging loop by hand. Don't wait for the second bounce
to notice — the first gate rejection on a mechanical fixup IS the signal to delegate, not a reason to "just
quickly fix this one thing" inline.
