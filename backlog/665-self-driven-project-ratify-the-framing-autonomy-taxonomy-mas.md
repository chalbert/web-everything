---
type: decision
workItem: story
size: 5
status: resolved
dateOpened: "2026-06-15"
dateStarted: "2026-06-15"
dateResolved: "2026-06-15"
graduatedTo: none
preparedDate: "2026-06-15"
tags: [self-driven-project, autonomy, methodology, positioning, branding, sdlc, conformance, plateau]
relatedReport: reports/2026-06-15-self-driven-project-prior-art.md
crossRef: { url: /backlog/666-self-driven-project/, label: "Self-Driven Project epic (#666)" }
---

# Self-Driven Project: ratify the framing, autonomy taxonomy & master brand

**No design exists yet** — this decision ratifies the framing for the **Self-Driven Project** (epic
[#666](/backlog/666-self-driven-project/)) before its slices open. The forks below are grounded in a
prior-art survey **published at [`/research/self-driven-project/`](/research/self-driven-project/)**
(session report via `relatedReport`), each carrying a **bold** recommended default. The concept: the
self-driving-car model applied to the whole SDLC — a human sets the goal + a tolerance/risk envelope,
the system drives the steps (design → code → test → ship → monitor → upgrade) gated/transparent/
reversible, escalating **only on tolerance breach**. Strong parallel to *coding by intention*.

## How the concern decomposes (the axes, with refs into the real tree)

The research surfaced **four orthogonal axes**; three are genuine calls, one dissolves to a ratify:

- **Autonomy level** — *already substantially ratified.* The dev-browser fix-loop ladder
  (report-only → propose → live-verify → open-PR, **default open-PR**) was ratified in
  [#141 Fork 2](/backlog/141-dev-browser-vision/), riding the verify-gated autofix engine
  ([scripts/autofix/engine.mjs:15](../scripts/autofix/engine.mjs#L15) — the gate; `maxRounds` backstop
  [engine.mjs:242](../scripts/autofix/engine.mjs#L242); the human `decide` hook
  [engine.mjs:247](../scripts/autofix/engine.mjs#L247)). The open part is only *how to express it for
  the whole SDLC* → **Fork 1**.
- **Tolerance envelope (the ODD)** — the value/risk dimensions that throttle autonomy per step. The
  *model* (value/risk-as-ODD) is our novel flag (ratify, below); the open part is the dimension
  *set/shape* → **Fork 2**.
- **The artefact contract** — everything-as-code, tool-agnostic, so a foreign tool can drive it. The
  ground-truth gate already exists as the 3-state capability matrix
  ([capabilityMatrix.json:1](../src/_data/capabilityMatrix.json#L1)) and the gate-severity seam lives in
  plateau-app (`Gate.blocksDeployment`, [profiles.ts:34](../../plateau-app/src/profiles/profiles.ts#L34)).
  This is a **forced invariant**, not a fork (below).
- **The brand** — the load-bearing positioning call, complicated by "Project" already naming a WE
  entity ([projects.json:1](../src/_data/projects.json#L1)) → **Fork 3**.

## Recommended path at a glance

| Fork | Recommended default | Main alternative | Confidence |
|------|--------------------|------------------|------------|
| 1 · autonomy scale | Adopt a public **SAE-numbered L0–L5** scale; map #141's verb-rungs onto it; add an L0 "report-only" floor | Keep only #141's verb-rungs, dev-loop-scoped | **Med-low** — mostly ratify (#141 stands) |
| 2 · dimension model | **Open, extensible registry** + a default flavor of five (ISO 25010:2023-anchored); rename "working software" → **"value increment"** | A closed canonical set of five | **Low** (shape) / **Low** (rename) |
| 3 · master brand | **Yes — master brand** over #563 + the AI-driven-IDE thread; brand word resolves the "Project" overload | Siblings, or narrow-to-SaaS-product | **Med — the real call** |

## Ruling — RATIFIED 2026-06-15

Premise (Nic): getting the long-term solution perfect upfront is near-impossible — and unnecessary,
because most of this decision is **cheap to evolve** (everything-as-code + reversible by design). So it
is ratified as **framing, not a lock**, with an explicit self-refining mechanism. The ruling is tiered
by *switching cost*, not treated uniformly:

- **Firm — the invariants below. Ratified outright.** Principles, low-regret, durable.
- **Provisional defaults — Forks 1 & 2. Ratified as the running defaults, expected to revise.** Both
  low-divergence and cheap to change (the autonomy scale is a vocabulary; the dimensions are an **open
  registry** by construction). The bold defaults are adopted now; perfecting them is not required.
- **Fork 3 (brand) — direction ratified, costly bits deferred under the protocol.** Ratified: there
  **is** a master brand over #563 + the AI-driven-IDE thread, and it is "self-**driven**" (never
  "self-driving" — Oracle). **Deferred** (not open — held under the revision protocol, tracked as A4/A5):
  the **exact public name**, the **#563 rename**, and the **"Project" overload** resolution, settled when
  the first SaaS surface surfaces friction. These re-enter this item (brand direction is firm) rather
  than resolving silently.

### Assumptions & friction protocol (the self-refining mechanism)

Every default above is an **assumption with a validation trigger**, not a settled truth. Friction met
while building the epic ([#666](/backlog/666-self-driven-project/)) is logged back here and revises the
default in place — `preparedDate`/this register are the durable record, not chat.

| # | Assumption (the default) | Validate by / revise-on trigger | Status |
|---|--------------------------|----------------------------------|--------|
| A1 | SAE L0–L5 public scale maps cleanly onto #141's rungs (Fork 1) | first real per-step autonomy config that doesn't fit a rung | open |
| A2 | The 5-dim default flavor + open registry is enough (Fork 2) | first project that needs a dimension outside the five | open |
| A3 | "value increment" reads better than "working software" | first control-plane copy review with a non-technical user | open |
| A4 | Master brand subsuming #563 + AI-driven-IDE is the strongest framing (Fork 3) | friction naming/positioning the first SaaS surface | open |
| A5 | The "Project" overload is harmless (context disambiguates) | first user/doc that conflates a Self-Driven Project with a WE standards Project | open |
| A6 | A third-party PM tool can drive the artefacts (no-lock-in invariant) | first attempt to point a foreign tool at the artefact contract | open |

> Ratifying this item **does not freeze** it: it sets the provisional defaults running and commits us to
> the register. Revising a provisional default later is normal upkeep, not a re-opened decision —
> *unless* the change touches a **firm invariant** or the **brand direction**, which re-enters here.

## Forced invariants (ratify, not weigh)

Not forks — WE first principles applied (fork-existence test: no coherent alternative, or exactly one
correct branch). Stated up front so the calls stay crisp.

- **Value/risk-as-ODD is the organizing thesis (our novel flag).** Every lifecycle activity is
  value-creation or risk-mitigation; the risk side, described by named quality dimensions, is the
  per-activity **autonomy dial** (the SAE Operational Design Domain / tolerance envelope). The survey
  found this in **no** prior framework — adopting it *is* the project, not a weighed branch. Lead the
  public novelty claim with it + the ground-truth gate.
- **Methodology and tooling are codified *separately* — no lock-in.** The methodology is tool-agnostic
  **everything-as-code**: the autonomy level, the tolerance envelope, the per-step gate definitions, the
  dimensions, and the run evidence are declarative, version-controlled artefacts. Any tool *we* ship
  (the SaaS control plane [#666](/backlog/666-self-driven-project/) §B, the dev-browser
  [#141](/backlog/141-dev-browser-vision/)) is a **non-blocking consumer** — never the owner. **Litmus:
  a third-party project-management tool must read and drive the *same* artefacts and take over the
  loop.** Classification: that artefact contract legitimately **is a Protocol** — the one place a
  foreign tool must interoperate/swap, i.e. minimize-lock-in's single escapable lock. (Work-tracker data
  is a genuine open-standard white space — report §7.4 — so this is novel *and* defensible.)
- **Non-blocking by construction.** No tool we provide may be a *required* step — removing it degrades
  the experience, never the project's ability to run. (Mirrors [#578](/backlog/578-fix-loop-git-integration-bot-pr-mechanics-flow-forge-auth-ag/):
  generated artefacts ride the same open gates; no privileged/owned path.)
- **Everything-as-code is the substrate.** Goals, tolerances, gates, dimensions, evidence are
  declarative config under version control — diffable, reviewable, revertible — which makes
  "transparent + reversible" literally true (anchors: Red Hat IaC, OpenGitOps Principles v1.0.0).
- **Per-step, per-project autonomy — never a global switch.** A project may run implementation at a
  high level while deploy stays low.
- **Honest prior-art positioning** *(was a fourth "fork"; dissolved — there is no coherent alternative
  to telling the truth).* In every public artefact, state plainly that "SAE-levels-for-the-SDLC" is
  convergent community content (not a ratified standard) — cite ASDLC.io & Dash0 — and lead novelty with
  the value/risk-ODD dial + the ground-truth gate that those frameworks lack (they stop at "CI green +
  human review").

## Supported by default (not decisions)

The existing machinery is **consumed as-is**, not re-decided: the #141 dev-loop ladder *stands*; the
verify-gated autofix engine ([#095](/backlog/095-conformance-auto-fix-agent/)), the evergreen lifecycle
([#099](/backlog/099-evergreen-app-vision/) / [#100](/backlog/100-requirement-as-code/)), the IDE bridge
([#562](/backlog/562-dev-browser-source-awareness-ide-bridge-map-deployed-dom-bac/)), the
not-privileged invariant ([#578](/backlog/578-fix-loop-git-integration-bot-pr-mechanics-flow-forge-auth-ag/)),
the live-patch carve-out ([#410](/backlog/410-dev-browser-deployed-app-live-patch-gated-capability-safety-)),
and the gate-severity enum ([#166](/backlog/166-governance-persona-roster-charter-schema/)) are all
existing children this framing gathers, not forks to ratify.

## Fork 1 — The public autonomy scale (express, don't re-decide)

**Crux.** #141 already ratified *that* there's a configured autonomy ladder for the dev-loop
([#141 Fork 2](/backlog/141-dev-browser-vision/): report-only → propose → live-verify → open-PR, default
open-PR). **That call stands — this fork does not reopen it.** The only open question: how to express
autonomy across the *whole* SDLC, given the published ladders (ASDLC.io, Dash0) number on a
**review-gating axis** that lines up with #141's rungs, while none of them has an L0 "report-only" floor.

**Ruling (2026-06-15): (A) — adopt as a provisional default** (revise-on-friction A1).

- **(A — recommended) Adopt a public SAE-numbered L0–L5 scale; map #141's verb-rungs onto it; add the
  L0 floor.** report-only = **L0** (our addition); propose = L1–L2; live-verify + open-PR = L3
  conditional; auto-merge = L3.5; live-patch/deploy = L4–L5 (system becomes its own fallback). Cite
  ASDLC/Dash0/Tessl + arXiv 2509.06216 (which explicitly calls for "a framework analogous to the SAE
  Levels"); claim no origination. **Merit:** a legible, marketable, prior-art-aligned vocabulary that
  generalizes per-step and carries the brand metaphor (ODD, request-to-intervene).
- **(B) Keep only #141's verb-named rungs, dev-loop-scoped; introduce no public numbered scale.**
  *Merit downside:* can't express per-step autonomy across design/test/deploy/upgrade, and forfeits the
  metaphor the whole framing leans on. *Rejected* unless the brand (Fork 3) lands narrow.

> Do **not** map onto Swarmia's ladder — it numbers by agent topology (single → swarm), a different
> axis; its L4/L5 are not comparable to ASDLC/Dash0's review-gating L4/L5 (report §7.1).

## Fork 2 — The value/risk dimension model: open registry + default flavor + a rename

**Crux.** The value/risk-as-ODD *model* is ratified above (invariant). Open: is the dimension list a
**closed set** or an **open registry**, and what is "working software" called?

**Ruling (2026-06-15): (A) open registry + default flavor; rename → "value increment"** — provisional
defaults (revise-on-friction A2/A3).

- **(A — recommended) An open, extensible registry with a default flavor of five.** Default flavor:
  performance · security · accessibility · the-value-feature · upgradeable/decoupled, anchored to
  **ISO/IEC 25010:2023** (now **9** quality characteristics — *safety* added; usability → interaction
  capability, portability → flexibility; ISO calls them "quality requirements," not NFRs). Projects add
  their own dimensions. **Merit:** matches WE's most-flexible-default + Config-Extends-Platform-Default
  + intents-open-design principles, and the *extensible-quality-model* precedent is strong — FURPS+ (the
  "+" is literally an extension slot), SEI/ATAM (open scenarios, a growing set), arc42 (184-quality
  default tailored into a per-project quality tree).
- **(B) A closed canonical set of five.** *Merit downside:* WE has no business mandating a fixed quality
  taxonomy (same reason intents are an open system); it can't absorb a project's own risk axis.
  *Rejected.*

**Sub-decision (genuine pick): rename "working software."** Default **"value increment"** (alts:
*functional value*, *feature delivery*). It's the one pure value-creation dimension beside performance's
UX half; "working software" reads as a status, not a dimension.

## Fork 3 — "Self-Driven Project" as the master brand (the real call)

**Crux.** Does "Self-Driven Project" become the **master brand** that the methodology
([#563](/backlog/563-ai-driven-agile-methodology-as-a-shareable-approach/)) and the AI-driven-IDE /
dev-browser thread sit *under*? It works at three altitudes — a **SaaS product** (gating made legible to
non-technical people), a **shareable methodology** (#563), and **our own dogfooded practice** (our
backlog loop already *is* decision + gating + review + transparency + reversibility — the credibility
proof).

**Ruling (2026-06-15): (A) direction ratified — master brand, "self-driven".** The exact public name,
the #563 rename, and the "Project" overload are **deferred under the revision protocol** (A4/A5), settled
at the first SaaS surface — not left open, held with a trigger.

- **(A — recommended) Yes — master brand; rebrand #563 *as* Self-Driven Project; AI-driven IDE becomes a
  *component*.** **Merit:** the strongest, most memorable umbrella; the car metaphor does real
  explanatory work (levels, ODD/tolerance, request-to-intervene) that "AI-driven" doesn't; and it's
  distinctive against the crowded generic "agentic SDLC" category.
- **(B) Siblings** — Self-Driven Project = product/methodology; AI-driven IDE = its own thread.
- **(C) Narrow** — Self-Driven Project = the SaaS product only; #563 stays as-is.

**Sub-decisions surfaced by the brand survey (report §7.5):**
- **Avoid "self-driving" — it's strongly Oracle's** (self-driving database). Use "self-**driven**"; keep
  away from "self-driving database/infra/SDLC" in copy.
- **"Project" overloads a WE entity** ([projects.json:1](../src/_data/projects.json#L1) — webregistries,
  webinjectors… are each a "Project"). Resolve by either accepting the overload (context disambiguates:
  a *Self-Driven* Project is a mode of working, not a standards Project) **(default)** or choosing a
  non-"Project" noun for the brand. *This is the one place a human's taste genuinely decides.*

---

## Context

### The SAE ↔ SDLC mapping (Fork 1 detail)

| Our SDLC rung | SAE | Published ladder | Fallback |
|---------------|-----|------------------|----------|
| report-only | **L0** *(our addition)* | — (none have it) | human does all |
| propose | L1–L2 | ASDLC L1–L2 / Dash0 L1–L2 | human, continuous |
| live-verify + open-PR | L3 conditional | ASDLC L3 / Dash0 L3 (*approve evidence, not diff*) | human, on request |
| auto-merge | — | Dash0 **L3.5** Selective Auto-Merge | human veto on risky areas |
| live-patch / deploy | L4–L5 | ASDLC L4–L5 / Dash0 L4–L5 | system self-recovers in-domain |

SAE L2→L3 is the load-bearing boundary (L2: human part of the task; L3: system does the whole task,
human is fallback; L4: system is its own fallback).

### What the epic ([#666](/backlog/666-self-driven-project/)) carries once this lands

- The **step-tree** (§A) — every lifecycle step × automatable data-driven gate × ceiling autonomy level.
- The **non-technical control plane** (§B) — tolerance dials + jargon-translated gate dashboard +
  escalation inbox, in plateau-app (a non-blocking consumer of the artefacts).
- The **developer-role thesis** (§C) — little/no human-written code; human input = planning +
  validation; value concentrates in **gate authoring**.
- The **brand rollout** (§D) — propagate the Fork-3 decision; publish the value/risk-ODD framing.
- Umbrella links over the existing children (#141/#095/#099/#100/#562/#578/#410/#166/#089/#563).

> Working scratch that seeded this (delete on file): `SELF-DRIVEN-PROJECT-DRAFT.md` at repo root.

**Graduated to** `none` — ratification — spawned #666 Self-Driven Project epic (+ no-lock-in artefact Protocol).
