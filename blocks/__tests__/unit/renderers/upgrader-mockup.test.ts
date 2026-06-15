/**
 * Unit tests for the mockup input adapter (backlog #086) — design-to-code on the #094 pipeline.
 *
 * Proves the #086 claims: a UI MOCKUP is a new *input adapter* (one analyzer registration), lifted to
 * the SAME `ComponentIR` and ridden through the SAME verify-gated `<component>` generation — no parallel
 * engine, no parallel generator. The vision capability is a swappable `CustomVisionProvider` (no-leakage
 * Plateau-service client, #475); the deterministic reference provider stands in keyless. A provider that
 * hallucinates structure is REFUSED by the unchanged verify gate, never offered.
 */
import { describe, it, expect } from 'vitest';
import { CustomAnalyzerRegistry, upgrade } from '../../../renderers/upgrader/upgraderEngine';
import { registerReferenceAnalyzers } from '../../../renderers/upgrader/analyzers/legacyWebComponent';
import {
  registerMockupAnalyzer,
  createReferenceVisionProvider,
  createScriptedVisionProvider,
} from '../../../renderers/upgrader/analyzers/mockupAnalyzer';

const KNOWN_INTENTS = ['disclosure', 'selection', 'motion'];

const freshRegistry = (provider = createReferenceVisionProvider()) => {
  const r = new CustomAnalyzerRegistry();
  registerReferenceAnalyzers(r); // the code path stays registered alongside — coexistence, not replacement
  registerMockupAnalyzer(r, provider, { knownIntents: KNOWN_INTENTS });
  return r;
};

describe('mockup input adapter — reference vision provider', () => {
  it('lifts a mockup → ComponentIR → generated <component>, verify-gated and OFFERED', async () => {
    const registry = freshRegistry();
    const result = await upgrade(
      { mockup: { kind: 'image', ref: 'mock://signin.png', description: 'Sign-in disclosure with expand toggle' } },
      { registry, knownIntents: new Set(KNOWN_INTENTS) },
    );

    expect(result.analyzerId).toBe('mockup:reference');
    expect(result.ir).not.toBeNull();
    // The neutral IR is the SAME shape the code path produces.
    expect(result.ir?.shadow).toBe('none');
    expect(result.ir?.name).toMatch(/^[a-z][a-z0-9]*-[a-z0-9-]+$/); // valid hyphenated custom-element tag
    expect(result.ir?.intents).toContain('disclosure');
    // Generation reuses the existing core — the declarative <component> form.
    expect(result.generated).toMatch(/^<component name="/);
    // The unchanged verify gate passed → the output is trustworthy.
    expect(result.verify.ok).toBe(true);
    expect(result.offered).toBe(true);
  });

  it('routes on the mockup payload without a language hint (code path is not consulted)', async () => {
    const registry = freshRegistry();
    const result = await upgrade(
      { mockup: { kind: 'figma', ref: 'figma://node/1', description: 'A plain content card' } },
      { registry },
    );
    expect(result.analyzerId).toBe('mockup:reference');
    expect(result.offered).toBe(true);
  });

  it('omits an intent the standard does not know (flag, don\'t fake)', async () => {
    // knownIntents excludes "selection" → the provider must not emit it even though the text implies it.
    const registry = new CustomAnalyzerRegistry();
    registerMockupAnalyzer(registry, createReferenceVisionProvider(), { knownIntents: ['disclosure'] });
    const result = await upgrade(
      { mockup: { kind: 'image', ref: 'mock://list.png', description: 'choose an option from a select list' } },
      { registry, knownIntents: new Set(['disclosure']) },
    );
    expect(result.ir?.intents ?? []).not.toContain('selection');
    expect(result.offered).toBe(true);
  });
});

describe('mockup input adapter — verify gate refuses a hallucinating provider', () => {
  it('does not offer output that references an unknown intent', async () => {
    const liar = createScriptedVisionProvider(() => ({
      name: 'fake-widget',
      shadow: 'none' as const,
      template: '<div>hi</div>',
      intents: ['not-a-real-intent'],
    }));
    const registry = new CustomAnalyzerRegistry();
    registerMockupAnalyzer(registry, liar);
    const result = await upgrade(
      { mockup: { kind: 'image', ref: 'mock://x.png' } },
      { registry, knownIntents: new Set(KNOWN_INTENTS) },
    );
    // IR was produced, but the unchanged verify gate fails the intent check → never offered.
    expect(result.ir).not.toBeNull();
    expect(result.offered).toBe(false);
    expect(result.verify.checks.find((c) => c.id === 'intents')?.ok).toBe(false);
  });

  it('surfaces an analyzer error as a diagnostic, never an exception', async () => {
    const thrower = createScriptedVisionProvider(() => {
      throw new Error('vision service unreachable');
    });
    const registry = new CustomAnalyzerRegistry();
    registerMockupAnalyzer(registry, thrower);
    const result = await upgrade({ mockup: { kind: 'prototype', ref: 'mock://p' } }, { registry });
    expect(result.offered).toBe(false);
    expect(result.diagnostics.join(' ')).toMatch(/vision service unreachable/);
  });
});
