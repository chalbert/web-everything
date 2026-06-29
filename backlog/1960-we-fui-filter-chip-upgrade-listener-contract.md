---
kind: decision
status: open
locus: webeverything
dateOpened: "2026-06-29"
tags: [webcomponents, fui-boundary, filter-chip, transient-element, decision]
---

# WE↔FUI chip-upgrade listener contract: delegation-required vs FUI listener-preserving / event API

A FUI `<we-filter-chip>` is a transient custom element (the `TransientElement` self-replacement pattern,
[we:block-standard.md:243](../docs/agent/block-standard.md#L243)): on upgrade it **replaces itself with a
native `<button class="fui-filter-chip">`**, and the original element — with any listeners bound directly to
it — is detached and discarded. WE-side JS that drives those chips therefore loses any handler it attached
*before* the upgrade, and any cached element reference goes stale.

This is not hypothetical: it shipped twice as a regression on the `/backlog/` Prioritisation table. The
readiness/kind chips survived only because they happened to use a **document-delegated** click handler; the
summary count pills (`data-pfilter`) used direct `addEventListener` and silently stopped filtering the
moment the FUI module loaded. The fix delegated them too. But "remember to delegate, and never cache a chip
reference" is tribal knowledge enforced by nothing — the next interactive FUI-chip surface will reintroduce
the same class of bug. WE consumes `we-filter-chip` as a cross-repo dependency, so the contract for *how a
consumer safely wires behaviour onto a self-replacing element* belongs in the boundary, not in each call
site's memory.

## The fork (real either/or)

Both readings are coherent; they put the invariant on opposite sides of the WE↔FUI boundary.

- **Fork A — Delegation is the consumer's contract (WE-side rule).** FUI keeps the transient
  self-replacement as-is; the WE rule becomes explicit and enforced: *never bind a listener directly to a
  `we-filter-chip`, never cache its reference — delegate on a stable ancestor and re-query live.* Codify in
  `docs/agent/*` and back it with a lint/gate (e.g. flag `addEventListener` on a `[data-pfilter]`/`[data-pready]`
  selector, or a `querySelector('we-filter-chip')` stored in a variable). Cheapest; keeps FUI dumb; but the
  burden stays on every consumer forever and the gate is heuristic.

- **Fork B — FUI guarantees a stable interaction surface (FUI-side rule).** FUI either (b1) preserves
  listeners across the upgrade (re-emit bound handlers onto the replacement, or upgrade in place without
  detaching), or (b2) exposes a stable change-event API (a `we-filter-chip` `change`/`toggle` CustomEvent on a
  persistent host element, or a documented `aria-pressed` mutation contract) so consumers never touch the
  transient node directly. Removes the footgun at the source for *all* consumers (WE today, plateau-app
  tomorrow); costs FUI work and a possible API addition, and must not regress the native-form/a11y benefit
  that motivated self-replacement in the first place.

**Leaning (not yet prepared):** Fork B2 — a stable event API on a persistent host is the durable boundary
fix, since the self-replacement exists for good reasons (native `<button>` semantics) and shouldn't be
unwound, but consumers shouldn't have to know the node identity churns. Fork A is the safe fallback if FUI
can't take the change. Needs `/prepare`: survey how FUI's other transient elements expose state, confirm
whether a delegated-only rule is gate-able without false positives, and decide where the codified rule lives
(WE `docs/agent` vs a FUI-side contract doc).

## Context

- Surfaced from the Prioritisation-table regressions ([we:backlog-table-sort.js](../src/assets/js/backlog-table-sort.js)):
  dead summary pills + a silently-emptied table, both rooted in the upgrade dropping consumer wiring.
- Locked in by a deterministic interaction-test lane (`tests/interaction/`) whose **mock `<we-filter-chip>`**
  reproduces the self-replace; that harness is the regression net regardless of which fork is ratified.
- Boundary rule: WE holds zero implementation — so if Fork B wins, the listener/event guarantee is built in
  FUI; WE only consumes it and codifies the consumer-facing contract.
