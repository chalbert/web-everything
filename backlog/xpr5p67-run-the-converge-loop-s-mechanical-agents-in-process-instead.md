---
kind: task
status: open
dateOpened: "2026-08-05"
tags: []
---

# Run the converge loop's mechanical agents in-process instead of as subagents

PR #1031 review finding 1's other carve-out, claimed 'filed separately' in the fix commit and in a source comment at we:scripts/workflows/review-parked-prs.mjs but never actually filed until now. Several agent() calls in the converge harness do nothing but shell a command and hand back its JSON — fetch the parked bundle, reduce a verdict, resolve rigor, record the ledger. Each one costs a full subagent spin-up to run one execFileSync. They are mechanical, not judgment: no lens, no diff reading, no discretion. The first attempt at this was to TIER them to a cheap model, which PR #1031's own review refuted — VERDICT_SCHEMA.verdict/outcome are plain strings with no enum and FETCH_SCHEMA.diff requires only non-empty, so a cheap model's malformed answer would pass validation and be read as a real verdict. Tiering was fully reverted. The correct move is not to spawn an agent at all: the Workflow body has no Node API, so this needs the harness runtime to expose an exec primitive, or these steps to move out of the harness into the caller. Take the fork first.
