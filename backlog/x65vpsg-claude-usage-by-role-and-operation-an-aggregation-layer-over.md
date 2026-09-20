---
kind: story
size: 8
parent: "3383"
status: open
scope: ["we:scripts/operations/claude-otel-collector.mjs", "we:scripts/operations/run-store.mjs"]
dateOpened: "2026-09-20"
tags: []
---

# Claude usage by role and operation: an aggregation layer over the collected OTel data

GOAL (operator, 2026-09-20): see Claude token and cost usage broken down by role (main session, subagent) and by operation (build, fix, review, prepare and so on). CAPTURE ALREADY WORKS: the collector receives numeric token and cost counters from every session on the machine (attributes include session id, query source main or subagent, model, effort, token kind). THE MISSING PIECE is the query layer; related open item 3671 covers tool-use counting only and its own hooks cannot see an Agent call. DESIGN TO SETTLE BEFORE BUILD (strong design required): (1) SIGNAL: the OTel query source attribute is the only reliable main-versus-subagent signal; confirm it on real data before relying on it. (2) ATTRIBUTION JOIN: map session id to an operation using the dispatch slug grammar (review, fix, ci-heal, conveyor, prepare with the item or PR number) and the run records in we:scripts/operations/run-store.mjs; unmapped sessions report as unattributed, never guessed. (3) SOURCES: OTel day files plus per-Codex-dispatch token records plus per-judge usage in run records, reconciled so nothing is counted twice. (4) DEPENDS ON the collector data-root fix (one shared root) or the aggregation must read every lane root. (5) PRIVACY: numeric only; identity attributes (email, account id) are dropped from any output; never persist content. (6) OUTPUT: a CLI report by day, role, operation and model with USD cost, plus a JSON form; whether a short line appears in wip is a separate decision. ACCEPTANCE: a fixture reproduces per-role totals; report totals reconcile with the raw files within 1 percent; unattributed share is reported.

## Done when

1. **Executable** — TODO: a command that fails before this item lands and passes after.
