---
kind: decision
status: resolved
codifiedIn: docs/agent/platform-decisions.md#constellation-placement
dateOpened: "2026-06-16"
dateStarted: "2026-06-17"
dateResolved: "2026-06-17"
graduatedTo: none
preparedDate: "2026-06-16"
parent: "800"
relatedReport: reports/2026-06-16-rendered-site-regression-tooling-home.md
tags: []
---

# Where does rendered-site regression tooling home — WE specs vs a plateau-hosted service?

**Prepared 2026-06-16.** No design existed; the two forks below are grounded in a prior-art survey
published as the `/research/` topic
[`rendered-site-regression-tooling-home`](/research/rendered-site-regression-tooling-home/) (session
report linked via `relatedReport`), each carrying a **bold** recommended default. The binary in the
title **dissolves** under the standing test — the real call is *who owns the gate signal* and *how the
one slice that needs hosting (visual) is built*, not "which repo."

The rendered WE-docs site is accreting regression checks across three orthogonal axes the survey
surfaced — each pinned to the real tree: **a11y** (shipped: [we:tests/a11y/rendered-site-a11y.spec.ts](../tests/a11y/rendered-site-a11y.spec.ts),
axe over the [we:route-allowlist.ts](../tests/a11y/route-allowlist.ts) set, run in the existing Playwright
lane at [we:playwright.config.ts:6-9](../playwright.config.ts#L6-L9)); **content/data-binding correctness**
(#796 — assert the rendered surface against the loader projection in [we:src/_data/backlog.js:102](../src/_data/backlog.js#L102)
`deriveTier`, unit-pinned by [we:src/_data/__tests__/tier.test.ts](../src/_data/__tests__/tier.test.ts) but
not yet at the rendered level — `check:standards` skips the 11ty build, [we:scripts/check-standards.mjs:627](../scripts/check-standards.mjs#L627));
and a later **visual-regression** slice (no baseline store exists). The prior-art seam is decisive: across
every tool family, **CI owns the pass/fail gate; a hosted service owns only baseline storage + the
diff-review UI + historical dashboards** — and visual regression is the *one* category that needs that
service.

## Recommended path at a glance

| Fork | Recommended default | Main alternative (excluded) | Confidence |
| --- | --- | --- | --- |
| **1 — who owns the gate signal** | **WE CI invokes the harness and owns red/green** | plateau-app runs checks vs deployed WE-docs, reports back | High |
| **2 — visual-regression slice (deferred)** | **WE-standardized git/filesystem baseline artifact; plateau-app tools it but never owns it (open-core)** | Third-party SaaS (Chromatic/Percy/Argos); plateau owning the artifact | Med-high |

### Ratify (forced invariant — no fork)

**Decompose by layer; don't pick a monolithic home.** Per the [#091](/backlog/091-web-docs-as-a-service-plateau/)
Web-Docs-as-a-Service ruling (a managed offering is not a monolith needing a home — it decomposes across
the constellation), reinforced by the universal CI-gate-vs-hosted-service seam: contract (route allowlist
+ loader-projection extraction) → **WE**; portable harness primitives (runner glue, axe wrapper,
extraction utils) → **FUI** open primitive; served surface (visual baseline store + review UI + dashboard)
→ **plateau-app** product. a11y (#770) + content (#796) ship **now** as WE-repo Playwright specs — their
layer is WE-resident and they are deterministic pass/fail needing no service.

### Supported by default (not decisions)

- **Assert against the loader projection via a stable extractable contract, never hard-coded fixtures.**
  The fixtures branch is broken (brittle, re-derives loader logic), so this is a forced invariant, not a
  fork — already mandated by #796/#800.
- **One harness, additive slices.** a11y/content/visual share the existing Playwright lane
  ([we:playwright.config.ts:6-9](../playwright.config.ts#L6-L9)) and its `reuseExistingServer` wiring — no new
  runner or server (the #770 precedent).
- **Extract the harness to FUI when a 2nd consumer or the visual slice forces it.** End-state home is
  FUI (open primitive, per #091); *when* to extract is prioritization, filed as its own build — not a
  fork (per the fork-is-not-a-prioritization-tool rule). Until then it stays as WE-repo specs (the #426
  precedent: don't split a small thing across a repo boundary prematurely).

## Fork 1 — Who owns the pass/fail gate signal (CI execution locus)

Crux: even after the harness graduates, where does the red/green that blocks a WE build run? The user's
framing ("graduate into a service the WE CI calls") leans toward plateau hosting; the universal seam says
the gate runs where the change lives.

- **A — WE CI invokes the harness and owns red/green (recommended).** WE imports the (eventually
  FUI-homed) harness primitive and runs it in WE's existing Playwright lane; plateau-app supplies the
  primitives + (later) the baseline/dashboard service the spec *calls into*, but does not own WE's build
  gate. Matches today's lane, the universal seam, and the user's "a service the WE CI calls" phrasing.
- **B — plateau-app runs the checks against deployed WE-docs and reports a status back.** *Rejected as the
  gate model* — couples WE's build gate to a deployed service + network + deploy ordering, and inverts the
  seam (a deterministic gate doesn't need hosting). Reserved narrowly for the visual diff-review UI (Fork
  2), the one piece that genuinely must be hosted.

## Fork 2 — Visual-regression slice: owned service vs SaaS vs committed baselines

Crux (deferred slice, shaped now): visual regression is the lone category that trips all three conditions
for needing a hosted service (large binary baselines, environment-sensitive pixels, human-judgment diff
approval). How is it built?

- **A — WE-standardized git/filesystem baseline artifact, tooled (not owned) by plateau-app (recommended).**
  The visual-regression *artifact* — baselines, diffs, approval metadata — lives in a **WE-spec'd,
  filesystem/git-saved structure** (the standard layer), so it is escapable by construction and carries no
  lock-in to plateau. plateau-app provides the served diff + review UI that *works with* that structure
  (open-core), but **never owns the artifact**: delete plateau and the baselines + history survive in git
  under the standard format. Per minimize-lock-in (*the protocol/artifact is the only lock — and here even
  that is a portable git structure, not a proprietary store*), linear-cost-with-revenue (no uncapped
  per-snapshot SaaS fee inside flat pricing), and #091's served-product layer (the *tool* is plateau-app;
  the *contract* is WE).
- **B — Third-party SaaS (Chromatic/Percy/Argos/Applitools).** *Rejected as end-state* — external lock-in
  + recurring per-snapshot cost. (Argos is OSS/self-hostable — if ever adopted, self-host it under
  plateau-app, which collapses into A.)
- **C — Committed baselines (Playwright `toHaveScreenshot`, images in git).** *Rejected as end-state*
  (binary bloat + cross-env flakiness) but acceptable as the **interim bootstrap** before the service
  exists.

**Red-team note for the deciding agent:** Fork 2's attack is "a hosted SaaS ships the review UI in a day;
building our own is months." The answer is to **defer the whole visual slice** until the owned service is
warranted — a11y (#770) and content (#796) need none of it, so nothing blocks now; the call here only
fixes the *end-state* so the deferred build isn't pointed at a SaaS by default.

## Decision — ratified 2026-06-17

Both forks ratified at their recommended defaults, with one amendment to Fork 2.

- **Forced invariant:** decompose by layer (per #091) — contract → WE, harness primitives → FUI, served
  surface → plateau-app. a11y (#770) + content (#796) ship now as WE-repo Playwright specs.
- **Fork 1 → A.** WE CI invokes the harness and owns red/green; plateau-app supplies primitives + (later)
  the baseline service the spec *calls into*, but never owns WE's build gate. (~90% confidence; the user's
  "a service the WE CI calls" framing confirms A — the service is called into, it doesn't own the gate.)
- **Fork 2 → A, amended.** The end-state is an **owned-but-non-locked** visual-regression artifact: the
  baselines/diffs/approval state live in a **WE-standardized filesystem/git structure** (standard layer),
  and plateau-app is the *tool that works with* that structure, **not its owner**. This strengthens the
  original "owned plateau-app service" default by moving the artifact's ownership out of plateau entirely —
  delete plateau and the baselines + history survive in git under the WE format. Rejects both third-party
  SaaS and any plateau-proprietary store. The visual slice stays **deferred** (a11y + content need none of
  it); this call only fixes the end-state so the deferred build isn't pointed at SaaS or a lock-in store by
  default. (~80% confidence; residual is the bespoke-build cost, defused by deferral + self-hostable OSS
  like Argos working against the same git structure.)

**Follow-on builds (separately prioritized, per fork-is-not-a-prioritization-tool):** extract the harness
to a FUI open primitive when a 2nd consumer or the visual slice forces it (#426 precedent — not yet);
specify the WE visual-baseline artifact format + the plateau-app tool that consumes it when the visual
slice is warranted.

## Context

- **Parent epic:** [#800](/backlog/800-rendered-site-regression-tooling-unified-harness-over-the-li/)
  (the unified-harness umbrella). Sibling slices: [#770](/backlog/770-rendered-site-a11y-gate-axe-lane-route-allowlist-we-docs/)
  (a11y, shipped), [#796](/backlog/796-rendered-backlog-page-content-smoke-test-playwright-assert-t/) (content).
- **Precedents:** #091 (constellation decomposition dissolves the "home" fork — the load-bearing one);
  resolved #168 (plateau in-browser Playwright harness — in the *legacy* abandoned plateau repo, superseded
  by FUI's e2e harness, so cite it as a pattern, not a live home); #426 (don't split a small capability
  across a repo boundary prematurely).
- **Survey:** the 2025–2026 tool landscape (Chromatic/Percy/Applitools/Argos hosted; reg-suit BYO-storage;
  BackstopJS/Playwright in-repo; axe-core/Pa11y/Lighthouse-CI a11y; Lighthouse CI's runner-vs-optional-server
  split) all confirm the CI-gate-vs-hosted-service seam. Full digest in
  [the research topic](/research/rendered-site-regression-tooling-home/) and `relatedReport`.
