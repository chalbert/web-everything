---
type: decision
workItem: task
status: resolved
dateOpened: "2026-06-16"
dateStarted: "2026-06-16"
dateResolved: "2026-06-16"
graduatedTo: none
codifiedIn: "one-off"
relatedReport: reports/2026-06-16-rendered-site-a11y-gating.md
preparedDate: "2026-06-16"
tags: [a11y, ci-gate, axe-core, playwright, devtools, decision]
---

# Gate UI best practices on website changes (rendered-site a11y/UX gate)

**Grounding (✓ ready to ratify):** no gate existed yet for rendered-site a11y/UX. `check:standards` validates spec/data/backlog invariants and **skips the 11ty build** (runs no browser — `we:scripts/check-standards.mjs`), so rendered regressions stay green — [#762](/backlog/762-site-navs-lack-a-current-page-active-state-fui-header-we-doc/) (neither site nav carries `aria-current`, shipped silently) is the worked example. Surveyed the a11y-gating prior art (axe-core / pa11y-ci / Lighthouse CI, route-list patterns, WCAG-tag scoping) and published [/research/rendered-site-a11y-gating/](/research/rendered-site-a11y-gating/) (report: `we:reports/2026-06-16-rendered-site-a11y-gating.md`). **The survey reshaped the fork:** the repo *already* has a Playwright integration lane that reuses the running dev servers, so "axe over the built sites" is not new infra — that collapses the original A/B/C three-way (A static-lint and C DoD-checklist **coexist** with axe, they don't rival it) into **one genuine tool call + two sub-decisions** (posture, route set), each with a **bold** default below.

## The axis

The concern decomposes into three orthogonal axes the research surfaced — **tool** (which engine observes the rendered page), **posture** (does a failure block the build, and from when), and **route set** (which URLs are gated, and how the list stays current) — over a fixed substrate that already exists in the tree:

- **The gate today** has no a11y rule and skips the build: `we:scripts/check-standards.mjs` — its closest "route-list" precedent is the §9 Vite-proxy-allowlist cross-check at `we:scripts/check-standards.mjs:716`.
- **A Playwright lane already exists and reuses the running servers:** `we:playwright.config.ts` `webServer` boots `npm run dev` (Vite `:3000` proxying `/backlog/` → 11ty `:8080`) with `reuseExistingServer`, and `@playwright/test` is already a devDep (`we:playwright.config.ts:21-41`). `test:integration` = `playwright test`. **No `@axe-core/playwright` dep yet** — adding it is the whole new surface.
- **The two rendered sites live in different repos:** WE-docs `:8080` (this repo, `we:src/_layouts/base.njk`) and FUI `:3001` (`frontierui`, its own server) — so a gate in this repo natively covers only WE-docs; FUI needs a mirrored copy (the Spec-Explorer-dev-panel-duplicated pattern).
- **The present instance** [#762](/backlog/762-site-navs-lack-a-current-page-active-state-fui-header-we-doc/) fixes the live miss; this item decides the gate that prevents recurrence.

### Recommended path at a glance

| Fork | Recommended default | Main alternative | Confidence |
| --- | --- | --- | --- |
| 1 — gating tool | **`@axe-core/playwright` in the existing lane** | pa11y-ci · Lighthouse CI | High |
| 2 — blocking posture | **warn → enforce ratchet** | hard-fail day one · CI-only advisory | Med-high |
| 3 — route set & scope | **hand-maintained allowlist, mirrored per-repo** | auto-derive from 11ty collection/sitemap | Med |

**Supported by default (not decisions):** a cheap **static template lint** in `check:standards` for the structural rules axe can't assert headless (nav links missing `aria-current` wiring, etc.), **and** a **DoD "website-change" checklist** folded into both repos. Per the fork-existence test these *coexist* with the axe gate — the item's own original note said "A and B are not mutually exclusive" — so they ship alongside the call below rather than competing with it. Classification: this is a **devtools quality gate** (kin to `check:standards`), not a Block/Intent/Protocol/Capability — zero consumer lock-in, and no protocol is minted (axe-core *is* the WCAG engine, consumed not re-specified).

## Fork 1 — the gating tool

**Crux:** which engine observes the rendered pages for the real gate (contrast, focus order, names, computed current-state) — the coverage `check:standards` structurally can't provide (`we:scripts/check-standards.mjs` skips the build + runs no browser).

- **A — `@axe-core/playwright` into the existing Playwright project.** axe-core is the embeddable WCAG rule engine; `AxeBuilder` scopes by `.include()/.exclude()` and filters by `.withTags(['wcag2a','wcag2aa','wcag21a','wcag21aa'])`, failing on any violation. Reuses the already-wired harness (`we:playwright.config.ts` reuses the running dev server) — one new devDep + spec files + a route list, no new server/runner.
- **B — pa11y-ci (standalone).** CLI wrapping axe-core (+ HTML_CodeSniffer) with a native `.pa11yci` `urls[]` route-list. *Rejected* — a second harness to install and maintain next to Playwright, for no coverage the axe-via-Playwright path lacks (pa11y runs the same axe engine).
- **C — Lighthouse CI.** Broad audit (perf + best-practices + SEO + a11y), score-gate model. *Rejected as the primary a11y gate* — its a11y is a coarse aggregate score, not per-rule WCAG; a fine *supplement* later, not the rendered-site a11y gate.

**Default: A — `@axe-core/playwright` in the existing lane.** It is the embeddable WCAG engine dropped into infrastructure the repo already runs.

## Fork 2 — blocking posture

**Crux:** does a violation block the build, and from when — the most-permissive-default question for a gate (don't turn the whole site red on day one).

- **A — warn → enforce ratchet.** Advisory over a curated route set first, flip to build-blocking once green. Mirrors the warn-only-then-enforce shape of research-freshness ([#477](/backlog/477-research-freshness-staleness-derivation-warn-only-check-read/)).
- **B — hard-fail from day one.** *Rejected* — would red-gate every pre-existing violation across both sites at once, blocking unrelated work; the most-restrictive default, against the most-permissive-default principle.
- **C — CI-only advisory, never blocking.** *Rejected as the end-state* — no enforcement means the same silent-regression failure mode #762 demonstrates; acceptable only as the *first rung* of the ratchet, which A already includes.

**Default: A — warn → enforce ratchet.** Start advisory, tighten by opt-in; the restriction is earned, not imposed.

## Fork 3 — route set & scope

**Crux:** which URLs are gated, how the list stays current, and how the two-repo split (WE-docs `:8080` here, FUI `:3001` in `frontierui`) is covered.

- **A — hand-maintained allowlist, mirrored per-repo.** An explicit, reviewed list of gated URLs, one copy per repo. Matches the existing §9 Vite-proxy-allowlist precedent (`we:scripts/check-standards.mjs:716`) and the duplicated-dev-panel pattern; a new page is gated only when added (a known, reviewable seam).
- **B — auto-derive from the 11ty collection / sitemap.** Self-maintaining (every published page gated automatically), but scans churn-y/in-progress pages and couples the gate to the build graph. *Rejected as day-one shape* — a genuine nice-to-have, filed as a follow-up build, not the first cut.

**Default: A — hand-maintained allowlist, mirrored per-repo.** Explicit and reviewable, matching the gate's existing route-list precedent; auto-derivation is a later enhancement on its own backlog item.

## Ruling (2026-06-16)

- **Fork 1 → A — `@axe-core/playwright` in the existing lane.** Confirmed. axe-core *is* the WCAG engine; the Playwright harness already reuses the running dev servers (`we:playwright.config.ts:24-41`, verified) and `@playwright/test` is already a devDep — so this is one new devDep + spec files + a route list, no new runner. pa11y (same axe engine, second harness) and Lighthouse (coarse aggregate a11y score, not per-rule WCAG) both lose on merit, not as live forks.
- **Fork 2 → A — warn → enforce ratchet.** Confirmed. Most-permissive default: advisory over a curated route set, flip to build-blocking once green (the #477 research-freshness shape). Hard-fail day one (most-restrictive) and CI-only-forever (reproduces #762's silent-regression failure) both rejected; C is the ratchet's first rung, not a rival.
- **Fork 3 → A — hand-maintained allowlist, mirrored per-repo.** Confirmed. Explicit reviewed URL list, one copy per repo (WE-docs `:8080` here, FUI `:3001` in `frontierui`), matching the §9 Vite-proxy-allowlist route-list precedent (`we:scripts/check-standards.mjs:715`, verified) and the duplicated-dev-panel pattern. Auto-derive-from-sitemap deferred to its own follow-up.
- **Supported, not decided (ship alongside):** a static template lint in `check:standards` for structural rules axe can't assert headless (e.g. nav `aria-current` wiring — the #762 instance) **and** a DoD "website-change" checklist in both repos. Per the fork-existence test these coexist with the axe gate.
- **Classification:** devtools quality gate (kin to `check:standards`); zero consumer lock-in, no protocol minted (axe-core *is* the WCAG engine, consumed not re-specified) — graduatedTo: none.
- **End-goal alignment (user, 2026-06-16):** the website is to be reworked to render only the constellation's own components (dogfooding FUI in WE-docs's own chrome). This gate is forward-aligned and *strengthens* under that goal — once the site renders own components, a rendered a11y violation **is** a component-conformance failure, making the rendered-DOM coverage (which static lint can't give) the proof the dogfooding is WCAG-clean. The dogfood rework itself is gated on the #765 boundary-relaxation decision and is tracked as its own epic; this gate does not depend on it (axe over rendered DOM is agnostic to what produced the DOM).

## Notes

- On ratification, graduate to builds via a `blockedBy` chain: the axe lane + route list (this repo), the mirrored FUI gate (`frontierui`), the static template lint in `check:standards`, and the DoD-checklist edits to both repos' Definition of Done. The auto-derive route source (Fork 3 alt) files as a separately-prioritized follow-up.
- Pairs with [#762](/backlog/762-site-navs-lack-a-current-page-active-state-fui-header-we-doc/) (the present instance to fix, ships now and independently); this item decides the gate that prevents recurrence.
