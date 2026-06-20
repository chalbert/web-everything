---
kind: story
size: 2
status: resolved
blockedBy: ["070"]
dateOpened: "2026-06-11"
dateStarted: "2026-06-12"
dateResolved: "2026-06-12"
graduatedTo: blocks/renderers/jsx/directives.ts
tags: [resource, directive, loader, jsx, suspense, lift-lower, crossStrategy]
---

# Wire is=resource: named slots to Loader states, resolve through the Resource Loader block, add resource lift/lower correspondence + lossy diagnostic

Wire the `is="resource"` directive's semantics: its named `loading` / `error` slots map to the Loader Intent's existing `pending` / `error` / `success` lifecycle states (two separate fallback surfaces, no merged `fallback`), all resolution routes through the existing Resource Loader block (state transitions, anti-flicker, version-token stale-drop, hierarchy aggregation stay Loader's — cross-reference, don't duplicate), and `crossStrategy` gains a `resource` lift/lower correspondence whose lower path raises a `resource-suspends-on-read` lossy diagnostic. Ratified in #124 (Forks 1-3): `<Resource>` is a declarative composition of the Loader Intent — no new async model. Blocked on #070.

## Progress

**Resolved 2026-06-12** (#070 long since resolved — unblocked). All three forks wired; no new async runtime (per #124 "declarative composition, no new async model").

**Fork 1 — slot → Loader-state contract** (`we:blocks/renderers/jsx/directives.ts`): added the exported `RESOURCE_SLOT_STATES = { loading:'pending', error:'error', default:'success' }` map + an authoritative doc block. Two separate fallback surfaces, **not** a merged `fallback`. The slots are plain children, so the existing registry-driven desugar/sugarize already carries them through unchanged — proven by 4 new tests in `we:directiveSugar.test.tsx` (desugar/sugarize/round-trip a `<Resource>` with `slot="loading"`/`slot="error"`/default; sugarize correctly leaves the inert slot `<template>`s verbatim and only raises the outer shell via stack pairing).

**Fork 2 — routes through the Resource Loader block** (cross-reference, don't duplicate): the doc block points `<Resource>` at the Loader Intent (`we:intents.json` `loader`) and the Resource Loader block (`fui:blocks.json` `resource-loader`, `we:blocks/resource-loader/ResourceLoader.ts`); state transitions, anti-flicker, version-token stale-drop and hierarchy aggregation are explicitly the Loader's. No resolution logic reimplemented in the directive layer.

**Fork 3 — crossStrategy lift/lower + lossy diagnostic** (`we:render-strategy/crossStrategy.ts`): added `liftResource` (`<template is="resource" from="E">BODY</template>` → `<Suspense>{use(E)}BODY</Suspense>`, incl. self-closing) and `lowerResource` (the reverse, raising `resource-suspends-on-read`). Uses React's real `use()`/`<Suspense>` vocabulary; `use()` is the suspend-on-read marker. The LOWER path is lossy because suspend-on-read (throw-to-Suspense via the scheduler) has no declarative equivalent — the Resource Loader resolves via explicit states instead. Ordering: `lowerResource` runs before `lowerInterpolation` (so `{use(E)}` isn't mis-read as a bare interpolation) and `liftResource` after `liftForEach`/`liftConditionals` (so inner templates lift first and the non-greedy body match closes on the resource's own `</template>`). 5 new crossStrategy tests (lift, self-closing lift, lower+flag, structural-reversible-but-flagged round-trip). POC nesting limit (shared with liftForEach): a crossStrategy body with its own nested slot `<template>`s is out of scope for the structural match — slot preservation is covered at the desugar/sugarize layer (Fork 1), which is stack-based and handles nesting.

Gate: 540 renderer vitest green (2 skipped, pre-existing live-model); tsc clean on changed files; `check:standards` 0 errors.

**Graduated to** `we:blocks/renderers/jsx/directives.ts` — RESOURCE_SLOT_STATES + we:crossStrategy.ts liftResource/lowerResource (render-strategy/).
