---
kind: story
size: 3
status: open
parent: "3383"
dateOpened: "2026-09-06"
tags: [cost, dispatch, prompt-caching, conveyor, operations]
relatedReport: reports/2026-09-06-token-optimisation-research.md
---

# The replacement dispatcher must preserve prompt-cache correctness

#3383 is rewriting the dispatcher right now, and **nothing on the board tells it to keep the spawned prompt's
prefix byte-stable**. A cache read bills at 0.1× input, this repo already observes ~162 reads per write, and a
byte-unstable prefix is far cheaper to prevent than to retrofit — so the constraint has to land while the
rewrite is in flight, not after it.

## Why this is filed now rather than after #3383

A sweep of #3383's 50 children found **zero** that mention prompt caching or prefix stability — the only
`cache` hit across them is #3457 caching a `gh pr list` call, which is unrelated. Board-wide, only #3006,
#3028 (resolved) and #3326 touch the concept at all. So the requirement is genuinely uncaptured while the
surface it constrains is being actively rewritten (`status: active`, `dateStarted: 2026-08-31`).

This item adds an open child to #3383 (15 → 16), which moves it *further* from the epic-resolve-on-last-child
trigger in [`we:scripts/backlog/epic-resolve.mjs`](../scripts/backlog/epic-resolve.mjs), not closer.

## The constraint

The shape is already proven in this repo by `buildJudgeArgv`
([`we:scripts/lib/judge-spawn.mjs`](../scripts/lib/judge-spawn.mjs)), which the replacement should not regress:

- **Stable instruction via `--append-system-prompt`**, held constant across invocations of the same role.
- **Variable content on stdin**, never interpolated into the prefix — the judged input already goes this way.
- **Explicit `--model` and `--effort`**, so a config change is deliberate rather than incidental. Note both are
  rendered into the request, so varying them *within* a cached conversation trades a small output saving for a
  much larger prefix re-write.
- **Nothing volatile in the prefix** — no timestamps, PR numbers, run ids or non-deterministic key ordering
  ahead of the stable region. Invalidation cascades `tools → system → messages`, so one byte early is a full
  miss.

Grounding for the economics is in the [token-optimisation research](/research/token-optimisation-research/);
the caveat there applies — treat specific figures as pointers to verify.

## Deliberately unscoped

No `scope:` is authored: the files this constrains are mid-rewrite under #3383, and guessing a touch-set inside
an actively-changing surface is exactly the error the 2026-09-06 split analysis made three times. A probe
should scope it once #3383's shape settles. The dispatcher will hold it `unshaped-no-scope` until then, which
is the correct state — its value now is being *visible on #3383*, not auto-dispatching.

## Done when

1. **Executable** — a check that spawns the same role twice and asserts the request prefix is byte-identical
   fails before this lands and passes after.
2. The reads-per-write ratio for a repeated dispatch role is observable rather than inferred (couples to the
   cache-observability item filed alongside this one).
