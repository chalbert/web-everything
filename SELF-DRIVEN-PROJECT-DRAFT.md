# DRAFT — "Self-Driven Project" (working doc, not a backlog item yet)

> Temp scratch file to refine the idea before we mint the epic. Nothing here is
> committed/ratified. Delete when the epic is filed. **Nic to add more ideas inline.**

---

## 0. The idea in one breath

A **self-driven project** is the self-driving-car model applied to the whole software
lifecycle. The human **sets the goal and a tolerance/risk envelope** — *what* to achieve
and *how much risk is acceptable* — and the system **drives the steps**: design, code,
test, ship, monitor, upgrade. It runs **gated step-by-step**, every step follows a
**strict machine-checkable standard**, everything is **fully transparent and reversible**,
and it **only stops/escalates when something exceeds the configured tolerance**.

Nic's framing notes verbatim:

- *Set the goal, not the details of how you get there.* Like a Level-3 car trip: you plan
  the trip, pick everything you want to see (with AI help), but the car does the driving
  and only stops if something unforeseen goes beyond your configured tolerance.
- **End level is not necessarily the goal** — each project sits at whatever level fits it;
  you don't have to drive every project at L5.
- Strong parallel to **coding by intention**.
- **Extract the deep properties we actually want** from the code/technical setup. *Code
  beauty / how it's set up was never the goal — it has always been a tool to reach the
  adequate real criteria.* The system is free to pick any implementation that passes the
  gates; we judge outcomes, not aesthetics.
- We need to brainstorm **the full, complete tree of every step a project goes through**,
  and for each: *can it be automated, and how?*
- Worked example: **manual UI testing in a room full of people** vs **fully dynamic,
  data-driven A/B testing**. The second isn't always desired — but it's what lets a step
  *pass the self-driven gate*, because the gate is now data, not a human in a room.

---

## 1. The metaphor, mapped (SAE J3016 → SDLC)

SAE J3016 ("Taxonomy and Definitions for Driving Automation," 2021) defines **six levels,
0–5**. The two concepts we borrow most heavily:

- **L3 "conditional automation" + "request to intervene":** the system does the whole task
  *within limited conditions*, but needs a **fallback-ready human** it can hand back to when
  it hits something out of scope. → This is exactly *"stop only if something unforeseen goes
  beyond your tolerance."*
- **ODD (Operational Design Domain):** *"the specific conditions under which the system is
  designed to function"* (weather, road type, speed…). → **This is our tolerance/risk
  envelope.** L5's ODD is unlimited; L0 has none. **The risk dimensions below ARE the ODD.**

Provisional level ladder for a project (to refine — this is the spine of the epic):

| Lvl | Driving analogue | Software analogue | Who's the fallback |
|----|------------------|-------------------|--------------------|
| L0 | No automation | Human writes everything; CI just reports | Human does all |
| L1 | Driver assist | AI proposes fixes; human verifies & merges (open-PR) | Human, continuously |
| L2 | Partial | AI proposes **and** verifies live on the running app; human reviews PR | Human, continuously |
| L3 | **Conditional** | AI auto-merges when all gates green **and** change is inside the configured envelope; escalates on breach | Human, on request-to-intervene |
| L4 | High | AI drives deploy + live-patch with instant revert; post-hoc audit, no pre-approval inside ODD | System self-recovers in-domain |
| L5 | Full | Closed-loop, unlimited domain | None |

> NOTE (Nic's point): *the level is per-project and even per-step.* A project can run S-code
> at L3 but S-deploy at L1. The dial is not global.

---

## 2. The classification: every step is value-creation OR risk-mitigation

Nic's organizing axis. Every lifecycle activity exists to either **create value** or
**mitigate risk** — and the risk side is what sets how far the AI may drive unattended
(the ODD). Mapped to ISO/IEC 25010 quality characteristics so it reads as rigorous, not invented:

| Dimension | Bucket | ISO 25010 home | Self-driven gate becomes… |
|-----------|--------|----------------|---------------------------|
| **Performance** (UX + cost) | **Value** | Performance efficiency | perf budgets / synthetic + RUM thresholds |
| **Security** | **Risk** | Security | policy-as-code, SAST/DAST gates, authz envelope |
| **Accessibility** | **Risk** | Usability / accessibility | automated a11y conformance (WCAG/EN 301 549) |
| **Working software** (the actual revenue-bearing feature) | **Value** | Functional suitability | requirement-as-code → tests pass; **A/B/data gate** |
| **Upgradeable / decoupled** (version upgrades, swap vendors) | **Risk** | Maintainability (modularity) | migration scripts + reversibility + conformance |

> "Working software" needs a better term — candidates: *functional value*, *feature
> delivery*, *the value increment*. (Nic to pick.) It's the only pure-value-creation item
> besides performance's UX half.

**The A/B example generalized → the core mechanic of the whole epic:** a step can only be
self-driven if its **gate is automatable**. A "room full of people manually judging the UI"
is a human-judgment gate → blocks autonomy. Replace it with **data-driven A/B testing** →
the gate is now a measurable threshold → the step passes the self-driven gate. So a big part
of designing each step is: *what is the automatable, data-driven gate that stands in for the
human judgment that's there today?* (And note: sometimes you DON'T want to replace it — then
that step is deliberately capped at a lower autonomy level. That's a legitimate choice, not a
failure.)

---

## 3. Prior art — what's already named, and where we're actually novel

**Honest headline:** the SAE-levels-applied-to-the-SDLC idea is **already published** —
independently converged on by ~a dozen authors in 2024–2026. It is **blog/community content,
not a ratified standard.** We should cite it, position ourselves *inside* that emerging space,
and lead with the part that's genuinely ours.

- **ASDLC.io — "Agentic Software Development Life Cycle"** (May 2026) — the closest match to
  this whole concept. Explicitly *"inspired by SAE J3016,"* frames autonomy levels as
  *"formal classifications of operational risk,"* has Context Gates, drift-tolerance
  halt-and-notify (= our escalation), deterministic validation standards, telemetry, and
  reversibility (humans keep merge authority at the L3 "production ceiling").
  https://asdlc.io/concepts/levels-of-autonomy/
- **Dash0 — "Six Levels of Agentic Software Engineering"** — documents the *convergence*:
  "more than a dozen independent authors, 2024–2026, all citing SAE J3016." Best line for us:
  *"the human role does not shrink as AI grows — it moves up the abstraction ladder."*
  https://www.dash0.com/knowledge/the-six-levels-of-agentic-software-engineering
- Also: Swarmia "Five levels of AI coding agent autonomy"; Zencoder "Autonomy is a Dial, Not a
  Switch"; Cloud Security Alliance "Levels of Autonomy for Agentic AI"; academic — arXiv
  2506.12469 (*Levels of Autonomy for AI Agents*), arXiv 2509.06216 (*Agentic Software
  Engineering: Foundational Pillars*).
- **Coding by intention — long, solid lineage** (cite, don't claim): Kent Beck, *Smalltalk
  Best Practice Patterns* (1997, "intention-revealing method name") → David Bernstein,
  *Essential Skills for the Agile Developer* ("Programming by Intention", "what before how")
  → Charles Simonyi, **Intentional Programming** / Intentional Software (program as an
  editable tree of *intentions* from which code is derived). 2026 arXiv *"Intent
  Formalization: A Grand Challenge for Reliable Coding in the Age of AI Agents"* closes the
  loop to agents.
- **Levels-of-autonomy reused outside driving (real, not marketing):** **TM Forum Autonomous
  Networks** — a *validated* L0–L5 maturity model for telecom (most operators still L1–L2).
  **Oracle Autonomous Database** — "self-driving, self-securing, self-repairing" (note: 3
  pillars, **not** an L0–L5 ladder — be precise). Oracle's trio maps cleanly to value
  (driving) vs risk (securing/repairing).
- **The gated/reversible delivery substrate is textbook** and we build *on top of* it, we
  don't reinvent it: **progressive delivery** (James Governor / RedMonk — canary, blue-green,
  feature flags, A/B as graduated automated gates replacing manual UAT), **GitOps** + automated
  canary analysis (Argo Rollouts/Flagger), **policy-as-code / OPA** ("strict standards enforced
  as a gate"), **reversibility** via feature flags / git-revert / blue-green / immutable infra.
- **Capability evidence under the levels:** SWE-bench (2,294 real GitHub issues — the field's
  autonomy yardstick), SWE-agent, Devin (Cognition, 2024 "first AI software engineer").

**Where we are genuinely novel (lead with this):**

1. **The value-creation vs risk-mitigation partition of *all* lifecycle work, bound to the
   five NFR dimensions, used as the autonomy *dial* (risk-bucket = the ODD that throttles how
   far the AI drives each step).** Nearest neighbors — validation-vs-verification, lean
   value-stream mapping, risk-based testing, ISO 25010 — are *adjacent*, none is this. Not
   found named anywhere.
2. **The verify gate has actual ground truth.** Every blog framework above stops at "all CI
   green + human review" as the L3 gate. Generic agentic IDEs (Copilot/Cursor/Devin) produce
   *plausible* output with **no machine-checkable target**. We have one: the Web Everything
   **conformance standard**. That's the self-driving-car insight they're missing — **a car
   needs a defined road and sensors; our "road" is the standard.** Without a machine-checkable
   target, L3+ autonomy isn't trustworthy. This is our existing moat (#089 "propose-and-verify").

---

## 4. This is NOT greenfield for us — it names a ladder we're already building

The whole point: we don't propose this from zero — it's the **inevitable next step** that
*names the full ladder* across machinery that already exists or is in flight. Load-bearing
existing items to cite as the spine:

- **#141 Dev Browser Vision** — already has a 4-rung **autonomy ladder** (report-only →
  propose → live-verify → open-PR), default open-PR (human in loop). Plus the verify-gate
  loop: apply → re-run conformance → accept only if clean, else revert. *This is the prototype
  of the level ladder.*
- **#095 Conformance Auto-Fix Agent** (shipped) — the propose-and-verify loop made literal:
  failure → candidate patch → re-verify → accept/retry/give-up. Never ships what the suite
  hasn't validated.
- **#099 Evergreen App Vision** — the north-star lifecycle the autonomy enables: requirement →
  verified code → versioned → safe auto-update → monitored → still conformant. (#100
  requirement-as-code, #101 auto-update w/ risk analysis + phased rollout + reversion.)
- **#562 Dev-Browser Source Awareness & IDE Bridge** — the substrate: resolver (DOM→file:line)
  + IDE-bridge provider registry (act on the repo). *The hands the driver uses.*
- **#578 Fix-Loop Git Integration** — the forced invariant: **AI-generated code is NOT
  privileged** — same CI gates, same branch protection, evidence payload carries the autonomy
  level + which gates ran. *This is "transparent + reversible" operationalized.*
- **#410 Deployed-App Live-Patch (gated capability)** — higher-autonomy action carved out with
  a stricter **authorization dial** + audit trail. *Shows the L4 carve-out pattern.*
- **#089 Monetization** — the "AI white-space" / propose-and-verify moat rationale (§3.2 above).
- **#166** — four-type gate enum (advisory / validating / blocking / escalating). *Already a
  gate-severity ladder we can reuse.*

> Constellation placement (to confirm): the **standard + the level taxonomy** → WE; the
> **drivers/agents + IDE bridge impl** → Frontier UI; the **authorization dials + governance +
> live management plane** → plateau-app. (Matches #091 managed-offering layering.)

---

## 5. The real work: the full tree of project steps × automatability

This is the brainstorm Nic flagged — *the complete tree of every step a project goes through,
and for each: can it be automated, and how, and what's the data-driven gate that replaces the
human-judgment gate?* First-cut skeleton to fill in together (rows are placeholders):

| Step | Today's gate (often human) | Automatable data-driven gate | Bucket | Max autonomy w/ that gate |
|------|----------------------------|------------------------------|--------|---------------------------|
| Requirement / intent capture | PM judgment | requirement-as-code (#100), spec coverage | value | L2? |
| Design / UX | design review meeting | design-ref diff + a11y conformance; **A/B test** vs manual room | value+risk | L3 once A/B replaces the room |
| Implementation | code review | conformance suite + type/lint + tests green | value | L3 (#095/#141) |
| Security | pentest / human authz review | policy-as-code, SAST/DAST, authz envelope | risk | L2–L3 (envelope-bound) |
| Accessibility | manual audit | automated WCAG/EN 301 549 conformance | risk | L3 |
| Performance | perf review | perf budgets, synthetic + RUM thresholds | value | L3 |
| Integration / E2E | QA sign-off | E2E from declared rules | value/risk | L3 |
| Release / deploy | change-advisory board | progressive delivery + canary analysis | risk | L3–L4 |
| Upgrade / migration | manual migration project | migration scripts shipped w/ breaking change + revert | risk | L3–L4 (#101/#102) |
| Monitor / operate | on-call human | SLO breach → auto-revert w/o redeploy | risk | L4 |

**Pattern to extract for every row:** *(a) what's the deep property we actually want
(outcome, not implementation), (b) what's the measurable gate, (c) is the gate automatable
today / what's missing, (d) therefore what's the ceiling autonomy level for that step.*

---

## 5.5 The role of the developer (and human) in a self-driven project

Nic's point (2026-06-15): in a fully self-driven project there is **little to no code actually
written by a human**. The human input is **planning and validation** — *what* to build and
*whether the result is acceptable* — not the keystrokes in between. This is the sharp end of
"code beauty was never the goal": if no human reads or hand-maintains the code, then the
**gate — not the code — is the contract**. The deep properties we want live in the gates and
the outcomes, and the AI is free to choose any implementation that clears them.

This matches the strongest line from the prior art (Dash0): *"the human role does not shrink
as AI grows — it moves up the abstraction ladder."* So the developer doesn't disappear; the
job **moves**. Provisional decomposition of what's left for humans:

- **Planner / intent author** — sets the goal + tolerance envelope; writes requirement-as-code
  (#100). Operates at the intent altitude. *Can be non-technical* (this is the §7 product user).
- **Validator** — reviews **proof, not diffs** ("approve the intent and the evidence," per
  ASDLC/Dash0): does the gate evidence show the real criteria were met? Increasingly
  non-technical (the §7 dashboard is built for exactly this).
- **Fallback-ready operator** — the L3 "request to intervene" human: handles escalations when a
  step breaches the envelope. Mixed technical/non-technical depending on what escalated.
- **Gate / standard author** — the *remaining deeply-technical role*: builds and curates the
  automatable gates, the conformance standard, the migration/reversibility machinery — i.e.
  **builds the road and the sensors the car drives on.** This is the role that doesn't
  commoditize, and it's where our standard lives. Someone has to make the human-judgment gates
  into data-driven ones (the §2 A/B example).

> The interesting inversion: as app-code authoring evaporates, **value concentrates in gate
> authoring**. The self-driven project doesn't remove developers — it relocates them from
> "write the feature" to "define what 'acceptable' means, in machine-checkable terms." That's
> a thesis worth stating explicitly in the epic.

> Nuance to chew on: does code quality still matter if no human reads it? Probably yes, but for
> a *different* reason — the AI's own ability to keep driving (upgrade, refactor, recover)
> degrades on incoherent code. So "maintainability" (§2 upgradeable/decoupled) stays a real
> risk dimension — it's just now in service of the *machine* operator, not a human one.

---

## 5.6 Branding / positioning — "Self-Driven Project" as the umbrella

Nic's instinct (2026-06-15): the branding is strong, and we may want to **fold the whole
current AI methodology under "Self-Driven Project."** The crux of self-driving — **decision +
gating + review + transparency** — *is exactly what we've already been doing.* The term isn't
just a future product; it's a name for the practice we run today.

The recursion is the story: **the methodology we use to build Web Everything is itself a
self-driven project.** Our backlog workflow already is the loop —

- **Decision** = `type:decision` fork items (the plan of record; surface the real fork, take a
  reasoned stance) — the "trip planning."
- **Gating** = `check:standards`, Definition-of-Ready, the conformance suite, the gate-severity
  enum (#166) — the per-step gates.
- **Review + transparency** = reports/ + evidence + concrete code refs + audit trail.
- **Reversibility** = resolve-don't-delete, committed-but-never-pushed, every change undoable.

So "Self-Driven Project" works at **three altitudes**, and that's the brand's strength:

1. **A product/SaaS** — the gating made legible to non-technical people (§7).
2. **A shareable methodology** — how *any* team should build with AI (this is #563 "AI-driven
   agile methodology as a shareable approach"; #564 personas as first-class). The branding
   question is whether **#563 gets rebranded *as* "Self-Driven Project."**
3. **Our own dogfooded practice** — we *are* a self-driven project building WE. That's the
   credibility proof: we don't just sell the methodology, we're visibly run by it.

This is genuinely a **positioning decision**, not just naming: do we make "Self-Driven Project"
the *master brand* that #563 (methodology), the dev-browser / AI-driven-IDE thread, and the
SaaS control plane all sit under? My lean: **yes** — it's a stronger, more memorable umbrella
than "AI-driven agile methodology," and the self-driving-car metaphor does real explanatory
work (levels, tolerance/ODD, request-to-intervene) that "AI-driven" doesn't. Caveat from the
prior-art pass (§3): the *term* "agentic SDLC / levels of autonomy" is already taken by others —
"Self-Driven Project" as a brand is more distinctive *and* lets us own the value/risk-ODD angle.

---

## 6. Open questions / forks to talk through (don't pre-settle)

- **Scope of the epic:** is this ONE umbrella epic ("Self-Driven Project") with the step-tree
  carved into child slices? Or a `type:decision` that ratifies the *level taxonomy + value/risk
  axis* first, with the build as a separate epic? (My lean: a short decision item to ratify the
  taxonomy & the value/risk-as-ODD framing, then an epic whose slices are the step-tree rows —
  several already exist as #141/#095/#099/etc., so the epic is partly an *umbrella over
  existing work* + the missing connective tissue.)
- **Naming:** "self-driven project" vs "autonomy levels for the SDLC" vs tying it to the
  existing **dev-browser / AI-driven IDE** thread. Does this BECOME the framing for the
  AI-driven-IDE project, or sit beside it?
- **"Working software" rename** (§2).
- **The value/risk × 5-dims claim** — do we publish it as a `/research/` topic (materialization
  pattern) so the novelty is staked and citable? (I think yes.)
- **How honest to be about prior art in the artifact:** I'd state plainly that "SAE-levels-for-
  SDLC" is convergent community content, not a standard, and that *our* contribution is the
  ground-truth gate + the value/risk-ODD dial. The honesty is itself a differentiator.

---

## 7. SaaS product surface — expose the gating to non-technical people

Nic's addition (2026-06-15): a big part of the **product/SaaS** value here is making the
technical gating **legible and controllable to non-technical persons** — a founder, PM,
compliance officer, or product owner who can't (and shouldn't have to) read code or CI logs.

The insight: the conformance machinery is technical, but **the sellable surface is autonomy
made legible.** The same self-driving-car framing is what makes this possible for a layperson —
*you don't need to understand the engine to plan the trip and watch the dashboard.* What the
non-technical person actually does:

- **Sets the goal + tolerance envelope in plain language** (the "trip planner"): what to build,
  and how much risk is acceptable on each dimension (security, a11y, perf, upgradeability). No
  code, no YAML — this is operating at the **intent altitude** (ties to "intents are UX-only").
- **Watches a live dashboard** where each step's gate status is **translated out of jargon**:
  not "conformance suite 14/16, axe violations: 2" but "Accessibility: ⚠️ 2 issues blocking
  launch — fix in progress" / "Security: ✅ within your risk limit."
- **Handles escalations** — the L3 "request to intervene" surfaced as a plain-language decision:
  *"The AI wants to change how payments are stored. That's above your configured risk limit.
  Approve, adjust the limit, or send back?"*
- **Sees the audit trail / reversibility** as "what changed, why, and undo" — not git.

Why this is a real product (not just UI sugar):
- It maps the technical gate severities (#166 advisory/validating/blocking/escalating) and the
  autonomy levels (§1) onto **persona-scoped views** (#166 charters / plateau-app profiles) —
  the compliance officer sees the risk dimensions; the founder sees value + cost.
- It's a recurring **regulatory/assurance budget line** (#089): *continuously proving* the
  running app honors WCAG / EN 301 549 / security policy is something a non-technical
  compliance owner pays for and wants to *see*, without reading code.
- **Constellation fit:** this control plane is the **plateau-app (product) layer** — the
  standard + taxonomy stay in WE, the drivers/agents in Frontier UI, the **non-technical
  dashboards + tolerance dials + escalation inbox** ship as the plateau-app product (matches
  #091 managed-offering layering, #089 monetization).

> Open: is the non-technical control plane its own child slice/epic, or a cross-cutting surface
> that every step in §5 must project into? (Lean: cross-cutting requirement — *every gate must
> have a plain-language projection* — plus one slice for the dashboard/escalation-inbox shell.)

---

## 8. Nic's additional ideas (to fill in)

- …
- …

---

### Sources (for whoever writes the eventual research topic)
- SAE J3016: https://www.sae.org/standards/content/j3016_201609/ ; https://blog.ansi.org/ansi/sae-levels-driving-automation-j-3016-2021/
- ASDLC.io levels: https://asdlc.io/concepts/levels-of-autonomy/
- Dash0 six levels: https://www.dash0.com/knowledge/the-six-levels-of-agentic-software-engineering
- Swarmia: https://www.swarmia.com/blog/five-levels-ai-agent-autonomy/ · Zencoder: https://zencoder.ai/newsletter/autonomy-is-a-dial-not-a-switch
- CSA: https://cloudsecurityalliance.org/blog/2026/01/28/levels-of-autonomy · arXiv 2506.12469, 2509.06216
- Coding by intention: Beck *Smalltalk Best Practice Patterns*; Bernstein *Essential Skills for the Agile Developer* (https://www.oreilly.com/library/view/essential-skills-for/9780321700469/ch01.html); Simonyi Intentional Software (https://en.wikipedia.org/wiki/Intentional_Software)
- TM Forum Autonomous Networks: https://www.tmforum.org/missions/autonomous-networks
- Oracle Autonomous DB: https://www.oracle.com/autonomous-database/what-is-autonomous-database/
- Progressive delivery / GitOps / OPA: https://www.weave.works/blog/stop-doing-progressive-delivery-manually-use-gitops-instead ; https://www.harness.io/blog/harness-policy-as-code
- ISO/IEC 25010: https://quality.arc42.org/standards/iso-25010
- SWE-bench / Devin: https://cognition.ai/blog/introducing-devin
