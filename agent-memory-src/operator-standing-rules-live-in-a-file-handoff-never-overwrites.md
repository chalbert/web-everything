---
name: operator-standing-rules-live-in-a-file-handoff-never-overwrites
description: The orchestrator's standing operator rules live in `~/workspace/.operations/handoff/handoff-webeverything-rules.md`, a file `/handoff` never overwrites; read it first on `/continue`; append a dated line the moment the operator corrects the work.
metadata:
  type: feedback
---

The orchestrator's standing operator rules live in `~/workspace/.operations/handoff/handoff-webeverything-rules.md`. That file is append-only: `/handoff` never overwrites, shortens or rewords it. (It first lived at `~/.claude/handoff-webeverything-rules.md`; that path is now a one-line pointer to the new one. The move was to get out from under `~/.claude`, where every edit prompts.)

**Why:** on 2026-09-21 the operator was annoyed that the orchestrator lost their standing rules across `/handoff` and `/continue`. The rules had been kept inside the handoff file, a snapshot of about 500 words that `/handoff` rewrites each time, so they kept vanishing. The failure to avoid is losing these rules across a handoff.

**How to apply:**
- On `/continue`, read the rules file first and obey every rule in it.
- On `/handoff`, only append. Add any operator correction not already there as a new dated line, and reference it in the handoff as "rules file: N rules". The 500-word limit on the handoff does not apply to the rules file.
- When the operator corrects how the orchestrator works, append the rule to the file at once, in the same turn, and say so in one line.
- Each rule states its why, so it can be judged and not just followed.
- The two commands that carry this behaviour are tracked in source at `.claude/commands/continue.md` and `.claude/commands/handoff.md`. Edit those, not the deployed copies.

**The six rules in the file (2026-09-21):**
1. Next items come from the prototype tracker, never `suggest-next`. See [[next-items-come-from-prototype-tracker-priority-order]].
2. Operator goals: delegation (pinned first) and graduation of the prototype branch to main. Same leaf.
3. Prototype (#3383) work commits straight to `lane/mechanical-dispatcher`, no PR, one tracker note per push. Prototype PR #1853 is closed. Everything else goes to main through a lane clone and a PR.
4. `/wip` format. See [[wip-report-format-short-plain-phone-friendly]].
5. "Needs you" is the operator-queue script's NEEDS YOU section verbatim and nothing else. See [[feedback-needs-you-only-when-truly-ready]].
6. Loss of these rules across `/handoff` and `/continue` is the failure to avoid; append corrections at once.

Related: [[feedback-main-session-no-direct-edits]].
