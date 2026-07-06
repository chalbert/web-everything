---
kind: story
size: 5
relatedTo: ["2095"]
status: parked
parkedReason: maturityGated
maturityTrigger: "adoptionSignal: a named dynamic-host consumer (plugin host / user-dashboard / multi-tenant) that must register intents at runtime"
dateOpened: "2026-06-28"
dateStarted: "2026-06-29"
preparedDate: "2026-06-29"
relatedReport: reports/2026-06-28-app-authored-custom-intents-meta-schema-registry.md
relatedProject: webintents
tags: [intents, custom-intents, runtime-registration, demand-gated, accepted-on-merit, dissolved]
---

# Runtime register-API for custom intents (demand-gated)

> **DISSOLVED → accepted on merit** (batch-confirmed per [#2095](/backlog/2095-apply-the-2092-merit-conceded-dissolve-test-to-the-ten-142-v/), applying the [#2092](/backlog/2092-validation-gate-not-yet-verdicts-vs-the-not-a-prioritization/) merit-conceded dissolve test). The merit is **conceded** — the shape is ratified upstream (#1913 + CSS `@property`); no design choice remains, only timing — so this is **no longer an open go/no/not-yet decision**; it is an accepted build gated on its trigger. **Trigger:** a named dynamic-host consumer appears (a plugin host / user-dashboard / multi-tenant app that must register intents at runtime) — parked `maturityGated` until then (its upstream #1930 is already resolved). Everything below is retained as the **settled** merit rationale (the concession), not an open question.

Demand-gated follow-up from #1913 ([custom-intents-namespace-by-ownership](../docs/agent/platform-decisions.md)):
a **runtime** register-API for custom intents, *vs* the ratified **build-time declarative manifest** (the
`src/_data/intents/`-style glob). This is a **validation gate** — a one-sided go/no-go on *when* to build,
not a design fork (the shape is already ratified: mirror CSS `@property`, declarative-first + runtime hatch).

## Digest + verdict — **NOT-YET (do not build)**

The build-time declarative seam ratified in #1913 (manifest glob → `owner:intent` namespacing → resolver)
covers every consumer that exists today. A runtime `registerIntent()` API is the **escape hatch** for a
genuinely dynamic host, and the platform's own canonical declarative+hatch pair reserves that hatch for a
real dynamic need — so it stays **gated, not built**, until a named such consumer appears.

## Prior-art delta (rides #1913's published survey — [/research/app-authored-custom-intents-meta-schema-registry/](/research/app-authored-custom-intents-meta-schema-registry/))

#1913 already surveyed 7 extensible-vocabulary systems; this gate adds one focused delta on the
**declarative-first + runtime-hatch** shape #1913 named as the model:

- **CSS `@property` ⟷ `CSS.registerProperty()` is the exact precedent.** The declarative `@property` at-rule
  is the preferred form (parsed with the stylesheet, no JS, no render-block); `CSS.registerProperty()` is
  documented as a runtime escape hatch **"used only when you need to register properties dynamically at
  runtime — e.g. based on user preferences or A/B test configuration"** (MDN). The hatch is **not** a default;
  it exists for the dynamic case the declarative form structurally cannot express. WE's build-time manifest is
  the `@property` analogue; this register-API is the `registerProperty()` analogue — and inherits the same
  "only when genuinely dynamic" reservation.
- **The mirror is structural, not just by analogy.** The intent catalog loads through a *pure build-time
  function* — the glob assembly ([we:scripts/lib/intents-loader.cjs:17](../scripts/lib/intents-loader.cjs)
  `readdirSync`) feeding the resolver ([we:webtraits/intentProfileResolver.ts:57](../webtraits/intentProfileResolver.ts)
  `resolveTraits`/`bundlePlan`), which today has **no runtime registration seam at all**. A register-API is a
  *new runtime substrate*, not a parameter on the existing one.
- **No delta in demand since #1913 (2026-06-28).** No plugin host, user-authored dashboard, or live
  multi-tenant surface that mints intents *after* build has been named. The build-time glob serves every
  current product (the FUI/product manifest loader #1930 — itself still blocked on the substrate #1948 — is
  the build-time seam; nothing downstream needs runtime minting).

## Why this is a gate, not a fork

The **mechanism is already ratified** (#1913 Placement clause: "manifest glob-loader + runtime register-API →
FUI/product (register-API demand-gated follow-up)"; this card's own brief: "shape to follow CSS `@property`").
So there is no *which-design* either/or to prepare — both "declarative manifest" and "runtime hatch" are
end-state-supported (support-both, exactly like `@property`/`registerProperty` coexist). The only live
question is the one-sided **build-it-now vs not** call, gated on real demand. That is the validation-gate
archetype, not a `## Fork N`.

## Un-gate trigger (concrete)

Build **iff** a named consumer genuinely cannot use the build-time glob — specifically one that mints or
ingests intent definitions **after** its build step:

- a **plugin host** that loads third-party intent packs at runtime,
- a **user-authored dashboard** where end-users define their own intents live, or
- a **live multi-tenant surface** whose per-tenant intent set is not known at build time.

Until such a consumer is *named* (not hypothesized), the gate stays closed. When one appears, the build
re-opens with the shape already fixed: a `registerIntent(owner, def)` runtime API that feeds the **same**
resolver/validate path as the manifest (so `owner:intent` namespacing, `mustUnderstand`, and additive
`extends` rules from #1913 apply unchanged), in **FUI/product** (WE holds zero implementation, #1282).

## Skeptic (merit)

`Skeptic:` SURVIVES (not-yet). **Attack (0 — classification):** is this really a gate, or a disguised fork
on the API shape? *Answer:* the shape is ratified upstream (#1913 + the CSS `@property` mandate), so no design
choice remains — only timing; it is correctly a validation gate. **Attack (1 — merit, "build it now so the
seam is ready"):** speculative-generality — building an unused runtime substrate now incurs maintenance + a
public API surface with **zero** consumer to validate it against, and risks freezing a shape before a real
host reveals its needs; the `@property`/`registerProperty` precedent is explicit that the hatch waits for the
dynamic case. **Attack (#1620 soft-park guard):** this is *not* a bare "do we need this, on what trigger" —
it carries a verdict (not-yet), a grounded prior-art delta (the `@property` hatch reservation), and a
*concrete, named-consumer* un-gate trigger. Verdict holds: **do not build; revisit on a named dynamic-host
consumer.**

## Blocked-by

- **#1930** (FUI/product manifest glob-loader) — the build-time seam this would be the runtime counterpart to;
  itself blocked on the FUI intent-resolution substrate **#1948**. The runtime hatch is only meaningful once
  the declarative substrate exists, so this stays `blockedBy: ["1930"]` in addition to demand-gated.

## Sources

- MDN — CSS `registerProperty()` (runtime hatch, dynamic-only): https://developer.mozilla.org/en-US/docs/Web/API/CSS/registerProperty_static
- MDN — Registering custom properties / `@property` (declarative-first): https://developer.mozilla.org/en-US/docs/Web/CSS/Guides/Properties_and_values_API/Registering_properties
- #1913 prior-art survey (7 systems): we:reports/2026-06-28-app-authored-custom-intents-meta-schema-registry.md
