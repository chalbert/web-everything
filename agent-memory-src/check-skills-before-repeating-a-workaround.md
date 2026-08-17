---
name: check-skills-before-repeating-a-workaround
description: When a task is hand-rolled because the "proper" tool was broken/missing, re-check for that proper tool before every repeat use — don't let the workaround become the habit
metadata:
  type: feedback
---

When the first attempt at a recurring task hits a real blocker in the intended tool (a skill, a
declared operation, a script) and gets improvised around instead, that improvisation easily becomes
the standing habit for the rest of the session — every later instance of the same task just repeats
the workaround, without re-checking whether the original blocker is still there.

**Real case (2026-08-17, web-everything):** the first PR review of the night hit `#3151`, a real bug
in the declared `review-pr` operation (its judge-spawn refused a tool-bearing juror with no way to
supply a lane via CLI flag). The fix was to hand-roll the review via the `Agent()` tool instead —
reasonable in the moment. But that became the pattern for every review afterward — roughly a dozen —
without ever checking `skills-src/` for whether a purpose-built skill already wrapped `review-pr` for
exactly this (it does: `/review`, `skills-src/review/SKILL.md`). The skill would have hit the same
`#3151` refusal until the bug was actually fixed, so using it wouldn't have "worked" either — but
discovering *that* directly, through the intended tool, is a better failure than never discovering the
skill existed at all.

**Why this matters even when the workaround is quietly working:** a hand-rolled substitute drifts
from the real tool by construction (different prompt each time, no shared run record, no declared
contract) — and once a session settles into it, the original blocker's status stops being reconsidered
even after circumstances change (the bug gets fixed elsewhere, a new session starts, etc).

**How to apply:** the moment a task gets improvised around a missing/broken tool a second time, stop
and check: (1) is there a skill or declared operation for this at all (`skills-src/`, an operations
registry) that I haven't checked, (2) if the workaround exists because of a known bug, is that bug
still actually open right now, not just assumed still-open from when the pattern started. Do this
check before the *second* repeat, not after the tenth.
