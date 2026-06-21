# Feature flags & experiments — declarative gating + variant assignment standard: PLACEMENT (decision-prep grounding)

**Item:** [#1414](../backlog/1414-feature-flags-experiments-declarative-gating-variant-assignm.md) ·
**Date:** 2026-06-21 · **Status:** prep only (no ruling) ·
**Research topic:** `/research/feature-flag-gating-variant-assignment/`

Surfaced by the app-infrastructure cross-cutting lens (#1402): nearly every non-trivial app ships
**feature flags** (gate a route/subtree/behavior on a runtime-evaluated flag) and **experiments / A-B
variant assignment** (deterministically bucket a user, render the assigned variant, emit an exposure
event), and the item asks where this lands in the WE constellation.

The headline of this prep: **a web survey of the upstream standard (OpenFeature/CNCF) plus the incumbent
providers, traced against the real WE tree, RESHAPES the item's own framing.** The item proposes "a
`feature-flag` intent vs fold into `access-control` vs a pure provider." But the binary-gate half is
**already standardized** in WE — access-control declares `feature-flag` as a first-class *authority kind*
on the Guard provider seam (we:src/_data/intents/access-control.json:24-30). The genuinely *unhomed*
concept is the part access-control's allow/deny gate cannot express: **multivariate variant assignment** (a
flag that resolves to one of N variants, not allow/deny) and its **exposure event**. So the real decision
is not "where does the gate go" (answered) but "is variant-assignment a *third surface* on the existing
access-control intent, or a separate `experiment`/`variant` intent, and where does the exposure event
sit relative to the telemetry seam (#1415)."

---

## 1. Prior-art web survey (the convergent shape + upstream vocabulary)

### OpenFeature (CNCF Incubating — the key upstream standard, treat as upstream, not a competitor)
- **Status:** accepted to CNCF 2022-06, Incubating since 2023-11; spec ~v0.8 in early 2026; backed by
  LaunchDarkly, GitLab, Split, Dynatrace, et al. This is *the* vendor-neutral standard for flag
  evaluation — WE aligns to it, borrows its vocabulary, and does not re-invent it.
  (https://openfeature.dev/specification/)
- **Resolution structure** — a flag evaluation returns `{ value, variant, reason, errorCode }`. `value` is
  the typed result; **`variant`** is the standardized name of which arm was returned; **`reason`** is a
  standardized enum: `STATIC | DEFAULT | TARGETING_MATCH | SPLIT | CACHED | DISABLED | UNKNOWN | STALE |
  ERROR`. (https://openfeature.dev/specification/sections/flag-evaluation/,
  https://openfeature.dev/specification/types/)
- **Typed flags** — boolean / string / number / object. A *boolean* flag is the binary gate; a *string /
  object* flag is the multivariate variant selector. **This is the load-bearing distinction for WE:** the
  binary case is the access-control gate; the multivariate case is the new surface.
- **Provider abstraction** — a `provider` resolves flag values from a source of truth, registered in a
  **global singleton** with init/evaluate/shutdown lifecycle, bindable per logical *domain*. The running
  app **consults** the provider on every evaluation. This is a genuine runtime-DI seam (contrast #1415's
  telemetry sink, also runtime-DI). (https://openfeature.dev/specification/sections/providers/)
- **Evaluation context** — arbitrary contextual data (user id, locale, etc.) is the basis for targeting;
  passed into each evaluation. (mirrors the predicate-context the Guard provider already takes.)
- **Tracking API (separate section)** — *"associate flag evaluations with subsequent actions … to
  facilitate experimentation."* A `track(eventName, context, details)` function records "what the user
  did"; the exposure ("which variation they saw") comes from the *evaluation*, the conversion comes from
  *tracking*. **Tracking is a distinct API from evaluation in the spec itself** — this is the upstream's own
  ratification of the flag↔telemetry seam (#1415): exposure *composes with* an emit-to-a-sink, it is not
  folded into the gate. (https://openfeature.dev/specification/sections/tracking/)

### Incumbent providers (the model is convergent; WE keeps them swappable behind one seam)
- **LaunchDarkly** — flag variations *are* the experiment arms; an experiment is layered on a flag. The SDK
  sends a *feature event* (the exposure) on evaluation; deterministic bucketing via a per-flag **salt**.
  (https://launchdarkly.com/docs/home/experimentation/events)
- **Statsig** — `getExperiment()` returns a standalone entity; evaluation is **deterministic** (same user +
  same config ⇒ same arm on any platform). Bucketing = `SHA256(salt + unitId) % 10000`.
  (https://docs.statsig.com/sdks/how-evaluation-works)
- **Unleash** — *activation strategies* (gradual rollout %, userId, IP, host, custom constraints), stackable.
- **GrowthBook** — open-source flags + experiments + analytics; *Safe Rollout* (10→25→50→75→100 ramp) on
  the same statistical engine as experiments. (https://www.growthbook.io/products/feature-flags)
- **Flagsmith** — flags + remote config + multivariate testing.

**Convergent shape extracted:** a *declarative gate/selector* (boolean = gate, string/object = variant) →
a *swappable evaluation provider* (the lock is the provider contract, the impl is escapable) → a
*resolution* `{value, variant, reason}` → a *separate exposure/tracking event* feeding analytics.
Deterministic bucketing (hash-of-salt+unit) is an **impl detail behind the provider** — never UX.

**How the survey reshaped the forks:** the item framed three placements for *the gate*. The survey shows
(a) the gate is the boolean case and is **already homed** on access-control's authority-kind seam, so
"a new feature-flag intent for the gate" and "fold the gate into access-control" both dissolve — the gate
is done; and (b) OpenFeature's own *typed* flags + *separate tracking API* expose the real seams: the
**multivariate variant selector** is the new surface, and the **exposure event** is a telemetry compose,
not new gate machinery. The decision narrows to: where does *variant assignment* live, and is the *provider*
the same Guard provider or a new one.

---

## 2. Per-fork classification (7-question sequence, recorded)

Run for each candidate element.

### Element A — the binary feature-flag GATE (gate a route/subtree on a boolean flag)
1. **Layer** — Intent; **already exists** as `authority: feature-flag` on access-control
   (we:src/_data/intents/access-control.json:24-30), evaluated on the Guard provider seam.
2. **Protocol vs intent dim** — intent dimension (an `authority` value), on the Guard *protocol*.
3. **Expose whole axis** — already exposed (authority is an open set).
4. **Fixed vs dimension** — settled dimension.
5. **DI-injectable** — yes; the running gate consults the Guard provider (a real runtime-DI seam, #052/#081).
6. **Default** — most-permissive (deny defaults conservative per access-control's trust boundary).
7. **Seam** — gate → Guard provider. **No new fork. Settled by default (already standardized).**

### Element B — multivariate VARIANT ASSIGNMENT (resolve a flag to one of N variants, render the arm)
1. **Layer** — Intent (declarative UX "render the assigned arm"). The *bucketing* is impl (provider); the
   *render-the-assigned-variant* is UX.
2. **Protocol vs intent dim** — could be a new `experiment`/`variant` intent **or** a third `surface` value
   on access-control. This is the live placement fork (Fork 1).
3. **Expose whole axis** — yes; N arms are all legitimate simultaneous end-states.
4. **Fixed vs dimension** — dimension (the arm set is open).
5. **DI-injectable** — yes; resolution consults an evaluation provider — **same shape as the Guard
   provider**, question is whether it's the *same* provider (Fork 2).
6. **Default** — most-permissive → the control/default arm when unresolved (mirrors OpenFeature `DEFAULT`).
7. **Seam** — variant intent → evaluation provider (resolution), and → telemetry exposure (Fork 3 / #1415).

### Element C — the EXPOSURE EVENT (emit "user saw arm X")
1. **Layer** — an *event* on the variant intent, routed to a sink — **the telemetry emit-to-a-sink shape**.
2. **Protocol vs intent dim** — composes with #1415's telemetry sink; not new machinery.
3-7. **DI-injectable** yes (the sink), **default** no-op sink, **seam** = variant→telemetry. OpenFeature's
   *separate tracking API* is the upstream precedent for keeping this a compose, not folding it into the
   gate. **Supported by default + a named seam to #1415, not a fork.**

### Element D — DETERMINISTIC BUCKETING (hash salt+unit → arm)
Pure impl behind the provider (intents-are-UX-only; "Impl Is Not A Standard"). Never an intent value, never
a WE artifact beyond the provider contract. **Supported by default (excluded from UX).**

---

## 3. The prepared fork shape (no ruling — defaults are recommendations)

Three genuine forks survive the fork-existence test; the rest are settled-by-default.

- **Fork 1 — Home for variant assignment: a new `experiment`/`variant` intent, OR a third `surface` on
  access-control, OR no intent (pure provider).** Genuine: the binary gate and the N-way selector cannot
  share one *deny-outcome* model (allow/deny ≠ pick-one-of-N), and "no intent" is the broken branch
  (the render-the-assigned-arm decision is UX an author declares — a pure provider gives nothing to
  declare against). **Recommended (a): a separate `experiment` intent.** (~75%)
- **Fork 2 — Same Guard provider, or a distinct evaluation provider?** Genuine: one provider returning
  either a deny-verdict *or* a variant cannot keep access-control's server-authoritative *trust boundary*
  (a flag arm is not a security verdict; conflating them risks a client gate masquerading as authz).
  **Recommended (a): a distinct evaluation provider** that reuses the Guard provider's *seam pattern*
  (native-first → project → custom) but not the same instance. (~70%)
- **Fork 3 — Exposure event: its own event family, or routed through the telemetry sink (#1415)?**
  Genuine-but-leaning-settled: OpenFeature splits tracking from evaluation, so the exposure is a telemetry
  emit. **Recommended (a): route through #1415's sink** as a named seam; the variant intent *declares* the
  exposure, telemetry *delivers* it. (~80%)

**Settled by default (not forks):** the binary gate (Element A, already on access-control); deterministic
bucketing (Element D, impl behind provider); the typed-flag distinction (borrowed from OpenFeature);
the OpenFeature `reason`/`variant` vocabulary (borrow verbatim).

---

## 4. relatedProject

`webintents` — intents have no per-file `relatedProject`; the catalog is owned by the **Web Intents**
project (we:src/_data/projects/webintents.json:2-5, *"Declarative profiles for application-wide UX/UI
behavior"*), and the sibling prepared decision #1337 uses `relatedProject: webintents`. This is an
intent-placement decision, so `webintents` is correct. The *provider seam* it composes lives in
**Web Guards** (we:src/_data/projects/webguards.json:4), cited but not the owning project of the decision.

## 5. Residual for the deciding agent's skeptic pass
- Fork 1's "separate intent vs third access-control surface" is the genuine call — a skeptic should test
  whether a `surface: variant` on access-control could carry the N-way resolution without breaking the
  deny-outcome family (the report argues it cannot, ~75%).
- Fork 2's distinct-provider claim rests on the trust-boundary argument; a skeptic should weigh
  operational simplicity (one provider) against the boundary risk.
