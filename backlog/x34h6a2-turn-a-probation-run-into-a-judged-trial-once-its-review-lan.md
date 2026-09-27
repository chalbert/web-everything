---
kind: story
size: 3
status: open
scope: ["we:scripts/lib/model-probation.mjs"]
dateOpened: "2026-09-27"
tags: []
---

# Turn a probation run into a judged trial once its review lands

Probation runs already write a scorecard row (executor=antigravity|codex) via we:scripts/lib/probation-launcher.mjs, but nothing converts that row into a judged trial in we:scripts/lib/model-probation.mjs once the PR's review verdict lands -- so we:scripts/lib/model-probation.mjs's report command only grows when someone records a trial by hand. Automate the conversion: when a probation-executed PR's review verdict lands, record a trial (landed / reworked / rejected, plus the critical-miss flag) against the provider x model x task-type triple in we:scripts/lib/model-probation.mjs, the same graduation-progress ledger the report reads. Note: the report's run-rating criterion needs PR #2811 to land first (it reads not-measured/unmet until then). Why: the operator wants other models to earn more of the real work over time as trial data supports it; promotion out of probation stays an explicit human decision, never automatic.

## Done when

1. **Executable** — TODO: a command that fails before this item lands and passes after.
