---
bornAs: x5340nd
kind: decision
parent: "3029"
status: open
dateOpened: "2026-08-09"
preparedDate: "2026-08-16"
relatedTo: ["3028", "3050", "3029"]
scope: ["we:scripts/lib/judge-spawn.mjs", "we:scripts/lib/__tests__/judge-spawn.test.mjs"]
tags: [plateau-loop, delivery, operations, jury, judge, guard, argv, capture]
relatedReport: "reports/2026-08-16-3056-judge-spawn-argv-guard-prep.md"
---

# The judge-spawn argv guard is a one-token denylist — a flag-shaped option value reaches argv unchallenged

`assertNoForbiddenArgv` scans the assembled juror argv for exactly one banned token, `--bare`. Every other flag
passes. Two caller-supplied option values reach argv as free strings, so a value shaped like a flag lands in the
spawn list unchallenged. **Capture only:** no live exploit is claimed and nothing is built here.

**Prepared 2026-08-16.** No design exists yet for what replaces the bare denylist, so this prep pass grounds
that gap against a structurally similar, already-ratified statute
([we:docs/agent/platform-decisions.md#guard-unresolvable-reexecution-denies](../docs/agent/platform-decisions.md#guard-unresolvable-reexecution-denies))
and a recurring CLI-hygiene pattern (below), then states one fork with a **bold recommended default**, a
resolved sub-question on `cli`/`cwd`/`env`, an inline skeptic attack and a fresh-context two-confusion screen —
see `relatedReport` for the session's grounding notes. The fork and the recommendation are **not yet ratified**;
prep brings the item to Definition of Ready, it does not decide it.

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

## Recommended path at a glance

| Fork | Recommended default | Main alternative | Confidence |
|---|---|---|---|
| Fork 1 | (c) validate `model`/`mandate` at their own seam — refuse any value starting with `-` | (a) turn the whole-argv scan into a position-aware allowlist | high |

`cli`/`cwd`/`env` are answered directly below the fork, not as a `## Fork N` — see *Whether `cli`/`cwd`/`env`
need the same treatment*.

## Fork 1 — how should a flag-shaped `model`/`mandate` value be stopped from reaching argv?

**Fork-existence justification.** This is a **forced invariant**, not a genuine three-way either/or: option
**(b) — keep the denylist and extend it, as the *sole* defense — is the flawed branch.** By the card's own
words it "can only ever name traps someone has already found," so it is permanently one measured spawn behind
whatever flag-shaped value turns up next; #3050 (open) already commits to fanning this exact guard out to N
jurors, so a defense that only grows by post-hoc addition propagates its lag to every juror rather than staying
local. That rules (b) out as the *primary* mechanism (it survives only as a supplementary layer — see below).
The genuine choice is between the two ways of actually *closing* the gap: (a) and (c).

**Statute — cited as supporting precedent, not binding authority (citation-scope checked, #1932).**
[we:docs/agent/platform-decisions.md#guard-unresolvable-reexecution-denies](../docs/agent/platform-decisions.md#guard-unresolvable-reexecution-denies)
rules a structurally similar case: *"an enumeration cannot be completed from inside the thing being enumerated:
a deny-list over shell is unbounded, so the unknown case must fall closed."* That anchor's own authoring scope
is **nested shell re-execution text**, which is genuinely unbounded (unlimited nesting depth) — this card's
denylist is over **CLI flag names**, a large but *finite*, documented set (`claude --help`). The anchor
therefore does **not** authorize ruling out a full allowlist as infeasible here the way it does for shell text —
unlike the shell case, an allowlist is, in principle, completable. What *does* transfer is the general
architectural lesson, used here only as supporting context: an enumerate-and-extend defense that only grows by
finding traps one at a time is the wrong shape for a security boundary, whether or not the underlying space
happens to be finite. This does not by itself settle (a) vs (c) — that's decided on the merits below.

- **(a) Turn the whole-argv scan into a positional allowlist.** Enumerate the flags `buildJudgeArgv` is
  permitted to emit (`-p`, `--output-format`, `--safe-mode`, `--tools`/`--allowedTools`, `--model`, `--effort`,
  `--max-budget-usd`, `--no-session-persistence`, `--session-id`, `--append-system-prompt`, `--json-schema`) and
  refuse any argv carrying a token outside that set **in a flag-bearing position**. *Rejected.* To be correct it
  must be **position-aware** — it has to know the token right after `--model` is a *value slot* exempt from the
  flag check, while `--model` itself is checked — which is exactly the residual blind spot the card's own cost
  note for this option names ("unless it also knows which tokens are values rather than flags"). Building that
  position-awareness is real engineering, and once built it is re-deriving the same fact (c) checks — whether a
  given value is flag-shaped — after assembly instead of at the source, duplicating the fixed-order argv shape
  `buildJudgeArgv`'s own tests already pin
  ([we:scripts/lib/__tests__/judge-spawn.test.mjs:107-187](../scripts/lib/__tests__/judge-spawn.test.mjs)).
- **(b) Keep the denylist, extend it.** *Rejected as the sole defense* — see the fork-existence justification
  above. Not rejected outright: the acceptance list below requires the existing `--bare` refusal
  (`FORBIDDEN_ARGV` + `assertNoForbiddenArgv`) to keep firing unchanged, so it survives as a **named,
  load-bearing trap record** (#3028's) layered *underneath* whichever positive constraint wins here —
  belt-and-braces, not the belt.
- **(c) Validate `model` and `mandate` at their own seam in `buildJudgeArgv`, the way `effort`/`budget`/
  `sessionId`/`shape` already are**
  ([we:scripts/lib/judge-spawn.mjs:358-369](../scripts/lib/judge-spawn.mjs)). **Recommended default.**
  Concretely: refuse any `model` or `mandate` value whose first character is `-` — a value shaped like a flag
  can never be a real model name or the start of real mandate prose, and no CLI flag exists that doesn't start
  with `-`. This is the same pattern the module already applies one field over, for the same reason:
  `allowedTools` entries are checked against `/^[A-Za-z][A-Za-z0-9_]*$/` specifically **because** "a
  non-identifier reaches argv as a flag"
  ([we:scripts/lib/judge-spawn.mjs:340-350](../scripts/lib/judge-spawn.mjs)) — `model`/`mandate` are the two
  fields that skipped that treatment.

  ```js
  if (typeof model !== 'string' || !model.trim()) {
    throw new TypeError('judge-spawn: `model` must be a non-empty string');
  }
  if (model.startsWith('-')) {
    throw new TypeError(`judge-spawn: refusing \`model\` ${JSON.stringify(model)} — a value starting with "-" reaches argv as a flag, not a model name`);
  }
  // …
  if (typeof mandate !== 'string' || !mandate.trim()) {
    throw new TypeError('judge-spawn: `mandate` must be a non-empty string');
  }
  if (mandate.startsWith('-')) {
    throw new TypeError('judge-spawn: refusing `mandate` — a value starting with "-" reaches argv as a flag, not system-prompt text');
  }
  ```

  **Why this beats (a) on the actual gap.** It closes the false-negative table in this card directly — none of
  `--dangerously-skip-permissions`, `--settings`, `--add-dir`, `-p`, `--tools` would pass `model` or `mandate`
  any more — and it does so **without depending on the third-party parser's greedy-consumption behavior at
  all**. Mitigation 2 (the "honest gap," above) only has to hold *if* a flag-shaped value is allowed to reach
  argv in the first place; reject it at the seam and the CLI's own parser configuration stops mattering to this
  guard's correctness. That directly answers this card's acceptance item 2 (refused, structurally — not
  "tolerated on the greedy-parse mitigation") and item 3 (no residual reliance on an unverified third-party
  parser assumption to record).

  **The symmetric cost, stated plainly (skeptic amendment).** (c) is not strictly cheaper than (a) — it trades
  a one-time positional-allowlist build for a **recurring per-field discipline**: every *future* caller-string
  option `buildJudgeArgv` grows must remember to add its own leading-dash check by hand, and nothing today
  catches a forgotten one structurally (unlike (a), which would cover a new field automatically once built).
  This doesn't flip the default — per-field type-checking is already required regardless of this fork (`effort`/
  `budget`/`sessionId`/`shape`/`allowedTools` are each already hand-validated at their own call site) — but the
  build item should close the gap rather than merely accept it: add a small structural test that walks
  `buildJudgeArgv`'s parameter list and asserts every string-typed, caller-facing option has a leading-dash
  guard, so a forgotten field is provably impossible rather than merely unlikely.

  **Known occurrences.** Refusing an option value that starts with `-` unless the caller opts in via an
  explicit `--` end-of-options marker is a standard, recurring CLI-hygiene pattern, not a bespoke invention:
  Python's `argparse` documents exactly this "looks like an option string" ambiguity and its `--` escape hatch;
  GNU `getopt`'s convention reserves a bare `--` to mark "everything after this is positional, not options," for
  precisely the class of value that could otherwise be misread as a flag; OWASP's command-injection guidance for
  argv-based (non-shell) spawns names validating that a caller-controlled value does not begin with `-` as a
  standard mitigation once shell metacharacters are already ruled out (which they are here, per Mitigation 1,
  above). This card's `model`/`mandate` values have no legitimate reason to start with `-`, so there is no
  `--`-marker UX to design around — a flat refusal is the right shape, not a partial one.

  **The one honest tradeoff.** A `mandate` that legitimately opens with a markdown bullet (`"- Do X, then Y"`)
  would be refused. Accepted: every `mandate` today is a first-party string written into the repo — no
  production caller exists yet (#3035 is where a real one would first appear) — so the fix is a one-time
  rewrite of the mandate text, not a runtime failure mode a caller has to route around. This is the same shape
  of accepted false positive the card already records for `model: '--bare'` under the *current* guard (above,
  "False positive").

Skeptic: SURVIVES-WITH-AMENDMENT — a throwaway skeptic sub-agent attacked classification (sound: (b)-as-sole-
defense really is a forced-invariant exclusion, not hand-waved), merit (no bypass of the leading-dash check
was found across the whole false-negative table; commander's verified greedy-consumption behavior gives it no
non-dash route to smuggle a flag), the statute-scoping move (honest — the anchor's own "unbounded" language
doesn't reach a finite, `--help`-documented flag universe, and `#agent-runner-cli-backend` was checked and
correctly judged non-overlapping — different subject, tool-permission composition vs. value-smuggling), and
every citation's scope (accurate; the OWASP citation is the weakest of the three but isn't load-bearing). The
one landed finding — (c) was framed as strictly cheaper than (a) when it actually trades a one-time build for a
recurring per-field discipline — is folded in above as "The symmetric cost, stated plainly," with a concrete
follow-up (a structural test over `buildJudgeArgv`'s parameter list) added to close it. Default unchanged.

Screen: clear — a fresh-context agent confirmed this fork rules on an internal API-contract question inside
`scripts/lib/` (not a WE standard, so the standard-vs-implementation axis doesn't apply and isn't
mis-invoked), and that stripping cost/effort from both branches still leaves real merit differences
(argv-ordering coupling/fragility for (a) vs. decoupled-at-assembly-time for (c); pattern-composability with
the module's existing per-field seams) — one effort-flavored phrase ("real engineering") was noted as not
load-bearing to the recommendation.

## Whether `cli` / `cwd` / `env` need the same treatment

**No — not under this card, stated plainly per the acceptance checklist's requirement not to leave it silent.**
`model` and `mandate` are vulnerable because they are **caller-supplied strings that `buildJudgeArgv` serializes
into `--flag value` pairs**, which the CLI's *own argument parser* then re-interprets — that is the entire
mechanism this card studies. `cli`, `cwd`, and `env` are not that shape: `cli` is the `argv[0]` executable path
handed directly to `execvp` via `spawnFn(cli, argv, …)`
([we:scripts/lib/judge-spawn.mjs:560](../scripts/lib/judge-spawn.mjs)), and `cwd`/`env` are `child_process.spawn`
**options**, not argv tokens — none of the three is ever parsed by the `claude` CLI's flag grammar, so there is
no flag-shaped-value-smuggling vector here. `cli` does carry its own, *different* residual risk (the card's own
words: "a caller supplying any other path gets it spawned with the juror argv") — but that is a "which program
gets to run" question, not a "which flag reaches argv" one, and belongs to its own decision if and when a real
caller supplies a caller-influenced value. Today `cli`/`cwd`/`env` share the same "no production callers yet"
bound the whole card rests on (above, "The bound") — #3035 is the trigger to revisit, same as for `model`/
`mandate`.

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
