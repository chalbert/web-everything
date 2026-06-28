---
kind: decision
size: 3
parent: "666"
status: resolved
codifiedIn: docs/agent/platform-decisions.md#monetization
dateOpened: "2026-06-15"
dateStarted: "2026-06-15"
dateResolved: "2026-06-15"
graduatedTo: none
tags: [self-driven-project, constellation, project, protocol, ownership, no-lock-in]
---

# Is the Self-Driven Project methodology a first-class constellation project (what owns its artefact Protocol)?

The #672 no-lock-in artefact Protocol can't register until this is decided: we:protocols.json hard-requires an ownedByProject that resolves in we:projects.json + a project partial carrying the anchor, and no self-driven-project/methodology project exists (the constellation is all web* platform-standard projects). #665 ratified the framing + named the Protocol but not an owner. Decide whether the methodology becomes its own first-class constellation project (own project + partial + npm scope + layer, per the #091 managed-offering pattern) and what owns the Protocol — or whether it is owned differently / is not a registered Protocol at all. Blocks #672.

> **Converged direction (refined through brainstorm 2026-06-15 — still refining; keep updating).**
> The methodology **lives in Web Everything**, scoped to web applications initially — a "web application"
> *is the whole product* (backend, DB, infra are pieces of it), so WE's "Everything" already covers
> full-stack and there is **no web-cap to escape**. **No separate brand, no new name.** It **reinforces two
> existing brands**: **WE owns the open standard** — a **composable, configurable** everything-as-code base
> (discoverable file/metadata structure + meta-schemas + a default recipe = the node + Protocol); **Plateau
> is the optional configurator** that tweaks the dev lifecycle from preconfigured recipes (open-core, the
> Intents / Technical-Configurator pattern). The value is **not the concept** — agentic-SDLC / autonomy-levels is
> trodden ground — but the **open, standards-based, no-lock-in way of doing it**, plus the ground-truth gate
> and WE dogfooding. **Axis 1 → A** (mint a WE node to own the Protocol); **Axis 2 → reinforce WE + Plateau**
> (the earlier separate-brand exploration is recorded in the appendix and dropped). Forks have effectively
> collapsed → ratifiable; held open only to keep refining.

## Why this is open (surfaced by #672, batch-2026-06-15)

Registering the artefact Protocol (`#672`) tripped the we:protocols.json invariant
(`we:check-standards-rules.mjs` §6b): every Protocol needs an `ownedByProject` that resolves in
`we:projects.json` **and** a `src/_includes/project-<owner>.njk` partial containing the protocol's `anchor`.
The whole constellation is `web*` **platform-standard** projects (webintents, webvalidation, webworkflows,
…); the Self-Driven Project methodology is a *process/governance* concern, not a browser-platform standard,
so it fits none of them and none can honestly own the Protocol. `#665` settled the methodology's framing
(autonomy taxonomy, tolerance envelope, gates) and graduated to "`#666` epic (+ no-lock-in artefact
Protocol)" — but deliberately did not assign project-hood. This is that deferred call.

## Two layers — the standard vs. how it's driven (refined 2026-06-15)

Critical separation: **the file/metadata structure that *enables* the methodology is the standard; *how
those artefacts drive a given project's work* is a separate, configurable layer.** The methodology is a
**composable, configurable system on a strong everything-as-code base** — the same shape as Web Intents and
the Technical Configurator, not a fixed process.

- **Layer 1 — the standard (the base, owned by the WE node).** A standardized, **discoverable** file
  structure + **metadata** for requirements and methodology artefacts (everything-as-code), plus
  **composable meta-schemas** — autonomy-level registry, value/risk-ODD dimension registry,
  gate-definition schema, step schema — each shipping a **default flavor**. Standardize the *shape*, not a
  fixed list (the Web Intents lesson: meta-schema, not the vocabulary). Requirement structure stays
  **light — enough to be discoverable + carry metadata** (most-flexible-default), connecting to #100
  requirement-as-code. This base *is* #672's Protocol.
- **Layer 2 — recipes / config (how it's driven, configurable).** A concrete methodology = a **recipe**: a
  named bundle of autonomy ceilings + tolerance dials + gate selections that **extends the fully-defined
  platform default** (config-extends-platform-default — the node ships **one complete default recipe**;
  everything else is a flavor on top). **Plateau is the configurator** — pick a preconfigured recipe, tweak
  the dev lifecycle, emit the everything-as-code config — exactly the Technical-Configurator pattern
  (data-driven domains/recipes). Plateau is the *authoring surface*, **not** the owner of the recipe format
  (the format is the standard). **WE's own dev-lifecycle config is just *one recipe* — a consumer/dogfood,
  not part of the standard.** The standard is the same for everyone; the recipe is what varies.

> **Dogfood already running:** the WE backlog (frontmatter `backlog/*.md`, discoverable, metadata-bearing,
> driving our lifecycle) is *already* an instance of Layer 1 + a Layer-2 recipe. The standard **generalizes
> what we already run**; our usage stays a *consumer* of it, never the spec.

Pattern lineage (why this is low-risk — it reuses proven WE machinery): **Web Intents** (open meta-schema +
default flavor, projects customize) · **Technical Configurator** (recipes you pick + tweak → emit config) ·
**config-extends-platform-default** (a fully-defined platform default; project flavors extend it).

## What the methodology would standardize (the fit test)

Listing the standardizable surface against what WE *already* owns is the fit test. Result: **most of it
composes existing WE standards; the genuinely-new surface is small and specific.**

| Candidate to standardize | Already a WE standard? | New? |
|---|---|---|
| **Autonomy level scale** (SAE L0–L5 for the SDLC: report-only → propose → live-verify → open-PR → auto-merge → live-patch) | No — #141 has the dev-loop ladder as a backlog item, #166 has gate-*severity*, but autonomy-level-as-vocabulary is unowned | ✅ **NEW** (a vocabulary) |
| **Value/risk-as-ODD dial** (quality dimensions as the per-step tolerance that throttles autonomy) | Partial — dimensions overlap `webcompliance`'s "which criteria enforced," but the *dial* (tolerance → autonomy ceiling) is unowned; #665's novel flag | ✅ **NEW** (the organizing model) |
| **Per-step gate** (machine-checkable, severity, pass/fail, expiring waivers, audit) | **Yes** — `webcompliance` (the enforcement gate) + `we:capabilityMatrix.json` (3-state ground truth) | ❌ compose |
| **Step orchestration** (design→code→test→ship→monitor→upgrade as directed progression w/ guards + completion) | **Yes** — `webworkflows` Workflow Protocol (orchestration graph)¹ | ❌ compose |
| **Run evidence / history** (what happened at each step, append-only) | **Yes** — `webaudit` (AuditEvent) + `webreporting` (report model) | ❌ compose |
| **Decision / request-to-intervene record** (why a gate escalated; the human handoff) | **Yes** — `webdecisions` (DecisionRecord) | ❌ compose |
| **Which gate, what severity, what scope** (policy) | **Yes** — `webpolicy` (DMN rule meta-schema) + `webcompliance` | ❌ compose |
| **The binding artefact contract** (everything-as-code that *wires* autonomy + ODD + gates + evidence + steps into one portable, no-lock-in declaration a foreign tool can drive) | No | ✅ **NEW** — this *is* #672's Protocol |

¹ altitude note: `webworkflows` is framed as a *user's UX* traversal; the SDLC is a different instance of
the same orchestration-graph machinery — reuse the Protocol, possibly with an extension.

**Fit verdict — strong, and the node is small.** The genuinely-new surface is just an autonomy **vocabulary**,
the value/risk-**ODD dial**, and the everything-as-code **binding Protocol** (#672) — i.e. **Layer 1** above
(file/metadata structure + composable meta-schemas + default recipe). Everything else is *composition* of
existing WE standards; **Layer 2** (recipes) is config, authored in Plateau, not new standard surface. That is exactly #666's thesis — "umbrella over existing work **+ the
missing connective tissue**" — made concrete: the node doesn't duplicate WE, it's a **capstone made *of* WE
standards**, bounded (owns ~1 Protocol + 2 vocabularies, composes 6+ projects). This retires the
"category-expansion / does it dilute the thesis?" worry — connective tissue over the constellation is the
*best* reason to live *in* the constellation. It also makes the whole stack open + no-lock-in by
construction: the one new lock is the binding Protocol, and it's escapable (a foreign tool drives the same
files); everything beneath it is already-open WE standards.

## Axis 1 — who owns the Protocol → **A (mint a WE node)**

- **A — Mint a WE-constellation node that owns the Protocol** (minted as **`webprocess`** —
  `we:src/_data/projects/webprocess.json`, owning the `self-driven-project-artefact-contract` Protocol;
  a node id, not a public brand). Own project entry +
  `project-<id>.njk` partial (carrying the protocol anchor), per the #091 layering. Satisfies the
  we:protocols.json invariant the clean way; matches how every other Protocol is homed. With the fit test
  above, the node is a **bounded capstone**, not a category expansion. **Chosen.**
- **B — Home under an existing project.** False home — every existing Protocol owner standardizes *the app
  being built*; the methodology is one altitude up (*how you drive the SDLC*). **Dropped.**
- **C — Not a registered Protocol** (report + JSON-Schema only). Reverses a *firm* #665 invariant (the
  artefact contract *is* a Protocol), and — given the value thesis below — would discard *the exact thing
  that is now the whole value*: the open, no-lock-in standard. **Dead** (survives only as an optional
  sequencing step: ship #672 as report+schema first, *promote* to a registered Protocol — a "not *yet*",
  not a "not a Protocol").

## Axis 2 — home & brand → **reinforce WE + Plateau (no separate brand)**

The brainstorm explored a **standalone / endorsed brand** (recorded in the appendix) and **reversed it**.
Why the reversal:

1. **No web-cap to escape.** A "web application" is the *whole product* — backend, DB, infra are pieces of
   it — so WE's "Everything" already covers full-stack. The earlier "web-agnostic → escape WE" argument
   assumed "web" = front-end; it doesn't. Scope is fine.
2. **Brand surface cost.** A separate brand is real surface to build and defend (solo founder; open-core
   focus ranking *self-run tool > service > enterprise*).
3. **Naming is a minefield** (appendix scan): the prior front-runner collided directly in-category; the
   namespace is crowded. A name we don't need is a name we don't have to defend.
4. **The value isn't a brand** — it's the open/no-lock-in *posture* (value thesis below), which is WE's DNA.

**Resolution — it reinforces two existing brands, no new brand, no new name:**

- **WE owns the open standard** — the node (Axis 1·A) + the binding Protocol + the two new vocabularies. This
  *deepens* WE's thesis from "web-platform standards" to "also a standardized **way to build** them" — a
  capstone, read as a distinct `category` within WE (the process tier), not a 40th peer standard.
- **Plateau is the optional managed tooling** on top — the control plane / tolerance dials / gate dashboard
  (#666 §B already lives there). Open-core: standard free + portable, Plateau the paid convenience you can
  walk away from.
- **"Self-Driven" stays the narrative on-ramp**, not a brand or the value claim.
- **Scoped to web apps initially, but the schema stays domain-general** (most-flexible-default): the
  artefacts (autonomy levels, tolerance, gates, evidence) don't hard-code "web," so generalizing later is
  free, not a refactor — a #665-style revise-on-friction trigger, not a decision owed now.

**This revises #665 Fork 3 / A4** (a legitimate revision under #665's protocol): from "self-driven as a new
*master brand*" → "**self-driven as a positioning attribute carried by WE (standard) + Plateau (product)**."
The name question and the "Project" overload become **moot** (no separate brand to name).

## Value thesis (what actually differentiates)

The **concept** (agentic SDLC, autonomy levels, the self-driving metaphor) is **trodden ground** — Tessl,
ASDLC.io, the big consultancies all have it, and all are building **proprietary platforms that own your
agentic SDLC**. The white space (#665 report §7.4) is the opposite, and it is **WE's DNA**:

> *Everyone's selling you an agentic-SDLC platform. We give you the **open standard** so you never get
> locked into one — and Plateau is an optional managed layer you can walk away from.*

- **Wedge:** open · standards-based · **no-lock-in** · everything-as-code · **composable + configurable**
  (discoverable file/metadata base + meta-schemas + recipes) · + optional Plateau configurator.
- **Moat caveat:** open-source alone isn't defensible (anyone can open-source). The defensible substance is
  what #665/#089/#095 already named — the **ground-truth gate** + propose-and-verify loop + **WE dogfooding
  it for real**. Pair them: open posture = the differentiator in a crowded field; gate + dogfooding = what
  makes it stick.
- **Honest positioning (#665 A-register):** lead the public claim on open/no-lock-in/gate, **not** on
  "inventing levels-for-SDLC."

## Ruling — RATIFIED 2026-06-15

- **Axis 1 — A: the methodology is a first-class WE-constellation node** that owns the artefact Protocol.
  It is a **bounded capstone** (Layer-1 standard: discoverable file/metadata base + composable meta-schemas
  + one default recipe; owns ~1 Protocol + 2 vocabularies, composes 6+ existing projects), read as a
  distinct process-tier `category` within WE — not a 40th peer platform standard. **B** (false home) and
  **C** (not-a-Protocol — reverses a firm #665 invariant and discards the value) are rejected.
- **Axis 2 — reinforce WE + Plateau; no separate brand, no new name.** WE owns the open standard; **Plateau
  is the optional configurator** (recipes/tweaking, Technical-Configurator pattern); open-core. The
  methodology lives in WE, **scoped to web apps initially** (web app = full-stack product, so no web-cap),
  with the **schema kept domain-general** so generalization is a free revise-on-friction later. "Self-Driven"
  is a positioning attribute, not a brand. **This revises #665 Fork 3 / A4** (master-brand → positioning
  attribute) and makes A5 (the "Project" overload) **moot**.
- **Value thesis:** the differentiator is the **open / standards-based / no-lock-in / composable
  everything-as-code** way of doing it + the ground-truth gate + WE dogfooding — *not* the (trodden) concept.

**On resolution:** #672 is unblocked, gets its owning node (A), and registers as the flagship Protocol;
the value thesis + two-layer framing thread into #672; the brand revision logs into #665's A4 register.

**Open mechanical pick (carried to the #672 build, not blocking):** the internal node **slug**
(`webdelivery` / `webprocess` / `webautonomy` / …) — a node id, not a public brand.

**Graduated to** `none` — ratification — unblocks #672 (owning node + flagship Protocol) under epic #666.

---

## Appendix — explored & dropped: a separate brand + the naming scan

Recorded for the trail; superseded by Axis 2 (reinforce WE + Plateau). The competitive intel and the
honest-positioning conclusion still stand and feed the value thesis; the **name candidates are moot** unless
a separate brand ever returns.

The brainstorm first leaned **endorsed brand** ("Self-Driven — proven on Web Everything") on a (mistaken)
"the methodology isn't about the web → escape the web-cap" premise — reversed once "web application = the
whole full-stack product" dissolved the cap.

**Market scan (2026-06-15):**

- **Category is crowded and hot** — "agentic SDLC" / "autonomous software factory" is a 2026 headline
  category: Forrester ([orchestrated SDLC agents](https://www.forrester.com/blogs/agentic-software-development-takes-the-lead-from-code-assistants-to-orchestrated-sdlc-agents/)),
  HCLTech ([autonomous software factory](https://www.hcltech.com/trends-and-insights/autonomous-software-factory-agentic-ai-sdlc)),
  PwC, Augment Code, CodeRabbit. A generic name won't cut through.
- **The self-driving / SAE-levels metaphor is shared, not ownable** — Tessl
  ([5 levels, learning from self-driving cars](https://tessl.io/blog/the-5-levels-of-ai-agent-autonomy-learning-from-self-driving-cars/)),
  ASDLC.io ([L1–L5](https://asdlc.io/concepts/levels-of-autonomy/)), Swarmia, Dash0, CSA, arXiv
  2509.06216 / 2510.19692. Confirms the honest-positioning call: metaphor = table stakes, gate = the differentiator.
- **Name collisions** (moot now):
  | Candidate | Verdict | Why |
  |-----------|---------|-----|
  | **Cairn** | ❌ eliminated | Direct in-category collision: [cairn-dev/cairn](https://github.com/cairn-dev/cairn) + [oritera/Cairn](https://github.com/oritera/Cairn). |
  | **Lodestar** | ❌ | Crowded AI namespace (multiple "Lodestar AI"). |
  | **Waypoint** | ❌ | HashiCorp Waypoint. |
  | **Traverse** | ⚠ | ERP/accounting suite; generic. |
  | **Bearing** | ✅ clean-ish | No dev/AI collision found; generic navigation word. |
  | **Portage** | ✅ clean-ish | No dev/AI collision; in-family terrain metaphor; distinctive. |
