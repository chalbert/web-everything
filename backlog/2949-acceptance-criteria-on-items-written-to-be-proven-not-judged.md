---
bornAs: xctebq6
kind: story
size: 3
parent: "2948"
status: open
dateOpened: "2026-08-06"
tags: []
---

# Acceptance criteria on items, written to be proven not judged

Every item states how it will be proven done, on a determinism ladder: an executable check first, an observable artifact second, a prose claim with an exact place to look last. Criteria are authored at file time and committed, so the implementing lane cannot set its own bar, and the review reads a named list instead of re-deriving what could be wrong.

## Why this is a review-cost item

Only **266 of 2919** items carry a `## Acceptance` section — about 9% — even though the dev-ready bar asks for "clear acceptance criteria" and `/resolve` re-checks them. The only gate-enforced goal field is the lead-paragraph digest. So a juror today has nothing to check *against*, and open-ended "find what's wrong with this diff" is the most expensive mandate you can give a model.

Pre-registered criteria change the shape of the review: each juror checks a named list plus anything catastrophic, instead of re-deriving the space of possible defects. That is a much shorter read and a much shorter argument — the biggest token lever after cutting the always-on lens set. It also **dissolves the scope question mechanically**: a finding that traces to a criterion is in scope, one that does not is a carve-out by construction (#2950), with no judgment call.

This cashes in a call already settled on #2636 — *"early human alignment (jury pre-registered at prepare)"* — and is the item-side half of #2638's prepare-time charter.

## The determinism ladder

Write criteria as high on this ladder as the item allows:

| tier | form | who checks it |
|---|---|---|
| 1 · executable | a named command that fails before and passes after — a test, a `check:standards` rule, a webcase, a visual baseline diff | nobody. It is green or it is not |
| 2 · observable | a named artifact or state: a file at a path, an endpoint returning X, a pattern present or absent | one cheap command, no judgment |
| 3 · assertable | a prose claim plus the exact place to look (*`resolveRoster` returns an empty roster for care `none`*) | a juror must read — costly, so cap these |
| — | anything vaguer ("improves clarity", "handles errors properly") | not a criterion. Rewrite it or drop it |

**Every item carries at least one tier-1 criterion, or an explicit line saying why it cannot** (doc-only, pure design judgment). That single requirement does most of the work: it forces the author to think about proof at file time, when it is cheap and convergent, rather than at review time, when it is a negotiation.

## Authoring, not self-certifying

Criteria are authored **at file time** by a single agent — shaped by the lens set (what would correctness need to see, what would conformance need to see) but written in one pass, not a fan-out. Writing criteria is convergent and cheap; only judging them is worth a jury. A committee-authored variant is worth trying at `high` care later, using the same care band data.

**The implementing lane must never write its own criteria.** Same anchoring problem the `dismissed-findings` signal exists to catch: an author who sets the bar sets it where the work already is. Criteria live on the item, committed to git, so weakening them is a visible diff rather than a private judgment.

Cap the count at 3–5 so this does not become its own ceremony. Start as a convention with a `check:health` flag; promote to a `check:standards` error once the backlog has caught up.

## Build

- we:docs/agent/backlog-workflow.md — the ladder, the ≥1-tier-1 rule, the cap, and the who-authors-them rule
- we:scripts/backlog/scaffold.mjs — render an `## Acceptance` skeleton into every new item
- we:scripts/check-health.mjs — a flag for an item that is dev-ready with no tier-1 criterion and no stated reason
- we:.claude/skills/next-backlog-item/SKILL.md — prefer items with tier-1 criteria in the selection tie-break

## Acceptance

1. **Executable** — `node we:scripts/backlog.mjs scaffold --kind=story …` produces an item whose body contains an `## Acceptance` section; a vitest case asserts it.
2. **Executable** — a `check:health` case asserting a dev-ready item with no tier-1 criterion and no stated exemption raises the new flag, and one with either does not.
3. **Observable** — `npm run check:health` reports the current count of dev-ready items missing tier-1 criteria, giving a baseline to burn down.
4. **Executable** — `npm run check:standards` green.
