---
kind: task
status: open
dateOpened: "2026-08-05"
tags: []
---

# BLAST_RADIUS misses skills-src/ — editing a skill's source scores lower than editing its build output

scoreEscalation's BLAST_RADIUS list in we:scripts/lib/review-escalation.mjs matches the built skills directory but not we:skills-src/, the source those skills are built from. So a 500-line edit to we:skills-src/jury/subject-jury.workflow.js scores care band low, while the same edit to the built skill file scores high. Operating procedures are exactly what blast-radius exists to catch, and today only the size signal catches the source edits. Found by the 2026-08-04 red-team of #2572.

## The gap

`BLAST_RADIUS` ([`we:scripts/lib/review-escalation.mjs:78-85`](scripts/lib/review-escalation.mjs)) matches
`/(^|\/)\.claude\/skills\//` — "agent skills (the operating procedures)". `we:skills-src/` is not in the list
and matches no other pattern (`^scripts/`, `.githooks/`, `.github/`, the statute paths, the standards JSON).

Measured on the same file at ~500 lines:

| Path | Band |
|---|---|
| `we:skills-src/jury/subject-jury.workflow.js` | `low` |
| `we:skills-src/conveyor/runner.mjs` | `low` |
| the built skill file under the skills directory | `high` |

Same skill, opposite band, decided by whether the edit lands on the source or the build output. Since the
source is where these are actually authored, the built-path pattern is the one that rarely fires.

## Why it matters beyond the score

Today the `size` signal is the only thing parking these PRs, and it only fires above the 400-line
`diffLines` threshold ([`we:scripts/lib/review-policy.contract.json`](scripts/lib/review-policy.contract.json)).
A 300-line rewrite of the jury's roster resolution or the conveyor's runner reaches no reviewer at all. This
was surfaced while red-teaming a proposal to stop parking the `low` band — that proposal was struck, but the
blind spot it exposed is independent of it and outlives it.

## Done when

- `we:skills-src/` scores blast-radius wherever the built skills directory does, and the two agree for the same
  logical file.
- A test in [`we:scripts/lib/__tests__/review-escalation.test.mjs`](scripts/lib/__tests__/review-escalation.test.mjs)
  locks source and build output to the same band, so the pair cannot drift apart again.
- Check whether any other built/source pair in the repo has the same shape before closing.
