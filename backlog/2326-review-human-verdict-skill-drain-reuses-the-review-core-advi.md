---
kind: story
size: 3
parent: "2285"
status: resolved
blockedBy: ["2325"]
dateOpened: "2026-07-07"
dateStarted: "2026-07-08"
dateResolved: "2026-07-08"
graduatedTo: none
tags: [review, drain, skill, agent]
---

# /review human-verdict skill + drain reuses the review core (advisory AI take even on review:human)

Builds on the shared review core (`#2325`). Two deliverables, one contract.

## 1. `/review <PR>` — the human-verdict skill

The one review flow with no skill today is the **human** clearing a parked PR (exactly what happened on PR #206
by hand). Add `/review <PR>`:

1. Pull the parked PR (diff + the drain's escalation `reasons`).
2. Run the shared core (`#2325`) → findings + verdict.
3. Present findings + the escalation reason to the operator.
4. On operator OK, record the verdict as a **label**: `review:human`/`review:pending` → `review:accepted`
   (or `review:changes`, which routes the fix back to the author lane).

## 2. Drain re-points at the core + advisory AI on review:human

- Repoint the drain's inline auto-review (`we:skills-src/drain/SKILL.md`, the `humanRequired: false` branch) at
  the shared core so the hand-rolled `Agent` prose is **deleted** — one engine, not a fork.
- **New behaviour (the ask):** a `review:human` PR must **still get an advisory AI review**. Today the drain
  "leaves it for the operator" and runs no review at all. Instead: run the core on a `review:human` PR too and
  **post its take** (findings + verdict) as a PR comment — clearly marked **advisory, non-clearing**. It informs
  the human; it must **never** auto-apply `review:accepted` to a `review:human` PR (the conflict-of-interest
  invariant in `we:scripts/lib/review-escalation.mjs` is unchanged). `/review` surfaces that advisory take.

## Invariant preserved

Label/verdict **policy** stays in the drain (`decideReviewGate` in `we:scripts/lib/review-escalation.mjs`): the
core judges, the caller decides what a verdict *does*. A gate-self edit is still human-cleared only.

## Acceptance

- `/review <PR>` skill exists, runs the core, and swaps the label on operator OK.
- The drain's inline review is a call to the core; the prose-spawned reviewer is gone.
- A `review:human` PR carries an advisory AI review comment (findings + verdict), and still cannot be
  agent-cleared.
