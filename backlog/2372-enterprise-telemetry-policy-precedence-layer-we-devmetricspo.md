---
kind: story
size: 3
parent: "1848"
status: resolved
dateOpened: "2026-07-09"
dateStarted: "2026-07-10"
dateResolved: "2026-07-10"
graduatedTo: "analytics/dev-metrics.ts DevMetricsPolicy + fui:plugs/webanalytics/devMetrics.ts resolveDevMetricsPolicy"
tags: []
---

# Enterprise telemetry-policy precedence layer: WE DevMetricsPolicy contract + FUI three-tier resolver

Build the ratified (#1850 fork a) enterprise precedence layer for dev-metrics consent. WE: extend we:analytics/dev-metrics.ts with a DevMetricsPolicy (precedence contract enterprise>per-dev>default + enterprise-source shape: env-var name / config-file path), declarative shape+ordering only. FUI: fui:plugs/webanalytics/devMetrics.ts reads the env-var/config-file source and resolves the three tiers before emitting. Scope: env-var/file source only — no server-based fleet distribution yet. plateau-app example config deferred (#1850 option c).
