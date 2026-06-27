---
kind: story
size: 5
status: open
priority: low
locus: webeverything
dateOpened: "2026-06-27"
tags: [telemetry, metrics, prioritization, privacy]
---

# Build anonymized dev-metrics: WE contract + vocabulary + FUI reference emitter (per-dev opt-in)

Build story opened by resolving #1797. Implement the anonymized dev-action metrics channel as ratified: (1) a WE dev-metrics vocabulary as a sibling entry over the existing transport-agnostic analytics contract (we:analytics/contract.ts — void fire-and-forget track(), swappable sink via DI), reusing the contract shape and the analytics-vocabulary registry; (2) a dedicated platform sink (not a product-analytics vendor); (3) a salted rotating-daily install-id (per-day distinct count, no persistent fingerprint, fixed not configurable); (4) per-developer opt-IN consent — a first-run prompt plus a one env-var/flag escape. Metric set: command in a closed vocabulary, exit code, CLI/platform version, OS+arch, CI flag, timestamp; exclude all PII. Constellation: contract+vocabulary to WE, reference emitter to FUI. priority:low (demand-blind). The enterprise-policy precedence layer and the hosted aggregation endpoint are decoupled into separate items.
