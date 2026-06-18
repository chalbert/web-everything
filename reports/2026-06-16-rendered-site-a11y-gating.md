# Rendered-site a11y/UX gating — tool, harness, posture, and route-set choices

**Date**: 2026-06-16
**Point**: Prep research for decision #763. The repo already has a Playwright integration lane (`test:integration`, `we:playwright.config.ts`) whose `webServer` reuses the running dev servers — so "axe over the built sites" is not new infra, it's `@axe-core/playwright` added to the existing project. That collapses the fork's biggest worried cost and reshapes A/B/C into one genuine tool call + a posture/route-set sub-decision, with the static lint and DoD checklist demoted to "supported by default."
**Research page**: `/research/rendered-site-a11y-gating/`
---

## Question

`check:standards` validates spec/data/backlog consistency and **skips the 11ty build**, so rendered-site a11y/UX regressions (missing nav current-page state, contrast, focus order) stay green-invisible — #762 (no `aria-current` on either site nav, shipped silently) is the worked example. How should WE gate UI best-practices when the FUI (`:3001`) and WE-docs (`:8080`) sites change?

## Recommendation (to ratify in #763)

1. **Tool — `@axe-core/playwright`** into the existing Playwright project. axe-core is the embeddable WCAG rule engine; the `AxeBuilder` API scopes by `.include()/.exclude()` and filters by `.withTags(['wcag2a','wcag2aa','wcag21a','wcag21aa'])`. It reuses the repo's already-wired Playwright harness (zero new server/runner), unlike pa11y-ci (standalone CLI + its own URL config) or Lighthouse CI (broader perf+SEO+a11y, but coarser a11y coverage — a single score, not per-rule WCAG).
2. **Posture — warn→enforce ratchet.** Start advisory over a small curated route set, then flip to build-blocking once green; don't hard-fail every page on day one. Same warn-only-then-enforce shape as research-freshness (#477).
3. **Route set — a hand-maintained allowlist, mirrored per-repo.** Mirror the existing §9 Vite-proxy-allowlist precedent in `we:check-standards.mjs`: an explicit, reviewed list of gated URLs. Each repo (WE-docs, FUI) runs its own copy — same dogfood/duplication pattern as the Spec Explorer dev panel.
4. **Supported by default (not forks):** a cheap **static template lint** in `check:standards` for the structural rules axe can't assert without a browser (nav links missing `aria-current` wiring, etc.), **and** a **DoD "website-change" checklist** folded into both repos. Both complement the axe gate; neither competes with it — the item itself notes "A and B are not mutually exclusive."

## Key findings

- **Three tool families, distinct jobs.**
  - **axe-core** — the rule engine. Embeds via `@axe-core/playwright` (AxeBuilder), `@axe-core/cli`, or `jest-axe`. WCAG-tag-scoped, per-rule violations, fail-build on any. Best for "accessibility inside the existing test suite."
  - **Pa11y / pa11y-ci** — CLI wrapper (runs axe-core and/or HTML_CodeSniffer) with a native `.pa11yci` JSON listing `urls[]` — the "route-list" model baked in. Pa11y 9.1 (2026) bundles axe-core 4.11. Standalone harness; a second runner to maintain.
  - **Lighthouse CI** — broadest (performance + best-practices + SEO + a11y), score-gate model (`0.9+` as a deploy blocker), GitHub Action. Its a11y is a coarse aggregate score, not the per-rule WCAG signal axe gives — good supplement, weak primary a11y gate.
- **The harness cost the item worried about is already paid.** `we:playwright.config.ts` `webServer` boots `npm run dev` (Vite :3000 proxying `/backlog/` etc. to 11ty :8080) and **reuses an already-running instance locally** (never killing the user's server). So axe can hit the *served* WE-docs pages with no separate "build the site" step — the exact step `check:standards` skips. FUI `:3001` is a separate server in the `frontierui` repo, hence the per-repo mirror.
- **`check:standards` proper can't be the rendered-site gate** — it deliberately skips the 11ty build and runs no browser (the known gotcha). It can host the *static* template lint (option A: a fast structural rule over `src/*.njk`), but the real rendered coverage (contrast, focus order, computed current-state) must live in the Playwright/integration lane.
- **Route-set maintenance is the live sub-question, not the tool.** Hand-maintained allowlist (explicit, reviewed, matches the §9 proxy-allowlist precedent at `we:check-standards.mjs:716`) vs auto-derived from the 11ty collection / sitemap (self-maintaining but scans churn-y pages). Auto-derive is a nice-to-have build, not the day-one shape.
- **Reference design systems dogfood + gate.** GOV.UK, Carbon, Fluent, Material all run automated a11y over their own component sites in CI — the same dogfood posture #762's fix already takes (use the repo's own `nav-list` spec).

## Files created/modified

| File | Action |
| --- | --- |
| `we:reports/2026-06-16-rendered-site-a11y-gating.md` | created (this report) |
| `we:src/_data/researchTopics.json` | added `rendered-site-a11y-gating` entry |
| `we:src/_includes/research-descriptions/rendered-site-a11y-gating.njk` | created (write-up) |
| `we:backlog/763-gate-ui-best-practices-on-website-changes-rendered-site-a11y.md` | rewritten to prepared-fork shape; `preparedDate` set |

## Sources

- [Playwright — Accessibility testing](https://playwright.dev/docs/accessibility-testing)
- [Automated Accessibility Testing with axe-core, Playwright & GitHub Actions (rishikc)](https://rishikc.com/articles/accessibility-testing-ci-integration/)
- [Accessibility Testing Automation — axe, Pa11y, Lighthouse CI (Accesify)](https://www.accesify.io/blog/accessibility-testing-automation-axe-pa11y-lighthouse-ci/)
- [Practical Accessibility Testing with Pa11y & axe-core (Ramotion)](https://www.ramotion.com/blog/practical-accessibility-testing-with-pa11y-and-axe-core/)
- [Playwright Accessibility Testing: Fast CI Automation Guide (TestDino)](https://testdino.com/blog/playwright-accessibility)
- [GOV.UK Design System](https://design-system.service.gov.uk/) · [WAI-ARIA APG](https://www.w3.org/WAI/ARIA/apg/)
