# Portfolio Tiering — prior-art survey + repo grounding for decision #2088

**Date**: 2026-07-02
**Point**: Prep research for decision #2088 (portfolio tiering of the 45 projects). Surveyed how comparable ecosystems partition their catalogs (W3C/WHATWG, TC39, WICG, Baseline, Node.js stability, Interop, design-system component lifecycles, core-vs-contrib splits) and grounded the current WE catalog model in the real tree. Core finding: every surveyed ecosystem keeps **maturity** (how far along) and **importance/availability** (how much it matters / who can rely on it) as *separate axes* — none overloads one label set for both — and the systems split on whether the second axis is *derived from data* (Baseline) or *stamped by judgment against a stated bar* (Interop focus areas, USWDS/Polaris statuses).
**Research page**: `/research/portfolio-project-tiering/`

---

## Question

The WE catalog has 45 projects (`we:src/_data/projects/*.json`) and 98 intents (`we:src/_data/intents/*.json`) with **no explicit must-ship partition** — so conformance investment, the adoption narrative, and a newcomer explanation lack a spine (external review 2026-07-01, `we:reports/2026-07-01-program-external-consultant-review.md:15`). #2088 must decide: the tier **vocabulary**, the **assignment bar**, the assignment **mechanism**, and the **site surfacing**.

## Recommendation

Add a second, orthogonal **`tier` axis** on each project entry — vocabulary **core / contextual / exploratory** — assigned by a **named-consumer evidence bar** (core: a benchmark design system or major framework demonstrably depends on the domain; contextual: unlocks a named constellation consumer; exploratory: no named external consumer yet), stored as an **explicitly stamped, enum-validated field with a required one-line evidence pointer**, and surfaced **in place** on the existing catalog (badge + tier grouping on the landing grids and project pages; nothing hidden). The bulk 45-project assignment is follow-on execution of the ratified bar, not part of the decision.

## Key findings — external prior art

**1. Two distinct axes recur everywhere: maturity/stage vs importance/availability.**

| System | Maturity/stage axis | Importance/availability axis | Assignment |
|---|---|---|---|
| W3C Process | WD → CR → PR → REC (per-spec pipeline) | REC-track vs Note (a *track* choice) | WG judgment + process gates |
| TC39 | Stages 0–4 | — (single pipeline; everything aims at Stage 4) | committee judgment per stage bar |
| WICG → WHATWG/W3C | incubation vs standards-track | the *venue* IS the tier: incubation = exploratory | graduation by adoption evidence (multi-implementer interest) |
| Baseline (web-platform-dx) | — | **limited / newly / widely available** | **derived** — computed from browser-support data (newly = in latest stable of all core browsers; widely = 30 months past that) |
| Interop (annual) | — | the year's **focus areas** — a chosen must-fix subset | **stamped** — proposals scored on demand evidence (developer surveys, usage counters) |
| Node.js docs | Stability index 0 deprecated / 1 experimental / 2 stable / 3 legacy | — | stamped per-module in doc metadata |
| USWDS | experimental → stable → use-with-caution → deprecated/retired | — | stamped against published per-status requirements |
| Shopify Polaris | alpha → beta → stable → legacy/deprecated | — | stamped against per-stage requirement checklists |
| Carbon | experimental vs stable component status | — | stamped (raised the bar on "experimental" over time) |
| npm ecosystems | — | core vs first-party vs community/contrib | ownership fact (who maintains it) |

Reading: the **maturity ladder WE already has** (`status`) matches the left column; **#2088's tier is the right column** and is a *new orthogonal axis*, exactly as prior art models it. The right column splits into **derived** partitions (Baseline — possible only because browser support is one structured dataset) and **judgment-stamped-against-a-stated-bar** partitions (Interop, venue graduation — used when the evidence is heterogeneous). The WE "core" bar (benchmark/framework dependence) is heterogeneous evidence → the Interop shape (stamped, evidence-cited), not the Baseline shape (computed), is the honest fit today.

**2. The nearest analogue to "core: a benchmark depends on the domain" is Interop's focus-area selection and WICG graduation** — both admit a candidate on *external demand evidence* (who is asking / who depends), never on internal effort spent. That supports an evidence-class vocabulary over a scheduling vocabulary ("deferred" names a schedule; "exploratory" names the evidence state — the W3C strategy-funnel's stage name for pre-incubation work; WICG's own term is *incubation*).

## Key findings — repo ground truth

- **45 projects**, one file each: `we:src/_data/projects/*.json`, loaded by [we:src/_data/projects.js](src/_data/projects.js) (registry loader, #1157). Schema today: `id / name / description / status / category / icon / isSvg` (+ 3 `details`, 1 `openQuestions`). **No tier-like field exists.**
- **Status axis (maturity) already exists and is populated:** concept 17 · poc 24 · draft 4. The public ladder is concept → poc → draft → candidate → stable (`we:src/project-lifecycle.njk:11-69`). The review's "67% pre-draft" is off against the live tree — **91% (41/45) is pre-draft** (concept+poc); concept alone is 38%.
- **Category axis already partitions the catalog:** standard 37 · utility 7 · ecosystem 1, rendered as two homepage sections ("Core Standards" / "Application Protocols") at `we:src/index.njk:36-57`. Note the heading "Core Standards" already uses the word *core* for what is actually the `standard` **category** — a naming collision the tier work must clean up or exploit.
- **Card rendering seam:** the landing grid is SSR'd per project as a `we-card` with `status` → a header `we-badge` (`we:.eleventy.js:292-311`, `weProjectGrid`); a tier would ride the same seam. `we:src/_includes/project-status.njk:1-3` renders the status meter on detail pages.
- **Three-way status-vocabulary drift (not a #2088 fork, and not a raw defect):** project `status` values are never enum-validated — `checkStatus` is applied to Block/Plug/etc. (`we:scripts/check-standards.mjs:178-181`) but not Project — and the skeptic pass surfaced that this scoping is *statute-acknowledged* (`we:docs/agent/platform-decisions.md:130-133`: "`poc` is the convention … the `LIFECYCLE` set governs *descriptors*, not projects"). Still, the data (`poc`), the public ladder (`candidate/stable`) and the descriptor enum (`experimental/active`, `we:scripts/check-standards-rules.mjs:726`) name three vocabularies for one axis; closing that is a *statute amendment*, not a drift fix. Any tier enum should be validated from day one so it doesn't inherit this looseness.
- **Machinery that already keys off project status** (a tier field would sit beside, not replace): D3-readiness demotes builds whose `relatedProject` is a `concept` project with no shipped surface (`we:src/_data/backlog.js:118`, `we:scripts/check-standards.mjs:533-540`); the health audit flags stale `concept` projects (`we:scripts/audit-backlog-health.mjs:490`).
- **Evidence source for the core bar exists but is capability-keyed, not project-keyed:** the gap-analysis corpus joins benchmark capabilities to WE *entities* with covered/partial/missing labels (`we:src/_data/benchmarkCoverage.json`, `we:src/_data/benchmarkCapabilities.json`) — usable as *supporting evidence* per project, but there is **no domain→project join** that could *compute* a tier today (why derived-owns-the-value is rejected).
- **"Tier" is already an overloaded word in this repo:** backlog readiness Tier A/B/C, capability tiers (`we:docs/agent/platform-decisions.md:565` vision-tiers), open-core pricing tiers (`/research/web-docs-open-core-tiering/`), evidence tiers (`we:docs/agent/platform-decisions.md:2015`). The rendered label should be "core/contextual/exploratory" words, never "Tier 1/2/3".
- **Statute scan:** no existing `we:docs/agent/platform-decisions.md` anchor governs portfolio/catalog tiering. Nearest same-subject anchors: `#project-protocol-bar` (what earns a Project at all — upstream of tiering, no conflict), `#catalog-tile-by-intent-mapping` (how tiles render — the surfacing fork must compose with it), and the D3-readiness rule above (status-keyed, orthogonal axis).

## Files created/modified

| File | Action |
|---|---|
| `we:src/_data/researchTopics/portfolio-project-tiering.json` | created — research topic registry entry |
| `we:src/_includes/research-descriptions/portfolio-project-tiering.njk` | created — research write-up |
| `we:reports/2026-07-02-portfolio-tiering.md` | created — this report |
| `we:backlog/2088-portfolio-tiering-partition-the-45-projects-into-core-contex.md` | rewritten to the prepared-fork shape (4 forks, defaults, skeptic verdicts) |

Sources: [USWDS component lifecycle](https://designsystem.digital.gov/components/lifecycle/), [Polaris component lifecycle](https://polaris-react.shopify.com/getting-started/components-lifecycle), [Carbon component status](https://carbondesignsystem.com/contributing/product-development-lifecycle/), [Baseline definitions](https://web-platform-dx.github.io/baseline/), [Baseline on MDN](https://developer.mozilla.org/en-US/docs/Glossary/Baseline/Compatibility).
