---
kind: decision
parent: "1836"
status: resolved
relatedProject: webplugs
relatedReport: reports/2026-06-27-unplugged-plug-parity.md
dateOpened: "2026-06-27"
dateStarted: "2026-06-27"
dateResolved: "2026-06-27"
graduatedTo: "docs/agent/platform-decisions.md#plugged-only-residue-bar"
codifiedIn: "docs/agent/platform-decisions.md#plugged-only-residue-bar"
preparedDate: "2026-06-27"
tags: [plugs, unplugged, parity, residue, conformance]
---

# Decide the plugged-only residue bar and how the parity table marks it

Some plug capabilities are impossible without `window`/prototype patching — that residue ≈ the genuinely-missing-platform-standard set (the reason plugged exists, #1826). This decision sets two things: **Fork 1 — the bar** a capability must clear to be *plugged-only* rather than *not-yet-ported* (recommended: a **strict** mechanical bar, tested over the observable *contract*, so the residue stays minimal), and **Fork 2 — the parity vocabulary + locus** (recommended: the caniuse-shaped **3-state** `works`/`works-with-caveat`/`plugged-only` with a mandatory caveat note, stored **FUI-side** — the runtime the verdict measures — not on WE contract data). Grounded in `/research/unplugged-plug-parity/` (report `we:reports/2026-06-27-unplugged-plug-parity.md`).

## Digest

The #635 audit (`we:reports/2026-06-14-plugs-runtime-audit.md:15-28`) found all surveyed plug domains *implement* both modes but only `webbehaviors` has dual-mode automated coverage — so "is X plugged-only?" is currently answered by nobody, and a loose answer would let teams stamp "impossible unplugged" on capabilities they simply haven't ported. The parity-table slice (`#1844`) needs a crisp bar and a state vocabulary before it can render. Two concerns, each a genuine call:

- **The residue bar** is the substantive one. The whole epic exists to make the public API work unplugged *everywhere it can*, leaving a **minimal, justified** residue. A loose bar (DX-worse-but-possible ⇒ plugged-only) inflates the residue and re-labels unfinished WeakMap ports as "impossible". So the bar must be **mechanical and strict**.
- **The marking vocabulary** is a smaller call but a real fork: 2-state (works / plugged-only) vs 3-state (+ works-with-caveat). The audit shows real caveated-but-working cases (e.g. visibility-gating that works unplugged via per-root observers instead of a global), so a binary loses signal.

Both axes are pinned to the real tree:

- **What residue looks like** (`fui:plugs/webinjectors/Node.injectors.patch.ts:101`): plugged mode patches `Document.prototype.createElement` to tag *every* node the page creates. The plug never receives a handle to those nodes, so it cannot tag them via its own API — this is **genuine residue** (the missing platform standard is a creation hook). Contrast a registry/behavior method the consumer invokes through an explicit `attach(el)`/`upgrade(root)` call (`fui:plugs/unplugged.ts:1-18`): the plug *does* get the element, so it keys state in a `WeakMap` and the capability **ports** — *not* residue.
- **The WeakMap test is the bar** (`fui:plugs/webinjectors/Node.injectors.patch.ts:27` already uses `new WeakMap<Node, HTMLInjector>()` in plugged mode): if the observable contract can be reproduced by WeakMap-keyed, out-of-band state consulted through the plug's own API, it is *not* residue.
- **The marking has no home yet, and its home is FUI** (`we:src/_data/plugs/customattribute.json`): the WE plug contract is `id/name/status/type/summary/projects` — no parity field, and (per Fork 2) none belongs there, since the verdict is a measured FUI-runtime fact. The 3-state mark is new **FUI** schema.
- **3-state is the established norm** (`/research/unplugged-plug-parity/`, Survey 2): caniuse `y`/`a`(partial)/`n`(+`d` for flag-gated); MDN BCD `partial_implementation: true` *with a required note*. Our `plugged-only` is structurally caniuse's `d` (gated), distinct from partial `a`.

## Recommended path at a glance

| Fork | The call | Recommended default | Main alternative (excluded) |
| --- | --- | --- | --- |
| **1 — the residue bar** | When is a capability *plugged-only* vs *not-yet-ported* | **Strict mechanical bar**: plugged-only ⟺ the observable contract requires mutating a global/prototype the plug holds no handle to, and the *contract* cannot be reproduced via WeakMap-keyed out-of-band attachment | DX/ergonomics bar (plugged-only if the unplugged form is materially worse) — *Rejected*: inflates the residue, re-labels unfinished ports as impossible |
| **2 — marking vocabulary + locus** | How the parity table encodes per-API state, and where the data lives | **3-state** `works` / `works-with-caveat` / `plugged-only`, caveat carries a **mandatory note**, stored **FUI-side** (the runtime the verdict measures); WE exposes at most a type-only schema | 2-state binary — *Rejected* (drops the caveated middle); **storing it on WE `src/_data/plugs/`** — *Rejected*: a measured impl fact in a contract file, violates #606/#1282 zero-impl |

## Fork 1 — the plugged-only residue bar

**Fork-existence justification (forced invariant):** the alternative — a **DX/ergonomics bar** — is **broken** against the epic's own goal. #1836 exists to make the public API functional unplugged *everywhere it can be*, with a residue that is "minimal and justified" (#1826: the residue ≈ the genuinely-missing-platform-standard set). A bar that admits "possible but the unplugged form is worse" lets a team declare residue to *avoid the WeakMap port*, inflating exactly the set the epic is trying to shrink. One bar serves the goal; the other defeats it → ratify the strict one.

**Crux** (`fui:plugs/webinjectors/Node.injectors.patch.ts:101` vs `fui:plugs/unplugged.ts:1-18`): the dividing line is whether the plug ever *gets a handle* to the thing it must affect — and whether the observable contract (not just the bare capability) survives porting to that handle. If the contract ports → WeakMap-keyed attachment reproduces it. If only the capability ports but the contract needs transparent interception of a native call → residue.

- **(a) Strict mechanical bar — over *contract*-portability, not *capability*-portability** *(recommended)* — a capability is **plugged-only** iff **both**: (i) its observable contract requires intercepting a native method/constructor the *consumer* calls directly on a node the plug holds no reference to (e.g. tagging every `document.createElement` result), **and** (ii) that **observable contract** cannot be reproduced by WeakMap-keyed state consulted through the plug's own API (`attach`/`upgrade`/getter). The clause-(ii) test is over the *contract*, not the bare *capability* — the distinction the skeptic surfaced: `fui:plugs/webcontexts/Node.contexts.patch.ts:52-70` patches `Node.prototype.createElement` so existing `node.createElement('x-y')` call-sites transparently dispatch through the injector registry. Its *capability* (scoped construction) ports to an explicit `injectorScopedCreate(node, 'x-y')` + WeakMap; but its *contract* (the **transparent** `createElement` interception, with no standard creation-dispatch hook to replace it) does **not**. So it is **plugged-only**, same as the injectors `createElement` patch (`fui:plugs/webinjectors/Node.injectors.patch.ts`) — the two are the same mechanism. *Pro:* objective, auditable per API member, keeps the residue minimal, and the contract-vs-capability framing stops the "everything ports via `upgrade()`+WeakMap" collapse. *Con:* requires attempting the WeakMap port *and* asking whether the transparent-interception contract survives it — which is the point.
- **(b) DX/ergonomics bar** — *Rejected.* Plugged-only if the unplugged form is materially worse to use (extra `attach()` calls, no transparent prototype sugar). Inflates the residue with everything not-yet-ported and makes "plugged-only" a subjective judgment; contradicts #1826's "minimal and justified".
- **(c) Capability-class allowlist** — *Rejected as the bar* (folded into the doc): enumerate fixed residue classes (global construction/parse hooks, native-method-shadowing). Useful as *documentation of what tends to be residue*, but as the *bar* it ossifies — a future platform primitive (e.g. a standard creation observer) would move a class out of residue and the allowlist wouldn't notice. The mechanical test (a) re-evaluates per API against today's platform, so it stays correct as the platform grows. Keep the class list as explanatory prose under the strict test, not as the gate.

Code shape — the bar as an auditable predicate, with the real contrasting cases:

```ts
// The residue bar (Fork 1a): applied per public API member.
// plugged-only  iff  needsUnownedGlobalMutation && !CONTRACT-reproducibleViaWeakMap
function isPluggedOnly(api) {
  return api.requiresMutatingGlobalThePlugDoesNotOwn   // (i) patches a method the consumer calls directly
      && !api.observableContractReproducibleViaWeakMap; // (ii) the CONTRACT (incl. transparency) doesn't port
}

// RESIDUE — webinjectors must tag every node the PAGE creates; the plug never gets a handle:
//   Document.prototype.createElement = function (tag) { … tag the result … }  // the patch IS the contract
//   -> isPluggedOnly = true  (no createElement hook is standard; this is the genuinely-missing primitive)

// RESIDUE (contract, not capability) — webcontexts' transparent createElement dispatch:
//   Node.prototype.createElement upgraded so `node.createElement('x-y')` resolves via injectors.
//   The CAPABILITY (scoped construction) ports to injectorScopedCreate(node,'x-y')+WeakMap, BUT the
//   CONTRACT (transparent interception of existing call-sites) has no standard hook -> isPluggedOnly = true.

// PORTABLE (NOT residue) — a behavior method invoked through an explicit attach(el):
//   attach(el);                      // the plug receives `el`
//   stateByEl.set(el, makeState());  // WeakMap<Element, State> — out-of-band, no prototype touched
//   -> isPluggedOnly = false  (works unplugged; mark `works` or `works-with-caveat`)
```

### Worked example — the `createElement` residue, both sides

This is the canonical residue case, pushed to the API surface. The plugged `createElement` patch is **not standalone** — it is one node in a web of cooperating prototype patches that propagate an *ambient injection context*:

- **Insertion patches set the ambient injector:** `InjectorRoot.creationInjector = this.getClosestInjector()` runs inside patched insertion methods (`fui:plugs/webcomponents/Element.insertion.patch.ts:144`, `fui:plugs/core/utils/pathInsertionMethods.ts:188`).
- **The `createElement` patch reads it:** every `document.createElement(...)` tags its result into `creationInjectors` (`fui:plugs/webinjectors/Node.injectors.patch.ts:88-94`, a `WeakMap<Node, HTMLInjector>`).
- **`getClosestInjector()` consults it as the last-resort fallback** for nodes with no tree position (`fui:plugs/webinjectors/Node.injectors.patch.ts:175`).

**Plugged** — zero call-site changes, works on code the plug does not own:

```js
// Anywhere — including inside a third-party lib, a framework render fn, a templating engine:
const el = document.createElement('div');   // native call; plug holds NO handle, gets NO callback

// el is still detached — never inserted into any tree:
el.getClosestInjector();                     // ✅ returns the injector ambient at creation time
                                             //    (via the creationInjectors WeakMap fallback)
```

**Unplugged** — the functional API is root-walking (`fui:plugs/unplugged.ts`: `register`/`upgrade(root)`; `fui:plugs/webinjectors/InjectorRoot.ts:474` observes `document.body` with `childList`):

```js
register(injectors);
upgrade(root);                  // walks an ATTACHED root's existing tree, tags what it finds

// To get creation context you must call the plug's own factory (the PROPOSED port — not built yet, #1840):
const el = injectorScopedCreate(injector, 'div');   // ✅ capability reproduced: WeakMap-keyed, no prototype touched
```

**What is genuinely impossible unplugged** (the residue). The *capability* ports cleanly (`injectorScopedCreate` + WeakMap). Two slices of the *contract* do not, and are irreducibly residue:

1. **Transparent capture on call-sites the plug doesn't own.** A bare `document.createElement('div')` written inside a third-party library or framework internals — code you cannot edit to call `injectorScopedCreate` — cannot participate. The only way to intercept it is to patch native `Document.prototype.createElement`. **There is no standard "element constructed" hook** — this is the genuinely-missing platform primitive.
2. **Detached-node creation context.** The context must be associated *synchronously at construction*, on a node that may never be inserted. Both candidate substitutes fail: `MutationObserver` observes **insertions** (`childList`), **asynchronously** — it never sees a detached, never-inserted node and can't answer a synchronous `getClosestInjector()`; `upgrade(root)` only walks **attached** trees, so a detached node is invisible to it by construction.

So the residue is not "createElement" the verb — it is **transparent ambient-context propagation across unowned construction**, and the missing standard is a *construction/insertion lifecycle hook*. The webcontexts `Node.prototype.createElement` case (`fui:plugs/webcontexts/Node.contexts.patch.ts:52-70`) is the **same mechanism** (it adds `createElement` to `Node.prototype`, which is not even a standard method) → same verdict.

**Refinement folded into the bar (from this dig):** the residue declaration must **name which native hook is missing** (here: a construction/insertion lifecycle observer), not just "patches `createElement`". That is what keeps the verdict auditable and *falsifiable as the platform evolves* — if the platform ever ships a creation observer, the capability moves **out** of residue and the mechanical test (a) notices, where an allowlist (c) would not.

**Skeptic: SURVIVES-WITH-AMENDMENT** — the attack (verified against `fui:plugs/webcontexts/Node.contexts.patch.ts:52-70`) found the original binary test misclassified the transparent-`createElement` case: its *capability* ports via WeakMap, so `!reproducibleViaWeakMap` was `false` and the bar stamped it `works` — yet its headline value (drop-in interception) is genuine residue, the same mechanism the item calls residue for webinjectors. Amendment folded in: **clause (ii) tests *contract*-portability, not *capability*-portability** (option (a) rewritten) — a capability with a portable kernel but an un-portable transparent-interception contract is residue. This also closes the "everything ports via `upgrade()`+WeakMap, residue is near-empty" attack: the discriminator is whether the *observable contract* (including transparency) survives the port, not whether the bare verb can be re-expressed. Discharged by evidence (the declaration cites which unowned global + why no handle reaches it, **and names the missing platform hook** the residue stands in for — see the `createElement` worked example above; #1840 re-audit attempts the port). The original "cite-the-global note" amendment was *insufficient* on its own and is subsumed by the contract-vs-capability fix.

## Fork 2 — the parity table's state vocabulary

This fork has two coupled sub-decisions — the **vocabulary** (how many states) and the **locus** (where the per-API verdict is stored). Both have a forced answer.

**Fork-existence justification (forced invariant — vocabulary):** the alternative — a **2-state binary** (works / plugged-only) — is **broken** because it has nowhere to put the audit's real finding that some capabilities *work unplugged but not identically* (webbehaviors visibility-gating runs via per-root `IntersectionObserver` instead of the global one — `we:reports/2026-06-14-plugs-runtime-audit.md:34-44`). A binary forces those into either `works` (hides the caveat) or `plugged-only` (overstates impossibility, inflating the residue Fork 1 works to minimise). The middle state carries real, non-collapsible signal → ratify 3-state.

**Fork-existence justification (forced invariant — locus):** storing the verdict on the **WE** plug contract (`we:src/_data/plugs/`) is **broken** against the constellation cut. A `parity.state` verdict is a **measured fact about whether the FUI runtime functions unplugged** — the #635 audit *defines* it as dual-mode test coverage (`we:reports/2026-06-14-plugs-runtime-audit.md`), and the caveat note literally describes FUI internals ("per-root vs global `IntersectionObserver`"). Per #606/#1282 (`we:docs/agent/platform-decisions.md`) WE holds **zero implementation — contract/protocol/interface only**; the 56 existing plug contract files carry *no* impl-state field for that reason. So the verdict lives **FUI-side**; WE may expose at most a *type-only* schema for the shape (`@webeverything/contracts` end-state).

**Crux** (`/research/unplugged-plug-parity/` Survey 2; `we:src/_data/plugs/customattribute.json`): caniuse/BCD all use a 3-state-with-partial-middle model and *require a note* on the middle; and the verdict being measured is a runtime fact, so it is greenfield **FUI** schema that reuses the proven vocabulary, not a new field on WE contract data.

- **(a) 3-state, note-on-caveat, FUI-owned per-API field** *(recommended)* — states `works` (≈ caniuse `y`), `works-with-caveat` (≈ caniuse `a` / BCD `partial_implementation`, **mandatory note**), `plugged-only` (≈ caniuse `d`, gated — references the Fork 1 residue justification). Stored as a `parity` block keyed per public-API member in an **FUI-owned** file (e.g. `fui:plugs/webbehaviors/parity.json`), surfaced into the #1844 doc-site table via the same cross-origin/data path FUI's runtime already feeds WE through (#604/#1499), drift-gated there. WE's contract may declare a *type* for the block, never the values. *Pro:* matches the established norm; keeps the measured impl verdict in the impl repo (#606/#1282), with the contract↔impl line intact; the note makes every non-`works` state self-justifying.
- **(b) 2-state binary** (works / plugged-only) — *Rejected.* Loses the caveated-but-working middle the audit found.
- **(c) Store on WE `src/_data/plugs/`** — *Rejected* (the original draft; the skeptic refuted it): a measured runtime verdict written into a WE contract file is the first impl fact ever placed there, a textbook FUI→WE leak (#1282 zero-impl). #882's one-file-per-entry is about *partitioning*, not a licence to home impl verdicts in contract files.
- **(d) Full caniuse token set** (`y`/`a`/`n`/`d`/`p`/`x`…) — *Rejected as over-fit:* the plug case has no prefix/polyfill distinctions; three states + a note suffice. Adopt the *shape* (partial middle + mandatory note), not the token zoo.

Code shape — the 3-state mark as a per-API-member `parity` block in an **FUI-owned** file (`fui:plugs/webbehaviors/parity.json`), surfaced to the #1844 table; WE holds only the type:

```json
{
  "plug": "customattribute",
  "parity": {
    "register":            { "state": "works" },
    "observeVisibility":   { "state": "works-with-caveat",
                             "note": "Unplugged uses a per-root IntersectionObserver instead of the global one; semantics match, identity differs." },
    "createElementTagging":{ "state": "plugged-only",
                             "residue": "Transparent Node.prototype.createElement dispatch — capability ports, but the drop-in interception contract has no standard creation hook." }
  }
}
```

**Skeptic: SURVIVES-WITH-AMENDMENT (vocabulary survives; locus flipped).** Two attacks. (1) "`works-with-caveat` is a slippery slope" — *refuted*: the middle is bounded by Fork 1's contract line (a difference is a *caveat* only if the capability genuinely `works` unplugged; a contract-breaking difference is `plugged-only`; an invisible difference is `works`), and the mandatory note is the forcing function — a caveat you can't state in one line isn't one. (2) "storing parity on WE `src/_data/plugs/` violates contract-vs-impl" — *sustained* and folded in: the verdict is a measured FUI-runtime fact (the audit defines it as test coverage; the caveat note describes FUI internals), so the original WE-storage default was a #1282 zero-impl leak. Default flipped to **FUI-owned `fui:plugs/webbehaviors/parity.json`**, WE keeps at most a type-only schema (option (c) now the rejected branch). The 3-state vocabulary + mandatory-note discipline are unchanged.

## Ruling (ratified 2026-06-27)

Both forks ratified as recommended. **Fork 1:** the strict mechanical bar over *contract*-portability (plugged-only ⟺ unowned-global interception **and** the observable contract — including transparency — does not survive a WeakMap port); declarations must name the missing platform hook. **Fork 2:** 3-state `works` / `works-with-caveat` (mandatory note) / `plugged-only`, stored **FUI-side**, WE type-only. Codified into the statute layer at `we:docs/agent/platform-decisions.md#plugged-only-residue-bar`. Surfaced a follow-on build idea — a **diagnostic/probe mode** (zero-behaviour-change instrumentation over the residue surface that logs when unowned code hits a plugged-only path under unplugged) — filed as its own card under #1836.

## Dependencies & lineage

- **Parent:** [#1836](/backlog/1836-make-every-plug-public-api-functional-unplugged-parity-matri/) (epic). Gates the parity-table slice [#1844](/backlog/1844-publish-a-doc-site-plugged-vs-unplugged-parity-table/) (Fork 2 schema) and informs the re-audit [#1840](/backlog/1840-re-audit-the-actual-unplugged-functional-state-of-every-publ/) (Fork 1 bar = the per-API verdict it records).
- **Feeds:** [#1838](/backlog/1838-ratify-default-maas-served-ir-is-unplugged/) — a plugged-only capability cannot be served by a self-contained module, so it is **marked-and-omitted** from the served surface (`X-MaaS-Lossy` + parity `plugged-only`), never served as a plugged form; this decision defines *what qualifies* as that residue.
- **Grounds:** #1826/#1807 (residue ≈ genuinely-missing standard; minimal+justified), #635 (`we:reports/2026-06-14-plugs-runtime-audit.md` audit), #882 (one-file-per-entry data pattern), `/research/unplugged-plug-parity/` Survey 2 (caniuse/BCD vocabulary).
