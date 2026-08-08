---
kind: story
size: 3
parent: "xgm2t3f"
status: open
dateOpened: "2026-08-08"
scope:
  - we:scripts/lib/judge-spawn.mjs
tags: [plateau-loop, delivery, operations, jury, judge]
---

# Judge helper — the tool-free juror spawn behind one function

One helper every `judge` step calls: spawn a juror with the findings shape **enforced**, the repo context
stripped, and no tools granted. The recipe below was measured in session, not invented — this slice packages it
so no caller re-derives the flags.

## The recipe

```
claude -p \
  --json-schema "$SHAPE"             # enforced, not requested — answer lands parsed in structured_output
  --output-format json
  --safe-mode                        # drop repo instructions, skills, hooks, plugins
  --tools ""                         # cannot touch the repo it is reviewing
  --model <per-lens> --effort <per-lens>
  --max-budget-usd <cap>             # hard ceiling per juror
  --no-session-persistence           # a juror is throwaway
  --session-id <runId-derived>       # the transcript is findable from the run record
  --append-system-prompt "$MANDATE"  # stable prefix; only the input varies
```

Measured on subscription, identical prompt: `--safe-mode --tools ""` cuts the spawn from **30,226 → 5,521**
context tokens and **11.0s → 6.1s**. Across a five-lens panel that is the difference between wasteful and cheap,
and what it protects is rate-limit headroom, which is the scarce resource on the solo tier.

## Two things this buys beyond tidiness

- **`--tools ""` is a structural guarantee.** The review mandate's rule that a juror must never check the branch
  out stops being prose the model has to recall and becomes something it cannot do.
- **The shape is enforced by the tool, not approximated.** `--json-schema` is implemented as a forced tool call
  (`stop_reason: tool_use`), so there is no prose to parse, no fences to strip, and no ask-and-validate loop to
  build. Retries are for genuine failures only.

## Trap, recorded so nobody re-finds it

`--bare` strips more context but **forces key-based auth and cannot see the subscription** — a spawn using it
fails with *"Not logged in"*. Tier one must use `--safe-mode`. A test should assert the helper never emits
`--bare`.

## Acceptance

`judgeSpawn({ mandate, input, shape, model, effort, budget })` returns a validated object or throws with the
spawn's own error. Per-lens model and effort are parameters, so the jury's care→rigor dial becomes two flags
rather than prompt tuning. Unit tests cover argv construction (pure, no spawning); one integration test covers a
real spawn.

## Not in scope

The hosted-tier backend. This helper is tier one only; the tier-two substitution sits behind the same function
signature and is not built here.
