# Lazy Trait Loading: Where We Stand, and How It Would Work

**Date:** 2026-06-02
**Status:** Analysis — confirms a direction; no new code.
**Subject:** the Web Traits "Scale without Weight" vision ([`we:src/_data/traits.json`](../src/_data/traits.json), surfaced at `/projects/webtraits/`) and whether a **declarative attribute** can drive trait application at **build time or runtime**.

---

## Where we stand

`we:traits.json` frames traits as **"Scale without Weight"** — ship massive capability (DX) while delivering minimal bundles (UX) by loading features based on usage. Three pillars:

| Pillar | What it is | Status |
|---|---|---|
| **The Contract** | Runtime interface — traits as isolated mixins/compositions with cleanup + a typed host | ✅ POC — [`we:Sortable.ts`](../src/plateau/lib/traits/Sortable.ts), the assertion pattern `useSortable(g): asserts g is DataGrid & SortableTrait` |
| **The Map** | Static `attribute/prop → trait module` declaration, e.g. `{ "sortable": "we:./traits/sort.js" }` | ⏳ Spec'd, not built (fui:blocks.json has `composesIntents`, no trait map) |
| **The Enforcer** | Build plugin (Vite/Rollup) that scans usage and injects the trait imports | ⏳ Spec'd, not built |

Building blocks that already exist and would back it:
- **Lazy DI providers** — `we:plugs/webinjectors/Injector.ts`: `register(key, async loader)` + `consume()` with in-flight dedup and post-load cache. The exact lazy pattern to reuse.
- **Runtime attribute discovery** — `we:plugs/webbehaviors/CustomAttributeRegistry.ts`: a MutationObserver upgrades attributes as they appear in the live DOM.
- **Runtime trait application** — resource-loader's `with*` factories (`load(promise, [traits])`, cleanup in reverse).

**The one missing piece:** `CustomAttributeRegistry.define(name, Class)` is **eager** — the class must be registered before the attribute appears. There is no `defineLazy(name, () => import())` and no attribute→`import()` mapping. Nothing yet loads a behavior's *code* on demand.

---

## Why the attribute declaration is the right primitive

The attribute is a **single declarative source that both a build-time analyzer and a runtime observer can read.** The same `<data-grid sortable>` is the trigger in both worlds — build-time reads it from the *template source*, runtime reads it from the *live DOM*. **One declaration, two application times.** That is exactly the property to want, and it confirms the attribute approach works for both build and runtime.

### Build-time application (baked / split)
The Enforcer scans templates for `sortable`, looks it up in the Map (`sortable → we:./traits/sort.js`), and injects the import + application. It can either (a) bake the trait in eagerly, or — better — (b) emit a code-split chunk plus a lazy registration. Zero runtime discovery cost; the bundler knows exactly what to split.

### Runtime application (on demand)
The MutationObserver already sees `sortable` appear. To make it lazy, give the registry the same Map as `defineLazy('sortable', () => import('we:./traits/sort.js'))`; on first sighting it dynamic-imports the module — reusing the Injector's dedup+cache pattern verbatim — then defines + upgrades the element.

### The hybrid (the mission, realized)
These aren't mutually exclusive. The richest design is **build-time decides the split** (one chunk per trait, from the Map) and **runtime decides the load** (`defineLazy` imports on first appearance). Automatic code-splitting + on-demand loading with no manual glue **is** "Scale without Weight."

---

## Orthogonal to the intent-vs-trait split

Lazy-loading governs **when a trait's code arrives**, not **where the selection is expressed**. The attribute *is* the trait selection (declarative, local — see [`we:2026-06-02-droplist-trait-language.md`](./2026-06-02-droplist-trait-language.md)); whether `Selection`'s code is bundled eagerly or imported lazily is a Map+Enforcer concern. The two efforts compose without interfering.

---

## Gaps (each a backlog item)

1. **The Map** — add an `attribute → module` trait manifest (e.g. a `composesTraits` field in fui:blocks.json, or a `traits` registry). Unlocks both modes; nothing works without it.
2. **`CustomAttributeRegistry.defineLazy(name, () => import())`** — copy the Injector's lazy register/consume (dedup in-flight, cache after). The smallest, most self-contained prototype; makes the runtime path real without the build plugin.
3. **The Enforcer** — a Vite plugin that reads the Map, scans templates, and emits split chunks + `defineLazy` registrations.
4. **Decision — default delivery:** eager-bake vs. split+lazy (and whether it's per-trait overridable).

`defineLazy` (gap 2) is the sharpest first prototype.
