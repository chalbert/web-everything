# Where does rendered-site regression tooling home? (#799 decision-prep)

**Date:** 2026-06-16 · **For:** decision `#799` (child of epic `#800`) · **Status:** prepared, not ratified

## The question

The rendered WE-docs site is accreting regression checks — a11y (`#763`/`#770`, shipped as
`we:tests/a11y/rendered-site-a11y.spec.ts`), content/data-binding correctness (`#796`), and a later
visual-regression slice. `#799` asks whether these stay as Playwright specs in the WE repo (simplest,
runs in WE CI today) or graduate into a unified harness **homed in plateau-app as a service the WE
project consumes** (the managed-offering constellation pattern). Decide the home *and* the seam so new
slices are built portably rather than accreting as scattered WE specs that later need migration.

## Standing test — is "WE specs vs plateau service" even a real binary?

**No — it dissolves, the same way `#091` dissolved the identical "home" fork for Web-Docs-as-a-Service.**
The `#091` ruling (2026-06-12): a managed Plateau offering is *not a monolith needing a home decision* —
it decomposes across the constellation (standard → WE; open primitives + adapters → FUI; complete served
product → plateau-app; open-core by usage). Applying that here, plus the prior-art seam below, the
monolithic framing is a false dichotomy. The genuine residual calls are *who owns the gate signal* and
*how the one slice that needs hosting (visual) is built* — not "which repo."

## Prior-art survey (published as `/research/` topic `rendered-site-regression-tooling-home`)

The 2025–2026 landscape shows **one consistent seam: CI owns the gate; a hosted service owns only
baseline storage + the diff-review UI + historical dashboards** — and visual regression is the *one*
category that trips the conditions for needing that service.

- **Visual regression** is the outlier that pulls toward a hosted service for three reasons: (a) baselines
  are large binaries needing branch-aware promotion (git bloat otherwise); (b) pixels are
  environment-sensitive, so a *centralized* render runner is needed or every laptop yields false diffs
  (Argos: "screenshots uploaded from CI, not developer laptops"); (c) a diff is a *human judgment call*
  needing an approval UI wired back to Git. **Hosted SaaS:** Chromatic, Percy (BrowserStack), Applitools,
  Argos (also OSS/self-hostable). **Self-hosted/BYO-storage:** reg-suit (your S3 bucket + GitHub PR
  comment). **Fully in-repo:** BackstopJS (local files), Playwright `toHaveScreenshot` (baselines
  committed to git, local pixelmatch diff).
- **a11y** (`@axe-core/playwright`, Pa11y, Lighthouse CI) needs **no baseline and no service** — violations
  are deterministic machine-decidable pass/fail in-repo. Lighthouse CI is the textbook split: `@lhci/cli`
  `collect→assert→upload` gates entirely in CI with no server; the optional `@lhci/server` adds *only*
  historical trend dashboards, strictly off the gate's critical path. (WE's shipped `#770` gate already
  embodies this — axe in the Playwright lane, no storage.)
- **Content / data-binding correctness** has no SaaS category at all: the pattern is Playwright assertions
  comparing extracted DOM text to the *projection* of the source data (apply the formatter to the source
  number, assert the cell), not hard-coded fixtures. Nearest named prior art: Testing-Library's
  "test what the user sees" + consumer-driven contract testing (Pact) for the data-shape analogue.

**Cross-cutting principle:** always in-repo/in-CI = the spec/contract, the runner invocation, and the
**pass/fail gate decision**. Graduates to a hosted service **only** when the artifact is (a) a large
binary needing branch-aware promotion, (b) environment-sensitive enough to need centralized rendering, or
(c) a human-judgment approval. Visual regression trips all three; a11y, content, and performance-assert
trip none.

Sources: Playwright visual comparisons (playwright.dev/docs/test-snapshots), Lighthouse CI architecture +
server docs (googlechrome.github.io/lighthouse-ci), Argos baseline governance, Storybook test-runner,
Chromatic interactions, Percy/Applitools/Chromatic comparison, axe + Playwright a11y guide.

## Classification against the constellation

Running the layering on each layer of the capability:

| Layer of the capability | Lives in | Why |
| --- | --- | --- |
| **Contract** — route allowlist, loader-projection extraction, what each slice asserts | **WE** | WE-docs-specific config; the surface under test. Already there: `we:tests/a11y/route-allowlist.ts`. |
| **Portable harness primitives** — runner glue, axe wrapper, projection-extraction utils | **FUI** (open primitive) | `#091`: open primitives → FUI, "enough to assemble a self-hostable UI". Extracted only when a 2nd consumer / the visual slice forces it (timing = prioritization, a separate build — not a fork). |
| **Served surface** — visual baseline store + diff-review UI + historical dashboard | **plateau-app** (product, open-core) | `#091`: complete served product → plateau-app. The one piece the prior-art seam says must be hosted. |
| **Gate signal** — the red/green that blocks a WE build | **WE CI** | The seam: the gate runs where the change lives. See Fork 1. |

a11y (`#770`) + content (`#796`) ship **now** as WE-repo Playwright specs — their layer is WE-resident
and they are deterministic pass/fail needing no service. This is not "WE wins the home" — it's the
contract+gate layers (which *are* WE-resident) shipping first, with the FUI/plateau layers materializing
when the visual slice forces them.

## Recommended decomposition (the ratify) + two residual forks

**Ratify (forced by `#091` + the universal seam):** don't pick a monolithic home — decompose by layer as
the table above. Slices ship where their layer lives; build portably (assert against the loader
projection, never fixtures) so the harness lifts to FUI cleanly later.

**Fork 1 — who owns the pass/fail gate signal.** **A (recommended): WE CI invokes the harness and owns
red/green** — imports the (eventually FUI-homed) harness primitive, runs in WE's existing Playwright lane;
plateau-app supplies primitives + (later) the baseline/dashboard service the spec *calls into*, but does
not own WE's build gate. Matches today's lane, the universal seam, and the user's own "a service the WE
CI calls" phrasing. **B (rejected as the gate model): plateau-app runs checks against deployed WE-docs and
reports a status back** — couples WE's build gate to a deployed service + network + deploy ordering;
reserved narrowly for the visual diff-review UI, the one piece that must be hosted.

**Fork 2 — the visual-regression slice (deferred; shaped now).** **A (recommended): owned plateau-app
visual-regression service** (baseline store + diff + Git-wired review UI), open-core — per minimize-lock-in
(served product is always plateau-app), linear-cost-with-revenue (no uncapped per-snapshot SaaS fee inside
flat pricing), and `#091`'s served-product layer. **B (rejected as end-state): third-party SaaS**
(Chromatic/Percy/Argos/Applitools) — external lock-in + recurring per-snapshot cost; if Argos (OSS) is ever
adopted, self-host it under plateau-app, which collapses into A. **C (interim only): committed baselines**
(Playwright `toHaveScreenshot`, images in git) — rejected as end-state (binary bloat + cross-env flakiness)
but acceptable as the bootstrap before the service exists.

## Confidence

- Fork 1: **high** — aligns with the universal seam and the user's own phrasing; the gate belongs where
  the change is.
- Fork 2: **med-high** — the principle is clear, but it's a deferred slice and buy-vs-build always carries
  judgment; flag for the deciding agent's red-team (the attack: "a hosted SaaS ships the review UI in a
  day; building our own is months" — answer: defer the *whole* visual slice until the owned service is
  warranted; a11y+content need none of it, so nothing blocks now).
