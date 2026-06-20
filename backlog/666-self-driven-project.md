---
kind: epic
status: open
ongoing: true
dateOpened: "2026-06-15"
tags: [self-driven-project, autonomy, methodology, sdlc, conformance, plateau, positioning, saas]
relatedReport: reports/2026-06-15-self-driven-project-prior-art.md
crossRef: { url: /backlog/665-self-driven-project-ratify-the-framing-autonomy-taxonomy-mas/, label: "Framing decision (#665)" }
---

# Self-Driven Project

> **Reopened 2026-06-20 (`ongoing: true`).** Resolving this 2026-06-16 was premature — it is the perpetual *vision umbrella* (the whole-SDLC self-driving north star), not a finite build; the framing decision [#665](/backlog/665-self-driven-project-ratify-the-framing-autonomy-taxonomy-mas/) stays resolved, but the program itself is continuous and stays `open`.

Umbrella for the **Self-Driven Project**: the self-driving-car model applied to the whole SDLC. A
human **sets the goal + a tolerance/risk envelope**; the system **drives the steps**
(design → code → test → ship → monitor → upgrade), **gated step-by-step**, every step under a
**strict machine-checkable standard**, **fully transparent and reversible**, escalating/stopping
**only when something exceeds the configured tolerance**. Strong parallel to *coding by intention*:
*you set the goal, not the details of how you get there.*

**Framing ratified 2026-06-15 via [#665](/backlog/665-self-driven-project-ratify-the-framing-autonomy-taxonomy-mas/)** —
the public autonomy scale (SAE-numbered L0–L5 mapped onto #141's ratified rungs), the value/risk-as-ODD
dial (dimensions as an **open, extensible registry** with a default flavor), the **no-lock-in invariant**
(methodology codified separately from tools, as tool-agnostic everything-as-code a third-party PM tool
could drive), and the **master-brand direction** ("self-driven", over #563 + the AI-driven-IDE thread)
are all ratified — as **provisional defaults under a revision protocol** (#665's Assumptions & friction
register), not a frozen spec. This epic is now **unblocked**; its slices can be carved. Prior art +
novelty grounding:
[we:reports/2026-06-15-self-driven-project-prior-art.md](../reports/2026-06-15-self-driven-project-prior-art.md)
· [`/research/self-driven-project/`](/research/self-driven-project/).

> This is largely an **umbrella over existing work** plus the missing connective tissue. Filed
> comprehensively on purpose — split into discrete child slices once #665 settles scope (worst case
> we split later). Working scratch that seeded it: `we:SELF-DRIVEN-PROJECT-DRAFT.md` at repo root.

## The deep idea (why this framing earns its keep)

*Code beauty / how it's set up was never the goal — it has always been a tool to reach the adequate
real criteria.* The system is free to pick any implementation that clears the gates; we judge
**outcomes**, not aesthetics. The gate — not the code — is the contract. Two concepts borrowed
precisely from SAE J3016: **L3 "request to intervene"** (a fallback-ready human the system hands
back to) and the **ODD / Operational Design Domain** (= our tolerance/risk envelope). The autonomy
level is **per-project and per-step** — not a global switch.

## Existing children (umbrella links)

Already-existing machinery this epic gathers under one roof:

- **[#141](/backlog/141-dev-browser-vision/)** — dev-browser autonomy ladder + verify-gate loop.
- **[#095](/backlog/095-conformance-auto-fix-agent/)** — propose-and-verify auto-fix (shipped).
- **[#099](/backlog/099-evergreen-app-vision/)** / **[#100](/backlog/100-requirement-as-code/)** — the evergreen lifecycle + requirement-as-code.
- **[#562](/backlog/562-dev-browser-source-awareness-ide-bridge-map-deployed-dom-bac/)** — IDE-bridge substrate.
- **[#578](/backlog/578-fix-loop-git-integration-bot-pr-mechanics-flow-forge-auth-ag/)** — AI code not privileged; evidence carries autonomy level.
- **[#410](/backlog/410-dev-browser-deployed-app-live-patch-gated-capability-safety-)** — higher-autonomy live-patch carve-out.
- **[#166](/backlog/166-governance-persona-roster-charter-schema/)** — gate-severity enum + persona-scoped views.
- **[#089](/backlog/089-monetization-product-ideas/)** — the propose-and-verify moat / monetization.
- **[#563](/backlog/563-ai-driven-agile-methodology-as-a-shareable-approach/)** — the methodology this may rebrand (per #665 Fork 3).
- **[#1249](/backlog/1249-define-program-strictly-the-four-part-bar-for-a-perpetual-on/)** (the *program* discipline) + the **currency-watch portfolio** — [#1257](/backlog/1257-platform-standards-watch-keep-we-current-as-the-web-platform/) platform-standards, [#1258](/backlog/1258-framework-churn-watch-keep-we-s-forward-adapters-current-as-/) framework-churn, [#1259](/backlog/1259-model-capability-watch-plateau-keep-on-device-cost-linearity/) model-capability (siblings #315/#192) — the **monitor / upgrade autonomy** rows of the step-tree made real: the project keeps itself current via the `/review-program` watch runner, no human driving each step. "Program"/"watch" are the internal mechanism; **Self-Driven Project** is the outward name they roll up into.

## Working practice — self-refining, capture friction (per #665 ruling)

This epic's framing ([#665](/backlog/665-self-driven-project-ratify-the-framing-autonomy-taxonomy-mas/))
is ratified as **provisional defaults under a revision protocol**, not a frozen spec — the methodology
refines itself as we build (dogfooding #563). So every slice below carries a standing instruction:

- **Validate assumptions as you go.** Each slice checks the #665 *Assumptions & friction protocol*
  register (A1–A6) for any assumption it exercises; if the slice's work confirms or breaks one, **update
  that row's status in #665 in the same close-out** (don't leave the finding in chat).
- **Capture friction the moment it appears.** Anything that didn't fit the framing — a rung that doesn't
  map, a needed dimension outside the five, a naming clash, a tool that can't drive the artefacts — is
  logged as a new register row in #665, with the slice that surfaced it.
- **Revising a provisional default is normal upkeep, not a re-opened decision** — *unless* it touches a
  firm invariant or the brand direction, which re-enters #665 as a fresh call.

## Net-new slices — carved 2026-06-15 (`/slice 666`)

Sliced into child items after #665 ratified the framing (report:
[we:reports/2026-06-15-backlog-split-analysis.md](../reports/2026-06-15-backlog-split-analysis.md)):

- **§A → [#671](/backlog/671-self-driven-project-step-tree-every-sdlc-step-automatable-da/)** — the step-tree artifact (story·3).
- **§D → [#672](/backlog/672-self-driven-project-tool-agnostic-artefact-contract-everythi/)** — the tool-agnostic artefact-contract Protocol (story·3, the foundation).
- **§C → [#673](/backlog/673-self-driven-project-developer-role-thesis-author-the-positio/)** — the developer-role thesis, authored as a positioning section into #563 (task).
- **§B → [#674](/backlog/674-self-driven-project-non-technical-control-plane-plateau-app-/)** — the non-technical control plane (tracking story·8, `blockedBy #672`, `locus plateau-app`); **not yet sliceable** — re-`/slice` in plateau-app context once #672 lands.
- **§E (brand rollout)** — **deferred (tracked at #665)**: its core (exact public name, #563 rename, "Project" overload) is a *deliberately deferred fork* already tracked as **#665 A4/A5**; it re-enters #665 on first-SaaS-surface friction. The publishable residual (the value/risk-ODD framing) rides #671/#672's public artefacts; the #143 approach page stays parked.

The §A–E sections below are retained as the authoring seed for each slice.

### A. The step-tree — every project step × automatable gate × ceiling autonomy level
The core brainstorm artifact: the full, complete tree of every step a project goes through, and for
each row — *(a)* the deep property we actually want (outcome, not implementation), *(b)* the
measurable data-driven gate that replaces today's human-judgment gate, *(c)* whether that gate is
automatable today / what's missing, *(d)* therefore the ceiling autonomy level for that step.
First-cut skeleton (to fill in):

| Step | Today's gate (often human) | Automatable data-driven gate | Bucket | Ceiling |
|------|----------------------------|------------------------------|--------|---------|
| Requirement / intent capture | PM judgment | requirement-as-code (#100), spec coverage | value | L2? |
| Design / UX | design review meeting | design-ref diff + a11y conformance; **A/B test** vs manual room | value+risk | L3 once A/B replaces the room |
| Implementation | code review | conformance suite + type/lint + tests green | value | L3 (#095/#141) |
| Security | pentest / authz review | policy-as-code, SAST/DAST, authz envelope | risk | L2–L3 (envelope-bound) |
| Accessibility | manual audit | automated WCAG / EN 301 549 conformance | risk | L3 |
| Performance | perf review | perf budgets, synthetic + RUM thresholds | value | L3 |
| Integration / E2E | QA sign-off | E2E from declared rules | value/risk | L3 |
| Release / deploy | change-advisory board | progressive delivery + canary analysis | risk | L3–L4 |
| Upgrade / migration | manual migration project | migration scripts + revert (#101/#102) | risk | L3–L4 |
| Monitor / operate | on-call human | SLO breach → auto-revert without redeploy | risk | L4 |

**The general mechanic:** a step is self-driveable only if its gate is automatable; replacing a
human-judgment gate with a data-driven one (the A/B-vs-room example) is what lets it pass the
self-driven gate — or you deliberately cap the step at a lower level (a legitimate choice).

### B. The non-technical control plane (SaaS product surface)
Expose the technical gating to **non-technical people** — founder, PM, compliance officer. The
sellable surface is *autonomy made legible*; the car metaphor is exactly what lets a layperson plan
the trip and watch the dashboard without understanding the engine. They:
- **Set the goal + tolerance envelope in plain language** (the "trip planner"), at intent altitude.
- **Watch a dashboard** where each gate is translated out of jargon ("Accessibility: ⚠️ 2 issues blocking launch", not "axe: 2 violations").
- **Handle escalations** as the L3 request-to-intervene in plain words ("AI wants to change how payments are stored — above your risk limit. Approve / adjust / send back?").
- **See the audit trail / reversibility** as "what changed, why, undo" — not git.

Maps gate severities (#166) + autonomy levels onto **persona-scoped views**; recurring
regulatory/assurance budget line (#089). **Constellation fit: this control plane is the plateau-app
(product) layer** (#091 managed-offering layering) — standard + taxonomy stay in WE, drivers/agents
in Frontier UI. *Open (per draft §7): own slice/epic, or a cross-cutting requirement that every step
in (A) must project a plain-language gate into, plus one dashboard/escalation-inbox shell slice (lean).*

### C. The developer-role thesis
In a fully self-driven project there is **little to no code written by a human**; human input is
**planning + validation**. The role *moves up the abstraction ladder* (Dash0): **planner/intent
author** + **validator** (reviews *proof, not diffs*) + **fallback-ready operator** (L3 intervene) +
**gate/standard author** — the residual deeply-technical role that builds *the road and the sensors
the car drives on* and doesn't commoditize. The inversion to state explicitly: **as app-code
authoring evaporates, value concentrates in gate authoring.** Nuance: code quality still matters —
for the *machine* operator's ability to keep driving (upgrade/recover), so "maintainability" stays a
real risk dimension. *Likely a positioning note inside [#563](/backlog/563-ai-driven-agile-methodology-as-a-shareable-approach/), not its own build.*

### D. The tool-agnostic artefact contract (everything-as-code, no-lock-in Protocol)
The load-bearing decoupling slice (per #665 invariants). Codify the methodology as **tool-agnostic,
version-controlled, declarative artefacts** — the autonomy level, the tolerance/risk envelope, the
per-step gate definitions, the value/risk dimensions, and the run evidence — so a **third-party
project-management/CI tool could read and drive the same files** (our SaaS control plane §B and the
dev-browser #141 are *non-blocking consumers*, never owners). The artefact contract is a **Protocol**
(minimize-lock-in's single escapable lock). Prior art: GitOps ("declarative desired state in Git",
OpenGitOps v1.0.0) + the per-category neutral-schema play (SARIF/SPDX/CycloneDX/OTel/OPA/OSCAL);
**work-tracking data is a genuine open-standard white space** (no adopted work-item interchange format —
report §7.4), and the repo's backlog-as-Markdown is docs-as-code applied to that gap. *Likely the
foundation slice the others compose on.*

### E. Brand / positioning rollout
Once #665 Fork 3 settles, propagate the master-brand decision: rebrand #563 if adopted, position the
AI-driven-IDE thread as a component, update the public approach page (#143), resolve the "Project"-word
overload, and publish the value/risk-ODD framing.
