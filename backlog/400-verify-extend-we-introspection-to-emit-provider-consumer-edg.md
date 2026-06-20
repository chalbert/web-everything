---
kind: story
size: 3
parent: "092"
status: resolved
dateOpened: "2026-06-12"
dateStarted: "2026-06-12"
dateResolved: "2026-06-12"
graduatedTo: plugs/webinjectors/Injector.ts (consumptionEdges + trackConsumption)
tags: []
---

# Verify/extend WE introspection to emit provider-consumer edges

Empirical prerequisite for the #092 provider-consumer graph: determine whether WE introspection (registries, injectors, webcontexts, webevents) already exposes consumption edges (consumesApis-equivalent), and extend it to emit them if not. #092 ruled build-time auto-derived graph as source of truth — that hinges on introspection actually surfacing edges. This is the first link in the graph chain; the graph-model build is blocked on it. Fact-to-build, not a design fork: the answer sets scope, not direction.

## Finding (2026-06-12) — providers introspectable, consumption edges were NOT

Read the live introspection surface. **The provider side is fully introspectable:** registries expose `keys()` / `entries()` / `size` ([we:CustomRegistry.ts](../plugs/core/CustomRegistry.ts)), the injector exposes `entries()` / `values()` / `get()` and the `parentInjector` ⇄ `childInjectors` tree ([we:Injector.ts](../plugs/webinjectors/Injector.ts)), and contexts/protocols declare the *provides* side. **The consumer side did not exist:** `Injector.consume(name, querier)` received the consuming `querier` purely to validate it (`isQuerierValid`), then **discarded it** — no `(consumer → provider)` edge was ever recorded. So a build-time graph derivation had no `consumesApis`-equivalent to read. The #092 source-of-truth hinges on edges the introspection was not surfacing → **extend, as the card anticipated.**

## Progress — extension shipped

**Resolved 2026-06-12** → `we:plugs/webinjectors/Injector.ts`.

Added consumption-edge introspection at the DI seam where consumption happens:
- `static trackConsumption = false` — **opt-in, off by default** so production runtime is untouched (zero cost); a graph/build tool flips it on, exercises the app, then reads edges. Aligns with the #092 ruling that keeps the autonomous *runtime agent* deferred — this is only the introspection *surface*, edges "potential until trace-confirmed."
- `consume(name, querier)` now records `(provider ← querier)` into a per-injector `Map<provider, Set<querier>>` when tracking is on.
- `consumptionEdges()` returns the `{ provider, querier }` pairs; a graph builder walks the injector tree and dedups. `dispose()` clears them.
- 5 new unit tests (we:Injector.test.ts): off-by-default, records-when-on, dedups, records-at-call-site-when-resolved-up-the-chain, clears-on-dispose. Full webinjectors suite green (190 + 5); `tsc --noEmit -p we:tsconfig.json` shows 0 errors in the touched file.

**Next in the #092 chain:** a tree-walking aggregator (`childInjectors`/`parentInjector`) that materializes the manifest from `consumptionEdges()` across all injectors, plus the equivalent harvest for contexts/webevents if those grow their own consume seams.

> **Close-out note — repo gate red from unrelated concurrent work, not this item.** At close-out `check:standards` reports 2 errors, both external to #400: a newly-added `decision-record` protocol missing its `we:src/_includes/project-webdecisions.njk` partial, and a stale `we:AGENTS.md` inventory (`npm run gen:inventory`). The protocol/intent counts rose 15→16 / 41→42 since this item's last green gate; #400 touched only `we:Injector.ts` + its test. Verified independently (injector suite + scoped typecheck green). The two errors belong to whoever is adding the decision-record protocol.
