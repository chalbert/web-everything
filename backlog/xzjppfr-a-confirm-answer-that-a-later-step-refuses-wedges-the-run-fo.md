---
kind: story
size: 2
parent: "3029"
status: open
relatedTo: ["3035", "3032", "2895"]
scope: ["we:scripts/operations/cli-adapter.mjs", "we:scripts/operations/step-kinds.mjs", "we:scripts/operations/review-pr.mjs"]
dateOpened: "2026-08-10"
tags: [operations, engine, confirm, usability, cost, capture]
---

# A confirm answer that a later step refuses wedges the run forever — the operator loses the juror spend

Answer `accept` at `review-pr`'s `confirm` on a gate-self PR and the run can never reach any other answer. The
answer is already committed to the record, so the only step left is `record`, which throws every time. **Nothing
is written and nothing is at risk** — this is a usability and cost defect, not a safety one. The cost is one
juror spawn, thrown away.

> **Capture only.** Nothing is built here. The fix is framed below without being chosen.

## Reproduction, against `main` at `2d895912`

The first live gate-self exercise of the operation (#3035) left the run on disk:
`we:.operations/runs/review-pr-e9f18407-320a-4e62-b764-b9bf6ef096bd.json` — `chalbert/web-everything#1153`,
`cursor: 4`, `pending: null`, `findings.confirm: "accept"`, `verdict.verdict: "needs-human"`,
`findings.read.labels: ["review:human"]`, `effects: []`. Replayed against a **copy** of that record
(`OPERATION_RUNS_DIR` pointed at a scratch dir, so the real record was not touched):

`--resume=<id> --answer=changes` → exit 2:

> `error: run review-pr-e9f18407-320a-4e62-b764-b9bf6ef096bd is `running`, not awaiting a decision — refusing an --answer for a question that has not been asked. Re-run without --answer to drive it to its next stop.`

`--resume=<id>` with no answer → exit 1, and identically on every repeat:

> `error: review-pr.record: refusing to record `accepted` on chalbert/web-everything#1153 — gate-self: review:human is human-ceremony-only — clear via /review in a session. The refusal is `decideSetLabel` in `we:scripts/review-set-label.mjs` (INVARIANT 2, #2470/#2644); this operation does not carry a route around it. …`

After both, the record is byte-for-byte where it was: `cursor 4`, `confirm accept`, `0` effects. `gh` confirmed
nothing reached the PR. **The guard did exactly its job.**

Two details make the wedge total rather than incidental:

- The refusal reads `findings.read.labels`, which was **frozen at the `read` step**. #1153 has since been
  cleared by a human and merged (`review:accepted`, merged `2026-08-10T20:06:36Z`) — the wedged run still
  refuses, because it is arguing with a snapshot, not with the PR.
- The throw escapes [we:scripts/operations/cli-adapter.mjs#driveRun](../scripts/operations/cli-adapter.mjs)
  uncaught and lands in the catch in [we:scripts/operations/run.mjs](../scripts/operations/run.mjs), which
  prints the message verbatim and exits 1. So there is currently **no seam that could tell the operator what to
  do next**.

## What it cost

The run's own telemetry, recorded by #3035's meter: **$0.4599** for one `correctness` juror, `sonnet`,
`effort: high`, 12.6s wall, 70,688 loaded context tokens. A fresh run re-spawns that juror, so a mis-answer on a
gate-self PR costs about **46 cents and a repeat wait** — the whole loss.

## The tension — the wedge is arguably correct

Do not read this as a bug to be steamrolled. The engine
([we:scripts/operations/engine.mjs#resolvePending](../scripts/operations/engine.mjs)) commits the confirm answer
as a finding and clears `pending` in the same `advance`, exactly as it does for a `judge` answer. Effects are
keyed and replayed from the record, and the adapter's `--answer` guard exists so a caller cannot answer a
question that was never asked. Letting a caller retarget an answered `confirm` means **mutating a suspended
run's recorded decision**, which is the one thing append-only replay safety forbids. Any fix has to buy the
operator's seconds back without buying that.

Note also that nothing here is gate-self-specific. The general shape is: **any post-`confirm` step whose fn
throws deterministically for the answer recorded** wedges its run the same way. Gate-self is simply the first
one we have hit.

## The fix, framed but not chosen

- **Refuse at `confirm`, not at `record`** — make the option set conditional on the `read` findings so `accept`
  is never offered on a gate-self PR. Cheapest for the operator, and the precedent is right there: `asks` and
  `of` in [we:scripts/operations/step-kinds.mjs#confirm](../scripts/operations/step-kinds.mjs) may already be
  functions of the projected view (`of` became one for exactly this case, #3035) — `options` is the only one
  that may not. Cost: the declared answer set stops being static, so the closed-set check in `resolvePending`
  has to validate against a per-run list.
- **Allow a re-answer while no effect has been applied.** Narrow and checkable (`run.effects` is empty). Cost:
  it weakens "a decision, once recorded, is recorded" — the property the rest of the engine leans on.
- **Make the wedge cheap.** Leave the refusal exactly as it is and have the CLI add one line —
  *"this run is spent; start a fresh one with `--pr=…`"*. Cost: a `try`/`catch` around `driveRun` (or in the
  CLI entry point) and nothing else. **Nearly free, and it may be the whole fix** — it turns a confusing dead
  end into a five-second restart, and it does not foreclose either option above.

## Definition of done

- A mis-answered gate-self run either cannot happen or tells the operator plainly that it is spent.
- Whichever option is taken, a test drives a `confirm` answer that the following step refuses and asserts the
  operator-visible outcome — the wedge is currently pinned by nothing.
- If the answer is only the third option, say so on the card and close it; the first two stay unfiled unless
  something else wants them.
