---
bornAs: xbwup67
kind: story
size: 2
status: open
scope: ["we:scripts/operations/cli-adapter.mjs"]
dateOpened: "2026-09-06"
tags: [review, dispatch, operations, conveyor]
crossRef: { url: /backlog/3513-what-may-economize-an-agent-review-depth-only-or-also-stren/, label: "the ruling that authorizes this knob" }
---

# Give `effort` the operator control-flag treatment `model` already has

An operator can override the juror's **model** on a run. They cannot override its **effort** — there is no
`--effort` control flag anywhere outside `buildJudgeArgv`'s own argv emission, and
[`we:scripts/operations/cli-adapter.mjs`](../scripts/operations/cli-adapter.mjs) line 471 merges `model` only.
So `JUDGE_EFFORT = 'high'` is unreachable in **both** directions: nobody can dial it down, and nobody can dial
it up to `xhigh`/`max` for a review that warrants it.

## Authorized by the ruling, and bounded by it

`#3513` ruled (2026-09-06) that **strength is operator-settable, never care-derived**. This item builds the
operator half. It must not become the care half: nothing here may make effort a function of a care band —
`panelRigorForCareLevel` continues to return `rounds` / `lenses` / `jurorsPerLens` and nothing else. A change
that derives effort from care re-opens that fork.

## The pattern to copy, not invent

`model`'s override is already safe and the reasoning is documented — copy it rather than designing a new path:

- The override arrives on a **different path from run input**, and is checked by `assertSafeJudgeRequest`
  ([`we:scripts/operations/cli-adapter.mjs`](../scripts/operations/cli-adapter.mjs) line 381).
- It is **merged before the guard runs, never after** (line 466, #3151) — that ordering is the property that
  makes the guard meaningful.
- A `-`-leading value is refused **twice**: once at parse, before a run record exists, and again on the merged
  request.

`effort` starts with an advantage `model` lacks: it already has a closed enum. `EFFORT_LEVELS`
([`we:scripts/lib/judge-spawn.mjs`](../scripts/lib/judge-spawn.mjs) line 330) is
`['low','medium','high','xhigh','max']`, and `buildJudgeArgv` already throws on anything outside it. Validate
against that enum rather than adding a second list.

The invariant the literals at [`we:scripts/operations/review-pr.mjs`](../scripts/operations/review-pr.mjs)
lines 427–443 protect — *a run's INPUT cannot reach argv* — must survive unchanged. `JUDGE_EFFORT = 'high'`
stays as the **default**; this adds a deliberate override, it does not unfreeze the constant.

## Done when

1. **Executable** — an operator `--effort` override reaches the juror spawn and is visible in the run record;
   a `-`-leading value is refused at parse and again on the merged request; a value outside `EFFORT_LEVELS` is
   refused. Tests assert all three, mirroring the existing `model` cases.
2. With no override, the juror still spawns at `high` — the default is unchanged.
3. `panelRigorForCareLevel`'s return shape is untouched, proving the care half was not built by accident.
