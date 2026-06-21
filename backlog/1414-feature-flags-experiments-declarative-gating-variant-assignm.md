---
kind: decision
size: 3
parent: "099"
status: resolved
dateOpened: "2026-06-21"
dateStarted: "2026-06-21"
dateResolved: "2026-06-21"
graduatedTo: none
codifiedIn: "docs/agent/platform-decisions.md#flag-gate-vs-experiment-selector"
preparedDate: "2026-06-21"
tags: [webintents, feature-flags, experiments, variant-assignment, openfeature, access-control, cross-cutting, decision-prep]
relatedProject: webintents
relatedReport: reports/2026-06-21-feature-flag-gating-variant-assignment.md
---

# Feature flags & experiments — declarative gating + variant assignment standard: placement

Surfaced by the app-infrastructure cross-cutting lens
([#1402](/backlog/1402-discovery-lens-app-infrastructure-cross-cutting-concerns-inv/)): nearly every
non-trivial app ships **feature flags** (gate a route/subtree on a runtime-evaluated flag) and
**experiments / A-B variant assignment** (deterministically bucket a user, render the assigned arm, emit an
exposure event). This decides where that lands in the WE constellation. **The prior-art survey reshaped the
item's own framing** — the binary-gate half is *already standardized* (access-control declares
`feature-flag` as a first-class authority kind on the Guard provider seam,
we:src/_data/intents/access-control.json:23-31), so "a new feature-flag intent for the gate" and "fold the
gate into access-control" both dissolve; the genuinely unhomed concept is **multivariate variant
assignment** (a flag resolving to one of N arms, which access-control's allow/deny gate cannot express) and
its **exposure event**. The forks below are grounded in a prior-art survey published as the
`/research/feature-flag-gating-variant-assignment/` topic (session report
we:reports/2026-06-21-feature-flag-gating-variant-assignment.md); each carries a recommended default in
**bold**. Exploratory / cross-cutting — the ruling is the end-state, the build is separately prioritized.

## Ruling — RATIFIED 2026-06-21

All three prepared defaults ratified as-is (user `ratified`, 2026-06-21; inline red-team cleared each
alternative as genuinely flawed, not merely less-preferred):

1. **Home = a separate `experiment` (variant-assignment) intent** under Web Intents (Fork 1a, ~75%).
   Pick-one-of-N is a different outcome family than access-control's allow/deny deny-set, so it gets its
   own home; the boolean gate stays on `authority: feature-flag` (access-control), untouched.
2. **Provider = a distinct evaluation provider reusing the Guard *seam pattern*** (Fork 2a, ~70%) —
   same native-first → project override → custom-plug mechanics (we:src/_data/projects/webguards.json:4),
   a separate contract returning `{value, variant, reason}` (OpenFeature vocab), **no security semantics**.
   The seam pattern is reused; the instance and contract are not (a variant arm is not an authz verdict).
3. **Exposure event = route through #1415's telemetry sink** (Fork 3a, ~80%) — the `experiment` intent
   *declares* the exposure; #1415's swappable sink *delivers* it (mirrors OpenFeature's Tracking⊥Evaluation
   split). A named seam, not a merge.

The decision graduates to no entity (`graduatedTo: none`); the entity (the `experiment` intent) is authored
by follow-up **#1479**. Follow-ups filed: **#1479** (author intent + evaluation-provider contract, Forks 1+2);
**#1480** (wire exposure → #1415 sink, Fork 3; blocked on #1415 + #1479); **#1481** (doc note: boolean-gate=
access-control / multivariate=experiment split, so the two aren't re-conflated). Codified as a one-off
placement ruling (this item is the record); the generalizable split is captured prose-side by #1481.

## Recommended path at a glance

| # | Decision | Recommended default | Main alternative | Confidence |
|---|----------|---------------------|------------------|------------|
| 1 | Home for variant assignment? | **A separate `experiment` intent** (no-intent is broken; access-control's deny family can't carry pick-one-of-N) | A third `surface` value on access-control | ~75% |
| 2 | Provider identity for variant resolution? | **A distinct evaluation provider** reusing the Guard *seam pattern* (a variant arm is not a security verdict) | The same Guard provider instance | ~70% |
| 3 | Exposure-event routing? | **Route through #1415's telemetry sink** (OpenFeature splits Tracking from Evaluation) | Its own event family on the intent | ~80% |

**Settled without a fork** (see *Supported by default* + *Context*): the **binary gate** is already shipped
as `authority: feature-flag` on access-control (we:src/_data/intents/access-control.json:23-31); the
**OpenFeature `variant`/`reason` vocabulary** (`STATIC | DEFAULT | TARGETING_MATCH | SPLIT | …`) is borrowed
verbatim; **deterministic bucketing** (hash of salt+unit) is impl behind the provider, never a UX value
(intents-are-UX-only; Impl-Is-Not-A-Standard); the **typed-flag distinction** (boolean = gate, string/object
= selector) is borrowed from OpenFeature.

## Axis-framing

The decision is the placement of *variant assignment* relative to a gate WE already standardized. Pinned to
the real tree, the convergent shape is a declarative gate/selector → a swappable evaluation provider → a
resolution `{value, variant, reason}` → a separate exposure event.

- **The binary gate (already homed)** — `authority: feature-flag` on Access Control
  (we:src/_data/intents/access-control.json:23-31), evaluated on the swappable **Guard provider**
  (we:src/_data/projects/webguards.json:4, *"the predicate is resolved by a swappable guard provider …
  native-first → project override → custom plug"*). It carries the deny-outcome family
  `hide | redirect | forbid | cloak` (we:src/_data/intents/access-control.json:14-22) and a
  server-authoritative trust boundary. A *boolean* flag is exactly this gate.
- **The provider seam (runtime-DI precedent)** — the running app *consults* the provider on every
  evaluation, which is what makes it a genuine runtime-DI seam (#052/#081) and not a build/devtools
  provider. OpenFeature's provider (global singleton, init/evaluate/shutdown, per-domain) is the same shape
  as the Guard provider WE already ships.
- **Variant assignment (unhomed)** — a *string/object* flag resolves to one of N arms. Access-control's
  single deny-outcome family (we:src/_data/intents/access-control.json:14-22) is allow/deny and **cannot**
  express pick-one-of-N — this is the gap the decision fills.
- **The exposure event (a telemetry compose)** — OpenFeature's Tracking API is a *separate* spec section
  from evaluation; the exposure ("which arm they saw") is an emit-to-a-sink that composes with the
  telemetry sink prepared in
  [#1415](/backlog/1415-telemetry-analytics-events-declarative-event-emission-vocabu/), not new gate
  machinery. Access Control's own events (we:src/_data/intents/access-control.json:34-38:
  `accessgrant | accessdeny | accessrevoke`) are the precedent for an intent declaring events.

The structural distinction: a boolean flag (the gate, already on access-control's deny family) and a
multivariate flag (the selector, no home) resolve through the **same provider shape** but produce
**different outcome families** (allow/deny vs pick-one-of-N), so the selector needs its own home.

## Fork 1 — Home for variant assignment: a separate `experiment` intent, a third access-control surface, or no intent?

**Why it's a fork:** the candidate homes genuinely cannot coexist (one location wins), and one branch is
*broken*. **No-intent (pure provider)** is broken: rendering the assigned arm is a UX decision an author
declares against (which subtree maps to which arm) — a bare provider exposes a resolution API but nothing to
*declare*, so there is no standard surface, only an SDK call. And the **fold-into-access-control** branch is
flawed: access-control's outcome family is a single deny set `hide | redirect | forbid | cloak`
(we:src/_data/intents/access-control.json:14-22), which models allow/deny — a pick-one-of-N resolution is a
different outcome family that the deny dimension cannot carry without overloading it (the same
nominal-vs-ordinal break #1337 found one intent over).

- **(a) A separate `experiment` (variant-assignment) intent** *(recommended)*. UX-level: this subtree
  renders the arm assigned to the current unit; an open `variant` dimension (the arm set), most-permissive
  default = the control/default arm (mirrors OpenFeature `DEFAULT`). Composes the Guard-style provider for
  resolution and #1415 for the exposure. Keeps access-control a clean allow/deny gate.
- **(b) A third `surface: variant` on access-control** *(Rejected — overloads the deny family)*.
  Access-control's deny-outcome family is binary (allow/deny); a pick-one-of-N resolution forces a second,
  incompatible outcome model onto the one intent. Bias-toward-separation: the burden is on combining and
  the trust boundary differs (a variant arm is not an authz verdict).
- **(c) No intent — a pure evaluation provider/behavior** *(Rejected — broken)*. Gives nothing to declare;
  there is no UX standard, only a vendor SDK call. Fails the "what does the author write?" test.

**Recommended: (a).** *(~75%. Residual: whether a `surface: variant` on access-control could carry the N-way
resolution without breaking the deny family — the report argues it cannot; the deciding agent's skeptic
should attack exactly this.)*

## Fork 2 — Same Guard provider, or a distinct evaluation provider?

**Why it's a fork:** the two cannot both be true (the resolution either flows through one provider or two),
and the single-provider branch is *flawed* on the trust boundary. Access Control's provider is
**server-authoritative** and its verdict is a *security* decision
(we:src/_data/intents/access-control.json:33, *"this intent is a UX mirror, never the enforcement point"*).
A variant arm is **not** a security verdict — bucketing a user into arm B grants nothing. Returning either a
deny-verdict or a variant from one provider invites a client-side variant gate to masquerade as
authorization, which is exactly the failure access-control's trust boundary guards against.

- **(a) A distinct evaluation provider reusing the Guard *seam pattern*** *(recommended)*. Same
  native-first → project override → custom-plug shape (we:src/_data/projects/webguards.json:4), same
  runtime-DI registry mechanics, but a separate contract returning `{value, variant, reason}` (OpenFeature
  vocabulary), with no security semantics. The seam pattern is reused; the instance and contract are not.
- **(b) The same Guard provider instance** *(Rejected — boundary risk)*. Collapses a security verdict and a
  rollout arm into one resolver, blurring the trust boundary and tempting client-side authz-via-flag.

**Recommended: (a).** *(~70%. Residual: operational simplicity of one provider vs the boundary risk — a
skeptic should weigh whether a typed `reason`/`authority` discriminator on one provider could keep the
boundary crisp.)*

## Fork 3 — Exposure event: route through the telemetry sink (#1415), or its own event family?

**Why it's a fork:** the exposure is emitted exactly once per assignment and must land *somewhere*; routing
it through the telemetry sink vs minting a dedicated event family are mutually exclusive delivery paths. The
own-family branch is *flawed by precedent*: OpenFeature's **Tracking API is a separate section from
Evaluation** — the upstream standard itself splits "which arm they saw" (evaluation/exposure) from delivery,
treating the exposure as an emit-to-a-sink. A dedicated event family re-implements the telemetry sink #1415
is already preparing.

- **(a) Route through #1415's telemetry sink** *(recommended)*. The `experiment` intent *declares* the
  exposure (event name + variant payload from a controlled vocabulary); #1415's swappable sink *delivers*
  it. A named seam between two intents, not a merge of the items.
- **(b) A dedicated exposure-event family on the intent** *(Rejected — duplicates the sink)*. Re-models the
  emit-to-a-sink shape #1415 owns; diverges from OpenFeature's Tracking/Evaluation split.

**Recommended: (a).** *(~80%. Residual: timing/ordering guarantees — an exposure must fire before the arm's
effect is measured; whether that ordering needs a contract beyond #1415's emit is the residual.)*

---

## Supported by default (not decisions)

- **The binary feature-flag gate is already standardized.** `authority: feature-flag` on Access Control
  (we:src/_data/intents/access-control.json:23-31) on the Guard provider seam already covers
  "gate a route/subtree on a boolean flag." This decision does not re-home it; a boolean flag *is* that
  gate. Only multivariate variant assignment is new.
- **OpenFeature vocabulary is borrowed verbatim.** The resolution `{value, variant, reason}` and the
  `reason` enum (`STATIC | DEFAULT | TARGETING_MATCH | SPLIT | CACHED | DISABLED | …`) come from the CNCF
  upstream standard — standards-bodies-are-upstream, not competitors; WE coins nothing here.
- **Deterministic bucketing is impl behind the provider.** The `SHA256(salt + unit) % N` assignment is a
  provider implementation detail (Statsig/LaunchDarkly converge on it), never a UX value
  (intents-are-UX-only) and never a WE artifact beyond the provider contract (Impl-Is-Not-A-Standard).
- **The typed-flag distinction is settled.** boolean = the gate (access-control), string/object = the
  variant selector (the new `experiment` intent). This split is OpenFeature's, adopted as-is.
- **Targeting context** rides the evaluation provider's context parameter (mirrors the Guard predicate
  context); not a new UX surface.

## Context

**Classification (per-element pass, recorded).**
- *Binary gate* — Intent; **already shipped** (access-control authority kind); Guard protocol dimension;
  runtime-DI (the gate consults the Guard provider); most-permissive default. **Settled.**
- *Variant assignment* — Layer = **Intent** (declarative UX "render the assigned arm"); a **dimension**
  (N arms, all legitimate simultaneous end-states); expose the whole axis; **DI-injectable** (the running
  intent consults an evaluation provider — a real runtime-DI seam per #052/#081, not a build/devtools
  provider); most-permissive **default = the control/default arm** (OpenFeature `DEFAULT`); seam =
  variant → evaluation provider (resolution) ⊕ variant → telemetry (exposure, #1415).
- *Exposure event* — a telemetry emit-to-a-sink; composes with #1415; default no-op sink. **Supported by
  default + named seam.**
- *Deterministic bucketing* — impl behind the provider; excluded from UX. **Supported by default.**

**Blast radius.** New artifacts (at graduation, if ratified): one `experiment`/variant-assignment intent
under Web Intents; a distinct evaluation-provider contract reusing the Guard seam pattern
(we:src/_data/projects/webguards.json); a named seam to #1415 for the exposure event. No change to
we:src/_data/intents/access-control.json (the gate already covers the boolean case). No Technical
Configurator card for bucketing — it is provider impl, not a UX strategy the author selects.

**Seam to siblings.** #1415 (telemetry/analytics events) owns the emit-to-a-sink the exposure routes
through — *named seam, not merged* (the items have different declarative surfaces: "this element emits event
E" vs "this subtree renders the assigned arm"). Access Control owns the binary gate. The Guard protocol owns
the provider *seam pattern* the evaluation provider reuses.

**Follow-ups to file at resolution:** (1) author the chosen variant-assignment intent (per Fork 1) +
its provider contract (per Fork 2); (2) wire the exposure event to #1415's sink (per Fork 3); (3) a doc
note clarifying the boolean-gate-is-access-control / multivariate-is-experiment split so the two are not
re-conflated; (4) confirm the OpenFeature `reason`/`variant` vocabulary is referenced, not re-coined.
