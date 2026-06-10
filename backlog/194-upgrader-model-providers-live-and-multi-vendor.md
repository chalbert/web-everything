---
type: idea
workItem: story
size: 3
parent: "097"
status: resolved
blockedBy: ["188"]
dateOpened: "2026-06-08"
dateStarted: "2026-06-10"
dateResolved: "2026-06-10"
graduatedTo: none
tags: [upgrader, ai-agnostic, provider-registry, byo-key, model-client, multi-vendor, monetization]
relatedProject: webadapters
crossRef: { url: /backlog/188-upgrader-byo-ai-model-analyzer/, label: "BYO-AI model analyzer (#188)" }
---

# Upgrader model providers — a keyed live run and a second vendor

[#188](/backlog/188-upgrader-byo-ai-model-analyzer/) shipped the model-backed analyzer behind the
`CustomAnalyzerRegistry` seam: a swappable `ModelClient`, a thin native-`fetch` Anthropic client
(BYO key, structured `output_config.format`), and a deterministic **scripted** client that proves
the seam and the verify gate in the playground and CI **without a key**. Two things the MVP
deliberately did not do, both natural follow-ons:

1. **No real network path is ever exercised.** The Anthropic client is unit-tested only for its
   no-key failure; a real lift against a live model has never run. Add an opt-in, key-gated smoke
   test (skipped unless `ANTHROPIC_API_KEY` is present) that runs one real `upgrade()` end-to-end on
   a dynamic fixture and asserts the verify gate accepts the model's output — turning the
   propose-and-verify claim from "structurally true" into "demonstrated against a live model".
2. **Only one vendor.** The `ModelClient` interface is the vendor-swap point, but only the Anthropic
   `fetch` client exists. Add a second implementation to prove multi-vendor (an OpenAI `fetch`
   client, and/or a `@anthropic-ai/sdk`-backed client for production Node/CI use where the SDK's
   retry/streaming/typed-error handling beats hand-rolled `fetch`). Each is just another
   `ModelClient`; the analyzer, engine, and verify gate are untouched.

Open points: where the keyed smoke test lives so it never blocks the default suite (a separate
`*.live.test.ts` excluded from CI by default, or an env-gated `it.skipIf`); whether the
`looksMessy()` routing heuristic should gain a "prefer model when a key is configured" mode; and
whether to publish the `ModelClient` contract as a documented extension point (a short authoring
note) so downstream adopters can bring their own vendor.

## Progress

- **Status:** resolved (2026-06-10, in a batch). The two concrete deliverables shipped; the two
  *decisions* among the open points were deferred, not built (they're forks, not work — see below).
- **Done — second vendor (objective 2):** `createOpenAIClient` in
  `blocks/renderers/upgrader/analyzers/modelComponent.ts` — a thin OpenAI Chat-Completions `fetch`
  client implementing the same `ModelClient` contract (`id: 'openai'`, structured
  `response_format: json_schema`, BYO `OPENAI_API_KEY`, fails loudly with no key). The analyzer,
  engine, and verify gate are untouched, proving the vendor is config not architecture. A deterministic
  no-key unit test (`upgrader-model.test.ts`) covers it (drops into the registry, surfaces a
  `model:openai` diagnostic with no key) — hermetic, no network.
- **Done — keyed live run (objective 1):** `upgrader-model.live.test.ts` runs one real end-to-end
  `upgrade()` per available vendor and asserts the **unchanged verify gate accepts** the live model's
  output (`model:<id>` handled it, `offered === true`, hyphenated tag, no leftover `${…}`). Resolved
  the *smoke-test-placement* open point in favour of **`describe.skipIf(!key)`** (the env-gated form):
  it's picked up by the default include but skips the whole block without a key, so CI without secrets
  stays green by skipping — no config change, runnable on demand by setting the key.
- **Deferred (not built — these are decisions, belong in discussion, not a batch):** the
  `looksMessy()` "prefer-model-when-a-key-is-configured" routing mode, and publishing the `ModelClient`
  contract as a documented extension point. Both are genuine forks; left as open points for a future
  decision item if/when demand appears.
