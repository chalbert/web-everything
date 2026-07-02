---
kind: story
size: 5
status: parked
parkedReason: maturityGated
maturityTrigger: "externalConsumers>=1"
locus: plateau-app
dateOpened: "2026-06-27"
tags: [telemetry, metrics, plateau, deferred]
---

# Hosted plateau aggregation endpoint for dev-metrics (maturity-gated)

Roll-forward of #1797's build-scope ruling. The hosted plateau-side endpoint that receives, aggregates, and anonymized-rolls-up the dev-metrics events emitted by #1849, producing the distinct-developer / install / build / test counts that drive 'what to build next'. This is the only server-cost piece of the channel, so it is maturity-gated rather than built now: parkedReason maturityGated, maturityTrigger externalConsumers>=1 (no vague 'actual prioritization need' trigger — that is the #1620 soft-park this gate avoids). Constellation: endpoint lives in plateau (the server-cost layer). Blocked by #1849 (needs the emitter + contract shape first).
