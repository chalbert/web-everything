---
kind: story
size: 1
status: resolved
scaffoldedBy: "loop-console"
dateScaffolded: "2026-08-13"
dateOpened: "2026-08-13"
dateStarted: "2026-08-13"
dateResolved: "2026-08-13"
tags: [review, jury, isolation, guard, footgun, follow-up]
scope:
  - we:scripts/lib/judge-spawn.mjs
  - we:scripts/lib/__tests__/judge-spawn.test.mjs
---

# The case-variant lane hole is open, and two comments say it is closed

`assertLaneCwd` refuses a tool-bearing juror pointed at the driver's own lane, comparing lane roots after
resolving the real path. It uses `fs.realpathSync`, which resolves symlinks but **echoes back the caller's
spelling**:

```
realpathSync("/users/…/lane-13")        → /users/…/lane-13     (as typed)
realpathSync.native("/users/…/lane-13") → /Users/…/lane-13     (as it exists)
```

On a case-insensitive filesystem those name one directory. The lane-root compare sees two strings, decides
they are different lanes, and hands a juror unscoped `Bash` pointed at the working tree its driver is
mid-review of — the exact thing the refusal exists for.

Named by PR #1178's round-5 reviewer, who drove it end to end through `judgeSpawn`.

## Why it is worth a card rather than a silent one-liner

The hole itself needs `JUDGE_LANE_CWD` set to an oddly-cased path, so it is hardening. What is not hardening is
that **two comments state it is closed** — in the file whose entire job is enforcing an isolation guarantee.
That is the fifth version of this check, and four of the five were wrong in a way a comment asserted was right.

## Also: the comment rule, tried here first

Every sentence claiming a guarantee either becomes a test or gets deleted. This file is the worst offender, so
it is where the rule gets tried before anything binds on it.

## Done when

- [x] A differently-cased spelling of the driver's own lane is refused.
- [x] No comment in the file claims a guarantee that no test defends.

## How it resolved

`realpathSync.native` where the platform has it, behind a named `REAL_PATH` so the distinction has somewhere
to be explained once. Verified against this machine's real paths, not a stub: `/users/…/lane-3` against a
driver in `/Users/…/lane-3` now refuses.

## What the comment rule was worth here, measured

| | before | after |
| --- | --- | --- |
| `assertLaneCwd` doc comment | 38 lines | 29 |
| inline comments inside the function | 8 | 1 |

A 24% cut on the doc and seven of eight inline comments gone. Modest on the doc, and honestly so: most of that
comment was already the KEEPABLE kind — a record of four earlier versions that looked right and were not. What
the rule removed was the restatement layer, and the inline count is where that shows.

The load-bearing change is not size. Every "so N things are refused, and each closes…" sentence — a guarantee
the code already states and no test defended — is gone, replaced by the dead-end list and by tests. The
sentence that was FALSE went with them.
