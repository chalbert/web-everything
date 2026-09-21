---
name: prototype-findings-go-in-epic-tracker-not-full-items
description: Every finding or follow-up raised in a session gets recorded (never left only in chat); if it is a prototype (#3383) fix or finding it goes in the epic tracker card as a session-update note, NOT filed as a full backlog item. Only non-prototype findings get a real card.
metadata:
  type: feedback
---

When the operator raises findings, follow-ups or fixes in a session, **note all of them** so they never have to remind. Where they go depends on whose they are:

- **Prototype (#3383) machinery** (the mechanical dispatcher, the turn-mechanisation programme #2340, drain/reaper/runner corrections, `/wip` mechanisation): append ONE session-update note to the #3383 tracker card with `node scripts/prototype-tracker.mjs append-note` (the `/prototype-tracker` skill), committed straight to `lane/mechanical-dispatcher`. No full item, no PR of its own.
- **Not prototype** (its epic is not #3383, e.g. #2058's findings under #3567 -> parent #3029): file a real card through the `file-item` operation and land it by PR to main.

**Why:** operator, 2026-09-19: "All should be noted but if prototype fixes they should be noted in the epic tracker not full item", then "Please note so I don't have to remind". Full items for prototype findings add backlog noise; the tracker is the epic's own running record. Consistent with [[prototype-branch-uses-direct-push-not-full-pr]] and [[default-to-prototype-for-mechanical-fixes]].

**How to apply:** when a finding comes up, classify it by parent epic (`parent:` in the card's frontmatter; #3383 or its programme = prototype). Batch prototype findings into one tracker note per session via a detached scribe worker (brief + body file in `~/workspace/.operations/jobs/`), and file non-prototype ones as separate cards. Say in the reply which went where. Do not ask the operator to re-state this rule.
