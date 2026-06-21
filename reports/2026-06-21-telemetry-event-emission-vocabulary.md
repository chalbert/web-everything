# Telemetry / analytics events — declarative event-emission vocabulary: placement (prep grounding)

**Item:** [#1415](../backlog/1415-telemetry-analytics-events-declarative-event-emission-vocabu.md) ·
**Date:** 2026-06-21 · **Status:** prep (no ruling) · **Research topic:**
`/research/telemetry-event-emission-vocabulary/`

> Autonomous prep half. Surveys prior art, classifies the candidate concerns against the
> fork-existence test, and authors the prepared-fork shape. **Makes no ruling.**

---

## 0. The grounding that reshapes the item

#1415 was filed as a greenfield "telemetry/analytics-event vocabulary standard: placement" — but the
WE tree already holds most of that standard. The decisive finding from reading the tree is that
**three of the four layers the item names already exist and are resolved**, so the open question
collapses to a much smaller, single seam.

What already exists under the `webanalytics` project:

- **The swappable sink (runtime-DI provider seam).** `CustomTrackerRegistry` —
  `we:plugs/webanalytics/CustomTrackerRegistry.ts` (graduated; epic #1003 / slice #1012, **resolved**
  2026-06-19). `define`/`resolve(key?)` + a `defaultKey`, four Segment routing helpers, a
  `NoopTracker` native-first silent default (`we:analytics/provider.ts`), wired into
  `ProviderTypeMap` as `customTrackers` (`we:plugs/webinjectors/InjectorRoot.ts`). This **is** the
  #052/#081 runtime-DI provider — and it passes the test by construction: the running app calls
  `resolve().track(...)`, so the sink registry is consulted at runtime.
- **The contract.** `CustomTracker` / `CustomAnalyticsEvent` / `Options` —
  `we:analytics/contract.ts` (type-only `@webeverything/contracts/analytics` candidate;
  `identify`/`track`/`page`/`group`, `page()` arg order aligned to the Segment SDK).
- **The controlled vocabulary.** The Analytics Event Vocabulary protocol —
  `we:src/_data/protocols/analytics-vocabulary.json:1-9` (`ownedByProject: webanalytics`), Segment
  Spec verbs (Identify/Track/Page/Group) plus a deck-event layer (Slide Viewed / Dwell / Deck
  Completed-Abandoned, #1193). The glossary term the item cites
  (`we:src/_data/semantics/analytics-event-vocabulary.json:2-4`) is the surfaced face of this
  already-registered protocol.
- **The vendor adapters (impl, FUI).** `fui:plugs/webanalytics/{segment,mixpanel,ga4}.ts` (slice
  #1013, **resolved** 2026-06-20).
- **A conformance demo.** `we:src/_data/demos/analytics-conformance-demo.json` (#1014).

So "the concept is named, the standard is unbuilt" (item line 18) is **half-true and now stale**:
the transport, contract, vocabulary, sink-DI, and adapters are all built and resolved. The **one
piece genuinely unbuilt** is the declarative *author-facing emission seam* — how an element on the
page declares "emit event E on interaction I" so it reaches the existing `track()` call **without
sprinkled imperative JS**. The #1003 epic itself foresaw exactly this gap and explicitly left it out
of scope: it described an "optional Web Events subscription so adapters can instrument off typed
events instead of **sprinkled `track()` calls**" (epic body lines 46-47, "composition seams —
deferred behind unbuilt dependencies"). The webanalytics spec repeats it: Web Events lets adapters
"instrument without sprinkling `track()` calls" (`we:src/_includes/project-webanalytics.njk:96`).

**Reframed question #1415 actually decides:** given the existing webanalytics transport + sink +
vocabulary, should WE add a **declarative emission seam** (a `data-track`-style annotation / emitter
behavior: "this element emits event E on interaction I") — and **where does it live** (its own
artifact under `webanalytics`, vs. nothing/imperative-only, vs. folded under a broader
"observability" intent with #1414's experiment-exposure events)?

---

## 1. Prior-art web survey (greenfield-shape confirmation)

The item is greenfield on the *emission seam* specifically, so I surveyed the convergent shape
across the upstream standard and the major analytics platforms. Standards bodies are treated as
**upstream** (align, do not compete).

| Source | Emission/annotation shape | Controlled vocabulary | Swappable sink |
|---|---|---|---|
| **OpenTelemetry** (semconv: Events) | An *Event* has a **name that uniquely identifies its structure** + typed attributes; events are distinct from logs/metrics | Semantic Conventions — named events + attribute keys/units, "reduce instrumentation drift" | OTLP exporters (vendor-neutral transport) |
| **W3C Trace Context** | `traceparent`/`tracestate` headers propagate a correlation id across hops | — (correlation, not event vocab) | any conformant collector |
| **Google Analytics 4** | `gtag('event', name, params)` + GTM `dataLayer.push`; enhanced-measurement is **zero-code declarative** | **Recommended events** (35+ named) + automatic + enhanced tiers; name rules (alnum/underscore, ≤40, alpha-start) | GA pipeline (one of many) |
| **Segment** | `analytics.track(event, props)` / `identify` / `page` / `group` | The **Segment Spec** (the exact vocabulary WE already adopted) | any conformant destination |
| **Amplitude** | `track(event, props)` | **Event taxonomy** — verb_noun, past tense, governed via the Taxonomy tool | Amplitude (swappable via CDP) |
| **Snowplow** | **Element tracking + data selectors** — declarative `data-*` config; elements with `data-track-event` get tracking **bound at the document level**, no per-element code | Iglu schema registry (typed, versioned event/entity schemas) | Snowplow collector / forwarders |
| **GitLab Internal Events** | **`data-event-tracking="click_…"` + `data-event-label/property/value`** declarative attributes; a "Single Instrumentation Layer"; event **definitions are the SSOT** | governed event definitions (declarative spec) | routes to multiple backends from one interface |
| `data-*` declarative-tracking pattern (general) | `data-track-event` / `data-track-label` listeners bound once at document level | per-project naming convention | per-project |

**Convergent shape (the borrow):** a **declarative annotation** — *event name + typed payload drawn
from a controlled vocabulary* — placed on an element (`data-track-*` / an emitter behavior), bound
once at runtime, **routed to a swappable sink/provider**. This is the exact OpenTelemetry "named
event + typed attributes" shape and the Snowplow/GitLab `data-*` declarative seam, sitting on top of
the Segment vocabulary WE already adopted.

**What the survey reshapes:** every surveyed system treats the **sink** and the **vocabulary** as
the durable contracts and the **declarative annotation** as a thin author-convenience binding over
them — never a separate "standard" in its own right. WE has already shipped the two durable
contracts. The emission seam is therefore confirmed as a *thin binding* over the existing
`CustomTracker` + vocabulary, not a new transport or a new vocabulary. The fork shrinks accordingly.

---

## 2. Per-fork classification (7-question pass, recorded)

For the **declarative emission seam** (the one unbuilt piece):

1. **Which layer?** **Intent or behavior** (declarative author-facing UX/annotation: "this element
   emits event E on interaction I"). Not a Protocol — the protocol (vocabulary) and the contract
   (`CustomTracker`) already exist; this layer only *binds* an element's interaction to a `track()`
   call. Strong lean to **behavior/directive** rather than a presentational Intent, because emission
   produces **no visual rendering** — it is invisible instrumentation, not a UX surface, which is the
   classic intent-disqualifier (intents are UX-only and render *something*).
2. **Protocol or intent dimension?** Neither a new protocol nor a dimension on an existing intent. It
   is a **declarative annotation/behavior** that consumes the existing protocol's vocabulary.
3. **Expose the whole axis?** N/A as a value-axis. The "axis" here is *which interaction triggers
   emission* — and yes, expose it fully (any DOM interaction: click, submit, view/impression via
   IntersectionObserver, focus, custom). Most-permissive.
4. **Fixed mechanic or dimension?** The binding mechanism is a **fixed mechanic** (annotation →
   resolve sink → call `track()`); the *trigger* and *payload* are author-supplied parameters.
5. **DI-injectable (does the running app consult the sink registry)? — YES.** The emitter resolves
   the sink through `CustomTrackerRegistry.resolve(key?)` at emit time. This is squarely the
   #052/#081 runtime-DI provider seam — **already built**. The emission seam does not *create* a new
   DI seam; it is a *consumer* of the existing one. (This answers the item's "is it a runtime-DI
   provider?" — the sink is, and it exists; the new piece is the declarative annotation that calls
   it.)
6. **Most-permissive default?** Unannotated element → **emits nothing**; an annotated element with no
   sink configured → routes to the `NoopTracker` silent default (already the native-first floor at
   `we:analytics/provider.ts`). Zero lock-in: removing the annotation removes the instrumentation;
   swapping the sink is a registry call, never a call-site rewrite.
7. **Seam between intents (telemetry ↔ experiment-exposure ↔ audit)?**
   - **↔ audit family** (`decision-trace` / `audit-timeline`): **distinct, no fold.** Audit is
     *governance/decision history rendered for a human* (`we:src/_data/intents/audit-timeline.json:5`
     "who did what, when, and before→after"; `we:src/_data/intents/decision-trace.json:5` "why a
     rules evaluation reached its outcome"). Both
     are **visual members** that *render* a record from an audit/decision **provider** — they own a
     display surface. Telemetry emission **renders nothing** and targets a **product-analytics**
     sink, not a governance log. Different provider, different purpose, no shared surface → keep
     separate.
   - **↔ experiment-exposure** (#1414): a **real seam, honoured by separation.** An experiment
     "exposure event" (user bucketed into variant V → emit an exposure) **is literally an analytics
     `track()` call** — it should *reuse* this emission seam + the `CustomTracker` sink, not invent a
     parallel emitter. But #1414's intent is *gating/variant-assignment* (a different provider — the
     flag evaluator) and its exposure event is one downstream emission. Bias-toward-separation +
     fork-existence test: there is no broken branch forcing a merge. Two coherent homes that
     **compose** (experiment intent emits *through* the telemetry seam) beat one "observability"
     umbrella. The umbrella is evaluated and rejected as Fork 3.

**Net classification:** a thin **declarative emission seam** (behavior/directive favored over
intent, because it renders nothing) consuming the **already-built** `CustomTracker` runtime-DI sink
and the **already-registered** Analytics Event Vocabulary protocol; owned by **`webanalytics`**.

---

## 3. The prepared forks (no ruling)

The survey + tree-grounding collapse the item's three originally-framed candidates. The sink-DI and
vocabulary are not open (built + resolved), so the real decision is **(I) build the declarative
emission seam at all**, **(II) what kind of artifact it is** (behavior/directive vs. intent), and
**(III) whether to fold it with #1414 under an "observability" umbrella**. The first is a genuine
fork (the "imperative-only, no seam" branch is coherent); the second is a genuine
behavior-vs-intent classification fork; the third is the bias-toward-separation umbrella test.

### Fork 1 — Add a declarative emission seam at all, or stay imperative-`track()`-only?

**Why it's a fork:** two coherent end-states — (a) WE ships a declarative annotation
(`data-track`-style) so authors emit without imperative JS, vs. (b) WE ships **only** the
imperative `CustomTracker` API (already built) and never standardizes a declarative seam. (b) is not
*broken* — apps can call `track()` by hand — so this is a genuine support-vs-not call, not a forced
ratify. The case **for** (a): every surveyed platform that reaches scale (Snowplow element tracking,
GitLab Internal Events, GA4 enhanced-measurement) ships a declarative `data-*` seam precisely
because sprinkled imperative `track()` calls are the documented pain (the #1003 epic + webanalytics
spec both name "sprinkled `track()` calls" as the thing to avoid). The residual against: a thin
declarative binding is small, and an app could supply its own.

- **(a) Ship a declarative emission seam** *(recommended)* — a `data-track`-style annotation /
  emitter behavior over the existing `CustomTracker` sink + Analytics Event Vocabulary. Closes the
  gap the #1003 epic explicitly deferred; matches the convergent prior-art shape; keeps the sink as
  the only lock (swap the registry, not the call sites).
- **(b) Imperative-only, no declarative seam** *(alternative — coherent, not broken)* — leave
  emission to hand-written `resolve().track()` calls. Lower surface, but reproduces the
  sprinkled-call problem WE already named, and diverges from every scaled prior-art system.

**Recommended: (a).** *(~80%. Residual: a declarative seam is author-convenience over an existing
imperative API, not a missing capability — so this is a "should WE standardize the convenience"
call, defensibly deferrable; the broken branch isn't broken, just lower-leverage.)*

### Fork 2 — Behavior/directive, or a presentational intent?

**Why it's a fork:** if Fork 1 is (a), the seam must be *one kind* of artifact, and the two
candidates exclude each other — (a) a **behavior/directive** (Web Behaviors / Web Directives: an
invisible annotation that binds an interaction → `track()`), vs. (b) a **presentational Intent**
under Web Intents (like the item's original "telemetry intent" framing). One branch is **flawed**:
intents are **UX-only and render a surface** — every shipped intent (`action`, `audit-timeline`,
`decision-trace`) *renders something*. Telemetry emission **renders nothing**; it is invisible
instrumentation. Calling it an Intent miscategorizes it against the established Intent definition (a
"telemetry intent" with no rendered output would be the lone non-rendering intent in the catalog).

- **(a) A declarative behavior/directive** *(recommended)* — `data-track`-style annotation bound at
  the document level (the Snowplow/GitLab shape), no rendered surface; resolves the sink via
  `CustomTrackerRegistry`. Fits the "invisible cross-cutting annotation" category.
- **(b) A presentational Intent** *(Rejected — miscategorized)* — an Intent that renders nothing
  contradicts intents-are-UX-only and would be the catalog's only non-rendering member. The item's
  "telemetry intent" framing predates the finding that the transport already exists; what's left is a
  binding, not a UX surface.

**Recommended: (a).** *(~75%. Residual: the exact directive-vs-behavior home (Web Directives vs Web
Behaviors) is a sub-classification the build resolves — both are non-rendering annotation layers; the
*not-an-intent* call is the high-confidence part.)*

### Fork 3 — Fold telemetry + #1414's experiment-exposure under a shared "observability" intent?

**Why it's a fork:** #1414's experiment-exposure event and this telemetry emission **share the
emit-to-a-swappable-sink shape**, so a single "observability" umbrella that owns *all* emission is a
coherent alternative to two separate homes. The branch that would be **excluded** if we folded: the
two concerns have **different providers and different primary purposes** — telemetry targets the
`CustomTracker` analytics sink; #1414 targets a **flag-evaluation provider** and *gating/variant
assignment* is its job, with an exposure event as one downstream emission. Bias-toward-separation
puts the burden of proof on combining, and no branch here is broken: the experiment intent can
simply **emit through** the telemetry seam (composition), which keeps each concern's provider and
purpose clean. Folding would force #1414's gating semantics and this emission seam into one artifact
with two unrelated providers — the conflation bias-toward-separation exists to prevent.

- **(a) Two separate homes that compose** *(recommended)* — telemetry owns the emission seam under
  `webanalytics`; #1414's experiment intent **reuses** it for exposure events (an exposure *is* a
  `track()` call). One emission seam, consumed by both; no umbrella.
- **(b) A shared "observability" umbrella intent** *(Rejected — conflates two providers)* — one
  artifact owning both analytics emission and experiment gating; merges two distinct providers
  (analytics sink vs. flag evaluator) and two purposes (instrument vs. gate) against
  bias-toward-separation, with no broken branch to justify it.

**Recommended: (a).** *(~85%. Residual: the *exposure-event vocabulary* (what an "experiment
exposed" event is named/shaped) may want a shared home — but that's a vocabulary entry in the
Analytics Event Vocabulary protocol, not a merged intent; it composes either way.)*

---

## 4. Supported by default (not decisions)

- **The swappable sink already exists — not re-decided.** `CustomTrackerRegistry`
  (`we:plugs/webanalytics/CustomTrackerRegistry.ts`) is the #052/#081 runtime-DI provider, built and
  resolved (#1012). The emission seam *consumes* it; it does not re-open it. (The item framed "a
  swappable sink provider" as a candidate fork — it's settled prior art.)
- **The controlled vocabulary already exists — not re-decided.** The Analytics Event Vocabulary
  protocol (`we:src/_data/protocols/analytics-vocabulary.json`, Segment Spec + deck events) is
  registered and `ownedByProject: webanalytics`. A telemetry emission seam adds *vocabulary entries*
  to this protocol when needed (e.g. an "experiment exposed" event), never a new protocol — adding
  vocabulary, not transport, exactly as #1193 did.
- **Distinct from the audit family.** `decision-trace` (`we:src/_data/intents/decision-trace.json:5`)
  and `audit-timeline` (`we:src/_data/intents/audit-timeline.json:5`) are **rendering** intents over
  a **governance/decision** provider; telemetry emission renders nothing and targets a
  product-analytics sink. No overlap, no fold — separate by construction.
- **Distinct from Web Events.** `webevents` (`we:src/_data/projects/webevents.json`) is DOM-event
  *discrimination* (`listenForScoped` + `instanceof`), not analytics emission. An analytics adapter
  *may* subscribe to typed Web Events to instrument (spec line 96), but that is the adapter's choice,
  orthogonal to the author-facing `data-track` seam.
- **Native-first floor.** Unconfigured sink → `NoopTracker` silent default
  (`we:analytics/provider.ts`); the declarative seam degrades gracefully to no-op, zero lock-in.
- **AI sits over the contract, not as the artifact.** Any AI assistance (suggest event names,
  auto-annotate) is a dev-time layer over the codified vocabulary + `CustomTracker` contract — never
  an emitter of disposable instrumentation.

---

## 5. Context — classification, blast radius, follow-ups

**Recorded classification (per-fork pass).** Layer = **behavior/directive** (invisible declarative
annotation), **not** an Intent (renders nothing → fails intents-are-UX-only) and **not** a new
Protocol (vocabulary + contract already exist). Consumes the **already-built** `CustomTracker`
runtime-DI sink (#052/#081 seam — built, resolved #1012) and the **already-registered** Analytics
Event Vocabulary protocol. Owner = **`webanalytics`**. Most-permissive default = unannotated → no
emission; annotated + no sink → `NoopTracker`. Seam to #1414 = **composition** (experiment intent
emits *through* this seam), not a merge.

**Blast radius.** Net-new artifact (a declarative emission behavior/directive); no migration of
shipped consumers — the imperative `CustomTracker` API stays as-is and is the seam's backend. Touches
`webanalytics` (new behavior/directive + a vocabulary entry or two), references `webbehaviors` /
`webdirectives` for the home (Fork 2 sub-classification at build time). #1414 references it for
exposure events once both land.

**Owning project — `webanalytics`** (not `webintents`). The emission seam is the author-facing face
of the existing webanalytics transport, sink, and vocabulary; it belongs with the standard it binds
to. (The audit-family intents live under their own projects too — `webaudit` / `webdecisions` — not
under `webintents`.) `relatedProject: webanalytics`.

**Follow-ups to file at resolution (if Fork 1 → (a)):** (1) build — the declarative emission
behavior/directive (`data-track`-style annotation → resolve `CustomTrackerRegistry` → `track()`),
with the document-level binding and the trigger set (click/submit/view/focus/custom); (2) a
vocabulary entry for experiment-exposure events in the Analytics Event Vocabulary protocol, consumed
by #1414; (3) a conformance demo extending `analytics-conformance-demo` with declarative annotations.

**Genuine residual for the skeptic pass (Fork 1).** The strongest counter is that the declarative
seam is *convenience over an existing imperative API*, not a missing capability — so a skeptic could
defer it as low-leverage rather than support it. The case for shipping rests on the convergent
prior-art (every scaled system ships the `data-*` seam) and on WE's own #1003 epic naming "sprinkled
`track()` calls" as the deferred-but-real gap. Confidence ~80% on (a); the residual is prioritization
(when to build), not merit (whether the end-state is correct).
