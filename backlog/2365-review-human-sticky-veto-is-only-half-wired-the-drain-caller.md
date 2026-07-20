---
kind: task
status: resolved
dateOpened: "2026-07-09"
dateStarted: "2026-07-09"
dateResolved: "2026-07-09"
tags: []
---

# review:human sticky veto is only half-wired — the drain caller still reports parked[].humanRequired from the stale fresh score

decideReviewGate parks correctly on a sticky review:human label (#2362), but the caller we:scripts/merge-ai-prs.mjs:977 (v.humanRequired) and we:scripts/merge-ai-prs.mjs:1023 (parked.push) still set humanRequired from score.humanRequired (this pass's fresh diff score), not gate.humanRequired. For the exact #289 rebase-narrowed shape (stamped review:human at open, gate-self file drops out on rebase so score.humanRequired=false), the PR now correctly PARKS instead of timeout-merging — but is reported to the /drain skill as humanRequired:false → agent-reviewable, so the auto-review panel can apply review:accepted then merge next pass. That is an AGENT clearing a gate-self change: the precise conflict-of-interest the sticky label exists to prevent. Fix: use gate.humanRequired (already returned true) at both call sites so a label-only human park is reported humanRequired:true and routed to the operator, not an agent panel. Note we:scripts/merge-ai-prs.mjs is itself a gate-self path, so the fix rides its own review:human PR. Found in the /review of #297.
