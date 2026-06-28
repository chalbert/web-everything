---
kind: task
status: open
dateOpened: "2026-06-28"
tags: []
---

# Add a citation-scope check to the decision red-team

Process improvement surfaced by #1913: add a 'citation-scope check' to the Red-team-the-default pass in we:docs/agent/backlog-workflow.md (and the prepare-decision skeptic prompt). Distinct from the existing grounding-claim and statute-overlap (#1886) checks: when a fork's default leans on an anchor to AUTHORIZE a branch, confirm the cited statute's authoring scope actually reaches the case — a rule written for one scope (a value-default; single-author catalog evolution) must not be cited as authority over a wider one (engine error-handling; cross-author extension). #1913 hit this twice (Fork 2 the :385 clause; Fork 3 the #1318 open-numbered rule).
