---
kind: story
size: 3
parent: "4075"
status: open
scope: ["we:backlog/4365-automatic-postmortem-on-every-merge-conflict-a-conflict-a-sc.md", "we:backlog/4366-prevent-prs-that-open-with-red-ci-local-pre-flight-mirrors-e.md"]
dateOpened: "2026-09-28"
tags: []
---

# File the prevention guard(s) owed by chalbert/web-everything#2869's independent review

Filed mechanically ON APPROVAL (operator rule, 2026-09-27 — "prevention outstanding should be filed by default on approval") — this accept verdict named the guard(s) below as owed. None of them blocked the approval; the debt is tracked here instead:

1. `we:backlog/4365-automatic-postmortem-on-every-merge-conflict-a-conflict-a-sc.md:150` — Add a prep-checklist lens: when a card assigns work to a module, grep the card for its own earlier claims about that module (pure, planner, no IO) and reconcile them. Filed as a backlog item, not a deterministic gate.
2. `we:backlog/4365-automatic-postmortem-on-every-merge-conflict-a-conflict-a-sc.md:110` — Add a prep-time check that each 'never/exactly once/counts once' guarantee in a card's Design maps to a named Task or Done-when test. Filed as a backlog item, not a deterministic gate.
3. `we:backlog/4366-prevent-prs-that-open-with-red-ci-local-pre-flight-mirrors-e.md` — Add a check:standards lint that rejects `exec`/`execSync`/`shell: true` in `scripts/operations/*-io.mjs`. Also add one line to the card's Design section requiring argv-array spawning for any user-derived title or body.
4. `we:backlog/4365-automatic-postmortem-on-every-merge-conflict-a-conflict-a-sc.md` — Give trailer parsers a shared helper that filters by comment `author`/`authored-by-actor` before parsing. Add a lint or test rule that any `*_TRAILER_RE` consumer goes through that helper.
5. `we:backlog/4366-prevent-prs-that-open-with-red-ci-local-pre-flight-mirrors-e.md:90` — A unit test asserting that `openPrOperation` with `dryRun: true` actually executes the preflight IO shell and returns a populated `allGreen` verdict instead of skipping the effect step.
6. `we:backlog/4365-automatic-postmortem-on-every-merge-conflict-a-conflict-a-sc.md:140` — An integration test verifying that `recordResolvedConflict` successfully extracts the trailer from the newly posted completion comment in the stacked-rebase flow, not an alert comment.

Idempotency key (do not edit): approval-prevention-key:chalbert/web-everything#2869@63a3befba9789f955bbbfec3f5bba0fbbeab6593

## Done when

1. **Executable** — TODO: a command that fails before this item lands and passes after.
