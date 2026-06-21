---
kind: decision
size: 3
parent: "099"
status: resolved
dateOpened: "2026-06-21"
dateStarted: "2026-06-21"
dateResolved: "2026-06-21"
graduatedTo: none
codifiedIn: "docs/agent/platform-decisions.md#declarative-seam-over-existing-provider"
preparedDate: "2026-06-21"
relatedReport: reports/2026-06-21-telemetry-event-emission-vocabulary.md
relatedProject: webanalytics
tags: [decision, book-candidate, webanalytics, telemetry, analytics, declarative-emission, data-track, cross-cutting, gap]
---

# Telemetry / analytics events — declarative event-emission vocabulary standard: placement

Surfaced by the app-infrastructure cross-cutting lens
([#1402](/backlog/1402-discovery-lens-app-infrastructure-cross-cutting-concerns-inv/)). Prepared via a
prior-art survey + tree-grounding published as the `/research/telemetry-event-emission-vocabulary/` topic
(session report
[we:reports/2026-06-21-telemetry-event-emission-vocabulary.md](../reports/2026-06-21-telemetry-event-emission-vocabulary.md)).
Each fork below carries a recommended default in **bold**.

## RULING (ratified 2026-06-21)

All three forks ratified **as prepared** (defaults adopted), after an inline red-team in which each
attack failed:

- **Fork 1 → (a) ship a declarative emission seam.** A `data-track`-style behavior/directive over the
  already-built `CustomTracker` sink + Analytics Event Vocabulary. *Red-team:* the "convenience over an
  existing API → defer" attack is a *when* (prioritization), not a *whether* — this fork decides the
  end-state and files the build separately (fork-is-not-a-prioritization-tool). No new lock-in (degrades
  to `NoopTracker`, sink stays the only lock); standardizes the *mechanism*, not which events to emit;
  `data-*` is native (native-first). ~80%.
- **Fork 2 → (a) a behavior/directive, NOT an intent.** Intents are UX-only and render a surface
  (verified: `decision-trace` renders a criteria-trace table); telemetry renders nothing, so an intent
  would be the catalog's lone non-rendering member. The Web Directives vs Web Behaviors sub-home is left
  to the build. ~85% on not-an-intent.
- **Fork 3 → (a) two homes that compose, no umbrella.** Telemetry owns the seam under `webanalytics`;
  #1414's experiment-exposure emits *through* it (an exposure *is* a `track()` call). Distinct providers
  (analytics sink vs flag evaluator) + bias-toward-separation, no broken branch to justify merging. ~85%.

**Net:** the swappable sink and controlled vocabulary are settled prior art (not re-decided); the one
unbuilt piece — the declarative emission seam — is approved as a non-rendering behavior/directive under
`webanalytics`. Build + vocabulary-entry + conformance-demo filed as follow-ups (see below).

**Reframe (load-bearing).** The item was filed greenfield, but the WE
[webanalytics](/projects/webanalytics/) standard **already ships most of it**. Built + **resolved**: the
swappable sink (`we:plugs/webanalytics/CustomTrackerRegistry.ts` — this *is* the #052/#081 runtime-DI
provider; the running app calls `resolve().track()`, so the sink is consulted at runtime; #1012); the
contract (`we:analytics/contract.ts`); the controlled vocabulary (Analytics Event Vocabulary protocol,
`we:src/_data/protocols/analytics-vocabulary.json`, Segment Spec + deck events #1193); vendor adapters
(`fui:plugs/webanalytics/{segment,mixpanel,ga4}.ts`, #1013); a conformance demo (#1014). The glossary term
the item cites (`we:src/_data/semantics/analytics-event-vocabulary.json`) is the surfaced face of that
already-registered protocol. The **one piece genuinely unbuilt** is the declarative author-facing
**emission seam** — how an element declares "emit event E on interaction I" *without sprinkled imperative
`track()` calls* — which the #1003 epic explicitly foresaw and deferred (epic lines 46-47;
`we:src/_includes/project-webanalytics.njk:96`).

## Recommended path at a glance

| # | Decision | Recommended default | Main alternative | Confidence |
|---|----------|---------------------|------------------|------------|
| 1 | Add a declarative emission seam at all? | **Yes — ship a `data-track`-style annotation over the existing sink + vocabulary** | No — imperative-`track()`-only (coherent, not broken) | ~80% |
| 2 | What kind of artifact is it? | **A behavior/directive** (invisible declarative annotation) | A presentational Intent (rejected — renders nothing, miscategorized) | ~75% |
| 3 | Fold with #1414's experiment-exposure under an "observability" umbrella? | **No — two separate homes that compose** (experiment emits *through* this seam) | A shared "observability" umbrella intent (rejected — conflates two providers) | ~85% |

**Settled without a fork** (see *Supported by default* + *Context*): the **swappable sink** and the
**controlled vocabulary** already exist and are resolved — not re-decided; **distinct from** the audit
family (rendering intents over a governance provider) and from Web Events (DOM-event discrimination).

## Axis-framing

The concern sits on top of an already-built standard. Pinned to the real tree:

- **Sink (built).** `we:plugs/webanalytics/CustomTrackerRegistry.ts` — `define`/`resolve(key?)` + a
  default key + `NoopTracker` native-first floor (`we:analytics/provider.ts`), in `ProviderTypeMap` as
  `customTrackers` (`we:plugs/webinjectors/InjectorRoot.ts`). The #052/#081 runtime-DI provider, consulted
  at runtime by the emitter.
- **Contract (built).** `we:analytics/contract.ts` — `CustomTracker` (`identify`/`track`/`page`/`group`),
  `page()` arg order = Segment SDK.
- **Vocabulary (built).** `we:src/_data/protocols/analytics-vocabulary.json:1-9` — Segment Spec + deck
  events; `ownedByProject: webanalytics`.
- **Emission seam (unbuilt — this decision).** The declarative annotation (`data-track`-style) that binds
  an element's interaction → `resolve().track()`. Convergent prior-art: Snowplow element tracking +
  data selectors, GitLab Internal Events `data-event-tracking`, GA4 enhanced-measurement, OpenTelemetry
  named-event semconv — every scaled system ships this thin `data-*` binding over the sink + vocabulary.

## Fork 1 — Add a declarative emission seam at all, or stay imperative-`track()`-only?

**Why it's a fork:** two coherent end-states — (a) WE ships a declarative annotation so authors emit
without imperative JS, vs (b) WE ships only the imperative `CustomTracker` API (already built) and never
standardizes a declarative seam. (b) is **not broken** — apps can call `track()` by hand — so this is a
genuine support-vs-not call, not a forced ratify. The case for (a): every scaled prior-art system ships a
declarative `data-*` seam precisely because sprinkled imperative `track()` calls are the documented pain,
which WE's own #1003 epic + webanalytics spec both name as the deferred-but-real gap.

- **(a) Ship a declarative emission seam** *(recommended)*. A `data-track`-style annotation / emitter
  behavior over the existing `CustomTracker` sink + Analytics Event Vocabulary; the sink stays the only
  lock (swap the registry, not the call sites).
- **(b) Imperative-only, no declarative seam** *(alternative — coherent, not broken)*. Lower surface, but
  reproduces the sprinkled-call problem WE already named and diverges from every scaled system.

**Recommended: (a).** *(~80%. Residual: a declarative seam is author-convenience over an existing
imperative API, not a missing capability — so the broken branch isn't broken, just lower-leverage and
defensibly deferrable; the residual is prioritization, not merit.)*

## Fork 2 — Behavior/directive, or a presentational intent?

**Why it's a fork:** if Fork 1 is (a), the seam must be one kind of artifact and the candidates exclude
each other — (a) a **behavior/directive** (invisible annotation binding interaction → `track()`) vs (b) a
**presentational Intent** (the item's original "telemetry intent" framing). One branch is *flawed*: intents
are **UX-only and render a surface** (every shipped intent — `action`, `audit-timeline`, `decision-trace` —
renders something). Telemetry emission renders nothing; a "telemetry intent" would be the catalog's lone
non-rendering member.

- **(a) A declarative behavior/directive** *(recommended)*. The Snowplow/GitLab shape — `data-track`-style
  annotation bound at the document level, no rendered surface; resolves the sink via `CustomTrackerRegistry`.
- **(b) A presentational Intent** *(Rejected — miscategorized)*. Contradicts intents-are-UX-only; the
  "telemetry intent" framing predates the finding that the transport already exists — what's left is a
  binding, not a UX surface.

**Recommended: (a).** *(~75%. Residual: the exact home — Web Directives vs Web Behaviors — is a
sub-classification the build resolves; both are non-rendering annotation layers. The *not-an-intent* call is
the high-confidence part.)*

## Fork 3 — Fold telemetry + #1414's experiment-exposure under a shared "observability" intent?

**Why it's a fork:** #1414's experiment-exposure event and this telemetry emission share the
emit-to-a-swappable-sink shape, so a single "observability" umbrella owning *all* emission is a coherent
alternative. The branch *excluded* if we folded: the two concerns have **different providers and different
purposes** — telemetry targets the `CustomTracker` analytics sink; #1414 targets a **flag-evaluation
provider** and gating/variant-assignment is its job, with an exposure event as one downstream emission.
Bias-toward-separation puts the burden on combining, and no branch is broken — the experiment intent can
simply **emit through** this seam.

- **(a) Two separate homes that compose** *(recommended)*. Telemetry owns the emission seam under
  `webanalytics`; #1414's experiment intent reuses it for exposure events (an exposure *is* a `track()`
  call). One seam, two consumers; no umbrella.
- **(b) A shared "observability" umbrella intent** *(Rejected — conflates two providers)*. Merges the
  analytics sink and the flag evaluator, and instrument vs gate, against bias-toward-separation with no
  broken branch to justify it.

**Recommended: (a).** *(~85%. Residual: the *exposure-event vocabulary* may want a shared home — but that's
a vocabulary entry in the existing Analytics Event Vocabulary protocol, not a merged intent; it composes
either way.)*

---

## Supported by default (not decisions)

- **The swappable sink already exists — not re-decided.** `we:plugs/webanalytics/CustomTrackerRegistry.ts`
  is the #052/#081 runtime-DI provider, built + resolved (#1012). The emission seam *consumes* it; the
  item framed "a swappable sink provider" as a candidate, but it is settled prior art.
- **The controlled vocabulary already exists — not re-decided.** The Analytics Event Vocabulary protocol
  (`we:src/_data/protocols/analytics-vocabulary.json`, Segment Spec + deck events) is registered. A
  telemetry seam adds *vocabulary entries* (e.g. an "experiment exposed" event), never a new protocol —
  adding vocabulary not transport, as #1193 did.
- **Distinct from the audit family.** `we:src/_data/intents/decision-trace.json:5` and
  `we:src/_data/intents/audit-timeline.json:5` are **rendering** intents over a governance/decision
  provider; telemetry renders nothing and targets a product-analytics sink. No fold.
- **Distinct from Web Events.** `we:src/_data/projects/webevents.json` is DOM-event *discrimination*, not
  emission; an adapter *may* subscribe to typed events (`we:src/_includes/project-webanalytics.njk:96`),
  orthogonal to the author-facing seam.
- **Native-first floor / zero lock-in.** Unconfigured sink → `NoopTracker` silent default
  (`we:analytics/provider.ts`); the declarative seam degrades to no-op. AI sits **over** the codified
  vocabulary + contract (suggest event names), never as an emitter of disposable instrumentation.

## Context

**Classification (per-fork pass, recorded).** Layer = **behavior/directive** (invisible declarative
annotation), **not** an Intent (renders nothing → fails intents-are-UX-only) and **not** a new Protocol
(vocabulary + contract already exist). Consumes the **already-built** `CustomTracker` runtime-DI sink
(#052/#081, built/resolved #1012) and the **already-registered** Analytics Event Vocabulary protocol.
Owner = **webanalytics**. Most-permissive default = unannotated → no emission; annotated + no sink →
`NoopTracker`. Seam to #1414 = **composition**, not merge.

**Blast radius.** Net-new artifact (a declarative emission behavior/directive); **no migration** — the
imperative `CustomTracker` API stays as-is and is the seam's backend. Touches `webanalytics` (new
behavior/directive + a vocabulary entry or two); references `webbehaviors`/`webdirectives` for the Fork-2
home; #1414 references it for exposure events once both land.

**Owning project — webanalytics** (not webintents): the seam is the author-facing face of the existing
webanalytics transport/sink/vocabulary, so it belongs with the standard it binds to (mirroring the
audit-family intents living under `webaudit`/`webdecisions`, not `webintents`).

**Follow-ups filed at resolution (Fork 1 → (a)):** (1) [#1475](/backlog/1475-declarative-telemetry-emission-seam-data-track-behavior-dire/)
build — the declarative emission behavior/directive (`data-track`-style annotation → resolve
`CustomTrackerRegistry` → `track()`), document-level binding + trigger set (click/submit/view/focus/custom);
(2) [#1476](/backlog/1476-analytics-event-vocabulary-add-experiment-exposure-event-ent/) a vocabulary entry
for experiment-exposure events in the Analytics Event Vocabulary protocol, consumed by #1414; (3)
[#1477](/backlog/1477-conformance-demo-declarative-telemetry-annotations-over-anal/) a conformance demo
extending `we:src/_data/demos/analytics-conformance-demo.json` with declarative annotations.

**Genuine residual for the skeptic pass (Fork 1).** The strongest counter: the declarative seam is
*convenience over an existing imperative API*, not a missing capability — a skeptic could defer it as
low-leverage. The case for shipping rests on the convergent prior-art (every scaled system ships the
`data-*` seam) and WE's own #1003 epic naming "sprinkled `track()` calls" as the deferred-but-real gap.
Confidence ~80% on (a); the residual is prioritization (when), not merit (whether the end-state is correct).
