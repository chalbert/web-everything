---
type: idea
workItem: epic
status: resolved
dateOpened: "2026-06-08"
dateStarted: "2026-06-08"
dateResolved: "2026-06-08"
graduatedTo: "204"
tags: [capability-provider, di, intents, native-first, adapters, resolution, module-as-a-service, client-hints, progressive-enhancement, cross-cutting]
relatedReport: reports/2026-06-02-native-platform-substrate.md
crossRef: { url: /backlog/025-droplist-native-substrate-fork/, label: "Graduated from #025 (droplist native-first resolution)" }
---

# Capability provider — injectable, adapter-backed resolution for intent-resolved impls

Graduated from [#025](/backlog/025-droplist-native-substrate-fork/), which settled the droplist
native-first resolution model and, in doing so, surfaced a **cross-cutting** mechanism that is not
droplist-specific: it serves any intent-resolved component family and ties into the
module-as-a-service thread ([#087](/backlog/087-module-service-distribution-caching/),
[#088](/backlog/088-module-service-versioning/),
[#085](/backlog/085-validation-adapters-multi-language/)). This epic owns that mechanism's design.

## Decided already (in #025 — the foundation, do not relitigate)

- **Binding model = explicit-via-base-extension; no magic-on-absence.** Defaults come from a base
  definition that explicitly sets every config; a project/view extends + overrides it. A default is
  an inherited *explicit* value, readable in the base.
- **A provider slot holds a concrete impl _or_ a named resolution policy.** `native-first` is a
  first-class policy value (the standard one the base uses). Concrete = pin; policy = resolve.
- **Two provider layers.** *Impl provider* = which implementation renders. *Capability provider* =
  the oracle answering "can impl X serve required capability Y, at what tier?" — itself injectable,
  adapter-backed.
- **`native-first` policy resolves as eligible → lightest → native wins ties.** "Lightest" = fewest
  polyfills / least JS over baseline. (Privileged-before-check rejected: it can commit to native
  then discover it can't serve a required intent.)
- **Adapters map each tool's real feature surface → a normalized capability vocabulary**; each
  capability reports a **3-state tier**: native-ok / polyfill-ok / capability-hard. Resolver (policy)
  and validator (pin) both query the capability provider rather than hard-coding capability facts.
- **Resolution venue is an optional, configurable dimension** (all three are legitimate end-states):
  **build-time** (known/narrow targets, zero runtime cost) · **runtime** (unknown targets, no infra)
  · **edge module-as-a-service** (broad targets, smallest payload, cached). Same eligible-tiebreak
  logic; only where/when differs. Default `build` in the base definition. Edge venue: capabilities
  ride in the component URL, client signal read via **Client Hints (not UA sniffing)**, chunk
  **cached per capability-equivalence class** (not raw UA), kept progressive-enhancement so a wrong
  guess degrades rather than breaks.

## Open questions (this epic's work)

1. **D3′ — Capability vocabulary.** Is the capability vocabulary the **intent vocabulary reused**
   (query an intent like `rich-option-content` directly) or a **separate lower capability layer**
   that intents are expressed in terms of? Must be **URL-serializable** (the edge venue carries caps
   in the component URL, e.g. `/c/droplist@1?caps=…`) — so it has to be stable and compact.
2. **D4′ — Capability-provider injection & sourcing.** Where capability data comes from and how the
   provider is swapped: static build-matrix · runtime feature-detection · edge-service. Set in the
   base definition, overridable per project. (Subsumes the old "where does the deployment-target
   matrix live" question — the target matrix is one capability-provider implementation.)
3. **D5 — Validation strictness.** warn / error / silent × build-time / runtime, as a configurable
   strictness knob mapped onto a conformance tier. Applies both to a concrete pin the validator
   rejects and to a policy that resolves to a capability-hard tier.
4. **D6 — Scoped binding precedence.** app / view / fragment override + inheritance through the base
   chain — who wins, and how an unspecified scope inherits.
5. **Adapter granularity & ownership.** Does each impl own its capability adapter, or does the
   capability provider hold a central registered table? (Repo's existing `adapters.json` pattern
   leans toward registered adapters.)

## Why it matters

The capability provider is the resolution layer the module-as-a-service items were missing, and the
generalization of native-first from a droplist tiebreak into a portable, declare-what-not-how
mechanism across every intent-resolved family.

## Resolution (2026-06-08)

All five open questions are settled. The epic's charter was the **design** ("this epic owns that
mechanism's design"); with the design complete it resolves and **decomposes into agent-ready build
stories** ([#204](/backlog/204-capability-vocabulary-provider-interface-matrix/),
[#205](/backlog/205-native-first-resolver/),
[#206](/backlog/206-capability-adapter-registration-table/),
[#207](/backlog/207-validation-strictness-scoped-binding-cascade/),
[#208](/backlog/208-runtime-edge-venue-provider-impls/), all `parent: "203"`).

### Rulings

- **D3′ — Capability vocabulary = separate lower capability layer, _not_ intent vocabulary reused.**
  Capabilities map ~1:1 to platform features (the substrate report's support-table rows) and **borrow
  Baseline / `web-features` IDs** as the vocabulary (e.g. `popover`, `anchor-positioning`,
  `customizable-select`, `showpicker`, `user-pseudos`). Rationale: the 3-state tier (native-ok /
  polyfill-ok / capability-hard) intrinsically lives on a *platform feature*, not a UX intent; intents
  are an open/unbounded system → an unstable URL cache key, whereas Baseline IDs are bounded, stable,
  compact, externally-maintained, already URL-safe. **Intents declare which capability IDs they
  require** (an authored intent→required-capabilities mapping); the provider tiers capability IDs; the
  resolver composes. The edge venue carries these IDs in the component URL (`/c/droplist@1?caps=…`) and
  caches per capability-equivalence class. *(Build: #204.)*

- **D4′ — Provider injection & sourcing = one interface, three venue-selected impls.** Single
  interface `tier(impl, capabilityId) → native-ok | polyfill-ok | capability-hard`. Default impl = the
  **static build-matrix** shipped as registered JSON (the substrate report's support table as data,
  paired with the default `build` venue). **Runtime feature-detection** impl overrides for the runtime
  venue; **edge-service** impl (reads Client Hints, not UA sniffing) for the edge venue, consulting the
  same matrix server-side. Subsumes the old "where does the target matrix live" — the matrix *is* the
  default provider impl. *(Build: #204 foundation + static matrix; #208 runtime + edge impls.)*

- **D5 — Validation strictness = one orthogonal `silent | warn | error` knob in the base, default
  `warn`.** Mapped onto conformance tiers (error = strict, warn = standard, silent = lenient). Default
  `warn` honors progressive enhancement (a wrong guess degrades, not breaks); CI bumps to `error`;
  runtime PE-degradation uses `silent`. Applies identically to a rejected concrete pin and to a policy
  that resolves to a capability-hard tier. *(Build: #207.)*

- **D6 — Scoped binding precedence = plain nearest-scope-wins cascade.** base → app → view → fragment,
  most-specific overrides, borrowing context-provider / CSS-cascade semantics. A child inherits the
  **slot value as written** (a policy stays a policy), re-resolved at the leaf — so `native-first` stays
  meaningful per-context (native on a Chrome view, custom on a Safari view) instead of freezing the
  parent's resolution. *(Build: #207.)*

- **Adapter granularity & ownership = central registered table** (the existing `adapters.json`
  pattern), resolved by the D4′ ruling: each impl authors its capability→tier row, but registration is
  central — the provider must enumerate all impls to resolve native-first anyway, and one table is
  discoverable. Ownership distributed, storage central. *(Build: #206.)*

### Through-line

**Capability IDs = Baseline / `web-features` keys** is the keystone: it makes D4′ (matrix keyed by
those IDs), D5 (tier per ID), the adapter table (rows keyed by those IDs), and the edge URL all fall
into place. Ties the module-as-a-service thread ([#087](/backlog/087-module-service-distribution-caching/),
[#088](/backlog/088-module-service-versioning/),
[#085](/backlog/085-validation-adapters-multi-language/)) into a single resolution layer via #208.
