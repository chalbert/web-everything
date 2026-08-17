---
bornAs: x5qc0lw
kind: story
size: 3
status: open
dateOpened: "2026-08-17"
tags: []
---

# tick-core plans auto-prepare-scope dispatches that never actually spawn

we:scripts/conveyor/tick-core.mjs's planTick computes a prep.scopeSpawns plan for unscoped held items (visible live as a "⚠ N auto-preparing scope: #NNN ..." notes entry), but calling we:scripts/operations/dispatch-lane.mjs --num=<one of those items> does NOT actually trigger that scope-prep dispatch. Confirmed repeatedly tonight (2026-08-17) across #3150, #2786, #2831, #2968, and #3137 — each repeatedly appeared in the plan's auto-preparing-scope notes across multiple dispatch-lane calls, but claude agents --json never showed a corresponding conveyor-<num> background session actually spawn for scope-prep. Worked around for #3150 by adding a scope: field to the item directly (bypassing the auto-prep path entirely) rather than fixing the underlying gap. The plan step correctly identifies the need; the effect step that should act on it appears to be a no-op or unwired. Needs the same treatment #3161 asks for on dispatch-lane's build path generally: either wire the scope-prep dispatch through to a real spawn, or have the plan step report explicitly why it did not dispatch (per #3161's reasoning) rather than silently repeating the same unfulfilled plan on every call.

## Done when

1. **Executable** — TODO: a command that fails before this item lands and passes after.
