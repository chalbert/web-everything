---
kind: decision
status: resolved
dateOpened: "2026-07-02"
dateStarted: "2026-07-02"
dateResolved: "2026-07-02"
graduatedTo: 2129
tags: [sequencing, external-validation, pilot-adopter, polyglot, dogfood, gated-deploy, governance]
relatedReport: reports/2026-07-02-external-validation-sequencing.md
preparedDate: "2026-07-02"
codifiedIn: "docs/agent/platform-decisions.md#forward-target-start-gate"
---

# External-validation sequencing: pilot adopter before the polyglot widening

**RATIFIED 2026-07-02 — all three defaults confirmed, with two ratify-turn amendments to Gate A's criteria**
(consumption-channel prerequisite + generated-artifact leg pinned to existing targets; see the ratify-turn
skeptic record under Gate A). **Ruling:** Gate A GO (pilot story #2129, channel #2128); Fork 1(b) staged
evidence ladder (claims-truth audit #2127 gates #1137; ungated-public stage #2130 `blockedBy` #867); Fork 2(a)
hard per-target evidence-citing start-gate, codified at
[we:docs/agent/platform-decisions.md#forward-target-start-gate](docs/agent/platform-decisions.md) (#1735
exempt; enforcement follow-up #2131).

Originally prepared: the 2026-07-01 external review's sequencing finding, decomposed against the **2026-07-02
tree** (two of the review's premises moved the same day it ran) and grounded in a prior-art survey of how
standards bodies and platform projects gate scope widening on independent evidence — published as the
[/research/external-validation-sequencing](/research/external-validation-sequencing/) topic (session report via
`relatedReport`). The item decomposes into **one validation-gate (Gate A — commit to a pilot adopter, with
concrete success criteria) and two forks (Fork 1 — the order's gate DAG; Fork 2 — hard vs advisory polyglot
gate)**, each with a bold recommended default, each skeptic-attacked at prep and re-attacked at ratification.

## Grounding digest — what is true on disk (2026-07-02)

- **Review finding (the trigger):** *"polyglot generation (#463/#507) is ratified while zero external JS users
  exist … recommended order: dogfood → gated deploy → one pilot adopter with success criteria → only then the
  enterprise/polyglot story"* (we:reports/2026-07-01-program-external-consultant-review.md:21, finding 2 at :26).
- **Dogfood is real-but-partial, not aspirational:** the SSR keystone #2016 resolved with live code
  (we:.eleventy.js:280 → we:scripts/lib/component-render-build-hook.cjs;
  fui:blocks/renderers/component-render/buildHarness.ts), chrome migrated (#865/#864 resolved), home grid SSR'd
  (#2019 resolved), page-UI sweep #866 resolved (2026-07-02). Open: #2018/#2020/#2021 (SSR surfaces), #867
  (ratchet, now unblocked); epic #777 open.
- **Parity keystone shipped, zero targets measured:** #2017 resolved (fui:plugs/webtheme/manifestLoader.ts);
  #1243 superseded-as-stub by open #2022; #2022–#2025 all open.
- **Gated deploy is technology-ready, human-gated:** #1137 open with `humanGate: deploy`
  (we:functions/_middleware.js splash gate built; runbook we:functions/README.md; analytics decided #1136).
- **The polyglot mechanism's first increment is ALREADY BUILT:** #463 ratified 2026-06-13, codified at
  [we:docs/agent/platform-decisions.md#forward-generation-adapters](docs/agent/platform-decisions.md); build
  epic #507 resolved 2026-06-15 — IR emit engine #547, first .NET target #548 (compile fix #661), conformance
  gate #549 (via #506), regression corpus #551. Un-built polyglot scope: further language targets (never
  filed), the emit-purpose IR widening (#1735, `parked`). Any gate here is **prospective** — it governs the
  next widening, never retracts shipped artifacts (no surveyed process retracts shipped increments either).
- **No pilot-adopter *story* exists** in we:backlog/ (grep 2026-07-02) — the stage the review found missing is
  genuinely unfiled. But adopter-**recruitment collateral already shipped**: the enterprise-adopter deck
  (#1214 outline, #1360 render — both resolved) carries the very "we eat our own cooking" claim the review
  flagged as aspirational, so recruitment cannot open on it until the claims-truth audit (Fork 1(b)) passes.
  **Zero external users** is the review's assertion (:11); nothing on disk contradicts it.
- **#1735 is not merely "parked":** it carries a **ratified empirical trigger** —
  `maturityTrigger: adoptionSignal:idiomatic-vue-svelte-angular-emitters-shipped`, per
  [we:docs/agent/platform-decisions.md#forward-emit-dedicated-ir](docs/agent/platform-decisions.md) (#939),
  whose body explicitly rules "not a backlog edge — the gate is empirical". Fork 2 must compose with that,
  not stack a second gate over it (reconciled below).

## Axis framing

Three orthogonal elements, standing-tested individually (classification recorded per section):

- **The pilot-adopter stage itself** — a candidate with no rival branch → **validation-gate archetype** (Gate A).
- **The order** — which prerequisite edges gate the gated deploy, the pilot, and the ungated-public stage →
  a genuine either/or over rival gate DAGs (Fork 1).
- **The polyglot gate's force** — a deterministic `blockedBy` edge vs an advisory note → a genuine either/or
  over one mechanism (Fork 2).

Not a config dimension (a repo-governance gate DAG is single-valued — there is no per-consumer knob), and not
contract-derived (no WE standard contract is being classified; this is constellation process law). The
*not-a-prioritization* screen is applied inside each section: the claims below are **evidence-input ordering
invariants** (what must be known before what may be built), never now-vs-defer schedule picks.

## Recommended path at a glance

| Element | Recommended default | Main alternative | Confidence |
|---|---|---|---|
| **Gate A** — pilot adopter | **GO — commit to exactly one criteria-bound external pilot (including one generated-artifact consumption leg); recruitment starts when the gated deploy is live** | stay internal-only until parity/polyglot mature (refuted in-section) | High — every surveyed process requires the evidence this supplies |
| **Fork 1** — validation order | **(b) staged evidence ladder as `blockedBy` edges: gated deploy once the claims-truth audit passes (bar is claim-indexed, not inventory-indexed) → pilot on the live deploy → ungated public on the full dogfood ratchet** | (a) strict serial: full dogfood before any deploy | Med-high — the claims-truth bar is the one judgment line |
| **Fork 2** — polyglot gate force | **(a) hard per-target evidence-citing start-gate, bootstrapped by a `blockedBy` edge to the pilot-evidence item; #1735 stays under its own ratified empirical trigger** | (b) advisory statute note | Med-high — the encoding layer's judgment residual is real (see Skeptic) |

## Gate A — commit to one external pilot adopter (validation-gate, not a fork)

**Verdict: GO, sequenced — high confidence on the commitment, medium on the criteria values.** Commit now to
exactly one external pilot adopter with the success criteria below; recruitment begins when the gated deploy
(#1137) is live (the pilot's subject must be a stable, reachable surface).

**What you're deciding.** Whether "one external pilot adopter with defined success criteria" earns a roadmap
place as the constellation's first external-evidence instrument — and what its concrete criteria and evidence
artifact are. At ratification this spawns a `kind: story` pilot item (`blockedBy: ["1137"]`) carrying the
criteria; that item is the node Fork 2's edges point at.

**Why this isn't a classic fork (and is still a decision).** There is no rival *instrument*: an open beta
contradicts the in-flight gated-rollout plan (#1104 — an open epic with a `humanGate`d controlled rollout,
cited as the operative plan, not as a ratified statute), and more internal testing is not *external* evidence
by definition. The one tabled alternative — **stay internal-only until parity/polyglot mature — is refuted,
not weighed:** internal evidence cannot substitute for external on any maturity schedule (every surveyed
process treats internal suites as necessary-but-never-sufficient), and each further internally-ratified
widening *increases* the unverified-assumption stock the pilot exists to check — waiting makes the instrument
less informative, not safer. So this is a one-sided go/no-go on a candidate stage — the third standing-test
outcome.

**Prior-art delta.** Every surveyed process makes independent experience a hard graduation input: TC39 Stage 4
(≥2 shipped implementations + test262 + practical experience), W3C CR exit (two independent interoperable
implementations), IETF operational experience (RFC 6410), Kubernetes beta→GA (real-world usage), Rust
stabilization (experience reports), design-system pilot-team practice (1–3 real teams, timed, criteria-bound).
WE has the internal half at or above field norm (the #506 golden-vector suite, the standards gate, 2,003 unit
tests) and the external half at zero — the review's "running open-loop." The pilot is the smallest instrument
that supplies the missing input.

**Recommendation — the concrete shape (these values are the recommended default, not placeholders):**

- **One** external team (not an open beta), building a **production-bound** JS/TS surface.
- **Scope:** adopts ≥3 FUI blocks + ≥2 WE intents on that surface, consuming only published artifacts
  (docs site + packages), no constellation-insider support beyond what the docs provide (that *is* the test).
- **Consumption-channel prerequisite (ratify-turn skeptic find):** "published artifacts" is satisfiable
  through **no filed path today** — `@frontierui/blocks` is `"private": true` (fui:blocks/package.json), the
  first real npm publish (#907) covers `@webeverything/contracts` only and is itself human-gated, gen-wrapper
  output is served only by the localhost workbench, and MaaS live-serve is parked (#1625). So the pilot story
  is `blockedBy` a named **pilot consumption channel** story (spawned at ratification, itself `blockedBy` #907):
  publish/deliver the pilot-scoped artifact set — the adopted FUI blocks/plugs plus ≥1 generated-wrapper
  artifact — consumable by an external team without insider support.
- **Generated-artifact leg (required for the Fork 2 un-gate), pinned to existing targets:** the pilot consumes
  **≥1 forward-generated artifact** — a gen-wrapper framework wrapper (fui:tools/gen-wrapper) for an **existing
  emit target (react or vue today)**, delivered as generated source through the consumption channel — so the
  retro produces evidence about the **forward-generation contract surface** (generated idioms; serve-path IR if
  MaaS matures first), the exact thing Fork 2 claims needs an external check. A pilot that only touches
  blocks + intents un-gates nothing on the polyglot axis. **Recruiting a stack that would require a *new*
  target (Svelte/Angular/etc.) is out of pilot scope** — a new target is exactly what Fork 2(a) gates on this
  pilot, so leaving the leg unpinned would let the recruiter walk into a self-deadlock (pilot needs a target
  the pilot itself gates).
- **Window:** 6 weeks from first integration commit.
- **Evidence thresholds:** ≥5 filed issues **or** one written gap report; plus a **written retro** with an
  explicit continue/churn verdict and reasons, including a section on the generated-artifact leg.
- **Success** = the adopter ships the surface and states they would continue unprompted. **The retro artifact
  (success or instructive failure) is the un-gate trigger Fork 2 consumes.** A *failed* pilot does **not**
  silently un-gate polyglot widening: it re-opens this decision as a normal reversal turn (the evidence then
  argues about direction, not just timing).

**Skeptic:** SURVIVES-WITH-AMENDMENT — two attacks landed and were folded in: (1) *instrument mismatch* — as
first drafted the pilot (blocks + intents on a JS/TS surface) produced **zero** evidence about the
forward-generation contract Fork 2 gates on; fixed by adding the required generated-artifact consumption leg
above (without it, Fork 2's "evidence-input" rationale collapsed into demand-timing — the forbidden
prioritization frame). (2) *"no rival branch" contradicted the glance table's "stay internal-only"
alternative* — that alternative is now explicitly refuted in-section rather than silently tabled. Also
demoted: the "#1104 ruling" citation → an in-flight plan (an open epic is scope, not statute — the
verify-ratified-citation rule). The criteria values (6 weeks, ≥5 issues) were attacked as arbitrary and
survive as explicit ratifier-overridable defaults; what is structural is that a named retro artifact exists.

**Ratify-turn skeptic (2026-07-02, second pass against the live tree):** REFUTED-THEN-AMENDED — two new
attacks landed on this gate and are folded in above: (1) *supply-chain hole* — the generated-artifact leg was
added at prep without re-checking its consumption channel; no filed path made "published artifacts"
satisfiable (fixed: the consumption-channel story + `blockedBy` edge). (2) *latent self-deadlock* — an
unpinned leg lets recruitment select a stack requiring a new emit target, which Fork 2(a) gates on this very
pilot (fixed: leg pinned to existing targets, new-target stacks out of pilot scope). Re-attacked after
amendment: the gate DAG is linear (audit → deploy #1137 → pilot; channel ← #907; polyglot ← pilot) — no cycle,
both humanGates are real prerequisites honestly encoded. SURVIVES.

## Fork 1 — the validation order: which gate DAG

**Fork-existence:** genuine either/or — the branches are rival `blockedBy` DAGs over the same items; an edge
present in one is absent in another, and the composability probe fails (an item cannot simultaneously be
gated and not gated on the same prerequisite; a "gate you may ignore" is Fork 2's advisory branch, not a
coexistence here). **Honest narrowing (from the skeptic's free-to-build screen):** if the full dogfood were
free and instant, (a) and (b) converge — so the surviving *merit* axis is not "how much dogfood" but
**which claim-state may face which audience** (an audience-indexed truthfulness question, which is not a cost
question). (a) and (b) are two thresholds on that one axis; the decision's real content is the threshold pick
plus the two concrete edges it produces.

**Crux.** What must be *true on disk* before (i) the gated deploy goes live, (ii) pilot recruitment starts,
(iii) the splash comes off. The review said "dogfood → gated deploy → pilot"; the tree moved under it — the
dogfood is now truthful for chrome + one SSR surface (#865/#2016/#2019 resolved) with the sweep open
(#866/#867, #2018–#2021).

- **(a) Strict serial.** Full dogfood (#777 complete, incl. the #867 ratchet) gates the gated deploy; deploy
  gates the pilot. *Merit pro:* maximal claim integrity — no external eye ever sees a non-dogfooded surface;
  the site is the conformance proof (#777), so an un-migrated page shown to the pilot misrepresents maturity.
  *Merit con:* it withholds the external-evidence channel that is itself the binding **validity** input (the
  open-loop risk: every internally-ratified widening compounds assumptions no user has checked); and it
  over-reads the statute — [we:docs/agent/platform-decisions.md#first-party-dogfood](docs/agent/platform-decisions.md)
  mandates the end-state and its preservation, not a pre-deploy completeness bar. The harm it guards against
  is already mitigated: the deploy is splash-gated to an *invited* audience (#1137).
- **(b) Staged evidence ladder (default).** Each stage is gated on the evidence the *claims at that stage*
  require. The **gated deploy**'s bar is **claim-indexed, not inventory-indexed**: every externally visible
  dogfood/maturity claim must be true of the deployed artifact — *scope the claim or ship the surface*. The
  truthful-core inventory (chrome #865, SSR keystone #2016, home grid #2019) makes that bar **meetable
  today, but it is met only once a named claims-truth audit passes** — a concrete pre-deploy node (spawned at
  ratification) that sweeps the site's published claims **and the adopter deck (#1214/#1360, both resolved,
  which currently carries the exact "we eat our own cooking" claim the review flagged as aspirational)**.
  **Pilot recruitment** is `blockedBy` the live deploy (#1137) — its subject must be stable and reachable.
  The **ungated public stage** (splash off, #1104's later notches) is `blockedBy` the full dogfood ratchet
  (#867) plus a re-run of the claims audit. *Merit pro:* claims trail evidence at every stage (the Baseline
  norm — status is an evidence state, never a roadmap claim) while the external-evidence channel opens at the
  earliest truthful moment; matches the field norm that dogfood gates the *public claim*, not all internal
  progress (Polaris shipped from a dogfooded admin; the admin never halted for extraction).
- **(c) Pilot-first / parallel outreach.** Recruit now, deploy later. *Rejected:* the pilot's subject would
  be a moving, unreachable target — the evidence produced is unattributable (is a failure the standard's or
  the unshipped site's?), and it spends the singular external-goodwill asset on an unverifiable claim;
  pilot-team practice is uniform that a pilot runs against a stable surface with defined criteria.

**Default: (b) — the staged evidence ladder, encoded as `blockedBy` edges** (pilot item `blockedBy: ["1137"]`;
the ungated-public stage item under #1104 `blockedBy` #867). The deploy itself stays a `humanGate` (a
credentialed human act, not an agent-resolvable edge — the existing #1137 encoding is already correct).

*Rejected — (a):* its extra gate protects an audience the splash gate already restricts, at the price of the
validity input; the dogfood statute doesn't demand it. *(a)'s truth lives on in (b)*: the full ratchet gates
the **ungated** stage, where the audience is genuinely public.

**Skeptic:** SURVIVES-WITH-AMENDMENT — two attacks landed. (1) *Internal contradiction:* the draft declared
the truthful-core bar "**already met**" inventory-style while simultaneously defining it claim-indexed — and
the resolved adopter deck (#1214/#1360) still ships the flagged claim; fixed: the bar is met only once the
named claims-truth audit (deck included) passes, now a concrete pre-deploy node. (2) *Fork inflation:* under
the free-to-build screen (a)/(b) converge, so (a) is a **stricter threshold on the same audience-indexed
truthfulness axis, not a rival principle** — the fork-existence line now says so, and the decision's content
is honestly stated as the threshold pick + the two edges. The attack on (b) via the review's literal
"dogfood → deploy" order fails: the review is a finding, not a statute, and its own strategy lens calls the
deploy chain "technology-ready and human-gated" — consistent with (b).

## Fork 2 — the polyglot gate: hard `blockedBy` edge vs advisory

**Fork-existence:** genuine either/or over one mechanism — a `blockedBy` edge deterministically removes an
item from every selection pool until the blocker resolves (we:docs/agent/backlog-workflow.md → "blockedBy — a
directional prerequisite edge"); an advisory note leaves it selectable. The same item cannot be both. (c)
no-gate is the named excluded branch: it is the state that already produced the drift under review.

**Crux.** The drift the review found happened under **no sequencing rule at all** — branch (c)'s state: #463
was ratified 2026-06-13 and its first target built by 2026-06-15, weeks *before* any recommended order
existed (the review ran 2026-07-01). So history falsifies (c), and the (a)-vs-(b) question is undecided by
history: it turns on whether an invariant a selector cannot see is worth having. This is **not**
prioritization: run the free-to-build screen — if the Java target were free and instantly maintained, a merit
difference remains, because a widening built without external evidence risks **standardizing the wrong
contract** (the serve-path IR and target idioms have never met a consumer who didn't write them — which is
exactly why Gate A's generated-artifact leg is *required*: the un-gate evidence must reach that contract
surface, or the gate degenerates into demand-timing). The codified rule is the start-gate sibling of the
ratified release-gate mechanic in #463 fork (c): **"every new target's start cites current external-adopter
evidence"** — per-target and repeatable, like "the conformance suite gates every target's release" — with the
Gate-A pilot retro as its **bootstrap instance**, not its permanent satisfaction (a Java target filed years
later cites *current* evidence, not a stale first retro).

- **(a) Hard prospective gate (default).** Every **new** polyglot-widening item — defined by **predicate,
  not by item list**: *an item that adds a new generation target or emit form (a further language target
  such as Java/Go, a new wrapper form, any new forward-generation scope)* — carries a `blockedBy` edge to
  the Gate-A pilot-evidence item (the bootstrap), and the codified rule requires every later target's start
  to cite *current* adopter evidence. **Out of the gate by the same predicate:** work that *consumes existing
  emit forms and adds no new target/form* — maintenance/bugfix of shipped artifacts (#547/#548/#549/#551,
  the #506 suite) and the workbench live-test panel family (#912, #967, #1030/#1031, #1761/#1762, which
  serve/mount already-generated wrappers) — stays ungated; a "workbench child" that in fact adds a new emit
  form fails the predicate and is gated. **#1735 is exempt from the edge:** it already carries a *ratified*
  empirical trigger (`adoptionSignal:idiomatic-vue-svelte-angular-emitters-shipped`, per
  `#forward-emit-dedicated-ir`, which explicitly ruled "not a backlog edge") — its governing gate is that
  trigger; this decision must compose with it, not stack a second gate (and note the two gates *agree in
  kind*: both are adoption-evidence triggers). *Merit pro:* structural encoding is the uniform prior-art
  shape (stage machines, CR exit tests, feature gates — never memos), and it is what the repo's own DAG
  machinery exists for. **Enforceability, honestly:** the gate is deterministic *once encoded* (a `blockedBy`
  edge removes the item from every selection pool); the obligation to *add* the edge at scaffold time is
  statute-enforced judgment, not script-enforced — the codified anchor gives a reviewing agent a citable
  rule, and a tag-keyed `check:standards` rule (items matching the predicate's tags must carry the edge or a
  carve-out marker) is a worthwhile follow-up build, filed at ratification.
- **(b) Soft advisory.** A statute-level sequencing note; items stay selectable. *Rejected:* an invariant a
  selector cannot see is a wish, not a gate (the hookable-vs-judgment rule: script-decidable → deterministic),
  and every surveyed process that works encodes the evidence gate structurally; advisory-only leaves the
  filing-layer judgment residual (above) as the *entire* mechanism instead of its last mile.
- **(c) No gate.** *Rejected (the broken branch, and the falsified one):* it is the state the drift actually
  happened under (no rule existed in June); affirms open-loop widening, which every surveyed process forbids.

**Default: (a) — the hard prospective gate.** Concrete encoding (the decision turn applies it; prep edits no
other item's frontmatter):

```yaml
# 1) Gate-A pilot-evidence item — spawned as #2129, a real, resolvable DAG node:
kind: story
status: open
blockedBy: ["1137", "2128"]  # Fork 1(b): recruitment needs the live gated deploy + the consumption channel
# body: the Gate-A success criteria + the retro artifact as its acceptance

# 2) every NEW polyglot-widening item (per the predicate), at scaffold time (e.g. the Java target):
kind: story
blockedBy: ["2129"]        # bootstrap: the first adopter evidence gates the next target's start
# later targets: the codified rule requires citing CURRENT adopter evidence, fork-(c)-style
# 3) #1735 stays under its own ratified empirical trigger (#forward-emit-dedicated-ir) — NO extra edge
```

Why a `blockedBy` edge and not a `humanGate`: the prerequisite is a real, resolvable backlog item (the pilot
story resolves when its criteria are met), which is precisely the DAG relation; `humanGate` is for a one-line
human residual with no resolvable tracker node. Why not gate the *ratified* #463 statute: the ruling stands —
the gate composes with `#forward-generation-adapters` (it adds a start condition for new targets alongside
the existing release condition), it reverses nothing.

**Skeptic:** SURVIVES-WITH-AMENDMENT — the skeptic landed four attacks on this fork and every one is folded
in: (1) *instrument mismatch* — the pilot as first drafted never touched the forward-generation contract, so
the gate's "evidence-input" rationale collapsed into demand-timing (the forbidden prioritization frame);
fixed via Gate A's required generated-artifact leg. (2) *missed governing anchor* — `#forward-emit-dedicated-ir`
already gates #1735 by a ratified empirical trigger ("not a backlog edge"); fixed by exempting #1735 and
reconciling the anchor below. (3) *false history* — "advisory already failed" was untrue (no rule existed in
June; the review postdates the drift); struck, (b)'s rejection re-grounded on hookable-vs-judgment + the
structural prior-art norm, and this fork's confidence demoted High → Med-high. (4) *one-shot gate* — a single
`blockedBy` edge is permanently satisfied after the first retro, which oversold the #463 fork (c) analogy;
fixed by codifying a per-target *current-evidence* rule with the pilot retro as its named bootstrap instance.
A fifth, partial attack (the edge-adding obligation is judgment at the filing layer) is now stated honestly
in (a) with the tag-keyed gate rule filed as a follow-up.

## Supported by default (not decisions)

- **Dogfood work continues regardless of the order chosen** — #866/#867/#2018–#2021 are mandated by the
  standing statute (`#first-party-dogfood` names regression a gated defect); no branch of Fork 1 stops or
  relicenses them.
- **The deploy's `humanGate` encoding stays** — a credentialed human act is not an agent edge (#1137/#1104
  are already correctly shaped).
- **Maintenance of shipped polyglot artifacts** (#547/#548/#549/#551, the #506 suite) and the **workbench
  validation surface** (#912 family) proceed ungated under any branch of Fork 2.
- **Analytics for the public site** is settled (#1136, resolved) — the pilot's telemetry rides it, no new call.

## Per-element classification (the 7-question pass, recorded)

1. **Layer:** none — this is constellation process law (statute layer), not a block/intent/protocol/capability;
   nothing enters we:src/_data/*.json.
2. **Protocol?** No — no multi-vendor interop surface; the "contract" here is a backlog DAG shape.
3. **Intent axis to expose?** N/A (no UX dimension).
4. **Fixed mechanic or dimension?** Fixed mechanic — a gate DAG is single-valued repo governance; there is no
   per-consumer legitimate-end-state pair (this is why neither fork is a config dimension).
5. **DI-injectable?** N/A.
6. **Most-permissive default?** Deliberately inverted, and named: a *gate* is a restriction, so Q6's
   most-permissive bias is overridden by the forced-invariant character of the evidence-input claim — the
   permissive branch (no gate) is the named broken branch, per the prior-art survey.
7. **Seam:** the pilot item sits at the WE↔world seam; its edges touch #1137 (deploy) and future `fui:`/target
   items — encoded as ordinary cross-item `blockedBy`, no new mechanism.

## Statute-overlap & citation-scope (reconciled at prep)

- **[we:docs/agent/platform-decisions.md#forward-generation-adapters](docs/agent/platform-decisions.md)** —
  the ratified polyglot mechanism. **No conflict:** Fork 2(a) adds a prospective *start* condition for new
  targets beside that anchor's existing *release* condition (the conformance suite); the ratified mechanism,
  SoT, and suite are untouched. At codification, the sequencing rule should be written as a sub-clause or
  sibling anchor that cites it, never a rewrite.
- **[we:docs/agent/platform-decisions.md#forward-emit-dedicated-ir](docs/agent/platform-decisions.md)** (#939)
  — **the directly-governing child anchor the first draft missed (skeptic find):** it already holds #1735 on
  a ratified **empirical adoption trigger** ("designed once the idiomatic Vue/Svelte/Angular emitters
  accumulate real cases", encoded as `maturityTrigger` on #1735, explicitly "not a backlog edge").
  **Reconciliation:** #1735 is exempt from Fork 2(a)'s edge — its ratified trigger is its governing gate; the
  two gates agree in kind (both adoption-evidence triggers) and compose by scope (the edge governs *new
  targets/forms*; the trigger governs *that specific IR widening*). The codified rule must cite this anchor
  and state the exemption, never override it.
- **[we:docs/agent/platform-decisions.md#first-party-dogfood](docs/agent/platform-decisions.md)** — mandates
  the dogfood end-state + preservation. **Scope check:** it does *not* state a deploy-ordering rule, so it is
  supporting context for Fork 1, not authority for branch (a); Fork 1(b) composes with it (the ratchet gates
  the ungated stage; regression stays a gated defect throughout).
- **The review report** (we:reports/2026-07-01-program-external-consultant-review.md) is an audit *finding*,
  not a statute — cited throughout as evidence, never as authority; where the tree moved after it ran, the
  tree wins.
- **Sibling in-flight decision #2088** (portfolio tiering, `preparing`): tier vocabulary/assignment is its
  turf; the evidence-gate mechanism is this item's. A tier map may *label* polyglot "deferred"; only this
  item's edges *gate* it. Compose — whichever ratifies second cites the other; no shared rule is rewritten.

---

## Context

- Lineage: filed by the external-consultant-review program run 1 (2026-07-01), finding 2. Siblings filed the
  same run: #2080 (CI), #2082–#2087 (enforcement gaps), #2088 (tiering).
- Graduated at ratification (2026-07-02) to: **#2129** the Gate-A pilot story (`blockedBy: ["1137","2128"]`,
  criteria incl. the pinned generated-artifact leg), **#2128** the pilot consumption channel (`blockedBy:
  ["907"]` — the ratify-turn skeptic's supply-chain fix), **#2127** the claims-truth audit pre-deploy node
  (site + adopter deck #1214/#1360; #1137 now `blockedBy: ["2127"]`), **#2130** the ungated-public stage under
  #1104 (`blockedBy: ["867"]` + audit re-run), **#2131** the tag-keyed `check:standards` edge-presence rule
  (Fork 2's enforcement follow-up), and the codified statute anchor
  [we:docs/agent/platform-decisions.md#forward-target-start-gate](docs/agent/platform-decisions.md) (sibling
  of `#forward-generation-adapters`, citing `#forward-emit-dedicated-ir`; #1735 exempt). Future
  polyglot-widening items take `blockedBy: ["2129"]` (bootstrap) then current-evidence citations per the
  anchor.
