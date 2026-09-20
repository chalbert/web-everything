---
name: drain-old-pr-queue-before-new-work
description: Do not pick NEW autonomous work while any PR opened before the current day is still open in web-everything, frontierui or plateau-app; work that moves such a PR toward merge always comes first. Say "held: pr-queue-first" when refusing a pick.
metadata:
  type: feedback
---

Do not pick **new** work while any PR opened **before the current day** is still open in **any** constellation repo (web-everything, frontierui, plateau-app). "New work" means new backlog items, prepare or build dispatches, new graduation increments, and new mechanisation slices chosen by the orchestrator.

**Always allowed, and it comes first** (work that moves an old PR toward merge): independent reviews, fixes for `review:changes`, conflict resolution, folds into the prototype branch, ci-heal, unsticking a deferred PR.

**Also allowed:** work the operator explicitly asks for in the current turn. That is not an autonomous pick.

**Why:** operator, 2026-09-20: "Wait for pr: wait until PRs that were opened before today to be merged before picking new work", and "note so I don't have to remind". A queue of old PRs had grown unreviewed for up to 12 days (plateau-app #148-#155, and #2072 held by an unreviewed impl half). New work made the pile worse.

**How to apply:**
- Before dispatching anything, list open PRs in ALL THREE repos (never fewer). If any was opened before today, dispatch only PR-closing work.
- When refusing a pick, say "held: pr-queue-first".
- The mechanical form is a hold row in `land-advance` / the conveyor runner. Link this rule to the tracker note item on the queue-first gate (#3383 tracker), see [[prototype-findings-go-in-epic-tracker-not-full-items]].
- Capacity still applies (machine load, worker cap). Clearing the queue is not a licence to exceed it; see [[full-concurrency-is-the-default-never-a-cost-judgment]].
- Do not ask the operator to re-state this rule.
