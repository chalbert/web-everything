---
kind: decision
parent: "777"
status: active
dateOpened: "2026-06-17"
dateStarted: "2026-07-09"
preparedDate: "2026-07-02"
relatedReport: reports/2026-07-02-a11y-ratchet-promotion-endgame.md
tags: [dogfood, a11y, ratchet, ci-gate]
---

# Per-page rollout ratchet for the WE-docs FUI dogfood

## Digest

Prepared 2026-07-02: no ratchet *policy* design existed yet — the two forks below are grounded in a
**live measurement of the gate** (full `npm run test:a11y` run over the auto-derived route set) plus a
prior-art survey published as the [/research/ topic a11y-ratchet-promotion-endgame](/research/a11y-ratchet-promotion-endgame/)
(session report linked via `relatedReport`); each fork carries a recommended default in **bold**.
**Which "WE" (per the WE-name disambiguation):** everything here is the WE **website app** (the 11ty
docs site and its Playwright gate, `we:tests/a11y/*`) plus the FUI website's mirror gate
(`fui:tests/a11y/*`). Nothing rules on the zero-impl WE *standard* layer, and no vocab→component
mapping is created by this decision — the conversions themselves were ruled and built in
#865/#866/#2018–#2021 (and #2098's SSR primitives); this item only governs how converted/measured
pages are promoted behind the a11y gate.

**Measured gate state (2026-07-02, this tree):** the scope-C derived set is **39 routes**
(`we:tests/a11y/sitemap-routes.ts:49-67` over the live `/sitemap.xml`). Of the **10 enforced** routes
(`we:tests/a11y/sitemap-routes.ts:27-38`), **5 fail today** — `/`, `/adapters/`, `/blocks/`,
`/intents/`, `/protocols/` — all `[serious] color-contrast` (1–35 nodes each) plus one
`nested-interactive` on `/`; all five are exactly the index templates converted to SSR `we-card`
tiles (#2019 `fd632345` + siblings), i.e. **the dogfood conversions regressed the earned enforce
posture and the red lane went unnoticed**. Of the **29 warn-only** routes, **26 are already green**
(promotable as-is) and 3 are red: `/semantics/` (`button-name`, `select-name`), `/web-contexts/`
(`document-title`, `html-has-lang`), `/rules/backlog-workflow/` (`scrollable-region-focusable`).
The FUI mirror gate exists (#849, `fui:tests/a11y/sitemap-routes.ts:21`) with an **empty** enforced
seed — zero FUI routes promoted. Dogfood keystones: #2016 (SSR render) and #2017 (manifest loader)
both resolved 2026-07-01; index conversions #2018/#2019/#2020 resolved; the detail-page sweep #2021
is **open** (children #2099–#2106 open, #2098 done). The stale `blockedBy: [865, 866]` was cleared
2026-07-02 (both resolved).

**Verdict on the reclassified (a)/(b)/(c) question** (see Context): *(a) "essentially done — confirm
and close" is refuted by measurement* (5 enforced routes red, 3 warn-only routes red, 26 green routes
unpromoted, FUI seed empty, #2021 open). *(c) "rollout-strategy — order/criteria"* is mostly settled:
the promotion **criterion** is already ratified (#774 forced invariant: a derived route enters
warn-only and "is promoted per-route as it goes green"), and promotion/remediation **order** is
prioritization, not a fork (#1961). What survives of (c) is one forced-invariant ratify (Fork 1) and
one genuine policy fork (Fork 2); everything else is *(b)-shaped mechanical work*, listed under
**Planned spin-offs**.

## Axis framing

The ratchet decomposes into two orthogonal policy axes the measurement surfaced:

- **Axis 1 — what promotion tracks.** #774's ratified criterion is *measured green, full stop*
  ("promoted per-route as it goes green" — `we:tests/a11y/sitemap-routes.ts:13-14`, #774's ruling
  restated); no conversion predicate exists in the ruling or the code, and the gate keys enforcement
  purely on `ENFORCED_ROUTES` membership (`we:tests/a11y/rendered-site-a11y.spec.ts:29-31`). The
  conversion-coupling reading comes only from this item's original story narrative ("each conversion
  is proven WCAG-clean"). → **Fork 1**, a forced-invariant *ratify*: confirm the green-only criterion
  reaches unconverted routes and reject the coupling rider as the broken branch.
- **Axis 2 — the entry posture after the drain.** #774's rider ("a newly-derived route enters
  warn-only") was ruled while the site was largely unmeasured; once the current 39-route set is fully
  enforced, a *new* route being born warn-only is a standing fail-open hole. Industry practice offers
  both perpetual-ratchet and flip-to-deny-by-default endgames (see the research topic). → **Fork 2**.

Not axes (no live choice — see *Supported by default*): the promotion *mechanism* (manual set edit vs
a helper report/script), remediation *order*, and whether the FUI-site drain is this item or a
sibling slice (slicing, not merit).

## Recommended path at a glance

| Fork | Recommended default | Main alternative | Confidence |
|---|---|---|---|
| Fork 1 — promotion coupling | (a) decoupled: promote any measured-green route now | (b) hold until FUI conversion — *the broken branch* | High — forced invariant, a ratify not a weigh |
| Fork 2 — ratchet endgame | (b) flip to enforce-by-default once the current set drains | (a) perpetual per-route warn-entry ratchet | Med-high |

## Fork 1 — does promotion track measurement only, or conversion + measurement?

*Fork-existence:* **forced invariant (case (a) of the standing test — a ratify, not a weigh)**, on
two independent grounds the skeptic pass converged on: (1) *settled-by-precedent* — #774's ratified
rider already prescribes promote-on-green with no conversion condition
(`we:tests/a11y/sitemap-routes.ts:13-14`), so branch (b) would silently *add* a precondition a
ratified invariant doesn't have; (2) branch (b) is *merit-empty* once cost/churn is stripped (shown
under (b) below) — mutually-exclusive set membership plus a merit-empty branch is the forced-invariant
shape, not a genuine either/or. Stated as a fork section so the ratification records the rejected
branch explicitly.

**Crux:** 26 warn-only routes are green today, but many (e.g. `/semantics/`, `/states/`,
`/web-contexts/`) have had no FUI conversion and #2021's detail-page sweep is still open. Do they
enter `ENFORCED_ROUTES` now, or only when their conversion lands?

- **(a) Decoupled — promote on measured green, regardless of dogfood-conversion state.** The gate
  asserts WCAG A/AA on the rendered DOM, whatever renders it. Promoting early means every *later*
  conversion of that page lands **under enforcement** — which is precisely the dogfood proof this
  item wants ("each conversion is proven WCAG-clean"), made structural instead of procedural. The
  measured 5-route regression is the smoking gun: those conversions landed on *enforced* routes and
  the red lane is at least catchable at the next run; the same regression on a warn-only route is a
  console line nobody reads. a11y-correctness and regression-guard merit both point here.
- **(b) Coupled — hold promotion until the page's FUI conversion lands.** Preserves the item's
  original narrative sequencing (convert → prove → promote). Its substantive defense — "don't enforce
  markup that's about to be rewritten" — is churn/effort, not merit (stripped per #1961); its merit
  residue is empty: the gate asserts rendered-DOM output only, never markup provenance, and
  re-measures on every run, so enforcing the current hand-rolled DOM neither entrenches it nor loses
  anything at rewrite time; nor does pre-conversion promotion dilute the dogfood proof —
  `ENFORCED_ROUTES` was never a conversion ledger (conversion state lives in #2021's children), and
  under (a) the conversion is the event that lands *under* enforcement, which is the proof
  strengthened. *Rejected — the broken branch:* it removes the guard at exactly the riskiest edit
  (the conversion), as the 5-route regression demonstrates in the enforced direction.

**Default: (a) — decoupled promotion; any measured-green scope-C route is promotable immediately.**

Code-level shape (the promotion is a set edit, per #774's explicit-set invariant — no runtime
auto-derivation of enforcement):

```ts
// we:tests/a11y/sitemap-routes.ts — promotion = append measured-green routes
export const ENFORCED_ROUTES: ReadonlySet<string> = new Set([
  '/', '/intents/', '/blocks/', /* …existing 10… */
  '/author/',            // promoted 2026-07-0X: measured green (warn-only run, 0 violations)
  '/compat/',            // promoted 2026-07-0X: measured green
  // NOT '/semantics/'   — red (button-name, select-name); remediate first
]);
```

Skeptic: SURVIVES-WITH-AMENDMENT — default (a) intact on every merit attack (entrenchment false: DOM-measured per run; proof-dilution inverted: conversions land *under* enforcement); the landed attack was classification — reclassified from "genuine either/or" to forced invariant / settled-by-#774 (branch (b) merit-empty + #774's green-only rider already governs), removing the G4 exposure of a weighed fork with a self-described merit-empty branch.
Screen: clear — ruling is boundary-observable (set membership flips warn→build-fail for contributors/CI), layering disclaimer accurate; broken branch verified broken *on merit* (removes the guard at the riskiest edit; contradicts the ratified #774 rider), not merely slower — a legitimate forced-invariant ratify.

## Fork 2 — ratchet endgame: what happens when the current route set is fully enforced?

*Fork-existence:* genuine either/or — a *new* sitemap route after the drain is either born
warn-only (a) or born enforced (b); the entry posture is a single repo-wide rule, and the branches
cannot coexist for the same new route.

**Crux:** #774's rider gives every newly-derived route warn-only entry, promoted by hand as it goes
green. That was the right bootstrap posture over a largely-unmeasured site. Once all 39 current
routes are enforced (the drain), the rider becomes the gate's only remaining fail-open hole: every
new template/collection ships advisory-only until someone remembers to promote it.

- **(a) Perpetual per-route ratchet (status quo).** New routes always enter warn-only; promotion
  stays a manual, per-route act forever. Merit: never blocks a legitimately-new experimental surface.
  Merit cost: fail-open by construction — a new page can ship with WCAG A/AA violations indefinitely,
  and the measured facts show warn-only output is ignored in practice (3 red warn-only routes today,
  violations first *seen* by this prep's measurement run).
- **(b) Flip to enforce-by-default at the drained milestone.** Once `ENFORCED_ROUTES` equals the
  derived set and the lane is green (a mechanically decidable predicate over repo state, not an unresolved placeholder),
  invert the posture: a derived route is build-blocking **unless** listed in an explicit
  `WARN_ROUTES` exception set (new/experimental surfaces opt *out*, visibly and temporarily). Merit:
  fail-closed — a new route must be born WCAG-clean, which is what "the site is the conformance
  proof" (#777) means once the debt is drained; the exception set keeps the escape-hatch explicit and
  reviewable. This composes with the repo's own gate precedents — the warn-first→ERROR rollout of the
  content-quality gates (#840/#844/#477, `we:docs/agent/platform-decisions.md:828`) and the
  fail-closed `check:standards` classifier rule (`we:docs/agent/platform-decisions.md:115`) — which
  treat warn as a *stage you exit once curated*, never a resting posture. This **supersedes #774's
  warn-only-entry rider at the drain milestone** — reconciliation below. Three designed-in
  consequences the ruling names up front: (1) the *trigger is self-announcing* — the lane gains a
  meta-assertion that flags "drain complete — execute the #867 flip" when `ENFORCED_ROUTES` equals
  the derived set, so the milestone can't rot unnoticed (the measured red-lane miss is the cautionary
  tale); (2) post-flip, a *sitemap-fetch failure hard-fails* the lane — today's fallback to
  `ENFORCED_ROUTES` (`we:tests/a11y/sitemap-routes.ts:96`) disappears with the set, and a silent
  zero-route green pass is the exact hole the fallback closed; (3) *scope-C sample rotation* — the
  per-group sample is the lexicographically-first detail page (`we:tests/a11y/sitemap-routes.ts:61-62`),
  so an unrelated content addition can rotate the sample and a rotated sample is born enforced; that
  is correct fail-closed behavior, and fix-or-opt-out (`WARN_ROUTES`) is the designed response, not
  gate flakiness.
- **(c) Flip the whole lane now (`A11Y_ENFORCE=1` as default).** *Rejected* — 8 routes are red today
  (5 enforced + 3 warn-only); flipping now yields a permanently red lane, which trains the repo to
  ignore it (the exact anti-pattern the baseline literature warns on — see research topic).
- **(d) Replace the route ratchet with a violation-level baseline snapshot** (fail on *new*
  violations anywhere, existing debt snapshotted — the trivago/accessibility-insights baseline-file
  pattern). *Rejected on merit:* baselines are churn-sensitive (node-level fingerprints break on
  unrelated DOM changes — accessibility-insights-action issue 949), they remove the drain
  forcing-function (snapshotted debt rots indefinitely), and #774 already ruled the enforce posture
  route-granular via an explicit reviewable set.

**Default: (b) — keep #774's warn-entry ratchet while draining; at the drained-and-green milestone,
invert to enforce-by-default with an explicit `WARN_ROUTES` exception set.**

Code-level shape of the inverted posture (mechanical inversion of
`we:tests/a11y/rendered-site-a11y.spec.ts:30`):

```ts
// After the drain: fail-closed by default, exceptions explicit.
export const WARN_ROUTES: ReadonlySet<string> = new Set<string>([
  // '/new-experimental-surface/', // opted out 2026-XX-XX, promote-by <date or condition>
]);
// spec: const enforce = !WARN_ROUTES.has(path);   // was: ENFORCED_ROUTES.has(path)
// gatedRoutes(): sitemap-fetch failure now THROWS (fail-closed) — the old fallback to
// ENFORCED_ROUTES (sitemap-routes.ts:96) is gone with the set; zero-routes-green is the hole.
// The flip also rewrites the "FORCED INVARIANT (#774)" header comments in BOTH gate files
// (we:tests/a11y/sitemap-routes.ts:12-15, fui:tests/a11y/sitemap-routes.ts:7-9) with the
// supersession lineage — live code must not keep asserting a superseded statute.
```

**Statute reconciliation (#774, checked per the #1886 overlap rule):** #774's forced invariant has
two parts — (i) *never silently un-earn enforcement* (the explicit-set discipline) and (ii) *new
routes enter warn-only*. Ruling (b) **preserves (i)** (the inversion strengthens enforcement and
keeps an explicit, reviewable set — now of exceptions) and **openly supersedes (ii) from the drain
milestone onward**, as a plain successor ruling on changed facts (the sanctioned
supersession-with-lineage path, `we:docs/agent/platform-decisions.md:38-39` — never a retro-edit of
#774): rider (ii)'s real justification — born-enforced entry over a largely-unmeasured site yields a
permanently red lane — *dissolves* once the site is fully measured, drained, and green, and the
measured evidence (3 red warn-only routes first seen by this prep) shows warn output is ignored in
practice. #774's named broken alternative ("reset every route to warn-only") only ever justified
part (i); rider (ii) rode along without its own invariant-grade justification, which makes it
severable. *Supporting background, not the supersession ground:* #774's "(most-permissive default)"
aside reads as the classification-Q6 principle, whose home is author-facing standard dimensions
(`we:docs/agent/backlog-workflow.md:369`), not the repo's own CI gate — but #774 never explicitly
cited Q6, so the supersession does not rest on that scope limit. When ruled, codify the flip beside
the #774 lineage with an explicit "supersedes #774 rider (ii) because the drained-set condition it
never contemplated inverts the risk profile" line.

Skeptic: SURVIVES-WITH-AMENDMENT — default (b) intact ("experimental surfaces" absorbed by the `WARN_ROUTES` opt-out; measured warn-ignored evidence kills perpetual warn; drain trigger is a decidable predicate, not an unresolved placeholder); five landed corrections folded in: supersession re-grounded as plain successor-ruling-on-changed-facts (the "scoped to bootstrapping / no authority" narrowing dropped, Q6 demoted to background since #774 never explicitly cited it), #840/#844/#477 + fail-closed-classifier precedents cited, self-announcing drain trigger added, post-flip sitemap-fetch hard-fail added (the `we:tests/a11y/sitemap-routes.ts:96` fallback dies with the set), scope-C sample-rotation consequence named. Issue-949 churn citation verified live.
Screen: clear — entry posture is directly observable (a new page post-drain ships advisory-only vs build-fails until green or explicitly opted out); fail-open vs fail-closed is a correctness/a11y merit difference that survives cost-stripping; the timing-shaped element is a decidable trigger condition, and the genuinely timing-only variant (c) is a rejected alternative, not a branch; named consequences correctly positioned as consequences of the ruling, not the fork.

## Supported by default (not decisions)

- **Promotion mechanism** — a manual set edit and a helper report (e.g. a `--list-promotable` script
  that diffs green warn-only routes against `ENFORCED_ROUTES`) are both coherent and coexist; the
  helper is optional tooling, separately prioritized. Not a fork.
- **Remediation/promotion order** — pure prioritization (#1961); any order drains the same set.
- **Per-repo mirroring** — the policy ruled here applies to each repo's own gate ("mirrored, not
  shared", the #774/#849 precedent): the FUI site's empty seed drains under the same Fork 1/Fork 2
  rulings against `fui:tests/a11y/sitemap-routes.ts`. Whether that drain is tracked here or as a
  sibling slice is slicing, not merit.

## Planned spin-offs at ratification (build items, `blockedBy` this decision unless noted)

1. **Fix the 5 enforced-route regressions** (`/`, `/adapters/`, `/blocks/`, `/intents/`,
   `/protocols/` — SSR `we-card` tile color-contrast + one `nested-interactive`). *Not blocked by
   this decision* — the enforced lane is red **now** under the already-ratified posture; fileable
   immediately.
2. Remediate the 3 red warn-only routes (`/semantics/`, `/web-contexts/`, `/rules/backlog-workflow/`).
3. Promote the measured-green routes per the Fork 1 ruling (mechanical set edit + a fresh measurement
   run at promotion time).
4. FUI-site mirror drain: measure `fui:` scope-C routes, remediate, seed FUI's `ENFORCED_ROUTES`
   (`fui:tests/a11y/sitemap-routes.ts:21`) per the same rulings.
5. The Fork 2 endgame flip, triggered at the drained-and-green milestone (per-repo). The flip item
   owns: the posture inversion, the sitemap-fetch hard-fail, and rewriting the "FORCED INVARIANT
   (#774)" headers in both gate files with the supersession lineage. A small precursor rides with
   spin-off 3: the self-announcing drain meta-check in the lane (flags "drain complete — execute the
   #867 flip" when `ENFORCED_ROUTES` equals the derived set), so the trigger cannot rot unnoticed.

---

## Ruling (2026-07-09)

Ratified after discussion + red-team; both forks landed on their prepared defaults.

- **Fork 1 → (a) decoupled promotion.** A scope-C route enters `ENFORCED_ROUTES` the moment it
  measures green, regardless of FUI-conversion state; branch (b) is the rejected broken branch (it
  removes the guard at the riskiest edit — the conversion — as the 5-route regression shows). A
  forced-invariant ratify of #774's green-only criterion, not a new weigh.
- **Fork 2 → (b) flip to enforce-by-default at the drained-and-green milestone.** Keep #774's
  warn-only entry while draining; once `ENFORCED_ROUTES` equals the derived set and the lane is
  green, invert to build-blocking-unless-in an explicit `WARN_ROUTES` opt-out set. Supersedes #774
  rider (ii) as a successor-ruling-on-changed-facts (part (i), the explicit-set discipline, is
  preserved). Alternatives (c) flip-all-now and (d) violation-baseline are rejected on merit.
  - **Rider accepted at ratify — pull the self-announcing drain trigger *forward*.** The
    "drain complete — execute the #867 flip" meta-check ships with the **promotion** spin-off (#3),
    not deferred into the flip spin-off (#5): the whole (b) case rests on the milestone being
    noticed, and a red enforced lane already went unnoticed for a week — the reminder must exist
    *before* the milestone, not after.
  - **Codification note:** when the flip lands (#5), record the #774 rider-(ii) supersession lineage
    in `we:docs/agent/platform-decisions.md` beside the #774 entry and rewrite the "FORCED INVARIANT
    (#774)" headers in both gate files.

Route lists in the Digest are from the 2026-07-02 measurement — re-measure at execution time rather
than trusting them verbatim.

---

## Context

**Lineage.** Parent epic #777 (dogfood WE-docs on FUI). Conversions: chrome #865 (→
`we:src/_data/chrome.js`), page-UI #866 (children #1598–#1601), index pages #2018/#2019/#2020,
detail-page sweep #2021 (open; #2098 done, #2099–#2106 open). Gate: #763 (ratified axe lane, warn→
enforce ratchet) → #770 (built) → #793/#805 (10 routes flipped to enforce) → #774 (auto-derivation
decision) → #846 (`we:src/sitemap.njk`) / #847 (scope-C derivation). FUI mirror: #771 → #849.
Keystones #2016/#2017 resolved 2026-07-01.

**Reclassification history (2026-07-02, batch-2026-07-02 parallel run).** A batch lane claimed the
original story and landed zero files (`blocked-in-fact`): the declared `blockedBy: [865, 866]` was
stale (both resolved) and the ratchet *infrastructure* already existed, but no concrete residual work
was specified. Reclassified story → decision asking whether anything is left and in what shape —
(a) confirm+close / (b) mechanical promotion / (c) rollout-strategy. This prep answered it by
measurement: see the Digest verdict.
