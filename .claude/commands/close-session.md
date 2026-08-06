---
description: Pre-close safety check — confirm nothing is lost before ending the session (routes to the closing-session skill)
---

Invoke the `closing-session` skill to audit whether session context is durably captured, run the repo health gate, and report working state.

**The close collects; it does not adjudicate.** Everything the audit surfaces that isn't already written down is emitted to the learnings pool (`we:scripts/conveyor/learnings-drop.mjs`, the skill's §1a) and left there. Nothing is red-teamed, filed, written to memory, or landed by the close.

The **memory/instruction reflection pass** (#1878, the model-usage-watch #1855 cadence beat — `npm run reflect`) has moved off the close for the same reason: near-duplicate/orphan/stale detection is a judgment over the whole corpus, not something to re-decide per session. It now runs inside **`/harvest`** (`we:skills-src/harvest-learnings/SKILL.md`), which is also where pool candidates are red-teamed and routed. Do **not** run `npm run reflect` here.

End by reporting the pool's depth (`npm run harvest:status`) on the **Learnings emitted** line. A deep or old pool is a nudge to run `/harvest` **later** — never a reason to start harvesting inside the close.

$ARGUMENTS
