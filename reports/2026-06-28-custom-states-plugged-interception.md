# custom-states slice B (#1892) — plugged validation interception: prior-art + architecture survey

**Date:** 2026-06-28 · **Prepares:** #1892 (slice B of epic #1831; governed by ruling #1807) ·
**Builds on prior survey:** `we:reports/2026-06-27-declarative-custom-state-surface.md` (#1807's platform prior-art).

## Why this survey is narrow

#1807 already surveyed the *platform* prior-art (CustomStateSet / `:state()`, the declaration+validation
gap, the `default-aria-*` precedent) and ratified the **two-posture-over-one-contract** shape. Slice B is an
**impl-architecture decision over already-researched ground**: the open call is *how the plugged form
intercepts an un-declared toggle*. That call is governed less by external prior-art than by two **already-
ratified WE statutes** — so this survey's job is to (1) show how those statutes collapse the item's stated
"wrapper-vs-proxy architecture" framing, and (2) confirm the residual mechanism choice against external JS
semantics.

## Finding 1 — the "proxy" branch is dead twice over

The item names a **"wrapper-vs-proxy architecture"** fork. The proxy branch is excluded by **two
independent forces**, before any judgment:

1. **Ratified statute #1872** (`we:docs/agent/platform-decisions.md#observe-only-posture-spectrum`, line ~903):
   *"Substrate is a prototype-method wrapper, **not** a `Proxy` … there is **no `new Proxy` in the plugs
   tree**."* Reassigning a prototype member is the house pattern (no identity break, no `instanceof`
   surprise). A Proxy-based interceptor would violate this.
2. **JavaScript semantics** (MDN Proxy): built-in `Set` methods access **internal slots** directly, not via
   `[[Get]]`/`[[Set]]`, so **a `Proxy` over a `CustomStateSet` cannot trap `.add()`/`.delete()` at all** —
   proxied built-ins throw on internal-slot access. `CustomStateSet` is a Set-like with internal slots, so
   the proxy approach is not merely discouraged, it is **non-functional**.

So the live axis is **not** wrapper-vs-proxy. It is **WeakMap-keyed out-of-band (no global patch)** vs
**prototype-method-wrapper patch of `CustomStateSet.prototype`** — both "wrappers" in different senses; the
proxy pole is removed.

## Finding 2 — Fork 1 is decided by the #1839 residue bar

`we:docs/agent/platform-decisions.md#plugged-only-residue-bar` (#1839, line ~890) is the **mechanical test**
for whether a plugged capability may patch an unowned global. A capability is genuine residue (→ patch
allowed) **iff both**: (i) its contract requires intercepting a native method on a node **the plug holds no
handle to**, **and** (ii) the contract — *including transparency* — **cannot** be reproduced by **WeakMap-
keyed out-of-band state consulted through the plug's own API**. The bar is *strict*; the DX/"nicer unplugged"
bar is explicitly rejected.

Apply it to custom-states validation:

- The plug **does** get a handle: `declareStates(internals, vocab)` receives `internals` (hence
  `internals.states`) at declaration time, and the component's toggles already route through slice-A's
  plug-owned helpers (`addStates` / `toggleState`, `fui:blocks/renderers/component/customStates.ts:28,35`).
- So the contract *"a toggle of an un-declared state, **through the declared surface**, is rejected/warned"*
  is **reproducible WeakMap-keyed out-of-band** (vocab in a `WeakMap<ElementInternals, Set<string>>`,
  consulted by the plug-resolved toggle helper). By clause (ii), this is **NOT residue → do not patch.**
- Patching `CustomStateSet.prototype.add` would be justified **only if transparency of the *raw* native call**
  (`internals.states.add('typo')` bypassing the helper) is part of the contract. #1807's ratified example
  shows that raw call throwing — but #1807 labels its code *"the authoring shape, not a final API spec"*,
  i.e. **illustrative, not contractual**. Most-permissive-default + the always-available native floor argue
  the raw escape hatch stays **open**.

**Conclusion:** default = **WeakMap-out-of-band, no global patch** (Fork 1a). The prototype-wrapper patch
(Fork 1b) is the alternative *only* if a future requirement makes raw-call transparency contractual — and it
must then discharge #1839's audit (name the unowned global = `CustomStateSet.prototype.add`; why no handle =
raw `.add` on a set the plug did not create; missing platform hook = a "validate state vocabulary" lifecycle).

## Finding 3 — context resolution is settled by precedent (not a fork)

"`declareStates` resolved from the plug context" follows the **established injector-registry pattern**:
`fui:plugs/validationUnplugged.ts` and `fui:plugs/guardsUnplugged.ts` both resolve their registry via
`InjectorRoot.getProviderOf(node, key)` (**nearest-scope-wins**) with a `window.<key>` **fallback**, set on
both the document injector and `window` in the bootstrap block. Slice B mirrors this: a `customStates`
registry/provider on the injector + window fallback. No new fork — apply the precedent.

## Finding 4 — polyfill scope is settled by #1807 (a constraint, not a fork)

#1807 partitions the capability per `#native-first-baseline`: the `CustomStateSet`/`:state()` **primitive is
Baseline-2024 (present)**; only the **declaration/validation layer is absent → plugged**. Two hard limits
fall out and are *constraints to document*, not open calls:

- **`:state()` CSS matching cannot be polyfilled in JS** — it is browser CSS-engine machinery. So in an
  engine lacking native `CustomStateSet`, no JS shim makes `:state(open)` match; the plug polyfills the
  **JS declaration/validation API only**.
- The slice-A floor already **no-ops when `internals.states` is unavailable**
  (`fui:blocks/renderers/component/customStates.ts:30` guard) — the plugged form keeps that graceful degradation.

## Finding 5 — decline-and-report vs throw is the second genuine call (Fork 2)

A single un-declared toggle through the declared surface either is **declined** (state not added, reported
non-fatally) or **throws** (aborts the call stack). These cannot both be one call's behavior. The skeptic pass
**flipped** prep's first instinct here:

- **Decline + dev-visible report (DEFAULT).** The state is **not applied** and a `console.error` fires — the
  **data-violation** posture every sibling plug uses: webvalidation reports an invalid value via the
  *non-throwing* `internals.setValidity({customError:true}, msg)` (`fui:plugs/webvalidation/applyMergedValidity.ts:51`),
  never a `throw`; throw is reserved for **misconfiguration** (unknown provider name, e.g.
  `fui:plugs/webguards/CustomGuardRegistry.ts:62`). This is *not* the hollow warn-that-still-adds #1807 killed —
  the state is **declined**, just without crashing. Mirrors the *open* native `CustomStateSet`
  (`#native-first-baseline`, ~line 861) per the polyfill-surface-fidelity corollary (~line 867).
- **`severity:'throw'` opt-up.** Hard `--strict` for authors who want an undeclared toggle to abort. Ships as
  the documented option, not the default.

The original `throw`-default **collided** with the most-permissive/native-first doctrine (~line 1308 —
restriction is the author's opt-in, not the default). Flipping to non-throwing decline+report removes the
collision and matches house style.

## Finding 6 — parity marking is FUI-side (#1839/#1844)

The plugged form's measured support is recorded **FUI-side** (`fui:plugs/customstates/parity.json`, 3-state
`works`/`works-with-caveat`/`plugged-only`); WE's `we:src/_data/plugs/customstates.json` exposes **at most a
type-only schema**, never the verdict (#606/#1282 zero-impl). Slice B's `fui:plugs/customstates/parity.json`
row for the declaration/validation layer is `plugged-only` (the layer no browser ships).

## Statute-overlap (for the eventual `codifiedIn`)

Slice B will extend the `#component-dc` cluster (next DC-N). The rule it writes — *"custom-states plugged
validation is WeakMap-keyed out-of-band, no `CustomStateSet.prototype` patch; the raw native floor stays an
open escape hatch; un-declared toggle through the declared surface throws (`severity:'warn'` opt-down);
parity marked FUI-side"* — **composes with, and is an application of**, #1839 (it *is* the clause-(ii)
classification: custom-states = not-residue) and #1872 (no Proxy; prototype-wrapper only if it were residue).
No same-turf collision: #1839/#1872 set the *test*; this writes the *verdict* for one capability. Reconciled.

## Net

The item's "wrapper-vs-proxy + reject/warn" framing reduces to **two genuine forks**, both with
statute-backed defaults: **Fork 1** (out-of-band-no-patch vs prototype-wrapper-patch) → default no-patch per
#1839, amended with an ambient-global `declareStates` seam so the emitted ESM and runtime twin agree;
**Fork 2** (decline+report vs throw) → default **non-throwing decline+report** (skeptic flipped prep's throw
instinct; throw → opt-up). Proxy is excluded (statute + JS semantics); context-resolution and polyfill-scope
are settled by precedent / #1807. A fast-ratification candidate.
