---
name: search-for-an-operation-before-asking-the-operator
description: Before asking the operator to do a chore by hand (close an old session, clear a stuck one, reap, release a lane, clean state), run the capability search and use a declared operation; if one exists without a skill or caller, file the gap instead of pushing the chore to the operator.
metadata:
  type: feedback
---

Before asking the operator to do something by hand (close an old session, clear a stuck one, reap, release a lane, clean state), run the capability search: `node scripts/capability-search.mjs "<what you need>"` or the `/capability-search` skill. Prefer a declared operation. If one exists, use it and say so.

If an operation exists but has **no skill or no caller**, file the gap instead of pushing the chore to the operator:
- prototype machinery: a session-update note in the #3383 tracker (`prototype-tracker.mjs append-note`);
- anything else: a backlog card.

**Why:** operator, 2026-09-20: "Why is it to me to close old Claude? We have an operation, make sure it has a skill too if needed". The orchestrator had asked the operator to close two stale interactive Claude sessions (a `claude login` since Sep 9 and a `claude` since Sep 12), although `dispatch-abort.mjs` (`stopSession`), `session-reaper.mjs` and `clear-stuck-session.mjs` (prototype branch) already exist. The capability search had returned EXACT MATCH.

**How to apply:**
- Search first, and name the operation you used in the reply.
- One case needs the operator: a session that is a human's live terminal. Ask once, with the exact command. Do not hand them the chore.
- Related: [[no-hand-rolling-around-a-missing-operation]] (same thesis, aimed at steps done by hand), [[check-skills-before-repeating-a-workaround]], [[verify-session-liveness-before-archiving]] (check a session is really stale before stopping it), [[prototype-findings-go-in-epic-tracker-not-full-items]] (where a prototype gap goes).
- Do not ask the operator to re-state this rule.
