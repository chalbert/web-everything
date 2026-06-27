---
kind: decision
status: open
size: 3
locus: frontierui
dateOpened: "2026-06-27"
dateStarted: "2026-06-27"
preparedDate: "2026-06-27"
tags: [custom-state-set, states, declarative-component, native-first]
relatedReport: reports/2026-06-27-declarative-custom-state-surface.md
relatedProject: webcomponents
---

# Declarative custom-state surface: how a <component> declares & toggles ElementInternals.states for :state() styling

## Digest

Surfaced while working #1794. FUI's class-bodyless declarative `<component>` (`fui:blocks/renderers/component/declarativeComponent.ts`) already lowers two `ElementInternals` members declaratively — `form-associated` → `static formAssociated + attachInternals()` and the `default-aria-*` surface (#853). The natural next member is **custom states** (`internals.states` / `CustomStateSet`) so a declarative component exposes internal state styled by the native `:state(...)` pseudo-class. The open call is the authoring *shape*, split into two genuine forks: how a `<component>` with no author class body (1) **declares** its custom-state vocabulary and (2) **toggles** states at runtime. Prep verified `internals.states` is unused in FUI today, that the `resize`/`shift` look-alikes are public config not state, and that a reactive binding layer (webexpressions) already exists — then ran a skeptic that **refuted Fork 1's default** (an allow-list validates an open string set against itself — a tautology that fights the native open-set contract). Full grounding in `relatedReport`.

## Axis framing

Both forks are pure pass-throughs to the native `CustomStateSet`, which `we:docs/agent/platform-decisions.md#native-first-baseline` (line 793) already declares an assumed Baseline-2024 primitive — so WE/FUI adds *declaration ergonomics + a toggle seam*, never a state engine. The sibling members set the precedent's *shape*: `form-associated` at `fui:blocks/renderers/component/declarativeComponent.ts:33,161,168`, and `default-aria-*` as a parsed, **allow-list-validated** (`VALID_ARIA_PROPS`, lines 56-65), **sorted-for-determinism** (line 111) map-through in the constructor (lines 171-178), all gated by one `hasInternals` flag (line 155). The crux Fork 1 turns on is that this precedent's *validation* leans on an external IDL truth (line 106 rejects a key absent from ARIAMixin) — a truth that **does not exist** for an open, author-invented custom-state set, so the precedent's validation power cannot be copied. Fork 2 turns on the toggle floor being *necessarily imperative* (custom states are not browser-managed) and on whether declarative reactivity reuses the shipped webexpressions parsers (`fui:blocks/parsers/*`) or mints a new DSL — tempered by the finding that those parsers are currently one-time-on-connect (`fui:blocks/parsers/value/resolveBinding.ts:9-11`), with reactive re-evaluation an unbuilt "phase 2".

### Recommended path at a glance

| Fork | Default | Alternative | Confidence |
|---|---|---|---|
| 1 · Declaration syntax | **No declaration attribute** — any string toggled at runtime (native open-set), an optional non-validating `states="…"` doc-list at most | `states="…"` allow-list as a *validating* gate · repeated `state-*` boolean family | med-high (flipped post-skeptic) |
| 2 · Toggle mechanism | **Imperative `internals` escape hatch now**; declarative reactivity reuses webexpressions when its phase-2 reactivity ships (a real prerequisite, not vaporware-as-answer) | bespoke `state-when="…"` predicate DSL | med-high (amended post-skeptic) |

## Fork 1 — Declaration syntax: how the component declares its custom-state vocabulary

**Fork-existence:** a real either/or — a *validating* `states="…"` allow-list and a *no-declaration* open set cannot coexist as the default (one rejects un-declared `internals.states.add('x')`, the other permits it); they are mutually-exclusive contracts on the same attach point, so this is case (b).

The crux: custom states are an **open** string set the author *invents* (`CustomStateSet` per MDN), unlike `default-aria-*` whose keys map onto the fixed external ARIAMixin IDL (`fui:blocks/renderers/component/declarativeComponent.ts:106` rejects an unknown key *because the platform defines the closed set*). So any `states` allow-list can only check a toggled name against the list the author just wrote — a tautology with zero typo-catching power, and emitting **no** constructor defaults (states are added at *runtime*, so the precedent's sort-for-determinism, line 111, also has nothing to protect).

- **(a) No declaration attribute (DEFAULT).** The vocabulary is implicit in what `fui:internals.states.add(...)` toggles at runtime; page CSS styles whatever is present via `:state(name)`. Most-permissive (MEMORY: Most-Flexible Default) and native-first (matches the open `CustomStateSet` contract). If "what states exist?" needs surfacing, that's a devtools/introspection read of `internals.states`, not a normative parse-time gate. A purely *optional, non-validating* `states="open active"` doc-list (rendered into the demo, never rejecting un-listed adds) is permitted sugar on top — it documents, it does not restrict.
- **(b) `states="…"` allow-list as a *validating* gate.** Rejected as the default: it imports the *form* of `default-aria-*` while losing all three of its justifications (validation against an external truth, deterministic constructor emit, typo rejection) and re-imposes a closed world on an API the platform made open.
- **(c) Repeated `state-*` boolean-attribute family.** Rejected: verbose for a flat list, same false-validation problem as (b), no upside over a single attribute.

**Rejected:** (b) and (c) both restrict an open native set with no error-catching gain — restriction must be the author's opt-in, never the default.

Skeptic: REFUTED → flipped from a validating `states="…"` allow-list to **(a) no declaration / open set**. The skeptic's beat — "the `default-aria-*` allow-list validates against the external ARIAMixin IDL (line 106); a custom-state list can only validate against itself, catching nothing, while fighting the open `CustomStateSet` contract" — is correct and decisive; the validating-gate default lost all three of the precedent's justifications. (Bonus the skeptic surfaced and prep confirmed independently: the precedent is already twin-broken — `defineFromDefinition` drops `defaultAria`, lines 212-250 — so any `states` adoption must wire both paths; a build note for #1794, not a fork.)

## Fork 2 — Toggle mechanism: how states flip at runtime

**Fork-existence:** a real either/or on the *declarative* path — reuse the shipped webexpressions binding parsers vs. mint a bespoke `state-when` predicate language; both are coherent reactive-toggle engines but only one can be *the* declarative seam (two parallel binding languages on the same surface is the duplication bias-to-reuse forbids), so case (b). The imperative floor itself is not a fork (custom states are not browser-managed, so an imperative handle is *forced*, not chosen).

The crux: per MDN, `:state()` is **not** browser-maintained — `internals.states` (a Set-like `CustomStateSet` with `.add/.delete/.has/.clear`) must be toggled in code, so the floor is necessarily the imperative `internals` handle the component already attaches. The only open question is the declarative sugar on top, and prep found FUI's webexpressions parsers are **one-time-on-connect** today (`fui:blocks/parsers/value/resolveBinding.ts:9-11`, `fui:blocks/view/ViewShowBehavior.ts:10-13`) — reactive re-evaluation is an unbuilt phase 2.

- **(a) Imperative `internals` floor now; reuse webexpressions for declarative reactivity when phase-2 reactivity ships (DEFAULT).** `fui:this.internals.states.add('open')` is the always-available escape hatch; the declarative reactive path is the *same* `{{ }}`/`[[ ]]` layer all bound surfaces use (e.g. a future `[[state.open]]="isOpen"` write-target), gated on that layer gaining reactive re-evaluation. Honest framing: declarative reactive toggling is **blocked on webexpressions phase-2 reactivity** — a stated prerequisite, not "already solved."
- **(b) Bespoke `state-when="expr"` predicate DSL.** Rejected: a second reactive engine duplicating webexpressions (MEMORY: webexpressions binding layer already exists; bias-to-reuse). It would ship reactivity faster *only* by forking the binding story — a worse end-state than one shared layer.

**Rejected:** (b) — minting a parallel predicate language to dodge the webexpressions phase-2 dependency trades a clean single binding story for permanent duplication.

Skeptic: SURVIVES-WITH-AMENDMENT — beat the attack "you're deferring reactive toggling to a capability that doesn't exist (webexpressions is one-time-on-connect, `fui:blocks/parsers/value/resolveBinding.ts:9-11`)". The attack is *factually right* and prep verified it, but it refutes the *framing*, not the *mechanism*: the fix is to state the webexpressions phase-2 reactivity as an explicit prerequisite (done above) rather than imply it's shipped. The imperative floor is correct and is the genuinely-shippable path today; minting `state-when` remains the wrong call (it forks the binding story). Amendment folded into option (a)'s wording.

## Context

---

**Lineage.** Forked out of #1794 (native `:state` alignment), which `blockedBy` this — #1794's adoption lands on the surface decided here. Sibling member: #853 (`default-aria-*`), the declarative ElementInternals precedent this mirrors in *placement* (though Fork 1 departs from its *validation* model — see the crux). Layer placement: this is a **block/impl ergonomics** surface on the declarative `<component>` (FUI), not a new intent — `grep` of `we:src/_data/intents/` finds none owning component-state vocabulary (`we:src/_data/intents/disclosure.json`'s `defaultState: open|closed` is a UX-level intent dimension, a different concern). No shared-registry mint needed.

**Supported by default (not decisions).**
- The imperative `internals.states` escape hatch is always available regardless of Fork 1's outcome (it's the native API).
- An *optional, non-validating* `states="…"` doc-list (Fork 1a) can coexist with the open set — it documents without restricting.
- Page CSS styling via `:state(name)` (plain ident; the dashed-ident `:--name` form is deprecated) and `::part(x):state(y)` is whatever the platform supports — WE adds nothing here.
- This surface is orthogonal to the workflow-engine / `LifecycleProvider` *state machine* (`def.states[...]`) — that models transitions, this exposes a CSS styling hook.
