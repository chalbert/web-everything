---
kind: decision
parent: "142"
status: open
locus: plateau-app
dateOpened: "2026-06-23"
preparedDate: "2026-06-23"
relatedTo: ["1645", "1647"]
crossRef: { url: /backlog/141-dev-browser-vision/, label: "#141 dev browser — natural home surface" }
tags: [dev-browser, variant-simulator, ai-generated, validation, decision]
---

# Variant simulator for locale, flag, role, viewport, motion

## Digest

This validates an AI-generated candidate from the [#142 pool](/backlog/142-ai-generated-dev-experience-feature-candidates/): a dev-browser control that flips the *live* app into any declared variant — locale, feature-flag, role, viewport, reduced-motion — at once, reading the app's *own* declared variant axes rather than a hand-maintained list of knobs. The decision is a one-sided go / no / not-yet validation gate, not a merit fork. This is the least substrate-dependent candidate in the family: the declared axes it drives **already exist** (webintl locale, #1414 flags, webpermissions roles, CSS/viewport, `prefers-reduced-motion`), it is local and zero-server, and it is directly demo-able against a flagship app today.

**Recommended verdict: go. Confidence: Medium-High.** The variant axes are already declared and introspectable, so this is a read-over-existing-state panel rather than new substrate — the cheapest, most demo-able member of the family, and a strong showcase of the self-describing moat.

## What you're deciding

Whether Web Everything commits to a **variant simulator** as a dev-browser feature, and if so on what trigger it becomes a build. Concretely the panel would:

- **Enumerate every declared variant axis** from the running app — locales (webintl), feature flags (#1414), roles/permission sets (webpermissions #009), viewport breakpoints, and `prefers-reduced-motion` — without an app-specific config.
- **Flip any combination at once** and re-render the live app under that composite variant (e.g. `fr-FR` + flag `new-checkout` ON + role `viewer` + mobile + reduced-motion), so the dev sees the exact cell of the variant matrix a user would.
- **Show the matrix coverage** — which combinations are declared/handled vs. unhandled — so missing variant handling surfaces as a gap, not a surprise in production.

## Why this isn't a classic fork (and is still a decision)

There is no contested either/or here — no rival "build shape A vs shape B" where one branch is flawed (the *fork-existence* test). It is a **one-sided validation gate** on an AI-generated idea: commit, defer-on-trigger, or drop. Per the user directive that is still a `decision` card — it resolves to a **go / no / not-yet verdict**, not a winning branch. The only genuine sub-question is the **trigger**, handled in the recommendation.

## Context & prior-art delta

The category is crowded; the delta is *driven by the app's own declared axes* vs. a manually-curated knob list:

| Prior art | What it shares | What it lacks (the WE delta) |
|---|---|---|
| **Storybook globals + viewport addon** | Toolbar to switch locale/theme/viewport per story | Knobs are author-maintained per story, scoped to an isolated component, not the running app's *declared* axes flipped together |
| **Chrome DevTools device toolbar + rendering emulation** | Emulates viewport, `prefers-reduced-motion`, `prefers-color-scheme` | Generic browser-level emulation; knows nothing of the app's locales, flags, or roles |
| **BrowserStack / Sauce Labs** | Real device/viewport matrix | Cross-device fan-out for QA; not a single live composite-variant flip from the app's own declarations |
| **i18n pseudo-localization (e.g. Lingui / FormatJS)** | Surfaces locale-handling gaps | One axis only (locale), and a build/lint mode, not a live multi-axis simulator |

The moat (per #142): a WE app **declares** its variant axes (webintl locales, #1414 flags, webpermissions roles), so the simulator enumerates and composes the *real* axes with zero app-specific wiring and can mark uncovered matrix cells — a thing none of the incumbents can do without that declared model underneath.

## Dependencies & lineage

- **Reads already-declared axes — minimal new substrate.** Locale from [webintl (#017)](/backlog/017-webintl-project-promotion/), flags from [#1414](/backlog/1414-feature-flags-experiments-declarative-gating-variant-assignm/), roles from [webpermissions (#009)](/backlog/009-gap-13-webpermissions-project/); viewport and reduced-motion are platform-native. This is what makes it far cheaper than the substrate-gated siblings.
- **Role/permission axis overlaps [#1645](/backlog/1645-permission-and-identity-simulator/)** (permission/identity simulator) — coordinate so the role axis is implemented once and this composes it, rather than two role-flippers.
- **Pairs with [#1647](/backlog/1647-named-seed-and-scenario-loader/)** (named seed/scenario loader) — a saved variant combination is effectively a named scenario; share the persistence shape.
- **Home:** `locus: plateau-app` — a dev-browser feature ([#141](/backlog/141-dev-browser-vision/)), local-first / zero-server per the cost-flat monetization rule.

## Recommendation

- **Verdict: go, Confidence Medium-High.** Unlike the substrate-dependent members of this family, every axis it drives is already declared and introspectable, it is local/zero-server, and it is the single most demo-able showcase of the self-describing moat — open a build story.
- **Un-gate trigger (concrete):** open the build story when the role axis from [#1645](/backlog/1645-permission-and-identity-simulator/) has a settled shape (so the simulator composes one role mechanism, not a duplicate) — locale/flag/viewport/motion can land first as a thinner v1 if #1645 lags. No external substrate is missing.
- **Skeptic:** "Storybook + DevTools already cover locale, viewport and motion — this is a rewrap." *Refuted on the delta, not on novelty:* those tools expose *author-curated* knobs over an isolated component or generic browser emulation; this enumerates the *running app's own declared axes* (locales, flags, roles) and composes them into one live variant cell, with matrix-coverage gaps surfaced — which is structurally impossible without the declared model none of those tools have. The residual the skeptic is right about is that the locale/viewport/motion axes are individually unremarkable; the *value is the at-once composite over declared axes*, hence a v1 can ship narrow.

*If you'd rather decide not-yet (gate on a flagship demand signal) or no (drop the candidate), say so — the verdict is the thing on the table.*
