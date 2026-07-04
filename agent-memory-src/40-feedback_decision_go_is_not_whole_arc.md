---
name: feedback-decision-go-is-not-whole-arc
description: "In decision-mode a single \"go\" is the claim+present trigger, NOT ratification authority — never collapse the arc into one turn"
metadata: 
  node_type: memory
  type: feedback
  originSessionId: 7e7cc084-168c-43c9-a1d1-9264832049ec
---

In `/decision` (next-backlog-item decision-mode), there are **two distinct `go`s** and they are NOT the
same turn: the **selection go** (user picks an item off the shortlist, by `go` or by naming `NNN`) →
`claim` + STOP + emit rename slug, then *next turn* present the decision's substance for discussion; and
a later **ratification go** → only after the back-and-forth + red-team does `resolve`/close happen. I
failed this on #1160: one `go` and I read → ratified all 3 forks → resolved → filed the build slice →
committed, all in one turn.

**Why:** the user's planning style is discussion-not-multiple-choice (global CLAUDE.md) — never compress
"help me understand" and "make me choose" into one step. The skill itself prescribes claim-as-its-own-turn
then present-for-discussion (step 0b + step 4 STOP), and the step-0 named-item trap already warns "naming
an item skips *selection*, not the claim." The seducer was the `/decision` wrapper phrase "once I say go —
make the chosen call," which read as ratify-now.

**How to apply:** treat a shortlist pick / named decision item as the **claim trigger only** — claim,
STOP, present next turn, red-team the default (skeptic sub-agent for high-`gates` forks), and wait for an
*explicit* second go before `resolve`+commit. Hardened in `.claude/commands/decision.md` and
`.claude/skills/next-backlog-item/SKILL.md` step 0b (2026-06-20). Related: [[feedback-wait-for-explicit-ratification]],
[[feedback-decisions-are-workitems-not-plan-mode]], [[feedback-decision-mode-engage-the-real-fork]].
