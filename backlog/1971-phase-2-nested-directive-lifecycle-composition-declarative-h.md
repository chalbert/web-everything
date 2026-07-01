---
kind: epic
parent: "1963"
status: open
dateOpened: "2026-06-29"
relatedReport: reports/2026-06-30-backlog-split-analysis.md
tags: []
---

# Phase 2 — nested-directive lifecycle composition (declarative-HTML deep structural)

Umbrella for the Phase-2 nested-directive lifecycle work; sliced 2026-06-30 into the runtime-wiring slices
below (see `we:reports/2026-06-30-backlog-split-analysis.md`).

Case 10 declarative-HTML deep STRUCTURAL nesting is UNMET: the structural mechanism is comment-anchor directives (CustomComment), not transient (no native-element target there). Foundation is built (#1130; the ForEach, ViewIf and ViewSwitch directives are one-time render plus manual refresh, #1217), but about 80% remains and was deferred as Phase 2 (uncarved in #1217 and #042). Align to DOM Parts `ChildNodePart` for the migration path (a marker-convention constraint carried by the nesting/reconciliation slices, not a build of its own). Ratified under #1963.

## Slices

- **A — parent-child lifecycle & ownership ordering** — runtime connect/disconnect cascade + nesting tests.
- **B — reactive cascade** (⟵ A) — wire directives through `observe()` → auto-`refresh()`.
- **C — keyed reconciliation** — the ForEach `#key` diff (DOM reuse by key).
- **D — moveBefore state-preserving moves** (⟵ C) — reorder reused nodes atomically.
- **E — SSR & hydration of comment regions** — *deferred*: no SSR surface exists in FUI to ground seams;
  design-gated child epic, a future `/slice` candidate once an SSR-of-comment-regions spike lands.
