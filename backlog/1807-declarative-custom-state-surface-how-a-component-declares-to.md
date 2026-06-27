---
kind: decision
status: resolved
size: 5
locus: frontierui
dateOpened: "2026-06-27"
dateStarted: "2026-06-27"
preparedDate: "2026-06-27"
blockedBy: [1826]
dateResolved: "2026-06-27"
graduatedTo: "#1830, #1831"
codifiedIn: "docs/agent/platform-decisions.md#component-dc"
tags: [custom-state-set, states, declarative-component, native-first, plug-unplugged]
relatedReport: reports/2026-06-27-declarative-custom-state-surface.md
relatedProject: webcomponents
---

# Declarative custom-state surface: how a <component> declares & toggles ElementInternals.states for :state() styling

## Digest

Surfaced while working #1794. FUI's class-bodyless declarative `<component>` (`fui:blocks/renderers/component/declarativeComponent.ts`) already lowers two `ElementInternals` members — `form-associated` and the `default-aria-*` surface (#853). The natural next member is **custom states** (`internals.states` / `CustomStateSet`) so a component exposes internal state styled by native `:state(...)`. Two forks — how it (1) **declares** its state vocabulary and (2) **toggles** at runtime — both resolve under one axis: **#1826's plug-as-proposed-standard doctrine**. The platform ships the *primitive* (`CustomStateSet`, Baseline-2024) but **no spec for declaring/validating a component's state vocabulary** — elemental-but-missing. So WE ships both postures: **unplugged** = native open set + thin sugar, no enforcement (safe-today, the real product surface); **plugged** = `states="…"` as an *enforced contract* + polyfill (WE's proposed standard). Validation that a skeptic killed as the *default* returns as the *plugged* mode — opt-in, because the opt-in **is the plug**. Full grounding in `relatedReport`.

## Decision axis — plugged / unplugged (per #1826)

This surface is the **first application of the plug-as-proposed-standard doctrine** (#1826). `CustomStateSet`/`:state()` is a Baseline-2024 primitive (`we:docs/agent/platform-decisions.md#native-first-baseline`, line 793) — *present*. What's absent from every platform spec is the layer **declaring a component's custom-state vocabulary and validating toggles against it**. That missing layer is what WE supplies, in two postures rather than one forced choice:

- **Unplugged (default — the real product surface, #606):** native `CustomStateSet` + a thin setter/getter; the open set, no enforcement; `states="…"` is documentation only. Safe today, zero platform divergence, tree-shakeable.
- **Plugged (opt-in — the proposed standard):** `states="…"` becomes the **enforced contract** — a validation system rejects/warns on un-declared toggles — plus a **polyfill** for that (nowhere-native) declaration+validation layer. This is WE's candidate for what the platform *should* offer, the version you'd take upstream.

The "restriction = opt-in" rule (MEMORY: Most-Flexible Default) is satisfied because the opt-in *is the plug*. The skeptic's refutation (validation-as-default is hollow) and the validation's real value (a declared contract, like a TS union / JSON enum) **both hold** — they live in different postures.

### Per-fork resolution at a glance

| Fork | Unplugged (default) | Plugged (proposed standard) | Confidence |
|---|---|---|---|
| 1 · Declaration | open set; `states="…"` non-validating doc-list | `states="…"` = enforced vocabulary; un-declared toggle throws/warns; polyfilled | high |
| 2 · Toggle | imperative setter/getter, no enforcement | validation-wrapped toggle; declarative reactivity via webexpressions (phase-2) | med-high |

## Ratified ruling (2026-06-27)

**Ratified** (explicit go after discussion + red-team; rests on #1826). The surface ships as **two postures over one single-substrate contract** (plug-as-proposed-standard, #1826):
- **Fork 1 — declaration:** unplugged = open set, `states="…"` non-validating doc-list (**default**); plugged = `states="…"` enforced vocabulary (un-declared toggle throws/warns) + polyfill.
- **Fork 2 — toggle:** unplugged = imperative `internals.states` floor, no enforcement (**default**); plugged = validation-wrapped toggle + declarative reactivity via webexpressions (phase-2 prerequisite). Bespoke `state-when` DSL rejected.
- **Imperative declaration API:** a per-instance, construction-time `internals` declaration call (**not** `static states` — static can't be conditional), the lowering target of `states="…"`, mirroring `default-aria-*`. Exact name → plug-mint.
- **Constellation split:** plug *contract* → WE (`webcomponents`, `we:src/_data/plugs.json`); runtime impl → FUI. Single-substrate guardrail holds.

**Graduates to:** #1830 (WE plug-contract mint) → #1831 (FUI build; where #1794's adoption lands). #1794 repointed `blockedBy` → #1831.

## Constellation split (per #1826 guardrail + managed-offering layering)

- **WE owns the plug *contract*** — a new entry in `we:src/_data/plugs.json` under the **webcomponents** project (NOT `webstates`, which is *signals/stores/schemas* — a data-state concern, distinct from CSS `:state()` despite the name): the declared-vocabulary semantics + validation contract + polyfill contract.
- **FUI owns the runtime impl** — the plugged validation patch + polyfill, and the unplugged setter/getter sugar (`@frontierui/plugs`). Per MEMORY: WE Holds ZERO Standard Implementation.
- **Guardrail (#1826):** the contract stays **single-substrate**. Plugged/unplugged is the *delivery + enforcement* axis, not two competing contracts for the same capability.
- *(Open for review: `locus` is still `frontierui`; since the headline new artifact is the WE plug contract, locus may want to move to the WE/webcomponents home. Flagged, not changed.)*

## Fork 1 — Declaration syntax: how the component declares its custom-state vocabulary

The crux: custom states are an **open** string set the author *invents* (`CustomStateSet` per MDN), each state purely **boolean** (present/absent — no value), unlike `default-aria-*` whose keys map onto the fixed external ARIAMixin IDL (`fui:blocks/renderers/component/declarativeComponent.ts:106` rejects an unknown key *because the platform defines the closed set*). So a `states="…"` list cannot validate its *declaration* against any external truth. But it **can** validate *usage* against the declaration — that's a producer/consumer contract (a TS union, a JSON-schema enum), not a tautology. The skeptic conflated the two; the plug axis resolves it.

- **(a · Unplugged, DEFAULT) Open set; `states="…"` non-validating doc-list.** The vocabulary is implicit in what `internals.states.add(...)` toggles; page CSS styles whatever is present via `:state(name)`. An optional `states="open active"` attribute *documents* (renders in the demo, feeds devtools/IDE autocomplete) but never rejects an un-listed add. Most-permissive, native-first, zero divergence.
- **(b · Plugged) `states="…"` as the enforced contract + polyfill.** When the plug is installed, the declared list becomes authoritative: an un-declared `internals.states.add('typo')` throws/warns (dev-time safety, like a TS union catching usage typos), and the plug polyfills the declaration+validation layer no browser ships. This is the *proposed standard* — opt-in, not the default.
- **(c) Repeated `state-*` boolean-attribute family.** Rejected: verbose for a flat list, no upside over a single `states="…"`.

**History — skeptic (REFUTED → reframed):** the skeptic correctly killed a *validating allow-list as the default* ("validates against itself, catching nothing, fighting the open set"). The flip to no-declaration was right *for the default* but threw out validation entirely; the #1826 plug axis rescues it as the *plugged* posture. Bonus the skeptic surfaced: the precedent is twin-broken — `defineFromDefinition` (lines 212-250) destructures only `formAssociated, defaultRole`, dropping `defaultAria` — so any adoption must wire **both** the emitted class *and* the runtime twin (build note for #1794, verified 2026-06-26).

## Fork 2 — Toggle mechanism: how states flip at runtime

The crux: per MDN `:state()` is **not** browser-maintained — `internals.states` (a Set-like `CustomStateSet` with `.add/.delete/.has/.clear`) must be toggled in code, so the floor is necessarily the imperative `internals` handle the component already attaches. The only open question is the declarative sugar, and FUI's webexpressions parsers are **one-time-on-connect** today (`fui:blocks/view/ViewShowBehavior.ts:11` — *"evaluated once on connect… Reactive re-evaluation is deferred to phase 2"*; the binding resolvers under `fui:blocks/parsers/`), with reactive re-evaluation an unbuilt phase 2.

- **(a · Unplugged, DEFAULT) Imperative setter/getter floor, no enforcement.** `this.#internals.states.add('open')` is the always-available native escape hatch; states are plain boolean membership. No validation.
- **(a′ · Plugged) Validation-wrapped toggle + declarative reactivity.** Plugged, toggles route through the validation system (Fork 1b); the declarative reactive path reuses the *same* webexpressions `{{ }}`/`[[ ]]` layer (e.g. a future `[[state.open]]="isExpanded"` boolean write-target), gated on that layer gaining phase-2 reactive re-evaluation — a stated prerequisite, not "already solved."
- **(b) Bespoke `state-when="…"` predicate DSL.** Rejected: a second reactive engine duplicating webexpressions (MEMORY: webexpressions binding layer already exists; bias-to-reuse). It ships reactivity faster *only* by forking the binding story.

**History — skeptic (SURVIVES-WITH-AMENDMENT):** the attack "you're deferring to a capability that doesn't exist (webexpressions is one-time-on-connect)" is factually right and refutes the *framing*, not the *mechanism* — fixed by stating the phase-2 prerequisite explicitly. Imperative floor is correct and shippable today; `state-when` remains the wrong call.

## Imperative declaration API (the `static`-free equivalent of `states="…"`)

The imperative equivalent of the declaration attribute is a **per-instance, construction-time `internals` declaration** — NOT a `static states` field. A static class field is evaluated once at class-definition time, so it cannot be conditional, computed, or per-instance; the declared vocabulary can legitimately depend on config/mode, and `ElementInternals` is instance-scoped anyway. This also lands on the *closer* precedent: `form-associated`/`tagName` lower to **static** fields (the browser reads them at registration), but `default-role`/`default-aria-*` lower to **constructor-body instance assignments** (`fui:blocks/renderers/component/declarativeComponent.ts` ctor) — custom-state vocabulary is an `internals` concern and belongs with the second group.

So the attribute is sugar over the imperative call (same shape as `default-aria-*`), and the imperative form is strictly more expressive (call unconditionally = the fixed case; wrap in an `if` = the conditional case — MEMORY: Most-Flexible Default):

| | Declarative (fixed, no code) | Imperative (conditional-capable) |
|---|---|---|
| Vocabulary | `states="open active"` | construction-time `internals` declaration call |
| Lowers to | → the constructor call | (is the call) |
| Toggle | binding (phase-2) | `internals.states.add('open')` (native) |

```js
constructor() {
  super();
  // Conditional vocabulary — impossible with a static field. Plugged surface; exact name → plug-mint.
  if (this.mode === 'expandable') this.#internals /* plug */ .declareStates(['open', 'active']);
}
```

The exact method name/shape (`declareStates`, an allow-list arg at attach, …) is a **plugged-surface detail for the plug-contract mint / #1794 build** — not pinned here. Unplugged needs no declaration call at all (open set; `internals.states.add` directly). **Rejected:** a `static states` field (cannot be conditional) and an instance-level external setter (`<my-toggle open>` + property — conflates internal state with config, the `resize`/`shift` confusion prep flagged).

## Resolution shape (what this graduates into)

On ratification, this decision spawns:
1. **WE plug-contract mint** — a `we:src/_data/plugs.json` entry under `webcomponents` defining the declared-vocabulary + validation + polyfill contract (needs an owning project — `webcomponents`, confirmed).
2. **FUI build story** — plugged validation patch + polyfill + unplugged setter/getter sugar, consumed by the declarative `<component>` lowering (wiring **both** the emitter and the runtime twin per the Fork-1 build note). This is also where #1794's adoption lands.

## Code examples

The *authoring shape*, not a final API spec — #1794's build pins exact names.

### 1 · The styling contract (native, WE adds nothing — both postures)

Page CSS targets whatever boolean custom state is present via native `:state()` (plain ident, not the deprecated dashed-ident `:--name`). Composes with `::part()`:

```css
my-toggle:state(open)              { border-color: var(--accent); }
my-toggle::part(panel):state(open) { display: block; }
```

### 2 · Unplugged (default) — open set + imperative toggle, shippable today

`states="…"` optional and documentation-only; toggling is the native imperative floor:

```html
<component name="my-toggle" shadow states="open active">  <!-- doc-list: a hint, never a gate -->
  <button part="trigger"><slot name="label"></slot></button>
  <div part="panel"><slot></slot></div>
</component>
```

```js
// Native floor — CustomStateSet is Set-like; each state is boolean membership.
this.#internals.states.add('open');      // → matches my-toggle:state(open)
this.#internals.states.delete('open');
this.#internals.states.has('open');
// Unplugged: internals.states.add('typo') silently works — open set, no enforcement.
```

### 3 · Plugged (proposed standard) — `states="…"` becomes the enforced contract

Same markup; installing the plug makes the declared list authoritative and polyfills the validation layer:

```js
// Plugged: the declared vocabulary is enforced (dev-time safety, like a TS union).
this.#internals.states.add('open');      // ✓ declared
this.#internals.states.add('expanded');  // ✗ throws/warns: 'expanded' not in states="open active"
```

### 4 · Plugged declarative reactivity (blocked on webexpressions phase-2)

Reuses the existing binding layer — a **boolean** write-target into `internals.states` (states have no value, so the bound expression is boolean):

```html
<!-- ASPIRATIONAL — needs webexpressions reactive re-evaluation (one-time-on-connect today,
     fui:blocks/view/ViewShowBehavior.ts:11). The expr is boolean → membership. -->
<my-toggle [[state.open]]="isExpanded">…</my-toggle>
```

Rejected **(2b)** — a bespoke predicate language duplicating webexpressions:

```html
<!-- REJECTED: forks the binding story; also note states are boolean, so a value-shaped DSL misleads -->
<my-toggle state-when="open">…</my-toggle>
```

---

**Lineage.** Forked out of #1794 (native `:state` alignment), which `blockedBy` this — #1794's adoption lands on the FUI build this spawns. Rests on #1826 (plug-as-proposed-standard doctrine — `blockedBy`). Sibling member: #853 (`default-aria-*`), the declarative ElementInternals precedent this mirrors in *placement* (Fork 1 departs from its *validation* model — see the crux). No new intent (`grep` of `we:src/_data/intents/` finds none owning component-state vocabulary; `we:src/_data/intents/disclosure.json`'s `defaultState` is a UX dimension, a different concern).

**Supported by default (not decisions).**
- The imperative `internals.states` floor is always available (native API), plugged or not.
- Page CSS styling via `:state(name)` and `::part(x):state(y)` is whatever the platform supports — WE adds nothing here.
- Orthogonal to the workflow-engine / `LifecycleProvider` *state machine* (`def.states[...]`) — that models transitions; this exposes a boolean CSS styling hook.
