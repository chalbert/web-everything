---
kind: decision
size: 3
parent: "023"
status: resolved
dateOpened: '2026-06-02'
dateStarted: '2026-06-08'
dateResolved: '2026-06-08'
graduatedTo: none
codifiedIn: "one-off"
tags:
  - droplist
  - dropdown
  - di
  - native-first
  - intents
relatedReport: reports/2026-06-02-native-platform-substrate.md
relatedProject: webintents
---

# Decide native-first resolution model for droplist DI

Is native (base-select) privileged before the capability check, or just the tiebreak among already-eligible implementations? Settling on 'lightest eligible impl, native wins ties' makes native-first a tiebreak rule rather than a default — and the polyfillability tier of each required intent decides whether a gap can be layered onto native or forces a wholesale switch to the custom impl.

## Resolution (2026-06-08)

**Ruling: `native-first` is an eligible-tiebreak, not privileged-before-check** — resolve as
**eligible → lightest → native wins ties** ("lightest" = fewest polyfills / least JS over baseline).
The polyfillability tier of each required intent decides layer-onto-native vs. wholesale-switch, via
an injectable capability provider (checked before the choice). The broader resolution architecture
this surfaced (capability provider, venue dimension, D3′–D6) **graduated to [#203](/backlog/203-capability-provider-resolution-architecture/)**.

## Progress

**Status:** resolved — graduated to #203.
**Branch:** docs/standard-authoring-workflow

### Decided

- **D1 — Binding model = explicit-via-base-extension; no magic-on-absence.** Defaults come from a **base definition that explicitly sets every config** (provider included); a project/view *extends and overrides* it. There is no "resolver runs when the slot is absent" — a default is just an inherited *explicit* value (auditable, readable in the base).
  - **A provider slot may hold either a concrete impl _or_ a named resolution policy.** `native-first` is a first-class *policy value* the shipped base uses — the resolver isn't implicit fallback, it's an explicit, inheritable, overridable value sitting in the base. Concrete value = pin; policy value = resolve. This keeps progressive enhancement (native-on-Chrome / custom-on-Safari) without reintroducing invisible magic.

- **D2 — `native-first` policy = eligible-tiebreak (B), not privileged-before-check.** Resolve as **eligible → lightest → native wins ties**. "Lightest" = fewest polyfills / least JS over the baseline substrate. A (try-native-before-checking) is rejected: it can commit to native and only then discover a required intent it can't serve (broken / late runtime switch). Settled by adopting the capability provider (below) — its whole purpose is *check before choose*, which is B.

- **SPINE — Capability provider (injectable, adapter-backed).** Provider splits into two layers:
  - **Impl provider** — *which* implementation renders (the slot D1 governs; concrete pin or `native-first` policy).
  - **Capability provider** — the oracle answering *"can impl X serve required capability Y, at what tier?"* Itself **injectable**; **adapters** map each tool's real feature surface → a **normalized capability vocabulary**. Resolver (policy) and validator (pin) both query it instead of hard-coding capability facts. The 3-state (native-ok / polyfill-ok / capability-hard) is the value each adapter reports per capability.
  - **Resolution venue is a configurable dimension** (legitimate multi-end-state fork): **build-time** (known/narrow targets, zero runtime cost) · **runtime** (unknown targets, no infra) · **edge module-as-a-service** (broad targets, smallest payload, cached). All three run the *same* eligible-tiebreak logic; only where/when differs. **Optional**, default `build` in the base definition. Edge venue: capabilities ride in the component URL (`/c/droplist@1?caps=…`), client signal read server-side (**Client Hints, not UA sniffing**), chunk **cached per capability-equivalence class** (not raw UA), kept progressive-enhancement so a wrong guess degrades not breaks.
  - **Cross-links:** module-as-a-service thread #087 / #088 / #085 — capability provider is their missing resolution layer.

### Next

- **D3′** — capability vocabulary: is it the **intent vocabulary reused**, or a **separate lower capability layer** intents are expressed in terms of? Must be URL-serializable (edge venue).
- **D4′** — capability-provider injection & sourcing (static build-matrix / runtime feature-detection / edge-service); subsumes the old "where does the target matrix live" (D4).
- **D5** — validation strictness: warn/error/silent × build/runtime (conformance-tier knob).
- **D6** — scoped binding precedence: app/view/fragment override + inheritance through the base chain.

### Graduate at close-out

The capability provider + venue dimension has outgrown droplist (serves any intent-resolved family; ties into module-as-a-service). On close-out, graduate it into its own item — likely a Project/Protocol-level entity — rather than leaving it buried here.

**Graduated to** `none` — decision — ruling 'lightest eligible impl, native wins ties' (in body); fed the #203 capability-provider architecture (prior corrupt value: 203).
