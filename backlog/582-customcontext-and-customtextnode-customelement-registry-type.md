---
type: decision
workItem: story
size: 3
status: resolved
dateOpened: "2026-06-14"
dateStarted: "2026-06-14"
dateResolved: "2026-06-14"
graduatedTo: none
codifiedIn: "one-off"
tags: [plugs, registry, typescript, generics, convergence]
relatedReport: reports/2026-06-14-registry-generic-type-architecture.md
preparedDate: "2026-06-14"
---

# CustomContext (and CustomTextNode/CustomElement) registry type-architecture: WE class-`Key` vs FU method-`get<Key>`

> **RESOLVED 2026-06-14 — A / A.** Ratified both recommended defaults after verifying every load-bearing
> claim against the real tree (WE/FU class signatures, `Registry` non-conformance of WE's form, byte-identical
> `CustomContextRegistry`, **zero** consumers of WE's class-level `Key`). The converged `plugs/` surfaces
> (#580) take:
> - **Fork 1 → A:** FU's method-level `get<Key>`, string-keyed, `Map`-shaped `CustomContext` (port
>   `values()`/`entries()`/`delete(): boolean` up). Decisive: it is the *sole* form that actually satisfies
>   `Registry<Definition, Key>` ([we:Registry.ts:9-18](../plugs/webinjectors/Registry.ts#L9-L18)) — WE's
>   `implements Registry<ContextValue, keyof ContextValue>` is a false declaration (omits `values`/`entries`,
>   `delete` returns `void`, mistypes the `Definition` slot); plus native-first and zero consumer cost (dead
>   class param). Position-as-upstream (Fork 1-B) does not outweigh a correctness defect at zero migration cost.
> - **Fork 2 → A:** FU's rider typings on both `CustomTextNodeRegistry` (`ImplementedTextNode<any>`) and
>   `CustomElementRegistry` (concrete `upgrade(root: Node)`, `options?` optional) — avoids the self-referential
>   `Parameters<>` bug and stays consistent with Fork 1.
> - **Axis 3 (not a fork) → unconditional:** port WE's `ensureNativelyConstructible`
>   ([we:CustomElementRegistry.ts:10-40](../plugs/webregistries/CustomElementRegistry.ts#L10-L40)) up regardless —
>   without it `new RealClass()` throws "Illegal constructor" in a real browser.
>
> No entity graduation — this is a type-contract ruling consumed by the #580 convergence build (→ #449), not a
> new protocol/intent. The #580 build is now one-directional: converge `plugs/` onto FU's typings + WE's runtime.

> **Prepared 2026-06-14.** Ratifies *shipped* code (both forms exist) — no greenfield design. **2 forks**,
> each with a **bold** recommended default, grounded in the published research topic
> [/research/registry-generic-type-architecture/](/research/registry-generic-type-architecture/) and the
> line-by-line diffs in [relatedReport](../reports/2026-06-14-registry-generic-type-architecture.md). The
> survey **reshaped the framing**: it corrected the divergent class name, split the CustomElement rider into
> two orthogonal axes (one of which is *not* a fork), and resolved the one residual risk #582 had deferred.

Surfaced working #580: the FU↔WE plugs trees diverge on the **public type contract** of core registries,
not just on code. #580 converges the two trees into one superset under `plugs/`, so the converged surfaces
can carry **only one** public form, and WE & FU chose mutually-incompatible ones (fork-existence test: the
branches cannot coexist — exactly one survives). Decide the canonical generic architecture (porting FU's
iteration methods and WE's native-construction runtime up regardless), so #580 converges one-directionally.
Gates #580 → #449.

## Correction from the survey (read before the forks)

The original item named the divergent class `CustomContextRegistry` and cited `we:CustomContext.ts:64`. The
**file ref was right; the class name was wrong.** `we:CustomContextRegistry.ts` is **byte-identical** between
the repos (`diff` → empty). The real divergence is in **`we:CustomContext.ts`** — the abstract base class that
`implements Registry<…>`. This item now names `CustomContext`.

## Axis-framing — three orthogonal axes, only two are forks

The concern decomposes into three axes, each pinned to the real tree:

1. **Key-typing of `CustomContext`** (the crux). WE parameterizes the *class* with a `Key`:
   [we:plugs/webcontexts/CustomContext.ts:63-66](../plugs/webcontexts/CustomContext.ts#L63-L66) —
   `class CustomContext<ContextValue extends Record<Key, unknown>, Key extends keyof ContextValue = keyof ContextValue> implements Registry<ContextValue, keyof ContextValue>`, with class-level
   [`get(key: Key)`](../plugs/webcontexts/CustomContext.ts#L139). FU drops the class param and moves the key
   to the *method*: `class CustomContext<ContextValue extends Record<string, unknown>> implements Registry<ContextValue[keyof ContextValue], string>`, with `get<Key extends keyof ContextValue>(key: Key)`,
   `keys(): IterableIterator<string>`, plus `values()` / `entries()` / `delete(_key): boolean` that WE lacks
   (WE's [`delete(): void`](../plugs/webcontexts/CustomContext.ts#L206) throws). → **Fork 1.**

2. **Rider typings on the two other registries** — same convention question, must match Axis 1's stance.
   `CustomTextNodeRegistry`: WE `constructor: typeof CustomTextNode` /
   [`define(name, TextNode: ImplementedTextNode)`](../plugs/webexpressions/CustomTextNodeRegistry.ts#L59)
   vs FU `constructor: ImplementedTextNode<any>` (heterogeneous, with a justifying comment) + `RootNode`
   import. `CustomElementRegistry`: WE
   [`upgrade(...args: Parameters<typeof OriginalCustomElementRegistry…>)`](../plugs/webregistries/CustomElementRegistry.ts#L128)
   + `ImplementedElement` ctor `(options: CustomElementOptions)` (required) vs FU concrete
   `upgrade(root: Node)` + `(options?: …)` (optional). → **Fork 2.**

3. **WE-only runtime on `CustomElementRegistry`** — `ensureNativelyConstructible`
   ([we:CustomElementRegistry.ts:10-40](../plugs/webregistries/CustomElementRegistry.ts#L10-L40)): registers
   the real class natively under a private `scoped-ctor-N-el` tag so `new RealClass()` / `Reflect.construct`
   don't throw "Illegal constructor" in a real browser. FU lacks it. **Not a fork** — it is additive (like
   FU's `values()`/`entries()`); the converged tree keeps it regardless of Forks 1–2. Recorded so the #580
   build doesn't drop it.

## Per-fork classification pass

- **Which layer?** All three surfaces are plugs-platform primitives owned by WE (the standard layer), with
  impls compiled against them in FU (the constellation: WE standard → Frontier UI impl). The contract lives in WE.
- **Protocol or intent dimension?** Neither — this is the TS *type contract* of a runtime registry, not a
  protocol entry or an intent. No we:adapters.json / we:intents.json change.
- **Expose the whole axis / fixed mechanic vs dimension?** Fixed mechanic. There is exactly one shared
  runtime form (a fixed mechanic, not a configurable dimension); the key-typing is not a configurable
  dimension — both branches are *candidate* end-states but only one ships (fork-existence).
- **DI-injectable?** No — this is the base-class/registry public signature, not an injected provider.
- **Most-permissive default?** Favours FU on every sub-axis: method-level `get<Key>` is strictly more
  flexible than a defaulted class param; `options?` optional is more permissive than required;
  `ImplementedTextNode<any>` is the more-permissive heterogeneous form (most-flexible default).
- **Seam between intents / bias to separation?** The runtime axis (Axis 3) is kept *separate* from the
  typing forks (bias toward separation) — that decoupling is what lets the rider adopt FU's
  typings without losing WE's native-construction runtime.

Native-first (built-ins align to the web platform) is decisive: the codebase's generic
`Registry<Definition, Key = string>` ([we:Registry.ts](../plugs/webinjectors/Registry.ts)) mirrors the native
`Map<K,V>` + iterator protocol, and **only FU's form actually conforms** to it (WE omits `values()`/
`entries()`, returns `void` from `delete`, and mistypes the `Definition` slot as the whole record).

## Recommended path at a glance

| Fork | Recommended default | Main alternative | Confidence |
|---|---|---|---|
| 1 — canonical `CustomContext` form | **A — adopt FU's method-level `get<Key>`, string-keyed, `Map`-shaped form** | B — keep WE's class-level `Key` | **High** — 3 independent reasons converge (below) |
| 2 — rider typings (TextNode + Element) | **A — adopt FU's typings on both** | B — re-derive under WE's form | **High** — consequence of Fork 1 + most-permissive |

## Fork 1 — canonical `CustomContext` generic form

**Crux:** the converged `CustomContext` carries one key-typing contract; WE's class-`Key` and FU's
method-`get<Key>` are mutually incompatible (refs in Axis 1 above).

- **(A — recommended) Adopt FU's method-level-generic, string-keyed, `Map`-shaped form**, porting
  `values()` / `entries()` / `delete(): boolean` up. Three independent reasons converge:
  1. **Native-first** — it completes the platform `Map`/iterator vocabulary the `Registry` interface
     mirrors; WE's is a partial subset.
  2. **Sole conformant side** — WE's `implements Registry<ContextValue, keyof ContextValue>` mistypes the
     `Definition` slot (passes the whole record where a *value* is expected), omits `values()`/`entries()`,
     and returns `void` from `delete` — it does **not** satisfy the interface it declares. FU's
     `Registry<ContextValue[keyof ContextValue], string>` does.
  3. **Zero consumer cost** — grep across WE + FU + plateau-app: **no consumer binds the class-level
     `Key`**; `CustomContext<X, Y>` (two args) has **zero occurrences**. WE's second param is dead, so
     dropping it retypes nothing. (This resolves the only residual risk the original item had deferred to
     #580 build time.)
- **(B) Keep WE's class-level `Key`-parameterized form** and graft FU's `values()`/`entries()` onto it.
  *Rationale:* WE is the upstream layer, so its form is "canonical by position." *Cost:* loses method-level
  ergonomics, must re-derive the iteration return types under the dead `Key` param, and leaves the
  `Registry`-conformance and `Definition`-mistype defects in place. Position alone doesn't outweigh three
  merit reasons.
- **(C) Design a third reconciled form.** *Rejected* — no evidence either shipped form is wrong in a way a
  third fixes; pure scope for no interop gain (support-all unless a branch is flawed).

**Default: A.**

## Fork 2 — rider typings adopt the same stance

**Crux:** `CustomTextNodeRegistry` and `CustomElementRegistry` must pick one convention too; keeping it the
*same* as Fork 1 means all three core registries converge on one convention, not three (refs in Axis 2).

- **(A — recommended) Adopt FU's typings on both riders:** `ImplementedTextNode<any>` (the heterogeneous,
  most-permissive form, with FU's altitude comment); concrete `upgrade(root: Node)` (FU's comment shows
  WE's `Parameters<typeof OriginalCustomElementRegistry…>` is *self-referential* here, since the class is
  assigned to `window.CustomElementRegistry` — so the concrete signature is the correct one); and
  `options?` optional (most-flexible default). **Independent of the typing choice, port WE's
  `ensureNativelyConstructible` runtime up** (Axis 3 — additive, not a fork).
- **(B) Re-derive the rider typings under WE's form** (concrete-`typeof`, `Parameters<>` upgrade, required
  `options`). *Rejected* — re-introduces the self-referential `Parameters<>` bug FU's comment documents, is
  less permissive, and contradicts Fork 1's stance, fragmenting the convention across three registries.

**Default: A.** (Tie this to whatever Fork 1 resolves to; under B-for-Fork-1 the riders would instead take
WE's typings, but the `ensureNativelyConstructible` port is unconditional either way.)

## Why a decision, not part of #580

#580 is otherwise mechanical (11/16 files: WE already ⊇ FU). The public type contract of three core
registries across two repos is the one genuine design call in it, carved here as a decision work item
(decisions are work items, not plan-mode). Resolving it unblocks #580's one-directional
convergence, which unblocks #449. **Prepared, still open** — the call is `/next decision`'s job.
