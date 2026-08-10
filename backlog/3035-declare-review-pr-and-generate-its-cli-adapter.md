---
bornAs: xqpw23c
kind: story
size: 5
parent: "3029"
status: resolved
blockedBy: ["3032", "3028"]
dateOpened: "2026-08-08"
dateStarted: "2026-08-09"
dateResolved: "2026-08-09"
graduatedTo: scripts/operations/review-pr.mjs
scope:
  - we:scripts/operations/
  - we:skills-src/review/
scopeRationale: "Adds one declaration file to the new operations directory and trims the review skill body; the exact filenames do not exist yet."
tags: [plateau-loop, delivery, operations, review]
---

# Declare review-pr and generate its command-line adapter

The first real operation on the engine, and the proof it works end to end. Declares the five review steps and
generates the command-line caller. **The existing scripts stay as the implementations behind the `read` and
`record` steps** — this slice re-declares, it does not re-implement.

## The declaration

| Step | Kind | Implementation |
|---|---|---|
| `read` | compute | `we:scripts/review-detail.mjs` for the park context, plus `computeNetDiffText`/`computeNetDiffPaths` from `we:scripts/merge-ai-prs.mjs` for the net-basis diff |
| `judge` | judge | the [#3028] helper, seeded with `buildPanelMandate` per lens |
| `reduce` | compute | `deriveVerdict` from `we:scripts/lib/review-core.mjs`, `humanRequired` from the labels |
| `confirm` | confirm | actor is `human` when the PR carries the gate-self label, `agent` otherwise |
| `record` | effect | a comment, a label swap via `decideSetLabel`, a ledger append, an event |

Two properties fall out and both are the point: the diff arrives on the **net basis**, so the console can no
longer show a diff stat where the agent sees real files; and the label guard stays in the pure core, so the
generated caller cannot clear a gate-self PR any more than the hand-written one could.

## What this replaces

The prose stop in `we:skills-src/review/SKILL.md` — *"This is a stop point … Do not auto-proceed."* — becomes the
engine suspending at `confirm`. The skill's step 4 note that *"a non-zero exit means re-run the same command"*
becomes idempotent effect replay. Both stop being rules the model must hold.

## Acceptance

`/review <PR>` runs entirely through the declared operation: same findings, same verdict, same label outcome and
the same comment as today, verified against a real parked PR. The skill body shrinks to invoking the operation
and presenting its output — it no longer restates the flow. Both invariants hold under test: a gate-self PR
cannot reach `accepted`, and a replayed `record` step produces no duplicate comment.

## Not in scope

The HTTP adapter ([#3036]). The escalation path where a reviewer needs to reproduce something in a throwaway
clone — genuinely tool-shaped, deliberately left out of the tool-free judge contract, and filed separately when
it is actually wanted.

## How it landed (2026-08-09) — and the four places the plan above was wrong

`we:scripts/operations/review-pr.mjs` is the declaration, `we:scripts/operations/review-pr-io.mjs` its injected
reader + four sinks, `we:scripts/operations/cli-adapter.mjs` the caller DERIVED from any declaration (no
per-operation argv parser), `we:scripts/operations/run.mjs` the entry. The skill body went 246 → 106 lines.

Four corrections to the sketch above, each forced by the engine as built:

1. **`buildPanelMandate` "per lens" is not deliverable in one `judge` step.** A `judge` step declares ONE
   request; the fan-out to N jurors under one budget is [#3050], filed and **not built**. This slice runs ONE
   juror, on a `lens` input defaulting to `correctness` (the mandatory floor). #3050 substitutes behind the same
   step — the request already carries `lens` — and no other step changes.
2. **`confirm`'s `of` had to accept a function.** *"actor is `human` when the PR carries the gate-self label"* is
   a property of the run, not of the declaration, and `we:scripts/operations/step-kinds.mjs` only took a string.
   `of` now mirrors `asks`: a string or a fn over the same projected view, refused when it renders empty.
3. **"a comment" and "a label swap" are ordinals 0 and 1 of one act, not two independent writes.** Splitting
   them into two sinks would re-implement `we:scripts/review-set-label.mjs` and lose the `reviewed-sha` /
   `reviewed-diff` / `reviewed-contribution` markers and its #2964 ordering. So ordinal 0 stages the comment
   BODY locally (idempotent) and ordinal 1 shells the single home, which posts that body and applies the label
   (**not** idempotent — it posts a durable comment). Ordinals 2 and 3 are the ledger row (not idempotent:
   [#3007] is open and no writer can yet claim dedupe on the merge authority) and the operator notice
   (idempotent — it only reports).
4. **The `verdict-ledger.append` effect needs a sink to exist at all** — the executor refuses the whole batch
   pre-flight on an unregistered type. Until [#3007] ships a writer, the adapter registers a **session-local
   gitignored sidecar** under `.operations/review/`, which is explicitly NOT the ledger: nothing merges on it and
   nothing reads it back.

**Verified against a real parked PR without mutating it.** The `read` step was compared field-for-field against
the hand-written path (`we:scripts/review-detail.mjs --json` + `computeNetDiffPaths`) on PRs
#1137/#1138/#1139/#1140 — identical every time. On PR #1138 the net basis and `gh`'s file list genuinely
DIVERGE (`gh` reports a sibling-lane backlog file the PR does not touch), and only the net list reaches the
juror's mandate. A full end-to-end run on #1138 with a real tool-free juror stopped at the `confirm` suspend
having applied zero effects, and was then completed with `--answer=abstain`, which declares no effects at all.
The label sink was exercised against the REAL `we:scripts/review-set-label.mjs` on merged PR #1135, whose
OPEN-state refusal fires before any write. **Residual: the live comment-post + label-swap has not been executed
through the operation** — doing so requires mutating a real PR, which this build deliberately did not do.
