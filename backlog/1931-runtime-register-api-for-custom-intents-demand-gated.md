---
kind: decision
status: open
blockedBy: ["1930"]
dateOpened: "2026-06-28"
tags: []
---

# Runtime register-API for custom intents (demand-gated)

Demand-gated follow-up from #1913: a runtime register-API for custom intents (vs the ratified build-time declarative manifest). Per the ruling this is decided ONLY when a real dynamic-host consumer exists — a plugin host, user-authored dashboard, or live multi-tenant surface that cannot use a build-time glob. Shape to follow CSS @property (declarative-first + runtime hatch). Un-gate trigger: a named consumer that genuinely needs runtime registration. Until then this stays gated, not built.
