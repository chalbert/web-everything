---
type: decision
workItem: task
parent: "991"
status: open
dateOpened: "2026-06-19"
tags: []
---

> **Retyped idea→decision (batch-2026-06-18 pre-flight).** This is design-authoring of a contract +
> replay model with an open fork ("check whether webevents event-identity is load-bearing for replay
> determinism") — a ratify-able design call, not a mechanical build. Moves to Tier B; `/prepare` it
> before the decision turn.

# Design the trace/replay substrate (webtraces + webevents) — the #140 dev-surface keystone

webtraces and webevents are spec-only concepts with no design item. The trace/replay artifact (declared state snapshot + ordered action trace) is the keystone that unblocks #140 features 6/9/10 (state explorer, error-repro, in-context bug report). State side is already introspectable (webcontexts plug + #400 injector consumption edges); webtraces is the missing artifact (W3C Trace Context/OTel-aligned record + replay semantics), webevents the action source. Design the trace-record contract + replay model; check whether cross-team event identity (webevents) is load-bearing for replay determinism. Links #140, #092.
