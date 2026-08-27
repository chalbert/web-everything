---
bornAs: xv3nqsg
kind: story
size: 2
parent: "3318"
status: open
dateOpened: "2026-08-27"
scope:
  - we:scripts/check-standards-rules.mjs
tags: []
---

# Guard that every committed pr-land invocation declares its verification posture

The hand sweep for pr-land call sites has been wrong twice in two review rounds, each miss wedging a whole automated path. A source-level check should refuse a committed invocation that neither carries a verify flag nor is preceded by a verify-lane run.

## The evidence: wrong twice, in two consecutive rounds of one PR

[#3321](/backlog/3321/) flipped `resolveVerifyOptions` so that silence resolves to `requireVerified: true`. That
flip is only safe if every caller that verifies **a different way** says so. The sweep for those callers was done
by hand, and missed one each round:

- **Round 1** missed `we:scripts/lane-drain.mjs`'s `buildPrLandArgs`. The drain lands WE from the **primary**
  checkout, where a lane's verification marker can never appear — lanes are separate clones, and the marker
  lives in the lane's own git directory. Every queued couple would have failed `unverified` and been sent back
  to open. **The entire drain, wedged.**
- **Round 2** missed all four landing invocations in `we:parallel-execute.workflow.js` — **every `/workflow`
  lane**, by the same mechanism.

Two misses, two rounds, two whole automated paths. A sweep with that record will be wrong a third time, and the
third caller may be added by someone who never reads this item.

## Why a human sweep cannot be the control

The property is not visible at the call site. A reader looking at an argv of `--ref=… --json` sees nothing
wrong — it is correct in isolation. It is wrong only in combination with **where the process runs** and
**whether a marker can exist there**, which are facts about other files. Same shape as the defect recorded on
[#3326](/backlog/3326/): correct lines, wrong only in combination with code they do not touch.

Neither is it visible in a diff. Both misses were in files the PR **did not modify** — the change was in the
resolver, the breakage in callers nobody had touched for months.

## What to build

A check over committed source: a landing invocation of `we:scripts/pr-land.mjs` must **declare its posture** —
either

- it carries an explicit verify flag (`--require-verified` or an explicit opt-out), **or**
- it is a path that provably runs `verify-lane` before landing, **or**
- it is annotated as deliberately inheriting the default.

Silence is what this closes. A caller that says nothing is currently indistinguishable from one that has
thought about it, which is exactly the condition that made both misses invisible.

**Refuse rather than warn.** These call sites are added by agents in headless runs; a warning on stderr reaches
nobody at the moment it matters. Same reasoning as [#3344](/backlog/3344/).

## The test that decides whether this is the durable fix

**Replay the guard against rounds 1 and 2.** A guard that would not have caught `buildPrLandArgs` and the four
`we:parallel-execute.workflow.js` invocations is not the fix it appears to be — it is a third hand sweep wearing
a check's clothing. Both cases are known, both are in git history, and both must be demonstrated caught before
this item is done. That is criterion 1 below, and it does not soften to "the tests pass".

## Watch the false-positive direction

A check that flags a correct call site gets an annotation pasted over it within a day, after which it protects
nothing — the pattern named on [#3340](/backlog/3340/) and measured on [#3308](/backlog/3308/), where a first
draft fired on 59 of 60 merged PRs before being cut to 8. Count what this flags across the tree **before**
deciding it is finished, and record the number. If it flags every call site, the escape is doing no work.

## Related

- The **fix** for both misses landed in #3321; this is the guard that stops the next one. Filing it separately is
  deliberate — a fix and the thing that prevents its recurrence are different work.
- [#3242](/backlog/3242/) — `we:scripts/open-pr.mjs` can add `--require-verified` but cannot express the
  opt-out, so one caller has **no legal way to comply** with this check today. That gap must close first, or
  this guard refuses a call site that cannot be fixed.

## Done when

1. **Executable** — a test replaying the guard against the two historical misses (`buildPrLandArgs`, and the
   invocations in `we:parallel-execute.workflow.js`) and asserting **both are caught**, plus that every landing
   invocation currently committed in this repo **passes**. Both directions: the negative half is what keeps the
   check from being annotated into uselessness.
2. The count of call sites flagged across the tree at landing is recorded here.
3. `npm run check:standards` — 0 errors.
