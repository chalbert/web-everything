---
bornAs: x08au3e
kind: story
size: 5
parent: "4075"
status: open
scope: ["we:scripts/lib/for-each-repo.mjs", "we:skills-src/conveyor/runner.mjs", "we:scripts/conveyor/parked-pr-progress-watch.mjs", "we:scripts/lib/gh-throttle.mjs"]
dateOpened: "2026-09-24"
tags: []
---

# Run independent per-repo and per-PR daemon reads in parallel under gh-throttle, so one slow repo cannot starve the rest

Audit: we:reports/2026-09-24-daemon-blocking-antipatterns.md. Findings R5, N1, P3, h-class (batch it). we:scripts/lib/for-each-repo.mjs lines 28-38 is a plain serial loop: it isolates a thrown error but not a hang, so one slow repo delays every other repo in review-daemon and fix-dispatch ticks. we:skills-src/conveyor/runner.mjs lines 344-411 runs 15 mechanical passes x 3 repos serially, with a nested serial per-PR review-dispatch loop (380-393). we:scripts/conveyor/parked-pr-progress-watch.mjs runs one gh api --paginate per parked PR serially (263-273, 347-357). Fix shape: read phases fan out per repo and per PR under we:scripts/lib/gh-throttle.mjs; write phases stay serial per repo; add a per-repo time budget so a repo over budget is skipped for the tick and logged. Invariant: writes that another daemon also makes stay serialized. Done when: tests prove a stubbed hung repo does not delay the others past the budget; LIVE proof: fix-dispatch mean tick (today about 232 s against a 120 s interval) measured over 20 ticks after deploy, before/after in the PR.

## Done when

1. **Executable** — TODO: a command that fails before this item lands and passes after.
