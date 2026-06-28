---
kind: decision
parent: "1831"
status: resolved
locus: frontierui
dateOpened: "2026-06-27"
dateStarted: "2026-06-28"
dateResolved: "2026-06-28"
graduatedTo: none
codifiedIn: "docs/agent/platform-decisions.md#native-first-baseline"
preparedDate: "2026-06-28"
relatedReport: reports/2026-06-28-custom-states-plugged-interception.md
relatedProject: webcomponents
tags: [custom-state-set, states, element-internals, plug-unplugged, declarestates-contract]
---

# custom-states slice B: the `declareStates` standard contract (+ FUI build)

Slice B of epic #1831, under ruling #1807 (slice A #1891 **resolved** — the `states=` parse + lowering + the
unplugged floor `fui:blocks/renderers/component/customStates.ts` all shipped). The custom-states **plug is a
proposed missing web standard**: a *declared, validated* custom-state vocabulary, which no spec ships today
(`CustomStateSet`/`:state()` are present and open; the declaration+validation layer is absent — #1807's
partition). So the **only thing this decision ratifies is the WE contract** — `declareStates` — as a future
first-class web-platform proposal. **How FUI implements it is secondary and out of scope here** (see
*Implementation — FUI, non-binding*). Contract home: `we:src/_data/plugs/customstates.json` (type-only, #606/#1282).

> **Scope discipline (`we:docs/agent/platform-decisions.md#native-first-baseline` → *Decision-discipline
> corollary*, #1892).** A plug decision ratifies the **contract**, never the implementation mechanism. The
> mechanism (prototype patch vs out-of-band, the residue classification, polyfill shape) is FUI-local, swappable,
> and could even come from a different library — valid as long as it conforms to this contract. This item earlier
> mis-scoped itself as the mechanism call ("how does the plugged form *intercept*?") and burned a session on it;
> that material is retained only as the *audit trail* below, demoted to non-binding. The lesson is now codified —
> this item is its worked example.

## ✅ Ratified ruling (2026-06-28)

**RATIFIED:** the WE standard is **`declareStates(internals, vocab, { severity? })`** — a closed, opt-in
**validated** custom-state vocabulary constraining the native `internals.states` (Definition A); undeclared
toggles are a validation error (severity = a `#config-extends-platform-default` dimension, default `report`,
opt-in `throw`); no declaration ⇒ open native floor; only the JS declaration/validation layer is in scope
(`:state()` native). **Scope: `declareStates` is the sole new standard surface** — `toggleState`/`addStates` are
**FUI implementation**, not part of the contract. Implementation mechanism (patch / out-of-band / residue) is
**FUI-local and non-binding** (#1794 picks a conforming impl). Codifies the meta-rule it exemplifies: a plug
decision ratifies the contract, never the implementation mechanism
(`we:docs/agent/platform-decisions.md#native-first-baseline` → Decision-discipline corollary).

## The WE decision — the `declareStates` contract (this is what gets ratified)

```ts
declareStates(
  internals: ElementInternals,
  vocab: Iterable<string>,
  options?: { severity?: 'report' | 'throw' }   // omitted ⇒ resolve up the config chain (see Severity)
): void
```

**Observable semantics (as a web-platform proposal):**
- `declareStates` declares `vocab` as the **closed** set of valid custom states for `internals.states`.
- After declaration, toggling a state **outside** `vocab` is a **validation error** — the state is **not applied**
  (declined) and reported; under `severity:'throw'`, it throws. The constraint is on **`internals.states`
  itself** — i.e. *any* path that sets an undeclared state is subject to the vocabulary, because a platform
  standard is enforced by the platform, not by which helper you happened to call.
- **Opt-in, per element.** With **no** `declareStates`, `internals.states` is the **open native set** — the
  native-first floor is preserved; the constraint exists only where an author opts in by declaring.
- **Polyfill/proposal scope:** only the **JS declaration+validation layer** is the proposal. `:state()` CSS
  matching is native Baseline-2024 machinery and is **not** part of it.
- **Surface scope — `declareStates` is the *only* new standard surface.** Toggling stays the **native**
  `internals.states.add/delete/has`; validation targets those native operations. `toggleState`/`addStates`
  (slice A) and any other ergonomic wrappers are **FUI implementation** over the native primitive — **not** part
  of this contract, never `@webeverything` surface. A consumer programs to `declareStates` + native
  `internals.states`; the WE standard adds exactly one verb.

**Why a *validated* set, not a lint (the one substantive standard call).** Two coherent contracts exist:
**(A)** the declared vocabulary constrains the primitive — an undeclared state is invalid *regardless of how it
is set* (a real platform feature with teeth); **(B)** only the framework's declared/mediated surface validates,
and a raw `internals.states.add('typo')` is an out-of-scope escape hatch (a *framework lint*). **The contract is
A.** B isn't a valid *plug* at all: a plug is a proposed **platform** standard, and a constraint a caller can
trivially bypass by using the native method is tooling, not a standard. A's enforcement stays native-first
because it is opt-in *at declaration* (B's "keep the primitive open" concern is met by the no-declaration floor,
not by leaving a bypass inside a declared element). This is the call to **ratify**.

## Severity — a config dimension on the contract (settled by statute)

Severity has two legitimate end-states, so per `#config-extends-platform-default` it is a **config dimension**,
not a baked behavior: the **enum `'report' | 'throw'` is the contract** (WE type-only); the **value** resolves
**nearest-wins** (#1662): per-call `declareStates({severity})` → app/fragment config → **team/project config** →
**platform-default flavor `report`** (Q6 most-permissive; `throw` is the author opt-in). A team that wants strict
states in CI sets `severity:'throw'` once in its `webeverything.config`; a call site can override locally. Ship
the **baseline** chain first; a **sealed** (non-overridable team mandate) entry is a later add only if a team
needs to *enforce* rather than *default*. (`throw` stays the baked behavior only for the *misconfiguration* class
— an unknown provider name, e.g. `UnknownGuardProviderError` — which is not a data violation and not part of this
dimension.)

## Implementation — FUI, non-binding (NOT part of this ratification)

How FUI realizes the contract is FUI's call (#1794's build), recorded here as **candidates only** — any of these
(or a third, or another library's) is valid **iff it conforms to the contract above**:

- **(candidate) prototype-method wrapper** — patch `CustomStateSet.prototype.add`/`.delete` (a **wrapper**, not
  `Proxy` — #1872) to consult a `declareStates`-populated WeakMap. This is the natural way to honor "constrain the
  primitive itself" (A), and the declarative lowering can additionally emit the check **inline** so the
  self-contained ESM (`fui:blocks/renderers/component/declarativeComponent.ts:196,222`) validates without
  importing the plug. Whether the prototype patch counts as [residue](../../docs/agent/platform-decisions.md#plugged-only-residue-bar)
  is an **FUI** classification, not a WE call.
- **(candidate) out-of-band helpers** — the plug-resolved `toggleState`/`addStates` validate; cheaper, but catches
  only the mediated surface (an FUI coverage choice about how completely it delivers A's "regardless of call-site").
- **Context resolution** mirrors the injector precedent (`fui:plugs/validationUnplugged.ts` /
  `fui:plugs/guardsUnplugged.ts`: `InjectorRoot.getProviderOf` nearest-scope + `window` fallback) — also FUI-internal.
- **Parity marking** is FUI-side (`fui:plugs/customstates/parity.json`, #1839/#1844); WE stays type-only.

**Feasibility floor (the only impl constraint the contract carries):** the contract must be *implementable* — it
is (the wrapper candidate demonstrates a conforming impl exists). That is all WE needs to confirm.

## Audit trail — why this took a session (the worked example for "ratify contract, not mechanism")

Kept as the lesson, not as live forks. The decision oscillated because it was scoped to *implementation*:

1. **Prep:** out-of-band, "not residue" — reached by *narrowing* the contract to "validate the helper".
2. **Review reframe:** flipped to a prototype patch, "residue" — reached by *widening* the contract to "enforce
   regardless of call-site". Ratified.
3. **Red-team (pre-resolve):** refuted the patch on three axes — but all three (mechanism gap on the seam-free
   ESM, residue/no-handle, global-mutation cost) are **implementation** concerns. The skeptic was attacking FUI
   build details that **WE never ratifies**.
4. **Resolution:** none of (1)–(3) was a WE decision. The mechanism is FUI's (above, non-binding). The WE call
   is just the `declareStates` **contract** (A + severity dimension). Both the prep's *narrowing* and the
   review's *widening* were **contract-gerrymandering** — picking a contract to force a mechanism verdict, the
   exact failure rules 139/140 name; this item adds rule 141 (a mechanism "fork" is not a standards decision).

## Statute-overlap reconciliation (for `codifiedIn`)

The WE rule #1892 codifies (a `#component-dc` entry, extending the cluster #1807 lists): *"the custom-states plug
contract is `declareStates(internals, vocab, {severity?})` — a closed, opt-in **validated** custom-state
vocabulary constraining `internals.states`; undeclared toggles are a validation error (severity = a
`#config-extends-platform-default` dimension, default `report`); no declaration ⇒ open native floor; only the JS
declaration/validation layer is in scope (`:state()` native). Implementation is FUI-local and non-binding."*
Plus the meta-rule it exemplifies: **a plug decision ratifies the contract, never the implementation mechanism**
(`we:docs/agent/platform-decisions.md#native-first-baseline` → Decision-discipline corollary).

- Clean against #1826 (plug = proposed standard), #606/#1282 (contract WE / impl FUI), `#native-first-baseline`
  (opt-in constraint preserves the open primitive), `#config-extends-platform-default` (severity dimension). No
  residue classification is asserted here — it is deliberately left to FUI, which is the point.

## Progress

- **Status:** RATIFIED (2026-06-28) → resolving. See *✅ Ratified ruling*.
- **Done:** Ratified the WE **`declareStates`** contract (Definition A: opt-in validated vocabulary + `severity`
  config dimension), scoped so `declareStates` is the **only** new standard surface (`toggleState`/`addStates`
  are FUI impl). Implementation mechanism left FUI-local + non-binding. Codified the meta-rule
  (`we:docs/agent/platform-decisions.md#native-first-baseline` → Decision-discipline corollary) + memory rules
  139/140/141.
- **Next:** FUI build #1794 picks a conforming implementation of the contract.
- **Notes:** The mid-session "ratified" on the *patch* was superseded by the pre-resolve red-team and dissolved
  as out-of-scope (impl, not standard); the actual ratification is the contract above.

**Lineage.** Epic #1831 → slice B. Ruling #1807 (the plug shape + layer partition) · slice A #1891 (the floor,
resolved). Governed by #1826 (plug = proposed standard) + #606/#1282 (contract WE / impl FUI) +
`#native-first-baseline` (open primitive; plug = contract, impl secondary — the #1892 corollary) +
`#config-extends-platform-default`/#1662 (severity dimension). Adoption #1794 consumes the FUI build.
