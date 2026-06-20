---
kind: story
size: 5
parent: "097"
status: resolved
dateOpened: "2026-06-08"
dateStarted: "2026-06-08"
dateResolved: "2026-06-08"
graduatedTo: "blocks/renderers/upgrader/analyzers/modelComponent.ts (model-backed analyzer + ModelClient seam)"
tags: [upgrader, ai-agnostic, provider-registry, byo-key, analyzer, monetization]
relatedProject: webadapters
crossRef: { url: /backlog/094-ai-upgrader-tools/, label: "AI upgrader MVP (#094)" }
---

# Upgrader BYO-AI model analyzer — a real model behind the registry seam

The [#094](/backlog/094-ai-upgrader-tools/) MVP proved the analyzer seam with a **deterministic
reference provider** (no key) that lifts a structured subset of vanilla web components. This item
registers a **real bring-your-own-key model provider** into the same `CustomAnalyzerRegistry`, so
the upgrader handles the messier input the heuristic deliberately rejects (dynamic `${…}` templates,
framework idioms, multi-file components) — with **no change to the engine core**, exactly the
swap-in the registry was built for.

Scope: a `CustomAnalyzer` whose `analyze()` calls a model (Anthropic/OpenAI behind a thin client),
prompts it to emit the neutral `ComponentIR` shape, and returns it. The **verify gate is unchanged
and does the heavy lifting** — a model that hallucinates structure fails fidelity/parse/intent
checks and is never offered, which is the whole "propose-and-verify" moat. Key handling is BYO
(read from env/config; never bundled), so we carry no model-hosting cost.

Open points: the prompt/output contract (force structured `ComponentIR` output, validate before
trusting); which provider client to depend on (keep it a swappable client too, or a single default);
how to surface model diagnostics distinctly from analyzer-subset rejections in the playground.

## Progress

- **Status:** resolved — model-backed analyzer registered into the existing `CustomAnalyzerRegistry` with NO engine-core change. Full suite (1619) + 21 new model tests + check:standards green; demo verified live (11/11, 0 console errors).
- **Branch:** docs/standard-authoring-workflow
- **Done:**
  - `we:blocks/renderers/upgrader/analyzers/modelComponent.ts` — `ModelClient` vendor seam; thin native-`fetch` Anthropic client (BYO key from env/opts, structured `output_config.format` → guaranteed `ComponentIR` JSON, `claude-opus-4-8`); `createScriptedClient` (no-key, deterministic — drives tests + the browser playground); `parseModelIR` validator (shape + rejects leftover `${…}`); `modelComponentAnalyzer` factory + `registerModelAnalyzer`.
  - `we:blocks/renderers/upgrader/__fixtures__/model-cases.ts` — shared (demo + suite): 2 good resolves (dynamic→slots; multi-`innerHTML` merge) + 4 hallucination guards, one per gate layer (model JSON validation, interpolation guard, engine intent check, engine parse check).
  - `we:blocks/__tests__/unit/renderers/upgrader-model.test.ts` — 21 tests (routing, lifts, gate, parseModelIR, no-key Anthropic client).
  - `demos/code-upgrader-demo.{ts,css,html}` — a "Model provider (BYO key — scripted here)" section surfacing `via {analyzerId}` so a model failure reads distinctly from a reference subset rejection; intro updated to point at #188.
- **Leftovers captured:** [#194](/backlog/194-upgrader-model-providers-live-and-multi-vendor/) keyed live smoke run + a second vendor (OpenAI / `@anthropic-ai/sdk`-backed `ModelClient`).
- **Open points resolved:**
  - *Prompt/output contract:* prompt asks the model to RESOLVE dynamics to a static declarative template and emit JSON; structured `output_config.format` (Anthropic client) + `parseModelIR` enforce the shape before the vendor-neutral verify gate runs.
  - *Which provider client:* the model VENDOR is itself swappable (`ModelClient`); the thin Anthropic `fetch` client is the reference real provider, an SDK/other-vendor client is a drop-in ([#194](/backlog/194-upgrader-model-providers-live-and-multi-vendor/)).
  - *Diagnostics distinctness:* a model failure surfaces as `analyzer "model:<vendor>" could not analyze…`, and the playground prints `via {analyzerId}` per card — distinct from a reference subset rejection.
- **Notes — design decisions (POC):**
  - **Routing with zero engine change:** model analyzer's `handles()` claims only component-shaped input the reference subset rejects (dynamic `${…}`, framework idioms, multi-`innerHTML`) or an explicit `language: "model"`; registered *first* so messy input escalates to the model and clean input falls through to the deterministic reference.
  - **The model vendor is itself swappable** (`ModelClient` interface) — the thin Anthropic `fetch` client is the reference real provider; a `@anthropic-ai/sdk`-backed client is a drop-in implementing the same interface. Native `fetch` keeps the browser playground dependency-free; the real client is Node/CI-side (no key in the browser).
  - **Output contract:** model is prompted to RESOLVE dynamics to a static declarative template and return JSON ComponentIR; `parseModelIR` validates shape and rejects leftover `${…}` before the engine's verify gate (parse + intents) does the heavy lifting — hallucinated structure fails and is never offered.
