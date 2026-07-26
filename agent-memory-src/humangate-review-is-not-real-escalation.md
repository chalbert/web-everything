---
name: humangate-review-is-not-real-escalation
description: "A soft humanGate:review spot-check is agent-clearable (review:pending), not human-only — the PR's review LABEL is the gate, not the item's humanGate field"
metadata:
  node_type: memory
  type: feedback
  originSessionId: 5135d7fd-82cd-4a09-af89-eeca10510a48
---

The gate for a parked conveyor PR is its **review LABEL**, not the backlog
item's `humanGate` field. `review:pending` = **agent-clearable** — an
independent auto-review agent may inspect the diff and apply `review:accepted`.
`review:human` = gate-self / statute / policy-tier, **human-only**. The item's
`humanGate` is an INPUT the producer rubric reads when it chooses the label — it
is **not itself the gate**.

A `humanGate:{kind:review}` that is a **soft spot-check** — a perceptual "looks
right" / "is it useful" / state-coverage sanity pass, sitting ON TOP OF a green
automated test — is **not a real escalation**. The rubric correctly demotes it
to `review:pending`. Do NOT hold such a PR for the operator by reading the item's
`humanGate` text: auto-review it like any other `review:pending` PR (the
visual-review lens now covers the perceptual part).

**Why:** operator correction 2026-07-26 — I over-escalated #746 / #107 (the
#1696 scenario loader) to the human by reading its `humanGate:review` field,
even though both PRs were labelled `review:pending`. Human-at-the-gate is for
GENUINE escalation — gate-self / statute / real contention — not soft
spot-checks.

**How to apply:** before holding any parked PR for the operator, check the PR's
actual review **LABEL**. `review:pending` → dispatch an independent auto-review
and accept if clean (swap to `review:accepted`, see
[[approve-verdict-sets-review-accepted-label]]). `review:human` → operator only.
Never route a `review:pending` PR to the human just because its item carries a
`humanGate:review`. The perceptual half a soft spot-check worries about is
already covered by the visual-review lens
([[ui-change-needs-before-after-visual-check]]); fold this into the drain-gated
delivery loop's park-clearing step ([[drain-gated-build-review-resolve-loop]]).
