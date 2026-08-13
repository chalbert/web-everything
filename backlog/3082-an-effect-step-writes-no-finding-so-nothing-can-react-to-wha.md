---
bornAs: xdoahvu
kind: story
size: 2
parent: "3029"
status: resolved
dateOpened: "2026-08-12"
dateStarted: "2026-08-13"
dateResolved: "2026-08-13"
tags: [plateau-loop, operations, engine, dispatch, model-gap]
scope:
  - we:scripts/operations/engine.mjs
  - we:scripts/operations/step-kinds.mjs
---

# An effect step writes no finding, so nothing can react to what an effect produced

Every other step kind records what it produced. An `effect` step does not:
`we:scripts/operations/engine.mjs` returns `{...run, pending: null, cursor: +1}` with no `withFinding`, and
`reads:` is rooted at `input|findings|verdict`, so there is no path from an effect's `result` to any later
step.

Proved by PR #1186's round-3 reviewer, who built the declaration this gap makes impossible — a dispatch, a
compute step that reads the outcome, a human confirm — and ran a FAILING build through it:

```
effect entry : status=applied result={"exit":1,"log":"BUILD FAILED"} error="compile error"
findings     : {"react":{"sawOutcome":"(NOTHING)"}}
the human is asked: "Land it?"
```

The build failed, the run advanced past it, the step that exists to react saw nothing, and the person was
asked to land it with no indication anything was wrong. With no confirm in the declaration the run reaches
`complete`, exit 0, carrying `result: {exit: 1}`.

## Why it blocks the epic, not just a nicety

`#declare-dispatch` is the effect that STARTS something. The whole point of a dispatch is that the work
produces an outcome later — and an outcome nothing can read is not an outcome. Until this exists, the waker
(#3084) cannot resolve a dispatch to anything but "cleanly succeeded", because every other answer needs a
later step to react and no later step can.

## Watch for

- An effect step declares MANY effects. A finding would have to carry all of them, keyed by ordinal, or the
  shape lies about which one is being read.
- `reads:` is deliberately closed to three roots and at most two segments. Widening it is a bigger change than
  writing the finding, and probably the wrong half to change.
- The run record already holds every effect's `result`. The gap is the READ path, not the storage.

## Done when

- [x] A step after an effect step can read what that step's effects produced.
- [x] A declaration can branch on a failing outcome instead of advancing past it.

## How it resolved

`withFinding` on both paths an effect step can settle — the declare path (a step with nothing to do) and the
resume path (a step whose effects landed on a later pass). The second is the one a replay takes, and it is
where four of the five mutation reds land.

The shape carries `applied` and, per effect, `type` / `status` / `result` / `error`. **Keyed by ordinal**, as
the Watch-for demanded: a step may declare the same type twice, and a type-keyed shape drops one and lies
about which result is being read. Nothing else from the run-record entry is exposed — the payload, the
idempotency flag and the handle are the executor's bookkeeping, and a step reaching for them would be going
around the model instead of through it.

The reviewer's probe, which returned `(NOTHING)` before:

```
findings.react: {"sawOutcome":{"exit":1,"log":"BUILD FAILED"},"ok":true}
the human is asked: The build FAILED. Land anyway?
```

`ok: true` there is correct and worth reading twice: the EFFECT applied — starting the build worked — while
the build itself failed, which the declaration learns from `result.exit`. Keeping those separate is what lets
one shape serve both an ordinary effect and a dispatch.

No test changed. All 339 existing operations tests passed untouched, which is the evidence that this adds a
finding rather than altering how anything settles.

Four mutations reddened named tests: dropping the finding on each of the two paths, keying by type, and
leaking the whole entry.
