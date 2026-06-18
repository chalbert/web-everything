# NL → Technical Configurator — prior-art survey & fork preparation

**Date:** 2026-06-11
**Backlog item:** [#096 — NL → Technical Configurator](/backlog/096-nl-to-technical-configurator/)
**Epic:** #097 (monetization product concepts)
**Status:** prepared (forks framed; not yet decided — item stays `status: open`)

---

## The question

[#096](/backlog/096-nl-to-technical-configurator/) proposes an **AI front-end to the
Technical Configurator**: the developer describes a behavior in plain language
("undo/redo with an audit trail", "locale-aware sorting that's stable") and the AI
**selects and wires the right strategy from the registries**, then emits the configured
code. The configurator already encodes the decision space — domains, capability axes,
strategies, and a pure compat engine that scores strategy-vs-requirement. So the AI's job
is **constrained selection over a formal space the standard already owns**, not open
generation.

The provider-seam fork ("NL → requirement-axes extraction stays behind a swappable
provider") and the tier-1/BYO-AI-key shape were **settled by principle** on 2026-06-11
(intent-UX-only + adapter-as-normalization-hub + solo-founder lens). What remains open is
**(a) the surface** the developer touches (CLI vs editor command vs configurator panel) and
**(b) the wire contract** the NL provider must satisfy — both product-UX/architecture calls,
plus the build. This survey grounds those in published prior art and in the real
configurator code so the forks can be decided, not guessed.

No design exists yet. This report is the design-first step-1 survey; the four forks below
each name a recommended default in **bold**.

---

## The machinery this rides on (grounded in the real tree)

The Technical Configurator already exists in **plateau-app** and is the entire reason the
AI's job is constrained rather than open. Concretely:

- **A `Requirements` object is the only thing the AI has to produce.** A domain is a set of
  capability **axes**, each with a fixed set of `AxisValue` ids
  (`we:types.ts:21-31`, 
  `we:types.ts:14-19`). A
  `Requirements` is `Record<axisId, acceptableValueId[]>`
  (`we:types.ts:88-94`). That is a
  small, **closed-vocabulary** structure — every key and every value is enumerable from the
  domain seed. The NL layer's whole output is this map.

- **The hand-authored presets are the exact shape the AI would synthesize.** Today a
  use-case preset is a human-written `{label, blurb, requirements}` triple
  (`plateau:presets.ts:15-22`); e.g.
  "Let users undo and redo" → `{reversibility: ['inverse-patch','replay','convergent']}`
  (`plateau:presets.ts:34-40`). The
  NL layer **replaces the human authoring of that `requirements` map** with model
  synthesis — it produces the same structure `applyPreset` already consumes
  (`plateau:configurator.ts:222`).

- **The compat engine is the deterministic guardrail downstream of the AI.**
  `rankStrategies(strategies, axes, requirements)`
  (`plateau:compat.ts:88-99`) folds
  per-axis verdicts (`satisfies | compromise | incompatible`) with a fixed
  correctness-vs-fidelity policy that lives in the **axis data**, not the code
  (`plateau:compat.ts:34-55`). So once
  the AI emits a `Requirements`, strategy selection is fully deterministic and
  standards-bound — the model never picks the strategy, only translates intent into the
  requirement vector the engine ranks against.

- **The provider seam already exists — and is the natural home for the NL layer.** The
  configurator reads domains through a `CapabilityProvider` interface
  (`we:types.ts:82-85`); the seed
  provider (`we:provider.ts:21-28`)
  is one impl, and the file header explicitly anticipates swapping it for "code
  introspection or a protocol-driven source — same interface, no UI change". The NL layer is
  a **second, parallel seam**: not a capability source but a `Requirements` *producer*. New
  domains slot in with no UI change (`we:provider.ts:14-19`,
  `plateau:presets.ts:24`, `plateau:presets.ts:72`, `plateau:presets.ts:118`),
  so any NL provider that emits a valid `Requirements` is automatically multi-domain.

- **Owned by the `webregistries` project.** #096's `relatedProject` is
  [`webregistries`](../../src/_data/projects.json#L3) — "custom registries for many
  purposes" — which is the platform layer the strategies are selected *from*.

The decision-record + config-stub emitter
(`plateau:configurator.ts:400`, `plateau:configurator.ts:446-477`)
is the existing "emit the configured code" tail; the NL layer feeds its front, not its end.

---

## Prior-art survey

### Finding 1 — the NL→config problem is a *structured-output* problem, and the field has converged on schema-constrained generation as the reliability fix

Across the surveyed literature the consistent 2024-2026 lesson is that **prompt-only "return
JSON" extraction fails 5-20% of the time in production**, while **schema-constrained /
grammar-constrained decoding gives a structural guarantee** — the decoder only emits tokens
that keep the output on a valid path through the schema's state machine. Native structured
outputs shipped across providers (OpenAI Aug 2024; Google Gemini; Anthropic structured
outputs GA early 2026 — `output_config.format` / `messages.parse()` constrained to a
JSON-schema). For #096 this is decisive: the NL layer's output is a **tiny closed-vocabulary
`Requirements` map**, which is the ideal shape for constrained generation — the schema is
*generated from the domain seed* (axis ids as keys, `enum` of value ids per axis), so the
model literally cannot emit a key or value the compat engine can't score. This is the
mechanism that makes "the configurator is the guardrail" true at the token level, not just
as a post-hoc validation.

### Finding 2 — "tool calling" vs "structured output" is a real fork, and the rule of thumb favors structured output here

The surveyed guides draw a clean line: **structured output** when you want the model to
*return data in a shape* (extraction, classification), **function/tool calling** when you
want the model to *trigger an action* or pick among operations. #096's NL layer returns a
`Requirements` data structure and triggers nothing — the compat engine does the selecting,
deterministically. That places it on the structured-output side. (Tool-calling would only
earn its keep if the model also had to *choose the domain* or *invoke the emitter* — see
Fork 4, where a thin tool wrapper is the rejected alternative.)

### Finding 3 — requirement extraction is framed as NL → a fixed, gradeable template

The requirements-engineering literature (INCOSE-style "The <subject> shall <action>
<object>…" templates; multi-agent SpecificationGeneratorAgent pipelines; CARLA-simulator
NL→config-code case studies) consistently frames the task as **mapping free text onto a
pre-defined slot structure**, and reports that *explicit requirement definitions improve
extraction accuracy*. The configurator's axes already **are** that slot structure, and each
`AxisValue` already carries a plain-language `definition`
(`we:types.ts:14-19`) authored for
exactly this teaching purpose. So the NL prompt is grounded in the standard's own vocabulary
— no coined terms — which is precisely the published accuracy lever.

### Finding 4 — dev-surface conventions: CLI = delegation/scriptable, editor command = in-flow/low-friction, panel = visual/teaching

The AI-dev-tooling surveys converge on a tradeoff triad:

- **CLI / headless agents** are built for *delegation* and *scripting*: deterministic
  text-in/text-out, exit codes, composable in CI, no UI state polluting context. Best when
  the output is a file or a code edit the developer will commit.
- **Editor commands (command-palette / inline)** offer *near-zero workflow disruption* — the
  developer never leaves the buffer; the result lands at the cursor. Best when the output is
  a snippet inserted into code-in-progress.
- **Panels / graphical surfaces** are the only ones that can *show* the decision — render the
  ranked strategies, the per-axis verdicts, the compromises. Best when the value is the
  developer *seeing and tuning* the choice, not just receiving it.

The load-bearing observation for #096: the configurator is **already a panel** that renders
ranked strategies and verdicts (`plateau:configurator.ts:239`, `plateau:configurator.ts:261`).
That asymmetry drives Fork 1 — the panel is the surface that reuses the most existing
machinery, while CLI/editor surfaces would have to re-emit the verdict rendering as text.

### Finding 5 — there is no native, no incumbent NL→swappable-strategy tool; the moat is the registry

Generic AI codegen (Copilot-class) has no registry of *swappable strategies* to target, so it
guesses plausible code. The white-space #096 names is real: because the configurator encodes a
**formal decision space with deterministic scoring**, the AI here navigates rather than
invents. Nothing in the surveyed tooling does this — the differentiator is the registry the
output is constrained to, not the model.

---

## Forks at a glance

| Fork | Crux | Recommended default | Main alternative |
|---|---|---|---|
| **1 · surface** | Where does the developer describe behavior? | **Panel-first inside the existing configurator** (NL box above the requirements list) | CLI-first *(rejected as the first surface)* / editor command |
| **2 · NL provider contract** | What does the swappable NL provider promise? | **`describe(nl, domain) → Requirements` (the existing closed map), schema-constrained** | free-form code emit *(rejected)* / full strategy pick |
| **3 · grounding mechanism** | How does the model stay on-vocabulary? | **Schema generated per-domain from the seed (axis ids + value-id enums), constrained decoding** | prompt-only "return this JSON" *(rejected)* |
| **4 · failure handling** | What happens when NL is ambiguous / underspecified? | **Partial `Requirements` + surface the unfilled axes for tuning** (degrade into the panel) | one-shot best-guess full fill *(rejected)* |

---

## Fork 1 — the surface (the item's stated open question)

**Crux.** #096 leaves open: CLI, an editor command, or a panel in the configurator UI. These
are not mutually exclusive end-states, but the *first* surface to build is a real decision
because it determines how much existing machinery is reused. The configurator is already a
rendered panel with a requirements list, a strategy ranking, and per-axis verdict badges
(`plateau:configurator.ts:160`, `plateau:configurator.ts:239`, `plateau:configurator.ts:261`).

- **(A — recommended) Panel-first: an NL box inside the configurator** that, on submit, calls
  the NL provider and **populates the existing requirements state** (`state.requirements`,
  `plateau:configurator.ts:48`, `plateau:configurator.ts:222`)
  — identical to clicking a preset, then the developer tunes via the fine-tune disclosure
  already present (`plateau:configurator.ts:186-192`).
  Reuses the ranking, the verdict badges, the decision-record emitter, and the teaching
  definitions — the AI just authors the requirement vector a human would otherwise pick.
  Matches Finding 4 (panels are the only surface that can *show* the decision) and Demo-First
  iteration. Cost: tied to the SPA; not yet scriptable.
- **(B) CLI-first.** Best long-term for delegation/CI and the cleanest BYO-key story (key in
  env), but as the *first* surface it must re-emit the ranked-strategy verdict rendering as
  text and gives up the panel's tuning loop — more new code, less of the demo lands visually.
  Strong *second* surface once the provider contract (Fork 2) is stable. **Rejected as first.**
- **(C) Editor command.** Lowest-friction in-flow insertion, but it needs an editor-extension
  host that doesn't exist yet and a way to surface compromises inline. Highest integration
  cost, defers furthest. **Rejected as first.**

**Default: A — panel-first.** The provider contract (Fork 2) is surface-agnostic, so CLI and
editor command remain open follow-ons that reuse the same `describe()` provider; the panel is
the cheapest path to a demonstrable concept (POC-mode pragmatism).

*Rejected:* CLI-first and editor-command-first as the **initial** surface — both discard the
panel's existing verdict rendering and tuning loop. Neither is rejected as a *later* surface.

---

## Fork 2 — the NL provider contract (what the swappable provider promises)

**Crux.** The 2026-06-11 ruling fixed *that* NL extraction lives behind a swappable provider;
it did not fix *what that provider returns*. The contract determines how much trust sits with
the model vs. the deterministic engine.

- **(A — recommended) `describe(nl, domain) → Requirements`.** The provider returns only the
  closed `Requirements` map (`we:types.ts:94`);
  the existing `rankStrategies` (`plateau:compat.ts:88`)
  picks the strategy deterministically. The model translates intent into the requirement
  vector and **never selects the implementation** — the configurator stays the guardrail
  (Finding 1-2). Smallest trust surface; the output is the exact shape a preset already is
  (`plateau:presets.ts:21`).
- **(B) Provider returns a chosen strategy (or emits code) directly.** Lets the model do the
  ranking too. Rejected: it re-introduces the open-generation problem the configurator exists
  to remove, makes the output unscoreable against the axis policy, and breaks the
  intent-UX-only principle by letting the AI front reach implementation. **Rejected.**

**Default: A.** A surface-agnostic `describe()` provider is consumed identically by the panel
(Fork 1), a future CLI, and a future editor command.

*Rejected:* provider-emits-strategy / provider-emits-code — collapses the deterministic seam
that is the entire moat.

---

## Fork 3 — grounding mechanism (how the model stays on-vocabulary)

**Crux.** The provider must be reliable enough that its `Requirements` always keys into real
axes/values — otherwise the compat engine silently scores against nothing.

- **(A — recommended) Per-domain schema generated from the seed + constrained decoding.** For
  the active domain, derive a JSON-schema where keys are the domain's `axis.id`s and each
  value is an array constrained to that axis's `AxisValue.id` `enum`
  (`we:types.ts:14-31`), pass the
  axis `definition` strings as grounding context (Finding 3), and run the model under native
  structured outputs / constrained generation (Finding 1). The model **cannot** emit an
  off-vocabulary key or value. Provider-agnostic at the contract level (BYO key); on
  Anthropic this is `output_config.format` / `messages.parse()` against the generated schema.
- **(B) Prompt-only "return this JSON".** Cheaper to wire, but carries the documented 5-20%
  malformed-output rate and can hallucinate axis/value ids the engine can't score.
  **Rejected** as the default; acceptable only as a fallback when a chosen BYO provider lacks
  constrained decoding (then validate against the seed and reject off-vocabulary keys).

**Default: A.** The schema is *machine-derived from the domain seed*, so it auto-tracks any
new domain or axis with zero extra authoring — the same "new domain, no UI change" property
the provider seam already has (`we:provider.ts:14-19`).

*Rejected:* prompt-only generation as the default contract — statistical, not structural,
reliability.

---

## Fork 4 — failure handling (ambiguous / underspecified NL)

**Crux.** Plain-language descriptions are often partial ("make sorting nice") — the model
can't responsibly fill every axis. What it does then shapes whether the tool feels honest.

- **(A — recommended) Emit a partial `Requirements` and degrade into the panel.** The model
  fills only the axes it's confident the description constrains and **leaves the rest unset**;
  the panel then renders those axes as un-required (the existing `hasRequirements()` /
  fine-tune path, `plateau:configurator.ts:113`, `plateau:configurator.ts:186`)
  so the developer completes them. Honest about uncertainty, reuses the tuning loop, and the
  compat engine already treats an absent axis as "not a requirement"
  (`plateau:compat.ts:67-68`) — so a
  partial map is a first-class input, not an error case. Most-flexible default.
- **(B) One-shot best-guess full fill.** Always populate every axis. Rejected: it manufactures
  confidence the description doesn't support, and on a correctness axis a wrong guess flips a
  strategy from `satisfies` to `incompatible` invisibly. **Rejected** as default (can be an
  opt-in "aggressive" mode later).

**Default: A — partial fill + degrade into the panel.** This is *why* panel-first (Fork 1)
compounds: the failure mode of the NL layer is exactly the manual mode of the configurator.

*Rejected:* always-full one-shot fill — fabricates certainty and can silently flip
correctness verdicts.

---

## Cross-references

- Decision: [#096 — NL → Technical Configurator](/backlog/096-nl-to-technical-configurator/)
- Epic: [#097 — monetization product concepts](/backlog/089-monetization-product-ideas/) · related [#089](/backlog/089-monetization-product-ideas/)
- Project: [Web Registries](/projects/) (`relatedProject: webregistries`)
- Machinery (plateau-app): `plateau:technical-configurator/types.ts`, `plateau:compat.ts`, `we:provider.ts`,
  `plateau:presets.ts`, `plateau:configurator.ts`

---

## Sources

- [LLM Structured Outputs: Schema Validation for Real Pipelines (2026)](https://collinwilkins.com/articles/structured-output)
- [Structured Outputs / Constrained Decoding — Let's Data Science](https://letsdatascience.com/blog/structured-outputs-making-llms-return-reliable-json)
- [JSON Mode vs Function Calling vs Structured Output: 2026 Guide](https://www.buildmvpfast.com/blog/structured-output-llm-json-mode-function-calling-production-guide-2026)
- [Beyond JSON Mode: Reliable Structured Outputs in Production — TianPan.co](https://tianpan.co/blog/2025-10-29-structured-outputs-llm-production)
- [Reliable JSON from Any LLM: Pydantic + Zod (2026) — TECHSY](https://techsy.io/en/blog/llm-structured-outputs-guide)
- [Are requirements really all you need? LLM-driven configuration code generation (CARLA)](https://arxiv.org/html/2505.13263)
- [Requirements are All You Need: From Requirements to Code with LLMs](https://arxiv.org/html/2406.10101v1)
- [ReqInOne: LLM Agent for Software Requirements Specification](https://arxiv.org/pdf/2508.09648)
- [Why CLIs Are Better for AI Coding Agents Than IDEs — Firecrawl](https://www.firecrawl.dev/blog/why-clis-are-better-for-agents)
- [CLI vs IDE Extension vs Cloud: Which AI Coding Interface — InventiveHQ](https://inventivehq.com/blog/cli-vs-ide-vs-cloud-ai-coding)
- Anthropic structured outputs (`output_config.format` / `messages.parse()`), GA Opus 4.8 — per the Claude API skill reference (schema-constrained generation).
