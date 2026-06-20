---
kind: story
size: 2
status: resolved
dateOpened: "2026-06-11"
dateStarted: "2026-06-12"
dateResolved: "2026-06-12"
graduatedTo: blocks/renderers/jsx/jsxToHtml.ts (reverseEvents + jsxToHtmlWithDiagnostics)
tags: [jsx, adapters, events, reverse-transform, lossy]
---

# JSX reverse-transform closure handling — synthesize a handler name, else flag lossy

Implement the JSX reverse-transform's inline-closure handling. A named handler round-trips (`onclick={inc}` ⇄ `on:click="inc($event)"`) because the function name *is* the string path the injector resolves; an inline closure (`onclick={() => …}`) has no string path. On reverse, the transform must either synthesize a stable handler name (lifting the closure to a named injector handler) or flag the cell lossy in the source toggle — never silently drop behavior. Ratified in #051 (Fork 2): the round-trip guarantee is scoped to named handlers (a platform fact), mirroring the #245 string-survival branch that exists to stop invisible behavior loss.

## Progress

**Resolved 2026-06-12.** Implemented in the reverse transform `we:blocks/renderers/jsx/jsxToHtml.ts`. Chose the **flag-lossy** branch of the ratified either/or (not closure-name synthesis), to stay consistent with `crossStrategy.lowerEvents`, which already settled the same rule for the render-strategy axis — a single `inline-closure-handler` rule id across both reverse paths, no drift.

- **Before:** step 3 dropped *all* expression props blindly (`\s+[\w:-]+=\{…\}`), so a named handler was silently lost and a closure produced no diagnostic.
- **After:** a new `reverseEvents` pass runs first — a **named** handler (`/^[\w$.]+$/`: `inc`, `store.save`) lowers to the canonical string behavior `on:click="inc($event)"` (the name *is* the injector's string path, so it round-trips); an **inline closure** is dropped **and** pushes a `{rule:'inline-closure-handler', message, fragment}` diagnostic. Remaining non-event expression props still drop silently (out of #325 scope, e.g. `value={x}`). A `on:select="…"` string attribute is already canonical and left verbatim.
- **API:** added `jsxToHtmlWithDiagnostics(jsx): ConversionResult` (reusing crossStrategy's `ConversionResult`/`Diagnostic` types via a type-only import — erased, so no runtime cycle even though crossStrategy imports the jsxToHtml value). `jsxToHtml(jsx): string` is preserved (delegates, returns `.code`) so all ~12 existing callers are untouched.
- **Tests:** 6 new cases in `we:blocks/__tests__/unit/renderers/jsxToHtml.test.ts` (named round-trip, member-path, react-dialect lowercasing, closure→lossy, verbatim string attr, string-API delegation). Full JSX renderer suite green: 122 tests across 5 files; `check:standards` 0 errors.

Pairs with **#324** (the display sub-toggle that chooses which spelling is shown) — #324's note "closures need #325's lossy handling" is now satisfied.
