---
kind: decision
parent: "1831"
status: open
locus: frontierui
dateOpened: "2026-06-27"
dateStarted: "2026-06-28"
preparedDate: "2026-06-28"
relatedReport: reports/2026-06-28-custom-states-plugged-interception.md
relatedProject: webcomponents
tags: [custom-state-set, states, element-internals, plug-unplugged, residue-bar]
---

# custom-states slice B: plugged validation + polyfill + declareStates plug-hook (FUI)

Slice B of epic #1831, under ruling #1807 (slice A #1891 **resolved** — `states=` parse + lowering + twin-lag
fix + the unplugged floor `fui:blocks/renderers/component/customStates.ts` all shipped). This is the
impl-architecture call #1807 deferred to the build: **how the plugged form intercepts a toggle of an
un-declared `internals.states` value.** Contract: `we:src/_data/plugs/customstates.json`.

## Grounding digest

#1807 ratified the *shape* (two postures over one single-substrate contract; `--strict`-style enforcement
axis) and labelled its code *"the authoring shape, not a final API spec — #1794's build pins exact names."*
Slice B picks the mechanism. The item posed it as a **"wrapper-vs-proxy architecture + reject/warn"** pair of
calls. Prep finds the **proxy pole is already dead** (two ways, below), so the real space is two genuine
forks — **(1)** out-of-band-no-patch vs prototype-wrapper-patch, and **(2)** non-throwing decline+report vs
throw — each with a statute-backed default (the skeptic pass flipped Fork 2's first instinct) that makes this a
*fast-ratification* candidate. Context-resolution and polyfill-
scope are **settled** (precedent / #1807), not forks. Full survey: `we:reports/2026-06-28-custom-states-plugged-interception.md`
(research topic `/research/#custom-states-validation-interception`).

## Axis-framing — what is actually open

The unplugged floor already exists and is plug-owned: `addStates(internals, names)` and
`toggleState(internals, name, force)` (`fui:blocks/renderers/component/customStates.ts:28,35`), with the
declarative `<component>` lowering calling them in the runtime twin (`fui:blocks/renderers/component/declarativeComponent.ts:252`)
and emitting raw `this.#internals.states.add('<s>')` in the **self-contained** standalone-ESM class form
(`fui:blocks/renderers/component/declarativeComponent.ts:196`; the emitted form is deliberately import-seam-free,
ibid. ~222). Plugged mode must add: a **declared vocabulary**, **validation** of toggles against it, and a
**polyfill** of that layer — resolved from plug context like every sibling plug
(`fui:plugs/validationUnplugged.ts`, `fui:plugs/guardsUnplugged.ts`: `InjectorRoot.getProviderOf` nearest-
scope-wins + `window` fallback).

Two statutes pre-decide most of the space:

- **#1872** (`we:docs/agent/platform-decisions.md#observe-only-posture-spectrum`): *"no `new Proxy` in the
  plugs tree"* — substrate is a prototype-method wrapper, not a Proxy. **And** JS semantics: built-in `Set`
  methods read internal slots, so a `Proxy` over a `CustomStateSet` **cannot trap `.add`/`.delete` at all**.
  → the "proxy" pole is non-viable, twice.
- **#1839** (`we:docs/agent/platform-decisions.md#plugged-only-residue-bar`): a plugged capability may patch
  an unowned global **only if** its contract (incl. transparency) *cannot* be reproduced WeakMap-keyed out-of-
  band through the plug's own API. → governs Fork 1.

### Recommended path at a glance

| Concern | Recommended default | Main alternative (excluded/opt-down) | Confidence |
|---|---|---|---|
| **Fork 1 · interception** | **WeakMap-keyed out-of-band; NO `CustomStateSet.prototype` patch** (not residue per #1839) | prototype-method-wrapper patch (only if raw-call transparency becomes contractual) | high |
| **Fork 2 · severity** | **non-throwing decline + dev report** on un-declared toggle through the declared surface | `severity:'throw'` opt-up (both ship) | med-high |
| Context resolution | injector registry, nearest-scope-wins + `window` fallback | — (settled by precedent) | high |
| Polyfill scope | JS declaration/validation layer **only** | — (`:state()` CSS unpolyfillable; #1807) | high |
| Parity marking | FUI-side `fui:plugs/customstates/parity.json` = `plugged-only`; WE type-only | — (settled #1839/#1844) | high |

## Fork 1 — interception mechanism: out-of-band (no patch) vs prototype-wrapper patch

**Fork exists because:** the two branches produce *different observable contracts that cannot coexist* — either
a raw `internals.states.add('typo')` (bypassing the plug helper) is transparently rejected (requires a global
patch of `CustomStateSet.prototype`) or it is an **open escape hatch** (no patch). One contract must ship. The
"proxy" third option the item named is **not** a live branch — excluded by #1872 *and* by JS internal-slot
semantics (a Proxy can't trap built-in Set methods).

- **(a · DEFAULT) WeakMap-keyed out-of-band — no global patch.** `declareStates(internals, vocab)` (resolved
  from plug context) registers the vocabulary in a `WeakMap<ElementInternals, Set<string>>`; the plug-resolved
  `toggleState`/`addStates` consult it and reject un-declared names. Raw `internals.states.add('typo')` by
  external code stays an **open native escape hatch** (most-permissive floor). Per #1839 clause (ii) the
  contract is reproducible out-of-band through the plug's own API ⇒ **custom-states validation is NOT residue
  ⇒ do not patch.** **Twin-coherence amendment (skeptic):** `ElementInternals` exposes no back-reference to its
  host, so the vocab cannot be read from the `states=` attribute at toggle time — it must be *registered* by a
  `declareStates` call. To keep registration coherent across **both** lowering paths without breaking the
  import-seam-free emitted ESM (`fui:blocks/renderers/component/declarativeComponent.ts:~222`), the plugged
  emitter and the runtime twin both register via an **ambient global** —
  `window.customStates?.declareStates(this.#internals, [...vocab])` (no-op when unplugged, so mode-agnostic and
  seam-free) — *not* an `import` (breaks self-containment) and *not* a prototype patch (#1839). This closes the
  emitter-vs-twin divergence the skeptic surfaced while preserving both invariants.
- **(b) Prototype-method-wrapper patch of `CustomStateSet.prototype.add`/`.delete`.** Transparent interception
  of *every* toggle incl. raw native calls (matches #1807's illustrative throwing example). Wrapper, **not**
  Proxy (#1872). Justified **only** if raw-call transparency is genuinely contractual — and must then discharge
  #1839's residue audit: cite the unowned global (`CustomStateSet.prototype.add`), why no handle (raw `.add` on
  a set the plug did not create), and the missing platform hook (a "validate state vocabulary" lifecycle).
  Rejected as default: #1807's throwing raw-add is *illustrative*, and the realistic un-declared-toggle surface
  for a **bodyless** declarative component is near-empty (no author class body) — so the patch buys global
  mutation for an escape hatch the most-permissive floor wants open.

```js
// Fork 1 (a) — out-of-band, no patch. Plug-resolved helpers consult a WeakMap; native floor stays open.
const declaredVocab = new WeakMap(); // ElementInternals -> Set<string>

// declareStates: resolved from plug context (injector nearest-scope-wins + window fallback), like guardsUnplugged.
export function declareStates(internals, vocab) {
  declaredVocab.set(internals, new Set(vocab));
}
// Plug-owned toggle seam (slice A's helper, now validating when a vocab is declared):
export function toggleState(internals, name, force) {
  const vocab = declaredVocab.get(internals);
  if (vocab && !vocab.has(name)) reject(name, vocab); // Fork 2 decides throw vs warn
  // ...native add/delete as today...
}
// Vocab registered via ambient global (seam-free, no-op when unplugged) — from both twin and emitted ESM:
window.customStates?.declareStates(this.#internals, ['open', 'active']);
// Escape hatch UNTOUCHED — no CustomStateSet.prototype patch:
internals.states.add('typo'); // ✓ still works (open native floor); only the declared *surface* validates.
```

**Skeptic:** SURVIVES-WITH-AMENDMENT — the no-patch mechanism is correct (residue bar is dispositive), but the
prep's original "vocab discoverable from the `states=` attribute / emitted form needs no change" was false:
`ElementInternals` has no host back-reference, and the emitted ESM emits raw `.add`, so twin and emitted form
would disagree on validation. Folded the **ambient-global `declareStates` registration** (option a) to close
the divergence without breaking the import-seam-free emitted ESM or adding a prototype patch.

## Fork 2 — enforcement severity: non-throwing decline+report (default) vs throw opt-up

**Fork exists because:** a single un-declared toggle through the declared surface either is **declined** (state
not added) reported non-fatally, or it **throws** (aborts the call stack). These are mutually exclusive per-call
behaviors. A `severity` option lets both ship, but the **shipped default** is a real call with downstream effect
(what #1794's adoption inherits).

- **(a · DEFAULT) Non-throwing decline + dev-visible report.** The un-declared toggle is **not applied** (the
  set is not mutated) and a `console.error` is emitted — the **data-violation** posture every sibling plug uses:
  webvalidation reports an invalid value via the *non-throwing* `internals.setValidity({customError:true}, msg)`
  (`fui:plugs/webvalidation/applyMergedValidity.ts:51`), never a `throw`. This is *not* the hollow
  warn-that-still-adds #1807 killed — the state is **declined**, just without crashing the page. Mirrors the
  open native `CustomStateSet` surface (`we:docs/agent/platform-decisions.md#native-first-baseline`, ~line 861,
  which names `CustomStateSet` as an *open* primitive) per the polyfill-surface-fidelity corollary (~line 867).
- **(b) `severity:'throw'` opt-up.** Hard `--strict` for authors who want an undeclared toggle to abort. Ships
  as the documented opt-**up**, not the default. (Throw stays the default only for the *misconfiguration* class —
  an unknown provider name — exactly as the registries already do, e.g. `UnknownGuardProviderError`,
  `fui:plugs/webguards/CustomGuardRegistry.ts:62`.)

```js
// Fork 2 — severity option; default = decline+report (non-throwing). Reached only for a toggle through the
// DECLARED surface; the raw native floor (Fork 1) is never reached here.
function rejectUndeclared(set, name, vocab, severity = 'report') {
  const msg = `[customstates] '${name}' is not in the declared vocabulary {${[...vocab].join(', ')}}`;
  if (severity === 'throw') throw new TypeError(msg);  // opt-up: hard --strict
  console.error(msg);                                  // DEFAULT: decline (do NOT set.add) + report
  return false;                                        // state declined, page keeps running
}
```

**Skeptic:** REFUTED → **default flipped**. The original `throw` default collided with the most-permissive /
native-first doctrine (`we:docs/agent/platform-decisions.md`, ~line 1308 — restriction is the author's opt-in,
not the default) and was inconsistent with every sibling plug (data violations report via `setValidity`, never
throw; throw is reserved for registry *misconfiguration*). Flipped to **non-throwing decline+report** as the
default, `severity:'throw'` as the opt-up — which also dissolves the statute collision (see below).

## Supported by default (settled — not forks)

- **Context resolution** follows the injector-registry precedent verbatim: a `customStates` provider `.set()` on
  the document injector (nearest-scope-wins via `InjectorRoot.getProviderOf`) + a `window.customStates` fallback,
  wired in a plugged bootstrap block and a `setupCustomStatesUnplugged(root)` seam mirroring
  `fui:plugs/validationUnplugged.ts` / `fui:plugs/guardsUnplugged.ts`. No design call.
- **Polyfill scope** is fixed by #1807's layer partition: the `CustomStateSet`/`:state()` **primitive is
  Baseline-2024 (present)**; only the **JS declaration/validation layer** is polyfilled. `:state()` CSS matching
  is browser CSS-engine machinery and **cannot** be polyfilled in JS; the slice-A floor already no-ops when
  `internals.states` is unavailable (`fui:blocks/renderers/component/customStates.ts:30`).
- **Parity marking** is FUI-side per #1839/#1844: `fui:plugs/customstates/parity.json`, 3-state vocabulary, the
  declaration/validation layer marked `plugged-only`; WE's `we:src/_data/plugs/customstates.json` stays type-only
  (#606/#1282 zero-impl).
- **The native imperative floor** (`internals.states.add/delete/has`) is always available, plugged or not (#1807).

## Statute-overlap reconciliation (for the eventual `codifiedIn`)

The rule #1892 will codify (a new `#component-dc` DC-N): *"custom-states plugged validation is WeakMap-keyed
out-of-band — no `CustomStateSet.prototype` patch; vocab registered via an ambient `declareStates` seam from
both lowering paths; the raw native floor stays an open escape hatch; an un-declared toggle through the declared
surface is **declined + reported non-fatally** (`severity:'throw'` opt-up); parity FUI-side."*

- **Fork 1 — CLEAN.** It is the **clause-(ii) application** of #1839 (custom-states classified *not-residue*),
  respects #1872 (no Proxy; wrapper only if it were residue), and extends the `#component-dc` cluster #1807
  already lists (DC-14). No prior residue classification contradicts it.
- **Fork 2 — collision found by the skeptic, reconciled by the flip.** The original `throw` default collided
  with the most-permissive / native-first doctrine (~line 1308; restriction is the author's opt-in) and the
  polyfill-surface-fidelity corollary (~line 867; the plug mirrors the *open* native surface). Flipping the
  default to **non-throwing decline+report** (throw → opt-up) **removes** the collision: the codified rule no
  longer ships a hard restriction as the default, and it now *matches* the house style for data violations
  (`setValidity`-style report, `fui:plugs/webvalidation/applyMergedValidity.ts:51`). No anchor is duplicated or
  overridden.

---

**Lineage.** Epic #1831 → slice B. Ruling #1807 (the shape) · slice A #1891 (the floor, resolved). Governed by
#1839 (residue bar) + #1872 (no-Proxy substrate) + #1826 (plug-as-proposed-standard). Adoption #1794 consumes
the FUI build this graduates into.
