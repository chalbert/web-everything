---
kind: decision
status: open
size: 3
dateOpened: "2026-06-26"
tags: [webinjectors, webcontexts, consumable, dx, native-first]
relatedReport: reports/2026-06-26-consumable-await-footgun.md
---

# Consumable await footgun — pick the reactive-consume() handle shape

The `relatedReport` describes a footgun where `await consumable` (after `consume()` internally calls `provide()`) hangs forever, because `await` then waits for the *next* `provide()`. **Pre-flight under batch-2026-06-26-1793-1697 found the subject API is not shipped**, so this is a design call, not a mechanical bug-fix.

## What you decide
The shape of a reactive `consume()` handle (`.value` for the current value + a way to await/iterate future provides) **if/when** that API is built — the report's Options A/B/C.

## Survey (why this isn't a buildable bug today)
Traced the real tree across WE + FUI:
- `webinjectors` `Injector.consume()` is **already async and returns the provider value directly** (`Promise<ProviderTypeMap[Key]>`, `fui:plugs/webinjectors/Injector.ts:197`) — `await injector.consume(...)` works; there is no thenable `Consumable` to hang on.
- `webcontexts` `CustomContext` exposes `get/set value` + **callback subscriptions** (`fui:plugs/webcontexts/CustomContext.ts:99`), not `await`/`for await`.
- The report's `Consumable` (a `get then()` thenable that is also `Symbol.asyncIterator`-iterable with `.value`, returned by `consume()`) has **zero occurrences** in non-test source in either repo. The report's own closing note confirms it: *"consume() remains synchronous. All tests pass. This plan documents the design constraint for future resolution."*

So the footgun is real only for a **future** reactive-consume handle that doesn't exist yet. Resolving it means picking that handle's shape.

## Options (from the report)
- **(A) — bold default — eliminate the thenable.** A `Consumable` is **not** thenable (no `get then()`); reactive waiting is the explicit `await consumable.next()`, and `for await…of` keeps working via `Symbol.asyncIterator`. The footgun becomes impossible *by construction* (you cannot accidentally `await` a non-thenable into a hang), which fits the project's footgun-elimination + native-first stance (an async iterator is the platform-native reactive primitive). Cost: `await consumable` is no longer a supported spelling — but there is **no live consumer** of it (the handle is unbuilt), so there is nothing to migrate.
- **(B) keep `consume()` sync, document the pattern.** Cheapest, zero code — but it *leaves* the footgun (an `await` still hangs) and only warns against it in prose. Rejected by default: documenting around a footgun violates the eliminate-by-construction stance.
- **(C) return a wrapper `{ consumable, value }`.** Avoids the thenable trap but adds a clunky destructure to every call site and a second concept; no offsetting benefit over (A).

## Lineage
Was `kind: story` (mis-flagged batchable). Re-typed to `decision` after the survey above; relatedReport unchanged.
