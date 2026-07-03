---
name: session_cost_on_card_accrual
description: "The close accrues a session's usage-equivalent $ onto the backlog card(s) it advanced — decision/prepare accumulate on one card, workflow even-splits across N, slice/resolve attribute nothing."
metadata:
  node_type: memory
  type: reference
  originSessionId: 5cc06fdd-a973-4d54-a56d-e538a066e48d
---

Backlog cards carry their **cumulative** usage-equivalent cost: `costUsd` + `costSessions` frontmatter,
accrued at **close** by `node scripts/backlog.mjs cost <NNN> --usd=<n>` (pure splice via `accrueCost` in
`scripts/backlog/frontmatter.mjs`; accumulates, so re-running adds). The `$` figure comes from
`~/.claude/skills/closing-session/session-cost.mjs --usd-only` (sums the transcript's per-turn usage at
model rates; window defaults to 1M since all sessions are `[1m]`). The closing-session SKILL step 3c does the
attribution.

**Which card, and whether to attribute at all (the judgment half):**
- **decision / prepare / focused single-item build** → full session `$` on that one card. `/prepare` then
  `/decide` on the same item **sum** into one running total.
- **`/workflow` (parallel)** → the orchestrator is light; **even-split** `$` across the N items it resolved,
  `$/N` on each. (Per-lane exact costing was rejected — a spawned agent sees the *parent* session id in
  `$CLAUDE_CODE_SESSION_ID`, not its own, so it can't find its own transcript; even-split is the accepted
  approximation and under-counts the Sonnet lane work by design.)
- **`/slice`, `/resolve`, or no dominant item** → attribute **nothing**.

**Why:** gives a real per-item cost signal over a card's whole life without a per-lane accounting rig.
**How to apply:** at close, read the session cost once, classify the session, call `backlog.mjs cost` for the
card(s), report the accrual in the audit's Footprint/Session-cost line — once per close (re-running
double-counts). Built 2026-07-03. Relates to [[shared-index-commit-race]] and the batch cost model (#1505,
memory 135).
