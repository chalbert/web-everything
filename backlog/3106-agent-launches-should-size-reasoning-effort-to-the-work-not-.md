---
bornAs: xoj6gye
kind: story
size: 2
status: resolved
dateOpened: "2026-08-14"
dateStarted: "2026-08-16"
dateResolved: "2026-08-16"
tags: [agent, model-routing, orchestration]
scope:
  - we:docs/agent/delivery-loop.md
  - we:docs/agent/backlog-workflow.md
---

# Agent launches should size reasoning effort to the work, not just the model

> **Resolved 2026-08-16.** Landed by [329299b4](https://github.com/chalbert/web-everything/commit/329299b4)
> (already on `main`): a new *Effort routing* section in
> [we:docs/agent/backlog-workflow.md](docs/agent/backlog-workflow.md#effort-routing) states the convention —
> same "don't omit it, don't default-cheap" discipline as model routing, routed on task SHAPE (mechanical/
> pointer → `low`, execution-to-spec → `low`/`medium`, judgment → `high`/`xhigh`), grounded in this card's own
> worked examples (#1236-round-2 mechanical fix, #1234's opt-in-and-unused judgment fork).
> [we:docs/agent/delivery-loop.md](docs/agent/delivery-loop.md)'s reviewer-spawn command now sets
> `--effort high` explicitly and links to that section. This item's own claim-through-resolve turn adds no
> further doc changes; it verifies and closes the record.

Operator observation, 2026-08-14: every agent launched this session (Agent tool, headless `claude -p`
reviewers) had its **model** tier picked to match the task (Haiku for pointers, Sonnet for execution-to-spec,
Opus for judgment) — but never its **reasoning effort**. The Agent tool and the Workflow tool's `agent()`
both accept an effort parameter (`low`/`medium`/`high`/`xhigh`/`max`); it was left at the inherited default on
every call this session, mechanical or not.

## Why this is a real gap, not a nice-to-have

The same asymmetry that justifies model routing applies to effort: a mechanical fix with an exact "To land"
checklist (e.g. this session's #1236-round-2 fix — one regex, one comment, the reviewer named the fix
verbatim) needs low effort to execute correctly. A judgment call under a real, unresolved fork (e.g. #1234's
"does this protection do anything in production, or is it opt-in-and-unused" question) needs high or xhigh
effort to reach a right answer rather than a plausible one. Routing model but not effort leaves a Sonnet-at-
default-effort agent doing careful design judgment, or an Opus-at-default-effort agent burning reasoning
tokens on a mechanical one-file diff — the same overspend/underspend problem model routing exists to fix, on
the other axis.

## What is not yet established

- Whether the two axes (model, effort) should be chosen independently or as a small number of named
  presets (e.g. "mechanical" = Haiku/Sonnet + low, "judgment" = Opus + high/xhigh) — a preset table would be
  more mechanical and auditable than two independent judgment calls per launch.
- Whether this belongs as a documented convention (a table in `we:docs/agent/delivery-loop.md` or the
  orchestration guidance an agent reads before dispatching) or as something more mechanically enforced later.
  Given #2607 (deterministic core, thin judgment), a documented convention is the right size for this: model
  and effort selection from a task's shape is a judgment call, not something a script can decide.

## Done when

- [x] `we:docs/agent/delivery-loop.md` (or wherever agent-dispatch guidance lives) states the effort
      convention alongside the existing model-routing convention, with the same "don't omit it, don't
      default-cheap" discipline the model-routing rule already carries. → the *Effort routing* section in
      `we:docs/agent/backlog-workflow.md#effort-routing`, linked from `we:docs/agent/delivery-loop.md`.
- [x] At least one worked example of each tier (mechanical → low, judgment → high/xhigh) cited from real
      session evidence, the same way the model-routing convention is grounded. → #1236-round-2 (mechanical)
      and #1234 (judgment), both cited inline in the *Effort routing* section.

## Watch for

- Don't turn this into a rigid lookup table that fights real judgment calls — the model-routing convention
  works because it names the SHAPE of the task (pointer / execution-to-spec / judgment), not a mechanical
  rule; the effort convention should follow the same shape-based pattern, not a stricter one.
