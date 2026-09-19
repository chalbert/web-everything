---
kind: epic
status: open
dateOpened: "2026-09-19"
tags: []
---

# Stateless durable-job orchestration — any session or model can drive the runner

Orchestrator decoupled from session state: every turn reads job status, advances finished items, dispatches new ones, and exits with no passive wait. Operator direction: start with Claude via Antigravity due to native Max usage; long-term goal is a DUMB orchestrator (Gemini sufficient) for mechanical dispatch. Requirements: R1 all plan/item state in files; R2 detached OS processes (Node detached:true, unref); R3 liveness via real pid check; R4 idempotent steps keyed by item+step; R5 turn is read/advance/dispatch/exit—never wait; R6 transition table is code for any model. Existing pieces: operation run records, lane-pool leases, we:scripts/operations/review-dispatch.mjs, conveyor queue/runner, we:scripts/lib/provider-routing.mjs. First slice: uniform detached job wrapper plus jobs status command with pid-verified liveness.

## Done when

1. **Executable** — TODO: a command that fails before this item lands and passes after.
