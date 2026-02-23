# Research Report — Scoped Event Discrimination for Resource Loaders

**Plan file**: `plans/scoped-event-resource.md`
**Research page**: `/research/scoped-event-discrimination/`
**Date**: 2026-02-23

---

## Question

When multiple Resource Loaders coexist in the same injector scope, both fire events with the same string name (`resource-load-end`). How does `listenForScoped` help consumers tell them apart? And how does tracing fit into this picture?

## Key Findings

### What listenForScoped Actually Solves

`listenForScoped` resolves an **event class** from the injector chain and validates incoming events via `instanceof`. This is **class identity discrimination**, not name-based filtering.

**Key insight**: Scoped events solve the *type collision* problem (different things with the same name). For *instance disambiguation* (same type of thing happening in two places), use DOM proximity or event detail filtering.

| Scenario | Without Scoped Events | With Scoped Events |
|----------|----------------------|-------------------|
| Tab fires `toggle`, View fires `toggle` | Can't tell which component fired | `instanceof TabToggleEvent` vs `instanceof ViewToggleEvent` — distinct classes |
| Resource loader vs third-party widget both fire `resource-load-end` | Listener receives both | `instanceof ResourceLoadEndEvent` rejects the widget's event |
| Two resource loaders fire `resource-load-end` (same scope) | Both received | Same — `instanceof` passes for both. Use DOM proximity or `detail.operation` to filter. |

### Three Discrimination Strategies for Same-Scope Loaders

| Strategy | How It Works | When to Use |
|----------|-------------|-------------|
| Different injector scopes | Each loader in a different `<div injector>` | Distinct architectural roles (route-level vs panel-level) |
| DOM proximity | Listen on the specific container, not `document` | Structurally nested loaders |
| Event detail filtering | Check `event.detail.operation` | Fine-grained filtering in the same scope |

### Resource Loader Event Lifecycle

Four typed events at state transitions:
- `resource-load-start` — async operation begins (`detail: { operation, timing }`)
- `resource-load-end` — success (`detail: { operation, data, duration }`)
- `resource-load-error` — failure (`detail: { operation, error, retryable }`)
- `resource-state-change` — any state transition (`detail: { oldState, newState }`)

The `operation` field enables instance-level filtering — it carries the resource key (e.g., `['users', 123]`).

### Tracing Relationship

Events and tracing are **orthogonal but complementary**:
- **Events** answer: "*What* happened and *who* cares?" (UI components reacting to data changes)
- **Traces** answer: "*How* did it happen and *what touched it*?" (DevTools, observability, debugging)

Three dimensions of provenance:

| Dimension | Question | Mechanism |
|-----------|----------|-----------|
| What triggered the call? | Which user action initiated the request? | Parent trace span |
| What modified the call? | Which middleware intercepted/transformed/retried? | Middleware trace spans + attributes |
| How is the trace correlated? | How do client and server connect? | W3C Trace Context headers (`traceparent`, `tracestate`) |

The connection point is the `operation` key — events and trace spans share it, enabling correlation.

## Files Created/Modified

| File | Action |
|------|--------|
| `src/_data/researchTopics.json` | Added `scoped-event-discrimination` entry |
| `src/_includes/research-descriptions/scoped-event-discrimination.njk` | New file (~300 lines) |
