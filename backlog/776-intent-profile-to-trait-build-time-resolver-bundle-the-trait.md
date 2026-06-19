---
type: idea
workItem: story
size: 5
status: resolved
locus: webeverything
dateOpened: "2026-06-16"
dateStarted: "2026-06-16"
dateResolved: "2026-06-16"
graduatedTo: webtraits/intentProfileResolver.ts
crossRef: { url: /backlog/747-design-system-equals-theme-plus-intents-bundle-manifest-catalog/, label: "Established while ratifying Fork 4 (#747)" }
tags: [intents, traits, technical-configurator, build-time, delivery, resolver]
---

# Intent profile to trait build-time resolver — bundle the traits the active intent profile implies

The principled indirect path established while ratifying #747-Fork-4: a design system never names a trait directly; instead its intent defaults reach traits through a resolver that maps the active intent profile to trait build-time inclusion/delivery. The concept is already stated (we:block-pages.njk:85 'only the traits matching the active intent profile are bundled'; we:router.njk:896 'Loader Intent selects the loading UX trait') but no resolver exists as code. Keeps intents UX-only (no impl refs — ratified) and traits technical: the mapping lives in a Technical-Configurator-style resolver layer, not in the intent or the trait.

Scope: build-time inclusion/delivery (which traits ship, eager/lazy); runtime activation gates (inert/visibility) stay DOM-driven.

## Progress (resolved 2026-06-16) — locus: webeverything

**Placement (set this turn):** built **WE-resident**, not in plateau-app. #747 carved this as "its own mechanic → #776" but left the home open; the loader inferred plateau-app from the `technical-configurator` tag. On merit the resolver is **standard logic**: a pure, deterministic function over the WE registries (the `intentDimension` keys traits already declare in `fui:blocks.json`, + intents), the same shape as this batch's `we:webcases/requirementValidator.ts`. The Plateau Technical Configurator and the FUI build are *consumers* of it, not its home (standard logic → WE, lowest lock-in; "Technical-Configurator-**style**" describes the resolver pattern, not the repo). Set `locus: webeverything`.

- New [`we:webtraits/intentProfileResolver.ts`](../webtraits/intentProfileResolver.ts) (pure, dependency-free):
  - `IntentProfile` = `"<intent>.<dimension>"` → chosen value (UX-only values, no impl refs).
  - `resolveTraits(profile, candidates)` — a trait with an `intentDimension` (`"<intent>.<dimension>.<value>"`, e.g. `type-ahead.matching.prefix`) bundles iff the profile selects that exact value; a `null` `intentDimension` is **unconditional** (always bundled). `splitIntentDimension` splits on the **last** dot (intent ids carry hyphens, not dots). Each result is labelled `unconditional` / `profile-match`.
  - Delivery defaults to **lazy** (keep the eager bundle small — perf-first, most-flexible default); explicit `eager` honored. `bundlePlan()` returns the `{ eager, lazy }` buckets a bundler consumes.
- Scope held to **build-time inclusion + delivery** per the card; runtime activation gates stay DOM-driven (out of scope).
- Tests: [`we:webtraits/__tests__/intentProfileResolver.test.ts`](../webtraits/__tests__/intentProfileResolver.test.ts) (7/7) against the real `fui:blocks.json` trait-key shape; added `webtraits/**` to `we:vitest.config.ts`. `tsc --noEmit` + `check:standards` clean.
