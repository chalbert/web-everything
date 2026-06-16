# Self-Driven Project — prior-art survey & novelty grounding

**Date**: 2026-06-15
**Point**: The self-driving-car model applied to the whole SDLC (human sets goal + tolerance, AI drives the steps, gated/transparent/reversible, escalates on tolerance breach) is **already named and published** — convergently, by ~a dozen authors in 2024–2026, all citing SAE J3016 — but as **blog/community content, not a ratified standard**. We should cite that space, not claim it. What is **genuinely ours** is (a) the **value-creation vs risk-mitigation partition of all lifecycle work, bound to five NFR dimensions, used as the autonomy *dial* (risk-bucket = the ODD that throttles autonomy per step)**, and (b) a **verify gate with real ground truth** — a machine-checkable conformance standard — which the published frameworks lack (they stop at "CI green + human review").
**Backlog item**: [backlog/665-self-driven-project-ratify-the-framing-autonomy-taxonomy-mas.md](../backlog/665-self-driven-project-ratify-the-framing-autonomy-taxonomy-mas.md) · epic [backlog/666-self-driven-project.md](../backlog/666-self-driven-project.md)

---

## 1. SAE J3016 — the central metaphor (get it exactly right)

SAE J3016 "Taxonomy and Definitions for Driving Automation Systems" (2021 rev) — six levels 0–5.
The two load-bearing concepts we borrow:

- **L3 "conditional automation" + "request to intervene":** the system performs the entire task
  *within limited conditions* but requires a **fallback-ready human** it hands back to on an
  out-of-scope situation. → our "stop only if something goes beyond your tolerance."
- **ODD (Operational Design Domain):** *"the specific conditions under which the system is
  designed to function"* (weather, road, speed). L5's ODD is unlimited; L0 has none. → **our
  tolerance/risk envelope.** Underpinned by the **Dynamic Driving Task (DDT)** = the real-time work.

Sources: https://www.sae.org/standards/content/j3016_201609/ ·
https://blog.ansi.org/ansi/sae-levels-driving-automation-j-3016-2021/

## 2. "Coding by intention" — established lineage (cite, don't claim)

- Kent Beck, *Smalltalk Best Practice Patterns* (1997) — "intention-revealing method name."
- David Bernstein, *Essential Skills for the Agile Developer* — "Programming by Intention" /
  "what before how." https://www.oreilly.com/library/view/essential-skills-for/9780321700469/ch01.html
- Charles Simonyi — **Intentional Programming** / Intentional Software (program as an editable
  tree of *intentions* from which code is derived). https://en.wikipedia.org/wiki/Intentional_Software
- 2026 arXiv *"Intent Formalization: A Grand Challenge for Reliable Coding in the Age of AI
  Agents"* — closes intent-as-spec to autonomous agents (verify the arXiv ID before formal cite).

## 3. Autonomy levels for the SDLC — already published, NOT a standard (be skeptical)

This is where our concept already exists most literally — and it is **convergent
blog/community/marketing content, not a ratified standard.**

- **ASDLC.io — "Agentic Software Development Life Cycle"** (May 2026), the closest full match:
  *"inspired by SAE J3016… autonomy levels are formal classifications of operational risk."*
  L1 Assistive → L2 Task-Based → **L3 Conditional (production ceiling; human "Change Owner"
  approves PRs)** → L4 High (post-hoc audit) → L5 Full (closed-loop). Has Context Gates,
  drift-tolerance halt+notify (= our escalation), deterministic validation standards, telemetry,
  reversibility. https://asdlc.io/concepts/levels-of-autonomy/
- **Dash0 — "Six Levels of Agentic Software Engineering"** documents the convergence: *"more than
  a dozen independent authors, 2024–2026, all citing SAE J3016."* Best line for us: *"the human
  role does not shrink as AI grows — it moves up the abstraction ladder."*
  https://www.dash0.com/knowledge/the-six-levels-of-agentic-software-engineering
- Also: Swarmia (https://www.swarmia.com/blog/five-levels-ai-agent-autonomy/), Zencoder "Autonomy
  is a Dial, Not a Switch" (https://zencoder.ai/newsletter/autonomy-is-a-dial-not-a-switch),
  Cloud Security Alliance (https://cloudsecurityalliance.org/blog/2026/01/28/levels-of-autonomy).
- More rigorous, non-SE-specific: arXiv **2506.12469** *Levels of Autonomy for AI Agents*; arXiv
  **2509.06216** *Agentic Software Engineering: Foundational Pillars*.
- Capability evidence under the levels: **SWE-bench** (2,294 real GitHub issues — the field's
  autonomy yardstick), **SWE-agent**, **Devin** (Cognition, 2024). https://cognition.ai/blog/introducing-devin

**Skeptical read:** there is genuine academic work on *agent autonomy levels in general*, but the
specific **SAE-levels-for-the-SDLC** mapping is practitioner/marketing content. No body has
ratified it. Treat ASDLC.io as the most complete prior art, **not** a citable norm.

## 4. "Levels of autonomy" reused outside driving

- **TM Forum Autonomous Networks** — a *validated* L0–L5 maturity model for telecom (most
  operators still L1–L2). The strongest real (non-marketing) precedent.
  https://www.tmforum.org/missions/autonomous-networks
- **Oracle Autonomous Database** — "self-driving, self-securing, self-repairing." Note: **three
  pillars, not an L0–L5 ladder** — be precise. The trio maps to value (driving) vs risk
  (securing/repairing). https://www.oracle.com/autonomous-database/what-is-autonomous-database/
- AIOps / self-driving infrastructure — same closed-loop, escalate-on-exception pattern.

## 5. Gated, reversible delivery — textbook substrate we build *on top of*

- **Progressive delivery** (James Governor / RedMonk): canary, blue-green, feature flags, A/B as
  graduated automated gates replacing manual UAT.
- **GitOps** + automated canary analysis (Argo Rollouts/Flagger). **Policy-as-code / OPA** =
  "strict standards enforced as a gate." **Reversibility** via feature flags / git-revert /
  blue-green / immutable infra. DORA/Continuous Delivery is the umbrella.
- https://www.weave.works/blog/stop-doing-progressive-delivery-manually-use-gitops-instead ·
  https://www.harness.io/blog/harness-policy-as-code

Not novel — it's the existing substrate our AI "driver" runs on. Novelty is letting the *AI*
clear those gates autonomously up to a tolerance, not the gates themselves.

## 6. Value-creation vs risk-mitigation × 5 NFR dimensions — our most novel framing

Closest prior art, none an exact match:
- **Validation vs verification** ("build the right thing vs build it right") — nearest two-bucket
  analogue, but about target-vs-build correctness, not value-vs-risk.
- **Lean value-stream mapping** — value-add vs non-value-add; different vocabulary.
- **Risk-based testing** — formalizes the *risk* bucket, not the value/risk dichotomy of *all* work.
- **The five dimensions → ISO/IEC 25010**: performance → performance efficiency; security →
  security; accessibility → usability/accessibility; "working software/revenue feature" →
  functional suitability; upgradeable/decoupled → maintainability (modularity).
  https://quality.arc42.org/standards/iso-25010

**Verdict:** the *components* are all named prior art. What was **not** found anywhere: partition
*every* lifecycle activity into exactly value-creation vs risk-mitigation, tie the risk side to
those five NFR dimensions, and use that as **the dial that sets the AI's autonomy envelope per
activity** (risk-bucket = the ODD that throttles autonomy). That synthesis is our contribution.

## Bottom line — novel vs prior art

| Element | Status |
|---|---|
| SAE levels as the metaphor | Prior art (correct, well-defined) |
| Human sets intent ("coding by intention") | Prior art (Beck → Bernstein → Simonyi) |
| L0–L5 autonomy *for the SDLC* | **Already published** — ASDLC.io + Dash0 + ~12 authors (blog/community, **no ratified standard**) |
| ODD-as-tolerance, escalate on breach | Prior art (J3016 L3; ASDLC drift halts; TM Forum) |
| Gated, transparent, reversible delivery | Prior art (progressive delivery, GitOps, OPA, blue-green) |
| Autonomy levels reused in other domains | Prior art (TM Forum = real; Oracle DB = 3 pillars, not 5 levels) |
| **Value/risk partition of all SDLC work × 5 NFR dims as the autonomy dial** | **Genuinely novel framing** |
| **Verify gate with machine-checkable ground truth (the conformance standard)** | **Our moat** (#089) — published frameworks stop at "CI green + human review" |

## 7. Deep-prep additions (2026-06-15) — mapping, registry, everything-as-code, lock-in, brand

A second research pass for the #665 prep sharpened five things:

### 7.1 The autonomy ladder maps on a *review-gating* axis (and we add an L0 floor)
The published agentic-SDLC ladders number by **review/merge gating**, which lines up with the repo's
own dev-browser rungs. Swarmia's ladder numbers by **agent topology** (single → swarm) and is **not
comparable** — don't mix the two. Clean mapping:

| Our SDLC rung | SAE | ASDLC.io | Dash0 | Fallback |
|---------------|-----|----------|-------|----------|
| report-only | **L0** *(our addition — none of the published ladders have it)* | — | — | human does all |
| propose | L1–L2 | L1 Assistive / L2 Task-Based | L1 AI-Assisted / L2 AI-Generated-Human-Reviewed | human, continuous |
| live-verify + open-PR | L3 conditional | L3 Conditional ("production ceiling") | L3 AI-Generated-Auto-Reviewed (*approve evidence, not diff*) | human, on request |
| auto-merge | — | (within L3/L4) | **L3.5 Selective Auto-Merge** | human veto on risky areas |
| live-patch / deploy | L4–L5 | L4 High / L5 Full | L4 Mostly-Autonomous / L5 Dark-Factory | system self-recovers in-domain |

SAE L2→L3 is the load-bearing boundary (at L2 the human is part of the task; at L3 the system does the
whole task with the human as fallback; at L4 the system is its *own* fallback). The SAE analogy is
**explicitly endorsed prior art** — Tessl ("learning from self-driving cars") and arXiv 2509.06216 both
call for "a hierarchical framework analogous to the SAE Levels." So #141's already-ratified ladder just
needs **expressing on the public scale**, not re-deciding.

### 7.2 ISO/IEC 25010:2023 is now NINE characteristics — and the list should be an OPEN registry
The 2011→2023 revision went **8→9**, adding **safety**, and renamed **usability → interaction
capability** and **portability → flexibility**. ISO calls them **"quality requirements," not NFRs**
(borrow that vocabulary). Corrected dimension mapping:

| Our dimension | Bucket | ISO/IEC 25010:2023 |
|---------------|--------|--------------------|
| Performance (UX + cost) | value | performance efficiency |
| Security | risk | security |
| Accessibility | risk | interaction capability (incl. accessibility) |
| "Working software" (revenue feature) | value | functional suitability |
| Upgradeable / decoupled | risk | maintainability (modularity) + flexibility |

**The five should not be a closed list.** Strong precedent for an **extensible registry with a default
flavor** (Config-Extends-Platform-Default): FURPS+ (the "+" is *literally* an extension slot, HP/IBM
Rational), SEI/ATAM (open quality-attribute scenarios; the attribute set grows edition-to-edition),
arc42 (a 184-quality default catalog tailored into a per-project *quality tree*). ISO's top level is
fixed per-revision but is applied by *selecting/tailoring* to context. → model the dimensions as an
open registry, the five as the platform default.

### 7.3 Everything-as-code is the substrate (anchors)
Anchor "transparent + reversible is literally true" on two canonical sources: **Red Hat — Infrastructure
as Code** (version-controlled, declarative desired state → auditable + revertible) and **OpenGitOps
Principles v1.0.0** (CNCF): *declarative · versioned-and-immutable (full history) · pulled automatically
· continuously reconciled*. Members of the umbrella: IaC, configuration-as-code, **policy-as-code**
(OPA/Rego), pipeline-as-code, docs-as-code — all "declarative + version-controlled + reviewable +
revertible."

### 7.4 No-lock-in: open artefacts a third-party tool can drive — and a real white space
The "store the source-of-truth as open, version-controlled, declarative artefacts; tools are
interchangeable readers" pattern is **well-precedented**: GitOps names it for infra; per-category neutral
schemas under neutral bodies prove the play — **SARIF** (OASIS, analysis findings), **SPDX**
(LF / ISO 5962) & **CycloneDX** (OWASP) for SBOM, **OpenTelemetry**/**OPA**/**CloudEvents** (CNCF),
**OSCAL** (NIST, compliance-as-code). **But work-tracking / project-management data is a genuine WHITE
SPACE** — there is *no* adopted open work-item interchange standard; portability is lossy CSV and is
non-portable *even within one vendor* (GitLab CE↔EE). The repo's **backlog-as-version-controlled-Markdown
is docs-as-code applied to exactly that gap.** This is what makes the user's "a third-party PM tool could
take over the same artefacts" requirement both **novel and defensible**. Classification: the artefact
contract legitimately **is a Protocol** (the one place a foreign tool must interoperate/swap — the single
escapable lock minimize-lock-in permits); our tools are non-blocking consumers of it.

### 7.5 Brand collision check
"Self-Driven Project" / "self-driven development" has **no direct product/framework/book collision**.
But **"self-driving" is strongly Oracle's** (the self-driving database, marketed verbatim
"self-driving, self-securing, self-repairing") — so lean on "self-**driven**" and avoid "self-driving
database / infrastructure / SDLC" in copy. "**Agentic SDLC**" is the crowded generic category (Sonar,
Cisco, Baytech). Internal clash: **"Project" already names a WE standard entity** (projects.json —
webregistries, webinjectors…), so the brand overloads an existing term — a Fork-3 sub-decision.

---

**Positioning guidance:** don't claim the SAE-levels-for-SDLC mapping as original — cite ASDLC.io
and Dash0 and position *inside* that emerging (un-standardized) space. Lead the novelty claim with
the **value/risk × 5-NFR-dimensions autonomy-envelope** and the **ground-truth gate**; anchor to
ISO 25010 + risk-based testing so it reads as rigorous. Being explicit that "levels of autonomy
for software engineering" is convergent blog content, not a standard, is itself a differentiator.
