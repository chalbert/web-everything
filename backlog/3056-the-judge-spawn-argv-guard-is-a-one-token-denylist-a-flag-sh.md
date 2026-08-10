---
bornAs: x5340nd
kind: decision
parent: "3029"
status: open
dateOpened: "2026-08-09"
relatedTo: ["3028", "3050", "3029"]
scope: ["we:scripts/lib/judge-spawn.mjs", "we:scripts/lib/__tests__/judge-spawn.test.mjs"]
tags: [plateau-loop, delivery, operations, jury, judge, guard, argv, capture]
---

# The judge-spawn argv guard is a one-token denylist — a flag-shaped option value reaches argv unchallenged

`assertNoForbiddenArgv` scans the assembled juror argv for exactly one banned token, `--bare`. Every other flag
passes. Two caller-supplied option values reach argv as free strings, so a value shaped like a flag lands in the
spawn list unchallenged. **Capture only:** no live exploit is claimed and nothing is built here.

## What the guard actually does

Read against `main` at `1fb43d7a`:

- [we:scripts/lib/judge-spawn.mjs#FORBIDDEN_ARGV](../scripts/lib/judge-spawn.mjs) is a frozen array with **one
  entry**: `'--bare'`. Its comment states the reason — `--bare` forces key-based auth and cannot see a
  subscription login, the trap #3028 recorded.
- [we:scripts/lib/judge-spawn.mjs#assertNoForbiddenArgv](../scripts/lib/judge-spawn.mjs) iterates that array and
  throws on `argv.includes(banned)`. That is the whole check: **one `Array.prototype.includes` over one token.**
- [we:scripts/lib/judge-spawn.mjs#judgeSpawn](../scripts/lib/judge-spawn.mjs) calls it once, after
  `buildJudgeArgv`, described in the source as *"belt-and-braces: the trap can never reach a real process, even
  if `buildJudgeArgv` is later edited."* That is an accurate description of what it does — it guards the *trap*,
  not the *argv*.

The scan is **positionless**. It compares tokens for equality and has no notion of whether a token is a flag the
helper emitted or a value the helper passed through. Two consequences follow, in opposite directions:

- **False positive.** `model: '--bare'` is refused, even though the CLI would read it as a model *name*, never as
  the flag.
- **False negative.** Any other flag name supplied as an option value passes.

## The reproduction — an injected `spawnFn`, no process started

Run against `1fb43d7a` with a fake `spawnFn` that starts nothing and returns a canned JSON result, so this costs
nothing and bills nothing. Each row is the `model` option's value, and the outcome is whether `judgeSpawn`
reached the spawn call with that token in `argv`:

| `model` value | outcome |
|---|---|
| `--dangerously-skip-permissions` | **passed** the guard; lands in argv immediately after `--model` |
| `--settings` | **passed**; same position |
| `--add-dir` | **passed**; same position |
| `-p` | **passed** |
| `--tools` | **passed** |
| `--bare` | refused — the single denylist entry |

`mandate` behaves the same way: `mandate: '--dangerously-skip-permissions'` passes and lands as the token after
`--append-system-prompt`.

## Which option surfaces are genuinely unconstrained — confirmed, not assumed

Every option was probed. Only two reach argv as an unconstrained caller string:

| option | validation in `buildJudgeArgv` | reaches argv as a free string? |
|---|---|---|
| `model` | `typeof === 'string'` and non-blank — **nothing else** | **yes** |
| `mandate` | `typeof === 'string'` and non-blank — **nothing else** | **yes** |
| `effort` | must be in `EFFORT_LEVELS` (`low`/`medium`/`high`/`xhigh`/`max`) | no |
| `budget` | positive finite number; emitted as `String(budget)` | no |
| `sessionId` | canonical lowercase UUID regex | no |
| `shape` | must be a non-array object; emitted as `JSON.stringify(shape)`, so the token always opens with `{` | no |
| `runId` / `lens` | never emitted — hashed into the `deriveSessionId` seed, which the UUID regex then constrains | no |

Verified by probe: flag-shaped `effort`, `budget`, `sessionId` and `shape` are each rejected by their own type
check before argv is built, and `runId: '--bare'` / `lens: '--settings'` produce a valid UUID with neither token
anywhere in argv.

**One surface beyond the argv question, recorded because it sits at the same seam.** `judgeSpawn`'s `cli`
parameter — *the executable itself* — has **no validation at all**. It defaults to the `JUDGE_CLI` constant
(`'claude'`) and is documented as *"the binary to run"*, an override the module offers on purpose, but a caller
supplying any other path gets it spawned with the juror argv. `cwd` and `env` are likewise passed through
unchecked. The no-shell mitigation below does **not** cover this: no argument has to split into tokens when the
caller simply names a different program. The same bound applies — first-party declarations only — but it belongs
on the record next to the argv scan rather than in a separate card.

## Two things bound this — state both, and the gap in the second

**1. The spawn uses no shell, so a value cannot split into extra tokens.** `judgeSpawn` calls
`spawnFn(cli, argv, { cwd, env, stdio })` with an argv **array** and no `shell: true`. Node passes that array to
`execvp` directly, so a value containing spaces, quotes or `;` is one argv element and stays one argv element.
The only reachable shape is *"one option's value happens to be spelled like a flag"* — never *"one value becomes
two arguments."*

**2. Commander-style greedy parsing consumes a flag-shaped value as the value, not as a flag.** Verified against
this repo's own installed commander (**10.0.1**): parsing
`--tools '' --model --dangerously-skip-permissions --effort medium` yields
`{ tools: [''], model: '--dangerously-skip-permissions', effort: 'medium' }`. An option declared with a required
argument takes the next token whatever it starts with. On that parser the realistic worst case is a spawn that
fails on a bogus model name.

**The honest gap.** Mitigation 2 was verified against **this repo's** commander, **not** against `claude`
2.1.220's actual parser configuration. No real spawn was run to prove it — deliberately, since this is a capture
and a metered call is not what a capture is for. Nor can the assumption be checked by reading: at 2.1.220 the CLI
ships as a compiled Mach-O arm64 executable (~257 MB) rather than a readable JS bundle, so its argument handling
is not statically inspectable from here. **So the mitigation rests on an assumption about a third-party CLI's
argument parsing, and that assumption is the part of this card worth someone's attention.** Whoever takes this
item should decide whether to settle it with one cheap metered spawn or to make the guard not need the
assumption.

## Why a narrow guard here matters more than its size

`judgeSpawn` is the mechanism every future independent review runs through. #3028 (resolved) shipped it; **#3050**
(open) is the panel that fans it out to N jurors, and its acceptance list already says *"`assertNoForbiddenArgv`
still fires per child."* A weak guard therefore propagates to every juror rather than staying local.

The design intent is explicitly structural. #3028's card calls `--tools ""` *"a structural guarantee"* — a juror
*cannot* touch the repo it reviews, as opposed to being told not to. #3050 leans on the same property for its
depth cap: *"`buildJudgeArgv` always emits `--tools ''`, so a juror cannot spawn anything at all."* A flag that
re-granted capability would undo a guarantee two cards already rest on. That is the reason to record the
denylist's narrowness even though no such flag is reachable today.

## The bound — say it plainly

**This is a robustness gap, not a live exploit.**

- No caller passes an attacker-influenced `model` or `mandate`. `judgeSpawn` has **no production callers at all**
  yet: the only importers are its own tests and
  [we:scripts/measure-judge-spawn.mjs](../scripts/measure-judge-spawn.mjs), a fact #3050 also records. The judge
  step kind in [we:scripts/operations/step-kinds.mjs](../scripts/operations/step-kinds.mjs) *declares* a request
  and never performs one, and the only `model:` in that tree is the literal `'sonnet'` in
  [we:scripts/operations/__fixtures__/fixture-operation.mjs](../scripts/operations/__fixtures__/fixture-operation.mjs).
- Every value that reaches argv today is a **first-party declaration written into the repo**, not input from a
  diff, a PR body, or anything a reviewed change could influence.
- Nothing observed here escalated any capability. The probes show tokens *reaching argv*, and on the parser we
  could test they are consumed as values.

Read it as *"the guard does less than its position implies"*, not as *"a juror can be re-armed."*

## The design question — NOT ruled here

Three candidate shapes, deliberately left open:

1. **Turn the scan into an allowlist** — enumerate the flags `buildJudgeArgv` is permitted to emit and refuse any
   argv carrying anything else. Strictly bounded, and it stops depending on what the third-party parser does.
   Cost: the list must be maintained against every CLI upgrade, and it inherits the same positionless blind spot
   unless it also knows which tokens are values rather than flags — an allowlist that treats every value slot as
   exempt forbids nothing new, and one that does not will refuse legitimate model names.
2. **Keep the denylist and extend it.** Cheap, no upgrade coupling, and it matches how the current entry earned
   its place — one measured trap at a time. Cost: unbounded by construction; it can only ever name traps someone
   has already found, which is the property this card is about.
3. **Validate option values at their own seam** — constrain `model` and `mandate` where they enter
   `buildJudgeArgv`, the way `effort`, `budget`, `sessionId` and `shape` already are, and let the argv scan keep
   guarding only what the helper itself emits. This is the shape the module *already uses everywhere else*, which
   is an argument for it; against it, a model-name pattern is a guess about a vocabulary Anthropic owns and will
   extend, and `mandate` is free prose by design and cannot be pattern-constrained at all.

These are not exclusive — (1) and (3) compose. **No option is recommended here.**

## Acceptance

- [ ] The fork above is ruled, with the losing options' costs recorded.
- [ ] Whatever is ruled, the record states plainly whether a flag-shaped option value is *refused* or
      *deliberately tolerated on the greedy-parse mitigation* — silence is not an acceptable outcome.
- [ ] If the ruling keeps relying on greedy parsing, the assumption about the CLI's parser is either **verified
      against the real binary** and the result recorded with its conditions, or explicitly recorded as an
      unverified dependency on third-party behaviour.
- [ ] A test asserts whatever is ruled, in the existing pure-seam style of
      [we:scripts/lib/__tests__/judge-spawn.test.mjs](../scripts/lib/__tests__/judge-spawn.test.mjs) — injected
      `spawnFn`, no process started.
- [ ] The existing `--bare` refusal is unchanged; its two assertions still fire.
- [ ] Whether `cli` / `cwd` / `env` deserve the same treatment is answered one way or the other, not left silent.

## Neighbours — related, not duplicated

- **#3028** (resolved 2026-08-09, graduated to
  [we:scripts/lib/judge-spawn.mjs](../scripts/lib/judge-spawn.mjs), PR #1131) built the helper and **records the
  `--bare` trap** — its *"Trap, recorded so nobody re-finds it"* section, and its requirement that *"a test
  should assert the helper never emits `--bare`."* **It owns that one trap, not the generalisation.** Nothing on
  it asks whether the guard should cover flags beyond it, and it is resolved, so it cannot absorb this. This card
  is the general question its single-entry denylist leaves open.
- **#3050** (open) fans `judgeSpawn` out to N jurors and requires `assertNoForbiddenArgv` to fire per child. It
  **propagates** the guard; it does not change what the guard checks. If this card is ruled toward a stronger
  guard, #3050 inherits it for free.
- **#3029** (open epic) is the parent — the operation engine this helper serves.
- **#3035** (open) is the `review-pr` operation, the first real consumer. It is where a non-fixture `model` value
  would first be declared, which is when this stops being purely hypothetical.
