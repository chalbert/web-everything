---
name: session_cost_on_card_accrual
description: "The close accrues a session's token usage onto the backlog card(s) it advanced — costTokens is durable, costUsd is derived from it via one shared rate table; decision/prepare accumulate on one card, workflow even-splits across N, slice/resolve attribute nothing."
metadata:
  node_type: memory
  type: reference
  originSessionId: 5cc06fdd-a973-4d54-a56d-e538a066e48d
---

Backlog cards carry their **cumulative** usage cost. The **durable** field is the token breakdown
`costTokens: "in:.. cw:.. cr:.. out:.."` (raw integers, cumulative); `costUsd` is **strictly DERIVED** from
those tokens through the ONE shared rate table (`scripts/backlog/cost-rates.mjs`) at every accrual — so it
re-prices itself when rates change and can never again drift from a stale hardcoded rate (the old bug: the
estimator hardcoded Opus-3 `$15/$75`, ~3x high, and the card stored only the derived dollars so nothing was
recomputable). Accrued at **close** by `node scripts/backlog.mjs cost <NNN> --tokens="in:.. cw:.. cr:.. out:.."`
(pure splice via `accrueCost` in `scripts/backlog/frontmatter.mjs`; accumulates the tokens, so re-running
adds; `--usd=` is accepted but ignored). The token breakdown comes from
`~/.claude/skills/closing-session/session-cost.mjs --tokens-only` (sums the transcript's per-turn usage;
window defaults to 1M since all sessions are `[1m]`). Correct Opus 4.8 rates: `$5` in / `$25` out / `$0.5`
cache-read per Mtok, cache-writes tiered (5m 1.25x, 1h 2x — this user's tier is 1h); NO long-context premium.
The estimator **fails loud** on an unknown model — warns to stderr and EXCLUDES it from both the total and
the forwarded tokens, never silently pricing it as opus. The closing-session SKILL step 3c does the
attribution. (`cost-rates.mjs` is canonical; `session-cost.mjs` carries a labelled duplicate of the table
because it is copied standalone into `~/.claude/skills/` and can't import a repo path.)

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
