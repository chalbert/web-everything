---
kind: story
size: 1
parent: "2753"
status: open
dateOpened: "2026-07-28"
scope: ["we:scripts/lib/decision-routing.mjs", "we:scripts/conveyor/decision-route.mjs"]
tags: []
---

# Session-free flip metric must distinguish metric-green from operator-armed enforce

`computeAgreementMetric`'s `answer` string hardcodes `"FLIP-READY (enforce armed)"` on a green metric, but the function has no knowledge of whether the operator armed enforce (`landMode`). The CLI's session-free `--agreement-file` path (`we:scripts/conveyor/decision-route.mjs`) prints that string bare, so an operator reading it can misread "metric is green" as "auto-ratify is live" when the operator ceiling is in fact still holding the mode to shadow. `resolveLandMode`'s trail already states the true state correctly. Fix: make the session-free metric output distinguish "metric green" from "operator armed + green" (or drop the `(enforce armed)` claim from `computeAgreementMetric`'s answer in `we:scripts/lib/decision-routing.mjs` and let the mode resolver own the armed/not-armed wording). Observability only — no control-flow change. Surfaced by the `/review` clearance of #911 (item #2754).
