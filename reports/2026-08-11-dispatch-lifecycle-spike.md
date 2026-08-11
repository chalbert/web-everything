# Spike #3030 — does the background-agent lifecycle cover a dispatch effect?

**Run 2026-08-11 against Claude Code 2.1.220. Answer: option (2), narrowed — start and observe are covered and
scriptable; stop is not exposed. No fifth step kind is needed. The real gap is not the vocabulary; it is the
effect executor's outcome model and the absence of a waker.**

No production code was written. Everything below is a command anyone can re-run.

---

## 1. What the CLI actually provides

| lifecycle verb | provided? | how |
| --- | --- | --- |
| **start** | **yes** | `claude --bg` / `--background` — *"Start the session as a background agent"* |
| **observe** | **yes, and scriptable** | `claude agents --json` — *"Print active sessions (interactive and background) as a JSON array and exit (for scripting; does not require a TTY)"*, plus `--all` for completed sessions and `--cwd <path>` to filter |
| **stop** | **no** | zero matches for `stop`/`kill`/`terminate` across `claude agents --help`. Every other flag on that subcommand sets a *default for dispatched sessions*, not a lifecycle action. |

`claude agents --json` returned 5 live sessions with this record shape:

```
keys: pid, cwd, kind, startedAt, sessionId, name
{"pid":20784,"cwd":"/Users/…","kind":"interactive","startedAt":1785931914821,
 "sessionId":"e2b2ac16-4f85-4447-9c15-be62dbc4026f","name":"nicolasgilbert-55"}
```

**Is the handle stable enough to persist in a run record?** `sessionId` yes — a UUID, durable, and the same
identity the independence check already reasons about. `pid` **no** — it dies with the process and the OS reuses
it, so it is a liveness hint only and must never be the key. `kind` distinguishes background from interactive,
and `--cwd` filters — which matters here because every lane build has its own checkout path.

**Stop is reachable but out of contract.** `pid` is returned, so a signal would work. That is not the tool's
interface and a PID is exactly the unstable handle above. Treat stop as unprovided rather than as available by
back door.

## 2. No fifth step kind is needed

The card's worry was that nothing in `compute`/`judge`/`confirm`/`effect` describes an effect that *starts*
something outliving the run. Reading the engine, the mechanism is already there.

Three of the four kinds **suspend**, and one call resumes all of them
([we:scripts/operations/engine.mjs](../scripts/operations/engine.mjs)): `judge` suspends with its request,
`confirm` suspends recording what is asked and of whom, `effect` suspends with the declared effects. `advance`
resumes each, and its no-resume path is explicitly idempotent:

```js
if (resume == null) return run; // nothing to resume with — the run stays suspended. `advance` is idempotent.
```

So **polling is free and safe by construction** — a waker may call `advance` as often as it likes and change
nothing until the work is done. "Start work, come back later" is expressible today: an `effect` that starts the
agent and records its `sessionId`, a suspend, and a later `advance` carrying the outcome.

This is the answer the statute wants. `#operations-declared-once-callers-generated` says an operation appearing
to need a fifth kind is a signal to change the model — and no change is needed, because the model already
covers it.

## 3. Where the gap actually is — the effect outcome model

[we:scripts/operations/effect-executor.mjs](../scripts/operations/effect-executor.mjs) carries four entry
states: `declared → pending → applied | failed`. An entry is marked `pending` **before** its sink runs, so a
crash mid-sink leaves it indeterminate, and a non-idempotent `pending` entry is **refused** on replay.

That is exactly right for a crash. It is exactly wrong for a build that is deliberately in flight — and the two
share one state. A dispatch would be marked `pending`, and the replay guard would refuse to advance it.

**So the finding is a state-model gap, not a vocabulary gap:** the executor needs to distinguish *"attempted,
outcome unknown"* from *"started on purpose, outcome arrives later"*. That distinction is small, local to one
module, and does not touch the four kinds.

## 4. The waker is the genuinely open question

Something must call `advance` when the dispatched build finishes. It cannot be the dispatching session.

**Measured, not assumed.** Across 2026-08-10/11 this session lost **five** headless `claude -p` runs that
started slow work and exited before it finished — every one instructed against it. One left an orphaned run
record stalled at `pending.kind: "judge"` with zero telemetry; another left a stray vitest process. The last was
a spike run that reached eleven hours holding no lane and producing no branch, and was killed. This is a
property of the harness, not an instruction problem.

**So the run record must be what survives, and the waker must be external.** Candidates, uncosted:

- **the drain**, which already sweeps every 60s — but that makes the operation engine depend on the drain, which
  the epic may not want;
- **an operator or agent re-invoking the CLI**, which is free and honest but not automatic;
- **the converge daemon**, which is deliberately **not installed** and should stay that way until the silent
  re-hold in [we:scripts/merge-ai-prs.mjs](../scripts/merge-ai-prs.mjs) is understood.

`claude agents --json --cwd <lane>` is precisely the poll such a waker would run: no TTY, filterable to one
build's checkout, and keyed on a durable `sessionId`.

## 5. What this spike cost, and the process finding

The question was answerable in **six commands**. A first attempt ran **eleven hours** and produced nothing —
because its brief asked it to test a hypothesis, design against a constraint, contrast the result with #3050,
enumerate failure modes, write the card, resolve it, run the gate and open a PR. That is a build brief wearing a
spike's name. The card said two points; the brief asked for five.

Recorded because it is the more transferable lesson: **a spike's deliverable is an answer, and its brief should
forbid everything else.**

## Follow-ups this spike names, none built here

1. **The executor's fourth state** — separate "in flight by design" from "attempted, outcome unknown", so a
   dispatched effect is not refused by the replay guard.
2. **Choose the waker**, and cost the dependency each choice creates.
3. **Stop has no contract.** If dispatch must be cancellable, that needs the tool to grow a verb or the design to
   accept that a dispatched build cannot be stopped through the sanctioned interface.
