---
kind: story
size: 5
parent: "xgm2t3f"
status: open
blockedBy: ["xzbzc7n", "xdh8sim"]
dateOpened: "2026-08-08"
scope:
  - we:scripts/operations/
  - we:skills-src/review/
scopeRationale: "Adds one declaration file to the new operations directory and trims the review skill body; the exact filenames do not exist yet."
tags: [plateau-loop, delivery, operations, review]
---

# Declare review-pr and generate its command-line adapter

The first real operation on the engine, and the proof it works end to end. Declares the five review steps and
generates the command-line caller. **The existing scripts stay as the implementations behind `read` and
`effect`** — this slice re-declares, it does not re-implement.

## The declaration

| Step | Kind | Implementation |
|---|---|---|
| `read` | compute | `we:scripts/review-detail.mjs` for the park context, plus `computeNetDiffText`/`computeNetDiffPaths` from `we:scripts/merge-ai-prs.mjs` for the net-basis diff |
| `judge` | judge | the [#xdh8sim] helper, seeded with `buildPanelMandate` per lens |
| `reduce` | compute | `deriveVerdict` from `we:scripts/lib/review-core.mjs`, `humanRequired` from the labels |
| `confirm` | confirm | actor is `human` when the PR carries the gate-self label, `agent` otherwise |
| `record` | effect | a comment, a label swap via `decideSetLabel`, a ledger append, an event |

Two properties fall out and both are the point: the diff arrives on the **net basis**, so the console can no
longer show a diff stat where the agent sees real files; and the label guard stays in the pure core, so the
generated caller cannot clear a gate-self PR any more than the hand-written one could.

## What this replaces

The prose stop in `we:skills-src/review/SKILL.md` — *"This is a stop point. Do not auto-proceed."* — becomes the
engine suspending at `confirm`. The skill's step 4 note that *"a non-zero exit means re-run the same command"*
becomes idempotent effect replay. Both stop being rules the model must hold.

## Acceptance

`/review <PR>` runs entirely through the declared operation: same findings, same verdict, same label outcome and
the same comment as today, verified against a real parked PR. The skill body shrinks to invoking the operation
and presenting its output — it no longer restates the flow. Both invariants hold under test: a gate-self PR
cannot reach `accepted`, and a replayed `record` step produces no duplicate comment.

## Not in scope

The HTTP adapter ([#xtfu40d]). The escalation path where a reviewer needs to reproduce something in a throwaway
clone — genuinely tool-shaped, deliberately left out of the tool-free judge contract, and filed separately when
it is actually wanted.
