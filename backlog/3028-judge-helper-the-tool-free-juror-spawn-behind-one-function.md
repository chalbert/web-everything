---
bornAs: xdh8sim
kind: story
size: 3
parent: "3029"
status: resolved
dateOpened: "2026-08-08"
dateResolved: "2026-08-09"
graduatedTo: scripts/lib/judge-spawn.mjs
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

On subscription, with an identical prompt, `--safe-mode --tools ""` cuts the spawn's loaded context by
**roughly an order of magnitude** and shortens wall clock correspondingly. The **direction** is what this
slice rests on and it reproduces every time. Across a five-lens panel that is the difference between wasteful
and cheap, and what it protects is rate-limit headroom, which is the scarce resource on the solo tier.

**The two original figures stay withdrawn.** The in-session pair and its independent re-run disagreed, neither
recorded its conditions, and neither is resurrected here. What replaces them is a committed script —
[we:scripts/measure-judge-spawn.mjs](../scripts/measure-judge-spawn.mjs) — which spawns both arms with an
identical prompt/model/effort/schema and prints every number stamped with the conditions that produced it.
Its first recorded run, **which is a sample and not a constant**:

| arm | loaded context (median) | wall clock (median) |
|---|---|---|
| treatment — `--safe-mode --tools ""` | **4,718 tok** | **7,446 ms** |
| control — neither flag | **79,249 tok** | **20,820 ms** |

⇒ context **16.8×**, wall clock **2.8×**. Conditions: cwd `.lanes/web-everything/lane-1` (a full checkout of
this repo, with `we:CLAUDE.md` and `we:AGENTS.md` present), `git HEAD e616a23f`, `claude 2.1.220`,
`--model haiku --effort medium`, 3 pairs, macOS `darwin 25.5.0`, node v22.1.0, 2026-08-09, total spend $0.27.
Per-run spread was wide on the control arm (62,128 / 79,249 / 181,084 tok) and non-trivial on the treatment
arm (4,715 / 4,718 / 15,181 tok) — prompt-cache state is uncontrolled, which is exactly why the ratio is
reported from medians and why **the table is a re-runnable output, not a constant to cite.** Re-run the script
rather than quoting this row; a figure without its conditions block is what got withdrawn twice.

## Three things this buys beyond tidiness

- **`--tools ""` is a structural guarantee.** The review mandate's rule that a juror never checks the branch out
  **in a shared tree** ([we:skills-src/review/SKILL.md](../skills-src/review/SKILL.md), citing #2336) stops being
  prose the model has to recall and becomes something it cannot do. Note it is *stronger* than the mandate: the
  mandate permits a throwaway clone, and a tool-free juror cannot make one — that escalation path is deliberately
  out of the judge contract (see [#3035]).
- **The shape is enforced by the tool, not approximated.** `--json-schema` is implemented as a forced tool call
  (`stop_reason: tool_use`), so there is no prose to parse, no fences to strip, and no ask-and-validate loop to
  build. Retries are for genuine failures only.
- **A juror is a *structurally* distinct actor, not a nominal one** — added 2026-08-09, verified in build, and
  the reason this helper is more than tidiness. This repo keys reviewer identity on `CLAUDE_CODE_SESSION_ID`
  ([we:scripts/lib/review-independence.mjs](../scripts/lib/review-independence.mjs)), and
  **a subagent inherits its parent's value** — so by the repo's own test *every review run as a subagent is the
  same actor as the PR's author*, whatever the mandate calls it. That inheritance is stated in
  [we:scripts/lib/review-independence.mjs](../scripts/lib/review-independence.mjs)'s header, recorded in #3006,
  and was re-verified here: a freshly spawned subagent reported the parent's id byte-for-byte. Meanwhile
  [we:scripts/lib/review-core.mjs](../scripts/lib/review-core.mjs) tells the model it is *"A reviewer subagent
  (independent of you and of the PR's original author)"* — and **nothing enforces that sentence**: the
  independence decider is imported by [we:scripts/review-set-label.mjs](../scripts/review-set-label.mjs),
  [we:scripts/pr-land.mjs](../scripts/pr-land.mjs) and
  [we:scripts/lib/auto-land-seam.mjs](../scripts/lib/auto-land-seam.mjs), i.e. the label and land seams, but
  **never by the review path that emits the claim**. A headless `claude -p` breaks the inheritance: three spawns
  whose environment carried the parent's id each reported a *different* `session_id`. Supplying `--session-id`
  goes further and makes the identity **deterministic and recordable** rather than merely fresh, so `judgeSpawn`
  derives one from `runId`+`lens` and **returns it** — a caller can record which actor judged, as a machine fact
  instead of a sentence in a prompt. Read the limit honestly, per #2895: a distinct session id is still not an
  *unforgeable* actor signal. What it removes is the failure a subagent juror has **by construction** and cannot
  argue its way out of.

## Trap, recorded so nobody re-finds it

`--bare` strips more context but **forces key-based auth and cannot see the subscription** — a spawn using it
fails with *"Not logged in"*. Tier one must use `--safe-mode`. A test should assert the helper never emits
`--bare`.

Re-verified live against `claude 2.1.220` while building: exit 1, `is_error: true`, `result: "Not logged in ·
Please run /login"`, zero tokens billed. `--bare`'s own help text is the cause — Anthropic auth under it is
*"strictly ANTHROPIC_API_KEY or apiKeyHelper via --settings (OAuth and keychain are never read)"*.

## Acceptance

`judgeSpawn({ mandate, input, shape, model, effort, budget })` returns a validated object or throws with the
spawn's own error. Per-lens model and effort are parameters, so the jury's care→rigor dial becomes two flags
rather than prompt tuning. Unit tests cover argv construction (pure, no spawning); one integration test covers a
real spawn.

**The measurement lands with the helper, or not at all.** A committed script — argv in, loaded-context and wall
clock out — that anyone can re-run, plus its recorded conditions (cwd, model, prompt). Until that exists no
figure goes on this item, in the report, or in the statute; only the direction does.

### What shipped

- [we:scripts/lib/judge-spawn.mjs](../scripts/lib/judge-spawn.mjs) — `judgeSpawn` plus the pure seam it rests
  on: `buildJudgeArgv` (argv, spawns nothing), `parseJudgeOutcome` (stdout → validated object or a throw
  carrying the CLI's own words), `deriveSessionId` (a deterministic RFC 9562 v8 UUID from `runId`+`lens`),
  `loadedContextTokens`, and `assertNoForbiddenArgv` (the runtime `--bare` refusal).
- [we:scripts/lib/__tests__/judge-spawn.test.mjs](../scripts/lib/__tests__/judge-spawn.test.mjs) — 51 unit
  tests, no process spawned, including the two `--bare` assertions this item asked for.
- [we:scripts/lib/__tests__/judge-spawn.integration.test.mjs](../scripts/lib/__tests__/judge-spawn.integration.test.mjs)
  — the one real spawn. **Opt-in** (`WE_JUDGE_SPAWN_LIVE=1`): unlike this directory's `git`/`node` subprocess
  tests it bills a metered API call and needs an interactive subscription login, so leaving it ungated would
  charge every `npm run test:unit` and fail in any CI without that login.
- [we:scripts/measure-judge-spawn.mjs](../scripts/measure-judge-spawn.mjs) — the measurement, with its
  conditions block. It builds the treatment arm by **calling the shipped `buildJudgeArgv`**, never a copy, so a
  drifted recipe breaks the measurement rather than being silently measured.

The judged input rides **stdin**, not argv: a diff has no `ARG_MAX` ceiling there, and it keeps the positional
prompt slot empty — which matters because `--tools` is variadic and would swallow a positional argument sitting
after `--tools ""`. A unit test pins that the token after `--tools ""` is always an option.

## Not in scope

The hosted-tier backend. This helper is tier one only; the tier-two substitution sits behind the same function
signature and is not built here.
