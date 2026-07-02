---
kind: decision
status: resolved
dateOpened: "2026-07-02"
dateStarted: "2026-07-02"
dateResolved: "2026-07-02"
graduatedTo: none
tags: [portfolio, tiering, projects-catalog, governance, adoption-narrative, decision]
relatedReport: reports/2026-07-02-portfolio-tiering.md
preparedDate: "2026-07-02"
codifiedIn: "docs/agent/platform-decisions.md#portfolio-project-tiering"
---

# Portfolio tiering: partition the 45 projects into core, contextual, and deferred

**Ratified 2026-07-02 — all four defaults, in the 2 → 1 → 3 → 4 order.** The 45 projects (91% pre-draft: concept 17 / poc 24 / draft 4) get a second, importance axis orthogonal to `status`: **(Fork 2)** tier assignment is the **named-consumer evidence bar** (core = benchmark/framework demand; contextual = shipped constellation use; exploratory = no named consumer yet; both-qualify → higher); **(Fork 1)** three tiers named **`core` / `contextual` / `exploratory`** — the stub's "deferred" → `exploratory` rename explicitly confirmed at ratification; **(Fork 3)** an **explicit, enum-validated `tier` stamp** on each `we:src/_data/projects/<id>.json` with a required `tierEvidence` one-liner on every non-exploratory project; **(Fork 4)** **in-place surfacing** — a `we-tag` tier cue per the by-intent statute, grids grouped core → contextual → exploratory, exploratory never hidden, and the "Core Standards" heading reworded so "core" is unambiguous tier vocabulary. Codified as the `#portfolio-project-tiering` statute anchor. The forks below (with their skeptic passes, grounded in the [`portfolio-project-tiering`](/research/portfolio-project-tiering/) research topic) are the record of the decision; bold options are the ratified branches. Bulk-assigning the 45 projects is follow-on execution (spun off at close-out), not part of this decision.

## Grounding digest

- **The maturity axis already exists and is orthogonal to this decision.** Every entry in `we:src/_data/projects/*.json` carries `status` (concept 17 · poc 24 · draft 4) against the public five-stage ladder concept → poc → draft → candidate → stable ([we:src/project-lifecycle.njk](src/project-lifecycle.njk):11-69). Prior art is unanimous that *maturity* (W3C WD→REC, TC39 stages, Node stability, Polaris/USWDS/Carbon lifecycles) and *importance/availability* (Baseline widely/newly/limited, Interop focus areas, core-vs-contrib) are **separate axes** — no surveyed system overloads one label set for both. The tier is the second axis; `status` is the first.
- **A category axis already partitions the homepage:** standard 37 / utility 7 / ecosystem 1 render as the "Core Standards" / "Application Protocols" sections at [we:src/index.njk](src/index.njk):36-57 — note "Core" is already (mis)used there for the *category*, a naming overlap the surfacing fork must resolve.
- **The render seam is ready:** the landing grid SSRs each project as a `we-card` with `status` → a header `we-badge` (`weProjectGrid`, [we:.eleventy.js](.eleventy.js):292-311); detail pages use [we:src/_includes/project-status.njk](src/_includes/project-status.njk):1-3. A tier cue rides the same seam.
- **No computable tier source exists:** the benchmark gap-analysis data ([we:src/_data/benchmarkCoverage.json](src/_data/benchmarkCoverage.json), `we:src/_data/benchmarkCapabilities.json`) is capability→entity keyed, not domain→project keyed — usable as *supporting evidence*, not as a derivation source.
- **Project `status` is deliberately outside the shared enum — but the vocabularies have still drifted three ways.** `checkStatus` covers Block/Plug/etc. ([we:scripts/check-standards.mjs](scripts/check-standards.mjs):178-181) but not Project, and that scoping is *statute-acknowledged*: `we:docs/agent/platform-decisions.md:130-133` says "`poc` is the convention — project `status` is not enum-validated; the `LIFECYCLE` set governs *descriptors*, not projects." So it is not a raw defect — yet the data (`poc`), the public ladder (`candidate/stable`, [we:src/project-lifecycle.njk](src/project-lifecycle.njk):11-69) and the descriptor enum still name three different vocabularies. Whatever the ruling, the **tier** enum must be validated from day one so it doesn't inherit this looseness.
- **"Tier" is overloaded in-repo** (backlog readiness Tier A/B/C, capability vision-tiers at `we:docs/agent/platform-decisions.md:565`, open-core pricing tiers) — the rendered labels are the tier *words*, never "Tier 1/2/3".

## The axes

The concern decomposes into four orthogonal choices the research surfaced: **(1) vocabulary** — which tiers exist and what they're called (the label set rendered on `we:src/_data/projects/*.json` entries); **(2) assignment bar** — the test that puts a project in a tier (the spine the external review said is missing, `we:reports/2026-07-01-program-external-consultant-review.md:15`); **(3) mechanism** — where the tier value lives and who stamps it (schema on the per-project JSON + validation in [we:scripts/check-standards-rules.mjs](scripts/check-standards-rules.mjs):726-785); **(4) surfacing** — where the tier renders ([we:src/index.njk](src/index.njk):36-57 grids, project detail pages). Classification pass: this is **website-app / portfolio-governance** turf, not a standards-layer entity (no block/intent/protocol is being shaped; the "WE = standard AND website-app" disambiguation applies — this decision lives on the catalog-app side). No fork is a config dimension: the tier vocabulary and bar are a *fixed public partition* of one catalog, not a per-consumer knob, so the Q4 dimension route doesn't fire; Q6's spirit survives as "a tier never gates what a consumer may use" (supported by default).

## Ratified path at a glance

| Fork | Ratified branch | Main alternative (rejected) | Confidence |
|---|---|---|---|
| **Fork 2** — assignment bar (ratify first) | **named-consumer evidence bar** (core: a benchmark design system or major framework depends on the domain; contextual: a named constellation consumer's build/runtime uses the surface; exploratory: no named consumer yet) | proxy metrics (intent count, backlog activity) | high |
| **Fork 1** — tier vocabulary (conditional on Fork 2 (a)) | **three tiers, named `core` / `contextual` / `exploratory`** (the evidence-class words; renames the stub's "deferred") | keep "deferred" · two-tier core/non-core | high |
| **Fork 3** — assignment mechanism | **stamped, enum-validated `tier` field + required `tierEvidence` one-liner per non-exploratory project** | derived from benchmark data (Baseline-style) | high |
| **Fork 4** — site surfacing | **in-place: a by-intent tier cue (`we-tag`) + tier grouping on the existing grids and detail pages; exploratory grouped last, never hidden** | segregate exploratory off the main catalog | med-high |

(The table lists Fork 2 first because Fork 1's tier *arity* is derived from Fork 2's evidence classes — ratify 2, then 1; section numbering below keeps the stable labels.)

## Fork 1 — tier vocabulary: which tiers exist and what they're called

*Fork-existence:* one public catalog can render exactly one canonical partition — rival vocabularies cannot coexist (a composability probe fails: there is no shared kernel two label sets could both be facades over; the rendered label set **is** the contract). The excluded-broken branch is overloading the existing `status` axis: importance ⊥ maturity (webvalidation is `poc` yet a prime core candidate; a polished utility can be exploratory), and every surveyed ecosystem keeps the two axes separate. *Scope note (skeptic):* the tier **arity** is not free-standing — "three evidence classes exist" is Fork 2's bar talking, so this fork is **conditional on Fork 2 (a)** and ratified after it; only the labels are genuinely this fork's own.

- **(a) three tiers, named `core` / `contextual` / `exploratory`** *(default)* — three evidence classes exist in the portfolio (external dependence / constellation-internal value / no named consumer yet), so two tiers under-partition. "Exploratory" names the *evidence state* (the W3C strategy-funnel's own stage name for pre-incubation work; WICG's term for the tier is *incubation*); the stub's "deferred" names a *schedule*, which is prioritization vocabulary inside a merit partition, and on a public site reads as abandonment rather than incubation.
- **(b) the stub's `core` / `contextual` / `deferred`** — same partition, scheduling word for tier 3. *Rejected as the default* for the naming reason above; ratifying (b) instead of (a) changes only the third label.
- **(c) two-tier `core` / non-core** — *Rejected:* collapses "unlocks FUI/plateau-app" and "no consumer yet" into one bucket, losing exactly the distinction the adoption narrative needs (what we ship *for the world* vs *for the constellation* vs *for the future*).
- **(d) overload the `status` maturity axis** — *Rejected (broken):* orthogonal axes, above; also `status` already has three drifted vocabularies (grounding digest) and adding importance semantics would make it four.

Skeptic: SURVIVES-WITH-AMENDMENT → the naming rationale ("deferred" = scheduling vocabulary inside a merit partition) and the three-way split beat the attacks; amended to (i) mark the fork conditional on Fork 2 (a) — the arity is derived from the bar's evidence classes, so ratify 2→1 (a decider cannot coherently take two-tier (c) alongside Fork 2 (a)), (ii) require the decision turn to explicitly confirm the H1's "deferred" → `exploratory` rename (a visible ratification point; (b) is a one-word override that disturbs nothing else), and (iii) correct a loose citation — "exploratory" is the W3C strategy-funnel stage name, not WICG's word (WICG's is *incubation*).

## Fork 2 — the assignment bar: what test puts a project in a tier

*Fork-existence:* a tier without a stated test is a vibe label — unauditable, undiscussable, and precisely the "no spine" the review flagged; the unstated-judgment branch is the broken one. Among stated bars, evidence-based and metric-based tests genuinely conflict (they tier several projects differently), so this is a real either/or.

- **(a) the named-consumer evidence bar** *(default)* — a project's tier is decided by *who demonstrably needs it*:
  - **core** — a benchmark design system or major framework depends on the domain: the capability shows up in the gap-analysis corpus ([we:src/_data/benchmarkCoverage.json](src/_data/benchmarkCoverage.json)) or a named framework ships the equivalent surface. This is the Interop-focus-area / WICG-graduation shape: admission on external demand evidence. *Two-clause honesty:* the benchmark corpus is component-shaped, so `standard`-category (UI-domain) projects qualify through it while the 7 `utility`-category projects (application protocols) reach core **only** through the named-framework clause — that asymmetry is stated, not hidden.
  - **contextual** — a *named* constellation consumer's **build or runtime uses the project's surface, shipped and functional today** (Frontier UI, plateau-app, an exercise app, the WE site's own chrome) even without external-benchmark demand. **"The WE site lists it in the catalog" never qualifies** — the site renders all 45 projects, so catalog listing would make every project contextual and the bar would stop partitioning. **Planned dogfooding never qualifies either** — the review found the site-dogfoods-its-own-components claim "not yet true" (#777 open, blocked on #765), and an aspirational consumer stamp is branch (c)'s "our own attention" failure smuggled into (a); the evidence must cite *shipped* usage.
  - **exploratory** — no named consumer yet; the project is a hypothesis about a missing standard.
  The tiers are **ordered evidence classes**: a project qualifying for both core and contextual takes the higher tier (core) — assign the strongest evidence that holds. The bar is falsifiable: each core/contextual stamp must *name* its consumer (Fork 3's `tierEvidence`), so a challenge is "that consumer doesn't actually depend on this," not "I feel differently."
- **(b) unstated judgment** — *Rejected (broken):* re-creates the reviewed defect with a prettier label.
- **(c) proxy metrics (intent count, backlog activity, resolved-item count)** — *Rejected:* measures *our own attention*, not external demand — a self-referential bar that would tier whatever we already worked on as core, cementing drift instead of correcting it.

Skeptic: SURVIVES-WITH-AMENDMENT → the evidence bar beat the "judgment in disguise" attack (the named-consumer requirement is the falsifiability mechanism); amended to (i) define constellation dependence as *shipped, functional build/runtime use* — excluding both catalog listing (as written, "the WE site itself" was vacuous: the site renders all 45, emptying tier 3) and planned dogfooding (aspirational per #777, the branch-(c) failure smuggled into (a)), (ii) state the two-clause asymmetry (the benchmark corpus is component-shaped, so utility-category projects reach core only via the judgment-heavier framework clause — falsifiability is weakest exactly there), and (iii) pin the tie-break — both-qualify → the higher tier wins.

## Fork 3 — assignment mechanism: where the tier value lives and who stamps it

*Fork-existence:* one field needs one owner — a stamped value and a computed value cannot both own `tier` (on divergence one must win, which is the ownership question restated). The excluded-broken branch is derived-owns-the-value: the bar is a judgment over heterogeneous evidence no dataset holds, and the benchmark data is capability→entity keyed with no domain→project join — a derivation would silently mis-tier, a correctness failure, not a cost deferral. (Baseline can derive because browser support is one homogeneous dataset; a "core" bar over a framework feature here and a design-system component there is a judgment over evidence, the Interop shape.)

- **(a) explicit, stamped `tier` field on each `we:src/_data/projects/<id>.json`, enum-validated, with a required `tierEvidence` one-liner on every non-exploratory project** *(default)* — judgment against Fork 2's stated bar, auditable because the evidence is on the entry itself, validated from day one (unlike `status` — grounding-digest drift). The stamp is re-assignable at review time (supported by default).
- **(b) derived Baseline-style from benchmark/coverage data** — *Rejected (on merit):* the core bar is a judgment over **heterogeneous evidence** — a framework feature here, a design-system component there — that lives in no dataset; even a complete, freely-maintained domain→project join could not *compute* "a named framework ships the equivalent surface." Baseline derives only because its evidence (browser support) is one homogeneous dataset. The grounding is also absent: no domain→project join exists at all — projects carry no intents/blocks lists, intents and blocks carry no project field, only protocols have `ownedByProject`; the association is prose-only in the project partials. If a later decision ever restructures the evidence into one dataset it may revisit ownership *with supersession lineage* — that is a successor ruling, not a branch of this one.
- **(c) hybrid: stamped value + derived advisory cross-check** — not a rival branch (the advisory check doesn't *own* the value) **and not a live default either**: the check requires the very domain→project join (b) lacks, so it is a join-blocked future enhancement — see "Not part of this decision."

The concrete shape (the code-level contract this fork ratifies):

```json
// we:src/_data/projects/webvalidation.json — the stamped shape
{
  "id": "webvalidation",
  "status": "poc",                    // maturity axis — unchanged, orthogonal
  "category": "standard",
  "tier": "core",                     // NEW — enum: core | contextual | exploratory
  "tierEvidence": "Every benchmark design system ships form-validation primitives: benchmarkCoverage joins those capability rows to WE validation blocks, whose conventional project home is webvalidation."
}
```

```js
// we:scripts/check-standards-rules.mjs — validated from day one (sketch)
export const PROJECT_TIERS = new Set(['core', 'contextual', 'exploratory']);
// error: missing/invalid `tier`; error: tier ∈ {core, contextual} without a non-empty `tierEvidence`.
```

Skeptic: SURVIVES-WITH-AMENDMENT → the stamped default held (rejecting (b) rests on heterogeneous-evidence merit — even a free, instantly-maintained join can't compute the framework clause — not on build cost), but three attacks landed as amendments: (i) an internal contradiction — the item rejected (b) as join-less while *defaulting* an advisory cross-check that needs the same join — fixed by demoting the cross-check to a join-blocked future enhancement; (ii) the sample `tierEvidence` itself overclaimed a capability→**project** join (benchmarkCoverage joins capability→block as prose; blocks carry no project field; only protocols have `ownedByProject`) — the sample was rewritten to what the data can express; (iii) the intent-inheritance default was reworded — the project↔intent association is prose-convention, not a data edge, so nothing mechanical inherits.

## Fork 4 — site surfacing: where the tier renders

*Fork-existence:* the true either/or is **hide vs show** — an exploratory project either remains a first-class tile on the main grid or is demoted off it; both are coherent site designs and cannot coexist (the broken branch is (c) internal-only, which forfeits the item's stated purpose — the newcomer explanation and adoption narrative are *public* needs). The *grouping order* half is narrower than a fork: core→contextual→exploratory is the canonical SSR default, and the existing per-section display toolbar ([we:src/_includes/display-toolbar.njk](src/_includes/display-toolbar.njk)) may re-sort it client-side — a support-both, not a branch.

- **(a) in-place surfacing** *(default)* — the tier renders as a **by-intent cue on every project card**, per the `we:docs/agent/platform-decisions.md#catalog-tile-by-intent-mapping` statute: a tier is *classification* metadata, so it maps to `we-tag` (the Tag intent) — **not** a second `we-badge`, which the anchor reserves for the *status* pill (Status-Indicator intent, #1319). It rides the same SSR seam (`weProjectGrid`, [we:.eleventy.js](.eleventy.js):292-311) and the project detail pages; within each existing section the grid *groups core → contextual → exploratory* so the spine is visible at first glance; exploratory stays on the page, grouped last, never hidden. Merit: honest (the catalog's real state stays visible — the quality the external review credited), and the newcomer reads the spine without a navigation hop. Sub-point: the "Core Standards" heading at [we:src/index.njk](src/index.njk):26 currently means the *category*; on ratification the heading must be reworded (e.g. "Standards") so "core" is unambiguous tier vocabulary on the page.
- **(b) segregated catalog** — exploratory demoted off the landing grid to an archive-style page. *Rejected:* misrepresents the portfolio's honest state (41/45 pre-draft reads as a curated dozen), and buries the incubation pipeline that *is* the project's thesis (plug = proposed missing standard).
- **(c) internal-only (data field, no render)** — *Rejected (broken):* defeats the stated purpose.

Skeptic: SURVIVES-WITH-AMENDMENT → in-place surfacing beat the "wall of concept tiles remains" attack (grouping + the tier cue *is* the spine; hiding is the dishonest fix), but two corrections landed: (i) the original "tier badge beside the status badge" wording violated the by-intent tile mapping statute — a tier is classification, so the cue is `we-tag`, the status pill keeps `we-badge` (folded into (a), statute-scan paragraph corrected from "no conflict" to "live constraint, now conformed to"); (ii) the fork-existence claim was narrowed to hide-vs-show — grouping *order* is a toolbar-re-sortable default, not a branch. The implementing build carries the standing UI-change obligations (before/after visual check + committed test) — the build's concern, not this ruling's.

## Supported by default (not decisions)

- **Tier and status render side by side** — orthogonal axes; neither replaces the other.
- **A tier is re-assignable — through a review turn, never a silent free edit.** A review (the external-review program #2090, a gap-sweep run, a program watch) may move a project up or down **against the same bar with a rewritten `tierEvidence`**; a re-stamp without new named-consumer evidence is invalid by construction (the broken branch — free silent edits — would hollow out Fork 2's falsifiability, so this is a stated invariant, not a fork). The stamp records current evidence, not history.
- **A tier never gates what a consumer may use** — it directs investment and narrative, never access (mandate-nothing; the Q6 spirit).
- **The grouping order is a canonical default, not a lock** — core → contextual → exploratory is the SSR order; the per-section display toolbar ([we:src/_includes/display-toolbar.njk](src/_includes/display-toolbar.njk)) may re-sort/filter client-side.
- **Intents carry no tier of their own** — tiering is per-project (this item's charter scope); no second stamping surface. Note the project↔intent association is **prose-only today** (no intent carries a project field, no project lists intents; only protocols have `ownedByProject`), so nothing mechanical *inherits* — the policy is simply that intents are never stamped.

## Not part of this decision

- **Bulk-assigning the 45 projects** — execution of the ratified bar (a spin-off story, `blockedBy` this decision); no rival branches once Forks 1–3 are ratified.
- **Conformance-investment ordering** ("do core's conformance vectors first") — prioritization, decided at backlog-selection time, never a fork branch (the not-a-prioritization rule).
- **The project-status three-way vocabulary drift** (grounding digest) — independent of any tier ruling, and **not a plain drift fix**: `we:docs/agent/platform-decisions.md:130-133` deliberately keeps project `status` outside `LIFECYCLE`, so closing the drift means *amending that statute* (e.g. a distinct `PROJECT_LIFECYCLE` matching the public five-stage ladder) — capture as its own decision-shaped item at close-out.
- **A derived advisory cross-check** (warn when an `exploratory` project's domain shows benchmark demand) — a future enhancement **blocked on building a domain→project evidence join that does not exist today**; it composes with Fork 3 (a) in principle but never owns the value, and it is not a live default (skeptic: defaulting it while rejecting (b) for the same missing join was a contradiction).

## Context — statute overlap & lineage

**Statute scan (one live constraint, reconciled; no rule conflict):** no existing `we:docs/agent/platform-decisions.md` anchor governs portfolio/catalog *tiering itself*. Same-subject anchors, reconciled: `#catalog-tile-by-intent-mapping` **is a live constraint the first draft mis-read as "no conflict"** — it mandates by-intent tile cues (status pill → `we-badge` / Status-Indicator intent #1319; category chips → `we-tag` / Tag intent, the #1621 state-vs-category split), and a tier is category-like, so Fork 4 (a) now specifies `we-tag`, conforming rather than minting a bespoke badge. `#project-protocol-bar` (what earns a Project *at all*) is upstream of tiering — a thing failing that bar never reaches this partition. The placement-test rule at `we:docs/agent/platform-decisions.md:130-133` (project `status` is deliberately not enum-validated; `LIFECYCLE` governs descriptors) scopes the *status* axis and is untouched by a *tier* enum — but it makes the status-drift follow-up a statute amendment, not a drift fix ("Not part of this decision"). The D3-readiness rule (`concept` project with no shipped surface demotes dependent builds, [we:src/_data/backlog.js](src/_data/backlog.js):118) keys off the *status* axis and stays untouched — a `core`+`concept` project still demotes its builds until it ships, which is correct (tier says *invest here*, status says *it isn't built yet*). Rule-7 impl-neutrality (`we:docs/agent/platform-decisions.md:135-141`) governs the capabilityMatrix impl grid, not own-portfolio governance — spirit checked, no collision. On resolve, `codifiedIn` should land the tier bar as a new platform-decisions anchor (portfolio-governance section).

**Lineage:** filed by the 2026-07-01 external consultant review (`we:reports/2026-07-01-program-external-consultant-review.md:29`, program #2090). Sibling decision from the same review: #2089. The review's "67% pre-draft" reads as stale against the live tree (91% — concept+poc = 41/45); the discrepancy doesn't change the problem statement.
