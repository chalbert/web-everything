---
type: decision
workItem: story
size: 3
status: open
dateOpened: "2026-06-14"
tags: []
---

# CustomContext (and CustomTextNode/CustomElement) registry type-architecture: WE Key-parameterized vs FU string-keyed

Surfaced 2026-06-14 working #580: the FU↔WE plugs trees diverge on the public type contract of core registries, not just on code. WE's CustomContextRegistry is Key-parameterized (`Registry<ContextValue, keyof ContextValue>` with class-level `Key`); FU dropped `Key` for a string-keyed `Registry` with method-level key generics (`get<Key>`) AND adds genuine runtime methods WE lacks (`values()`, `entries()`, `delete(_key): boolean`). The two are mutually incompatible — the converged superset tree must pick ONE public form, and each has consumers in its own repo. CustomTextNodeRegistry (`ImplementedTextNode<any>` generic + RootNode import) and CustomElementRegistry (concrete vs `Parameters<>` `upgrade()` typing + `ImplementedElement`) ride the same call. Decide the canonical generic architecture (port FU's iteration methods up regardless), so #580 can converge one-directionally. Gates #580 → #449.

## Crux

The plugs are a **single shared runtime** — #580 converges the two trees into one superset under `webeverything/plugs/`, so the converged `CustomContextRegistry` can carry **only one** public type contract. WE and FU chose mutually-incompatible ones (fork-existence test: the branches cannot coexist, exactly one survives). Pick the canonical form on merit; the FU-only *runtime* methods (`values()`, `entries()`) get ported up under whichever form wins — they are additive, not part of the fork.

Concrete refs:
- WE: [plugs/webcontexts/CustomContext.ts:64](../plugs/webcontexts/CustomContext.ts#L64) — `class CustomContextRegistry<ContextValue extends Record<Key, unknown>, Key extends keyof ContextValue = keyof ContextValue> implements Registry<ContextValue, keyof ContextValue>`; `get(key: Key)` / `set(key: Key)` use the class-level `Key`.
- FU: `frontierui/plugs/webcontexts/CustomContext.ts:64` — `class CustomContextRegistry<ContextValue extends Record<string, unknown>> implements Registry<ContextValue[keyof ContextValue], string>`; method-level `get<Key extends keyof ContextValue>(key: Key)`, `keys(): IterableIterator<string>`, plus `values()` / `entries()` / `delete(_key): boolean`.

## Fork — canonical registry generic architecture

- **(A — recommended) Adopt FU's method-level-generic, string-keyed form** as the canonical contract, and port its `values()`/`entries()`/`delete(_key)` additions up. *Rationale:* it mirrors the platform's own `Map<K,V>` shape (method-level `get<K>`, `string` keys, `values()`/`entries()` iterators), is the most ergonomic for consumers, and is the only side that carries the extra runtime — so adopting it is also the smaller net change to reach a superset. Cost: WE consumers relying on the class-level `Key` parameter (if any) get retyped; verify the WE consumer set first.
- **(B) Keep WE's class-level `Key`-parameterized form** and graft FU's `values()`/`entries()` onto it. *Rationale:* WE is the upstream layer, so its form is "canonical by position." Cost: loses FU's method-level ergonomics; FU consumers using `get<Key>` / `string` keys get retyped, and B must still re-derive the iteration methods' return types under the `Key` param.
- **(C) Design a third reconciled form** superseding both. *Likely rejected* — no evidence the two existing forms are both wrong; adds scope for no interop gain (support-all / fork-existence: only diverge when a branch is flawed).

**Default: A.** It aligns with the native `Map` vocabulary (native-first), is the lower-loss path to the superset (FU already has the richer surface), and keeps the WE↔FU contract identical to what FU consumers already compile against. The residual work is verifying WE's CustomContext consumers retype cleanly under A — done at #580 build time, not here.

**Rider (ratify with the chosen form):** `CustomTextNodeRegistry` (`ImplementedTextNode<any>`) and `CustomElementRegistry` (`upgrade()` concrete-signature + `ImplementedElement`) adopt the *same* stance — FU's more-concrete typings under A, WE's under B — so all three core registries converge on one convention rather than three.

## Why a decision, not part of #580

#580 is otherwise mechanical (11/16 files: WE already ⊇ FU). This is the one genuine design call in it — the public type contract of three core registries across two repos — so it is carved here per *Decisions Are Work Items*. Resolving it unblocks #580's one-directional convergence, which in turn unblocks #449.
