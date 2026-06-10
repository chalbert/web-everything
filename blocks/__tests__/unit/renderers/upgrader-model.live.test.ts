/**
 * Key-gated LIVE smoke test for the model-backed upgrader (#194).
 *
 * Turns the propose-and-verify claim from "structurally true" (proven hermetically by the scripted
 * client in upgrader-model.test.ts) into "demonstrated against a live model": it runs one real
 * end-to-end `upgrade()` through a real vendor `ModelClient` and asserts the UNCHANGED verify gate
 * ACCEPTS the model's output.
 *
 * It NEVER blocks the default suite. `describe.skipIf` skips the whole block unless the matching
 * API key is present, so CI without secrets stays green by *skipping*, not failing — and a real
 * network call happens only when a key is set. BYO key; none is bundled.
 *
 * Run it: set ANTHROPIC_API_KEY and/or OPENAI_API_KEY, then
 *   npx vitest run blocks/__tests__/unit/renderers/upgrader-model.live.test.ts
 */
import { describe, it, expect } from 'vitest';
import { CustomAnalyzerRegistry, upgrade } from '../../../renderers/upgrader/upgraderEngine';
import { registerReferenceAnalyzers } from '../../../renderers/upgrader/analyzers/legacyWebComponent';
import {
  registerModelAnalyzer,
  createAnthropicClient,
  createOpenAIClient,
  type ModelClient,
} from '../../../renderers/upgrader/analyzers/modelComponent';
import { modelCases, knownModelIntents } from '../../../renderers/upgrader/__fixtures__/model-cases';

const knownIntents = new Set<string>(knownModelIntents);
// A genuinely dynamic component the deterministic reference subset rejects — forces model escalation.
const DYNAMIC_SRC = modelCases.find((c) => c.id === 'dynamic-resolved')!.source;
const LIVE_TIMEOUT = 60_000;

/** One real end-to-end lift, asserting the verify gate accepted the live model's output. */
async function liveLift(client: ModelClient): Promise<void> {
  const registry = new CustomAnalyzerRegistry();
  registerModelAnalyzer(registry, client, { knownIntents: knownModelIntents });
  registerReferenceAnalyzers(registry);

  const r = await upgrade({ code: DYNAMIC_SRC, language: 'model' }, { registry, knownIntents });

  expect(r.analyzerId).toBe(`model:${client.id}`); // the real vendor handled it, not the reference
  expect(r.offered).toBe(true); // the unchanged verify gate accepted a real model's structure
  expect(r.ir!.name).toMatch(/-/); // a valid hyphenated custom-element tag
  expect(r.ir!.shadow).toMatch(/^(open|closed|none)$/);
  expect(r.generated).not.toContain('${'); // dynamic interpolation was resolved to static markup
}

describe.skipIf(!process.env.ANTHROPIC_API_KEY)('LIVE — Anthropic ModelClient (ANTHROPIC_API_KEY set)', () => {
  it('lifts a dynamic component end-to-end; the verify gate accepts it', () => liveLift(createAnthropicClient()), LIVE_TIMEOUT);
});

describe.skipIf(!process.env.OPENAI_API_KEY)('LIVE — OpenAI ModelClient (OPENAI_API_KEY set)', () => {
  it('lifts a dynamic component end-to-end; the verify gate accepts it', () => liveLift(createOpenAIClient()), LIVE_TIMEOUT);
});
