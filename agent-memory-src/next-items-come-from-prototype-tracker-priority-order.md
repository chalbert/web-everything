---
name: next-items-come-from-prototype-tracker-priority-order
description: The orchestrator picks the next work from the `## Priority order` of epic #3383's card on `lane/mechanical-dispatcher`, never from `run.mjs suggest-next`; name the list line per dispatch; operator goals are delegation (pinned first) and graduation (no pinned section yet).
metadata:
  type: feedback
---

Next items come from the prototype tracker, never from `run.mjs suggest-next`. Operator, 2026-09-21: "I am expecting the prototype tracker items to be the source of next items."

**Why:** on 2026-09-21 `run.mjs suggest-next` queued two jobs that were not on the operator's list; both were later aborted. `suggest-next` is a leverage ranker. It ignores the operator's goals, so it picks work the operator did not ask for.

**How to apply:**
- The source is the `## Priority order` section of epic #3383's card on `lane/mechanical-dispatcher`: `git show origin/lane/mechanical-dispatcher:backlog/3383-a-background-mechanical-dispatcher-replaces-the-interactive.md`.
- Take the first lines that can be dispatched. Skip claimed lines, blocked lines, operator-decision lines, needs-operator-fast-forward lines and lines already in flight.
- Name the list line number of each dispatch in the reply.
- A card outside #3383 is queued only when its list line is marked `operator-added`.
- Owed mechanisation: card #3720 (list line 35), "queue the next work the moment a PR lands". It replaces the orchestrator queueing the next work by hand. Prioritise it.

**The operator's goals behind that list (2026-09-21):**
- **Delegation** of work to other agents (Codex, Antigravity, provider routing). It is pinned first in the list (rule 0a). See [[delegate-work-to-codex-when-feasible]] and [[delegate-by-default-the-loop-only-orchestrates]].
- **Graduation** of the prototype branch to main. It is a stated priority with no pinned section yet: cards #3486, #3487, #3744 and epic #3443 are scattered through the list. Treat it as a priority anyway and propose pinning it.

Source rule file: [[operator-standing-rules-live-in-a-file-handoff-never-overwrites]] (rule 1 is this leaf, rule 2 is the goals). Related: [[prototype-is-source-of-truth-for-mechanical-work]].
