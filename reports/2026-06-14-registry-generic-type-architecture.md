# Registry generic type-architecture: WE class-`Key` vs FU method-`get<Key>` — prior-art grounding for #582

**Date:** 2026-06-14 · **Backlog:** [#582](../backlog/582-customcontext-and-customtextnode-customelement-registry-type.md) (decision, prep) · **Gates:** #580 → #449

## Why this report

#580 converges the FU and WE `plugs/` trees into one shared-runtime superset. The two repos shipped
**mutually-incompatible public type contracts** on three core registry surfaces — `CustomContext`,
`CustomTextNodeRegistry`, `CustomElementRegistry`. A single shared runtime can carry only one form, so
this is a real fork-existence call (exactly one survives), carved to #582. This report grounds the call
in (a) the actual divergent code, read line-by-line, and (b) the platform vocabulary (`Map<K,V>`, the
iterator protocol) the codebase's own generic `Registry` interface already mirrors.

## Correction to #582's framing (found by reading the tree)

The item's prose names the divergent class **`CustomContextRegistry`** and cites
`we:plugs/webcontexts/CustomContext.ts:64`. The **file ref is right; the class name is wrong.**
`we:CustomContextRegistry.ts` is **byte-identical** between WE and FU (`diff` → no output). The actual
divergence is in **`we:CustomContext.ts`** — the abstract base class that `implements Registry<…>`. The
prepared item is corrected to name `CustomContext` (the base), not `CustomContextRegistry` (the
HTMLRegistry subclass, which does not diverge).

## The three divergent surfaces (verified diffs)

### 1. `CustomContext` (we:webcontexts/CustomContext.ts) — the fork proper

| Axis | WE | FU |
|---|---|---|
| Class params | `<ContextValue extends Record<Key, unknown>, Key extends keyof ContextValue = keyof ContextValue>` | `<ContextValue extends Record<string, unknown>>` (single) |
| `Registry` conformance | `implements Registry<ContextValue, keyof ContextValue>` | `implements Registry<ContextValue[keyof ContextValue], string>` |
| `get` / `set` | class-level `get(key: Key)` | method-level `get<Key extends keyof ContextValue>(key: Key)` |
| `keys()` | `IterableIterator<keyof ContextValue>` | `IterableIterator<string>` |
| `values()` / `entries()` | **absent** | **present** |
| `delete()` | `delete(): void` (throws) | `delete(_key: string): boolean` |
| `ImplementedContext<V>` | `V` unconstrained | `V extends Record<string, unknown>` |

### 2. `CustomTextNodeRegistry` (webexpressions/) — rider

WE: `constructor: typeof CustomTextNode`, `define(name, TextNode: ImplementedTextNode)`.
FU: `constructor: ImplementedTextNode<any>`, `define(… ImplementedTextNode<any>)`, imports `RootNode`,
with a comment justifying `<any>` as "the right altitude at this boundary" (heterogeneous registry).
FU is the more-parameterized/heterogeneous typing.

### 3. `CustomElementRegistry` (webregistries/) — rider, with a twist

- **Typing axis (fork-aligned):** WE `upgrade(...args: Parameters<typeof OriginalCustomElementRegistry…>)`
  vs FU **concrete** `upgrade(root: Node)`. FU's comment notes `Parameters<>` is *self-referential* here
  (the class is assigned to `window.CustomElementRegistry`) — so FU's concrete signature is the correct
  one. `ImplementedElement` ctor: WE `(options: CustomElementOptions)` (required) vs FU `(options?: …)`
  (optional → most-permissive).
- **Runtime axis (NOT the fork — additive, port up like values/entries):** WE has a whole
  `ensureNativelyConstructible` mechanism (registers the real class natively under a private
  `scoped-ctor-N-el` tag so `new RealClass()` / `Reflect.construct` don't throw "Illegal constructor" in
  a real browser) that **FU lacks**. This is a genuine WE-only runtime feature and must be carried up
  regardless of the typing decision — the converged tree keeps it.

## Decisive consumer-set evidence (resolves #582's residual risk)

#582-A's only flagged cost was "verify WE's `CustomContext` consumers retype cleanly under A." Grepped
every subclass across WE + FU + plateau-app:

- **No consumer anywhere binds the class-level `Key`.** Every `extends CustomContext<State>` /
  `extends CustomContext` uses the single type parameter (or none). `CustomContext<X, Y>` (two args):
  **zero occurrences** in the workspace.
- WE's second class param `Key = keyof ContextValue` is therefore **effectively dead** — defaulted and
  never overridden. Dropping it (adopting FU's single-param + method-level `get<Key>`) **retypes zero
  consumers.** The residual risk is resolved here, not deferred to #580 build time.

## Correctness point beyond ergonomics

The shared generic interface is `Registry<Definition, Key = string>` with `get(name): Definition |
undefined`, `delete(name): boolean`, and `keys()/values()/entries(): IterableIterator<…>`
([we:Registry.ts](../plugs/webinjectors/Registry.ts)).

- **WE's `CustomContext` does not actually satisfy it:** it omits `values()` and `entries()` and its
  `delete(): void` violates the `boolean` return. It also passes the *whole record* `ContextValue` into
  the `Definition` slot — but `Definition` is the *value* type (`get` returns one value), so WE mistypes
  that slot.
- **FU's `CustomContext` fully conforms:** `Registry<ContextValue[keyof ContextValue], string>` puts the
  value union in `Definition` and `string` in `Key` (matching the interface default), and it implements
  `values()`/`entries()` and `delete(): boolean`.

So A (adopt FU's form) is not merely "more ergonomic" — it is the form that **conforms to the codebase's
own `Registry` contract**, which WE's form silently breaks.

## Platform vocabulary (native-first grounding)

The native `Map<K, V>` and the JS iterator protocol are the reference shapes the generic `Registry`
interface already mirrors: `keys()`, `values()`, `entries()` returning `IterableIterator`, `delete`
returning `boolean`, `has`/`get`/`set`, a `size` accessor. FU's surface reproduces the full `Map`
method set; WE's is a partial subset (no `values`/`entries`, non-`boolean` `delete`). For the *key
typing*, the idiomatic TS pattern for a heterogeneous record accessor is the **method-level indexed
generic** `get<K extends keyof T>(key: K): T[K]` (the shape used by typed config/store accessors), which
is exactly FU's `get<Key>`. A class-level single `Key` union (the Map shape) would *lose* per-key
precision; WE avoids that only by defaulting `Key = keyof ContextValue`, i.e. by never using the param —
which is why it is dead. Method-level is both more precise and more flexible.

## Conclusion (for ratification at /next decision — not made here)

- **Fork → A** (adopt FU's method-level-generic, string-keyed, `Map`-shaped form; port `values()` /
  `entries()` / `delete(): boolean` up): native-first, the only `Registry`-conformant side, *and*
  zero-consumer-cost (the WE `Key` param is dead). Confidence **high**.
- **Riders → adopt FU's typings** (`ImplementedTextNode<any>`; concrete `upgrade(root: Node)`;
  `options?` optional) **and port WE's `ensureNativelyConstructible` runtime up** as additive. Confidence
  high on typings; the runtime port is not a fork at all.
- **C (third reconciled form): rejected** — no evidence either shipped form is wrong in a way a third
  fixes; pure scope for no interop gain (support-all / fork-existence).

Published as `/research/registry-generic-type-architecture/`. Linked from #582 via `relatedReport`.
