---
type: decision
workItem: story
size: 5
parent: "097"
status: resolved
dateOpened: "2026-06-06"
dateStarted: "2026-06-11"
dateResolved: "2026-06-11"
graduatedTo: none
codifiedIn: "docs/agent/platform-decisions.md#intents-ux-only"
preparedDate: "2026-06-11"
relatedReport: reports/2026-06-11-nl-to-technical-configurator.md
tags: [monetization, business-model, ai-agnostic, technical-configurator, natural-language, provider-registry, decision-support, plateau, self-run-tool]
relatedProject: webregistries
crossRef: { url: /backlog/089-monetization-product-ideas/, label: "Product ideas (#089)" }
---

# NL → Technical Configurator — describe the behavior, AI wires the strategy

An **AI front-end to the Technical Configurator**: the developer describes desired behavior
in plain language ("undo/redo with an audit trail", "locale-aware sorting that's stable") and
the AI **selects and wires the right strategy from the registries**, then emits the configured
code. No design exists yet. The provider-seam and tier-1/BYO-key shape were settled by
principle (below); what remains are the **surface** (CLI vs editor command vs panel) and the
**wire contract** the NL provider must satisfy. The four forks below are grounded in a
prior-art survey (LLM structured-outputs / schema-constrained generation, requirement-extraction
templates, AI-dev-surface conventions) published as the
[NL → Technical Configurator](/research/nl-to-technical-configurator/) research topic. Each
names a recommended default in **bold**.

The white space vs. generic AI codegen ([#089](/backlog/089-monetization-product-ideas/)):
incumbents have no registry of *swappable strategies* to target, so they guess; here the AI
navigates a **formal decision space the standard already encodes**, with deterministic scoring —
the registry the output is constrained to is the moat, not the model.

## Axis framing — the machinery this rides on

The Technical Configurator already exists in **plateau-app** and is the entire reason the AI's
job is *constrained selection* rather than open generation. The forks below all turn on how much
of that machinery the NL layer reuses:

- **A `Requirements` object is the only thing the AI must produce.** A domain is a set of
  capability **axes**, each with a fixed set of value ids
  (`we:types.ts:21`,
  `we:types.ts:14`); a `Requirements`
  is `Record<axisId, acceptableValueId[]>`
  (`we:types.ts:88`) — a small,
  **closed-vocabulary** map the NL layer fills.
- **The hand-authored presets are the exact shape the AI would synthesize.** A use-case preset
  is a human-written `{label, blurb, requirements}` triple
  (`plateau:presets.ts:15`); e.g.
  "Let users undo and redo" → `{reversibility: [...]}`
  (`plateau:presets.ts:34`). The NL layer
  **replaces the human authoring of that map** — same structure `applyPreset` already consumes
  (`plateau:configurator.ts:222`).
- **The compat engine is the deterministic guardrail downstream of the AI.**
  `rankStrategies(strategies, axes, requirements)`
  (`plateau:compat.ts:88`) folds per-axis
  verdicts (`satisfies | compromise | incompatible`) under a correctness-vs-fidelity policy that
  lives in the **axis data**, not the code
  (`plateau:compat.ts:34`). Once the AI emits
  a `Requirements`, strategy selection is fully deterministic and standards-bound.
- **The provider seam already exists.** The configurator reads domains through a
  `CapabilityProvider` interface
  (`we:types.ts:82`); the seed provider
  (`we:provider.ts:21`) is one impl,
  and new domains slot in with no UI change
  (`we:provider.ts:14`). The NL layer
  is a second, parallel seam — a `Requirements` *producer*, surface-agnostic.
- **Owned by [`webregistries`](../src/_data/projects.json#L3)** — the platform layer the
  strategies are selected from. The decision-record + config-stub emitter
  (`plateau:configurator.ts:400`) is
  the existing "emit the configured code" tail the NL layer feeds the front of.

### Recommended path at a glance

Ratify all four rows, or override just the one you'd change. The **confidence** column says
where judgment is actually needed vs. where to nod.

| Fork | Recommended default | Main alternative | Confidence |
|---|---|---|---|
| **1 · surface** | **panel-first** (NL box inside the configurator; CLI/editor as follow-ons) | CLI-first / editor command *(rejected as first)* | **Med-high** — reuses the most machinery; alts are legit later surfaces |
| **2 · provider contract** | **`describe(nl, domain) → Requirements`** (model translates intent only) | provider emits strategy/code *(rejected)* | **High** — collapses the deterministic moat otherwise |
| **3 · grounding** | **per-domain schema from the seed + constrained decoding** | prompt-only "return JSON" *(rejected as default)* | **High** — structural vs statistical reliability |
| **4 · failure handling** | **partial fill + degrade into the panel** | one-shot full best-guess *(rejected)* | **High** — absent axis already = "not required" in the engine |

## Fork 1 — the surface (the item's stated open question)

**Crux.** CLI, an editor command, or a panel in the configurator UI. Not mutually exclusive
end-states, but the *first* surface is a real decision: it sets how much existing machinery is
reused. The configurator is already a rendered panel with a requirements list, a strategy
ranking, and per-axis verdict badges
(`plateau:configurator.ts:160`,
`plateau:configurator.ts:239`).

- **(A — recommended) Panel-first: an NL box inside the configurator** that, on submit, calls
  the NL provider and **populates the existing requirements state**
  (`plateau:configurator.ts:48`,
  `plateau:configurator.ts:222`) —
  identical to clicking a preset, then the developer tunes via the fine-tune disclosure already
  present (`plateau:configurator.ts:186`).
  Reuses ranking, verdict badges, the decision-record emitter, and the teaching definitions.
  Matches the prior-art finding that panels are the only surface that can *show* the decision,
  and Demo-First iteration. Cost: tied to the SPA; not yet scriptable.
- **(B) CLI-first.** Best long-term for delegation/CI and the cleanest BYO-key story (key in
  env), but as the *first* surface it must re-emit the verdict rendering as text and gives up
  the panel's tuning loop — more new code, less of the demo lands visually. Strong *second*
  surface once the provider contract (Fork 2) is stable.
- **(C) Editor command.** Lowest-friction in-flow insertion, but needs an editor-extension host
  that doesn't exist yet plus a way to surface compromises inline. Highest integration cost.

**Default: A — panel-first.** The provider contract (Fork 2) is surface-agnostic, so CLI and
editor command stay open follow-ons on the same `describe()` provider; the panel is the cheapest
path to a demonstrable concept (POC-mode pragmatism).

*Rejected:* CLI-first and editor-command-first as the **initial** surface — both discard the
panel's existing verdict rendering and tuning loop. Neither is rejected as a *later* surface.

## Fork 2 — the NL provider contract (what the swappable provider promises)

**Crux.** The 2026-06-11 ruling fixed *that* NL extraction lives behind a swappable provider; it
did not fix *what it returns*. The contract sets how much trust sits with the model vs. the
deterministic engine.

- **(A — recommended) `describe(nl, domain) → Requirements`.** The provider returns only the
  closed `Requirements` map (`we:types.ts:88`);
  `rankStrategies` (`plateau:compat.ts:88`)
  picks the strategy deterministically. The model translates intent and **never selects the
  implementation** — the configurator stays the guardrail, and the output is the exact shape a
  preset already is (`plateau:presets.ts:15`).
  Smallest trust surface; surface-agnostic (consumed identically by the panel, a future CLI, and
  a future editor command).
- **(B) Provider returns a chosen strategy (or emits code) directly.** Lets the model do the
  ranking too. Re-introduces the open-generation problem the configurator exists to remove, makes
  the output unscoreable against the axis policy, and breaks intent-UX-only by letting the AI
  front reach implementation.

**Default: A.**

*Rejected:* provider-emits-strategy / provider-emits-code — collapses the deterministic seam that
is the entire moat.

## Fork 3 — grounding mechanism (how the model stays on-vocabulary)

**Crux.** The provider must reliably key into real axes/values — else the compat engine silently
scores against nothing.

- **(A — recommended) Per-domain schema generated from the seed + constrained decoding.** For
  the active domain, derive a JSON-schema where keys are the domain's `axis.id`s and each value
  is constrained to that axis's value-id `enum`
  (`we:types.ts:14`), pass the axis
  `definition` strings as grounding context, and run under native structured outputs /
  constrained generation. The model **cannot** emit an off-vocabulary key or value.
  Provider-agnostic at the contract level (BYO key); on Anthropic this is
  `output_config.format` / `messages.parse()` against the generated schema. The schema is
  *machine-derived from the seed*, so it auto-tracks any new domain or axis with zero extra
  authoring — same "new domain, no UI change" property the provider seam already has
  (`we:provider.ts:14`).
- **(B) Prompt-only "return this JSON".** Cheaper to wire, but carries the documented 5-20%
  malformed-output rate and can hallucinate axis/value ids the engine can't score. Acceptable
  only as a fallback when a chosen BYO provider lacks constrained decoding (then validate against
  the seed and reject off-vocabulary keys).

**Default: A.**

*Rejected:* prompt-only generation as the default contract — statistical, not structural,
reliability.

## Fork 4 — failure handling (ambiguous / underspecified NL)

**Crux.** Plain-language descriptions are often partial ("make sorting nice"); what the model
does then shapes whether the tool feels honest.

- **(A — recommended) Emit a partial `Requirements` and degrade into the panel.** The model fills
  only the axes the description constrains and **leaves the rest unset**; the panel renders those
  as un-required via the existing `hasRequirements()` / fine-tune path
  (`plateau:configurator.ts:113`,
  `plateau:configurator.ts:186`) so
  the developer completes them. The compat engine already treats an absent axis as "not a
  requirement" (`plateau:compat.ts:67`), so a
  partial map is a first-class input, not an error. Most-flexible default — and the reason
  panel-first (Fork 1) compounds: the NL layer's failure mode *is* the configurator's manual mode.
- **(B) One-shot best-guess full fill.** Always populate every axis. Manufactures confidence the
  description doesn't support; on a correctness axis a wrong guess flips a strategy from
  `satisfies` to `incompatible` invisibly. Could be an opt-in "aggressive" mode later.

**Default: A — partial fill + degrade into the panel.**

*Rejected:* always-full one-shot fill — fabricates certainty and can silently flip correctness
verdicts.

## Settled by principle (2026-06-11)

These were ruled before this preparation pass and are **not** re-opened here:

- **NL → requirement-axes extraction stays behind a swappable provider** (intent-UX-only +
  adapter-as-normalization-hub: NL is the variable AI-facing front; the Configurator is the
  canonical decision space it normalizes into). Fork 2/3 above decide the *contract* of that
  provider, not whether it's swappable.
- **Ships as a tier-1 self-run, BYO-AI-key tool** (no model-hosting cost or uptime on us — the
  solo-founder shape).
- **Reuses the configurator's domain seeds directly**, so a new domain (validation, reliability)
  becomes NL-addressable with no extra work.

## Why it fits the solo-founder lens (preserved context)

- **Tier-1 self-run tool**, BYO-AI key — no model-hosting cost or uptime on us.
- **Leverages existing plateau-app work** — the configurator, compat engine, and domain seeds
  already exist; this is an NL layer on top, not new architecture.
- It's a *product on* the configurator, not "building the app" — the AI tool is the saleable
  artifact.

## Resolution — ratified 2026-06-11

- **Fork 1 — panel-first surface**: an NL box inside the existing configurator panel reuses the most machinery (ranking, verdict badges, decision-record emitter, fine-tune loop) and is the cheapest demonstrable concept; CLI and editor command stay open follow-ons on the same surface-agnostic provider.
- **Fork 2 — `describe(nl, domain) → Requirements`**: the provider returns only the closed `Requirements` map and never selects the implementation; `rankStrategies` stays the deterministic guardrail. Smallest trust surface; keeps the registry-as-moat intact.
- **Fork 3 — per-domain schema from the seed + constrained decoding**: derive a JSON-schema (axis-id keys, value-id enums) from the active domain and run under native structured outputs so the model cannot emit off-vocabulary keys/values; the schema is machine-derived, so new domains auto-track. Structural over statistical reliability.
- **Fork 4 — partial fill + degrade into the panel**: the model fills only constrained axes and leaves the rest unset; the compat engine already treats an absent axis as "not required," and the panel's fine-tune path completes them. Honest, most-flexible default; the failure mode *is* the configurator's manual mode.

`graduatedTo: none` — the rulings yield an NL-layer build on top of plateau-app's existing configurator, not a new standard entity.

**Follow-on builds (not yet scaffolded):**

- NL provider seam + `describe(nl, domain) → Requirements` contract (surface-agnostic, BYO-AI-key, tier-1 self-run) · feature/M · blockedBy: none. → #328
- Per-domain schema generator from the seed + constrained-decoding integration · feature/M · blockedBy: provider seam (#328). → #329
- Panel NL box wiring (populate requirements state + degrade-into-panel on partial fill) · feature/S · blockedBy: provider seam (#328). → #339

## Progress

**Status:** resolved 2026-06-11 — all four forks ratified to their bold defaults. Originally prepared 2026-06-11 (forks framed + grounded; research captured in
`relatedReport`). Provider-seam and tier-1/BYO-key shape settled by principle (above); the four
forks below settle the surface, the provider contract, the grounding mechanism, and the failure
mode. The build follows once they're ruled.
