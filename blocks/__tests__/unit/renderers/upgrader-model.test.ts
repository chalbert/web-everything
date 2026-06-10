/**
 * Unit tests for the model-backed upgrader analyzer (backlog #188).
 *
 * Proves the item's objectives:
 *   1. a REAL provider drops into the SAME `CustomAnalyzerRegistry` with no engine-core change;
 *   2. routing escalates only the messier input to the model — clean vanilla components still fall
 *      through to the deterministic, no-key reference analyzer;
 *   3. the model VENDOR is swappable (`ModelClient`), exercised here with a no-key scripted client;
 *   4. the verify gate is unchanged and does the heavy lifting — hallucinated structure is caught at
 *      every layer (model JSON validation, interpolation guard, engine intent check, engine parse
 *      check) and is never offered;
 *   5. the thin Anthropic client fails loudly with no key, rather than bundling one.
 */
import { describe, it, expect } from 'vitest';
import { CustomAnalyzerRegistry, upgrade } from '../../../renderers/upgrader/upgraderEngine';
import { registerReferenceAnalyzers } from '../../../renderers/upgrader/analyzers/legacyWebComponent';
import {
  registerModelAnalyzer,
  createScriptedClient,
  createAnthropicClient,
  createOpenAIClient,
  parseModelIR,
} from '../../../renderers/upgrader/analyzers/modelComponent';
import { modelCases, knownModelIntents, scriptedResponderFor } from '../../../renderers/upgrader/__fixtures__/model-cases';
import { upgraderCases } from '../../../renderers/upgrader/__fixtures__/upgrader-cases';

const knownIntents = new Set<string>(knownModelIntents);

/** Registry with the model provider AHEAD of the reference one — the intended escalation order. */
const freshRegistry = (): CustomAnalyzerRegistry => {
  const r = new CustomAnalyzerRegistry();
  registerModelAnalyzer(r, createScriptedClient(scriptedResponderFor(modelCases)), { knownIntents: knownModelIntents });
  registerReferenceAnalyzers(r);
  return r;
};

describe('routing — model escalation vs reference fall-through', () => {
  it('routes a clean vanilla component to the deterministic reference (model declines)', async () => {
    const registry = freshRegistry();
    const src = upgraderCases.find((c) => c.id === 'shadow-innerhtml')!.source;
    const r = await upgrade({ code: src }, { registry, knownIntents });
    expect(r.analyzerId).toBe('reference:legacy-web-component');
    expect(r.offered).toBe(true);
  });

  it('routes a dynamic `${…}` component to the model provider', async () => {
    const registry = freshRegistry();
    const src = modelCases.find((c) => c.id === 'dynamic-resolved')!.source;
    const r = await upgrade({ code: src }, { registry, knownIntents });
    expect(r.analyzerId).toBe('model:scripted');
  });

  it('honors an explicit language="model" opt-in', async () => {
    const registry = freshRegistry();
    const src = modelCases.find((c) => c.id === 'multi-innerhtml-resolved')!.source;
    const r = await upgrade({ code: src, language: 'model' }, { registry, knownIntents });
    expect(r.analyzerId).toBe('model:scripted');
  });
});

describe('the model provider lifts what the reference subset rejects', () => {
  it('resolves a dynamic template to a faithful, offered <component>', async () => {
    const registry = freshRegistry();
    const src = modelCases.find((c) => c.id === 'dynamic-resolved')!.source;
    const r = await upgrade({ code: src }, { registry, knownIntents });
    expect(r.offered).toBe(true);
    expect(r.ir!.name).toBe('greet-user');
    expect(r.ir!.shadow).toBe('open');
    expect(r.generated).toContain('<slot name="name">');
  });

  it('merges multi-step innerHTML into one declarative template (escalates past the lossy reference)', async () => {
    const registry = freshRegistry();
    const src = modelCases.find((c) => c.id === 'multi-innerhtml-resolved')!.source;
    const r = await upgrade({ code: src }, { registry, knownIntents });
    expect(r.analyzerId).toBe('model:scripted'); // not the reference, which would lift only the first write
    expect(r.offered).toBe(true);
    expect(r.ir!.name).toBe('status-card');
    expect(r.generated).toContain('<h3>Status</h3>');
    expect(r.generated).toContain('<p class="body">'); // the SECOND write — proves the full merge
  });
});

describe('verify gate — hallucinated structure is never offered, tagged as a model failure', () => {
  for (const c of modelCases.filter((x) => !x.expectOffered)) {
    it(`${c.id}: rejected with a "${c.expectDiagnostic}" diagnostic`, async () => {
      const registry = freshRegistry();
      const r = await upgrade({ code: c.source }, { registry, knownIntents });
      expect(r.offered).toBe(false);
      expect(r.analyzerId).toBe('model:scripted'); // distinct from a reference subset rejection
      expect(r.diagnostics.join(' ')).toContain(c.expectDiagnostic!);
    });
  }
});

describe('parseModelIR — model-output contract', () => {
  it('accepts a well-formed object and stamps a provider note', () => {
    const ir = parseModelIR('{"name":"x-y","shadow":"none","template":"<i></i>"}');
    expect(ir.name).toBe('x-y');
    expect(ir.notes!.join(' ')).toMatch(/model provider/);
  });

  it('reads JSON out of a fenced code block', () => {
    const ir = parseModelIR('```json\n{"name":"a-b","shadow":"open","template":"<slot></slot>"}\n```');
    expect(ir.name).toBe('a-b');
  });

  it('rejects leftover `${…}` interpolation', () => {
    expect(() => parseModelIR('{"name":"a-b","shadow":"open","template":"<b>${x}</b>"}')).toThrow(/interpolation/);
  });

  it('rejects a non-JSON completion', () => {
    expect(() => parseModelIR('here you go!')).toThrow(/valid JSON/);
  });

  it('rejects a bad shadow value', () => {
    expect(() => parseModelIR('{"name":"a-b","shadow":"ghost","template":"<i></i>"}')).toThrow(/shadow/);
  });
});

describe('shared fixtures — demo + suite exercise the same engine', () => {
  for (const c of modelCases) {
    it(`${c.id}: offered === ${c.expectOffered}`, async () => {
      const registry = freshRegistry();
      const r = await upgrade({ code: c.source }, { registry, knownIntents });
      expect(r.offered).toBe(c.expectOffered);
      if (c.expectOffered) {
        expect(r.ir!.name).toBe(c.expectName);
        expect(r.ir!.shadow).toBe(c.expectShadow);
      }
    });
  }
});

describe('thin Anthropic client — BYO key, never bundled', () => {
  it('fails loudly when no key is configured (rather than faking a call)', async () => {
    // Stub the env so the no-key path is exercised hermetically (no network), even if the dev
    // machine has ANTHROPIC_API_KEY set. resolveKey throws before fetch is ever reached.
    const saved = process.env.ANTHROPIC_API_KEY;
    delete process.env.ANTHROPIC_API_KEY;
    try {
      const registry = new CustomAnalyzerRegistry();
      registerModelAnalyzer(registry, createAnthropicClient());
      const src = modelCases.find((c) => c.id === 'dynamic-resolved')!.source;
      const r = await upgrade({ code: src }, { registry, knownIntents });
      expect(r.offered).toBe(false);
      expect(r.analyzerId).toBe('model:anthropic');
      expect(r.diagnostics.join(' ')).toMatch(/ANTHROPIC_API_KEY|API key/);
    } finally {
      if (saved !== undefined) process.env.ANTHROPIC_API_KEY = saved;
    }
  });
});

describe('thin OpenAI client — second vendor, BYO key, never bundled (#194)', () => {
  it('drops into the same registry and fails loudly when no key is configured', async () => {
    // Hermetic: stub away the env so the no-key path is exercised without a network call, even on a
    // machine that has OPENAI_API_KEY set. resolveOpenAIKey throws before fetch is ever reached.
    const saved = process.env.OPENAI_API_KEY;
    delete process.env.OPENAI_API_KEY;
    try {
      const registry = new CustomAnalyzerRegistry();
      registerModelAnalyzer(registry, createOpenAIClient());
      const src = modelCases.find((c) => c.id === 'dynamic-resolved')!.source;
      const r = await upgrade({ code: src }, { registry, knownIntents });
      expect(r.offered).toBe(false);
      expect(r.analyzerId).toBe('model:openai'); // distinct vendor id, proving the seam is swappable
      expect(r.diagnostics.join(' ')).toMatch(/OPENAI_API_KEY|API key/);
    } finally {
      if (saved !== undefined) process.env.OPENAI_API_KEY = saved;
    }
  });
});
