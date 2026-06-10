/**
 * Unit tests for the AI upgrader engine (backlog #094, MVP).
 *
 * Proves the MVP objectives:
 *   1. the reference analyzer lifts legacy vanilla web components → neutral IR (one source path);
 *   2. generation reuses the existing core — the IR lowers to a declarative `<component>` that
 *      `parseDefinition` (the same module MaaS + the /adapters/ demos use) accepts;
 *   3. the VERIFY GATE is real — it offers faithful output and REFUSES drift / bad intents /
 *      out-of-subset input (the moat: only checked output is trusted).
 */
import { describe, it, expect } from 'vitest';
import {
  CustomAnalyzerRegistry,
  generateComponentSource,
  verifyUpgrade,
  upgrade,
  type ComponentIR,
} from '../../../renderers/upgrader/upgraderEngine';
import { registerReferenceAnalyzers } from '../../../renderers/upgrader/analyzers/legacyWebComponent';
import { parseDefinition } from '../../../renderers/component/declarativeComponent';
import { upgraderCases } from '../../../renderers/upgrader/__fixtures__/upgrader-cases';

const freshRegistry = (): CustomAnalyzerRegistry => {
  const r = new CustomAnalyzerRegistry();
  registerReferenceAnalyzers(r);
  return r;
};

describe('reference analyzer — legacy web component → IR', () => {
  it('lifts an open-shadow component to the right tag, shadow, and template', async () => {
    const registry = freshRegistry();
    const src = upgraderCases.find((c) => c.id === 'shadow-innerhtml')!.source;
    const r = await upgrade({ code: src }, { registry });
    expect(r.analyzerId).toBe('reference:legacy-web-component');
    expect(r.ir).not.toBeNull();
    expect(r.ir!.name).toBe('user-card');
    expect(r.ir!.shadow).toBe('open');
    expect(r.ir!.template).toContain('<slot></slot>');
  });

  it('lifts a light-DOM component to shadow="none"', async () => {
    const registry = freshRegistry();
    const src = upgraderCases.find((c) => c.id === 'light-dom')!.source;
    const r = await upgrade({ code: src }, { registry });
    expect(r.ir!.shadow).toBe('none');
    expect(r.ir!.name).toBe('x-badge');
  });
});

describe('reference analyzer — conservative intent inference (#189)', () => {
  it('infers "selection" from role="listbox" + aria-selected, and notes it', async () => {
    const registry = freshRegistry();
    const src = upgraderCases.find((c) => c.id === 'listbox-selection-intent')!.source;
    const r = await upgrade({ code: src }, { registry });
    expect(r.ir!.intents).toEqual(['selection']);
    expect(r.ir!.notes!.join(' ')).toMatch(/inferred intent "selection"/);
  });

  it('infers "motion" from a prefers-reduced-motion guard', async () => {
    const registry = freshRegistry();
    const src = upgraderCases.find((c) => c.id === 'reduced-motion-intent')!.source;
    const r = await upgrade({ code: src }, { registry });
    expect(r.ir!.intents).toEqual(['motion']);
  });

  it('does NOT infer "selection" from role="listbox" alone (both signals required — flag, don\'t fake)', async () => {
    const registry = freshRegistry();
    const src =
      `class PlainList extends HTMLElement {\n` +
      `  connectedCallback() {\n` +
      `    this.innerHTML = '<ul role="listbox"><li role="option">A</li></ul>';\n` +
      `  }\n` +
      `}\n` +
      `customElements.define('plain-list', PlainList);`;
    const r = await upgrade({ code: src }, { registry });
    expect(r.ir!.intents).toEqual([]);
  });

  it('infers no intents for a plain component (empty, not faked)', async () => {
    const registry = freshRegistry();
    const src = upgraderCases.find((c) => c.id === 'light-dom')!.source;
    const r = await upgrade({ code: src }, { registry });
    expect(r.ir!.intents).toEqual([]);
  });

  it('an inferred intent passes the verify gate when it resolves in the standard', async () => {
    const registry = freshRegistry();
    const src = upgraderCases.find((c) => c.id === 'listbox-selection-intent')!.source;
    const r = await upgrade({ code: src }, { registry, knownIntents: new Set(['selection', 'motion']) });
    expect(r.offered).toBe(true);
    expect(r.verify.checks.find((c) => c.id === 'intents')!.ok).toBe(true);
  });
});

describe('generation reuses the existing core', () => {
  it('emits a declarative <component> that parseDefinition accepts (no parallel generator)', () => {
    const ir: ComponentIR = { name: 'user-card', shadow: 'open', template: '<slot></slot>' };
    const def = generateComponentSource(ir);
    const parsed = parseDefinition(def);
    expect(parsed.name).toBe('user-card');
    expect(parsed.shadow).toBe('open');
  });
});

describe('verify gate — the moat', () => {
  it('passes when the generated source round-trips to the analyzed structure', () => {
    const ir: ComponentIR = { name: 'x-badge', shadow: 'none', template: '<strong>New</strong>' };
    const v = verifyUpgrade(ir, generateComponentSource(ir));
    expect(v.ok).toBe(true);
    expect(v.checks.find((c) => c.id === 'fidelity')!.ok).toBe(true);
  });

  it('FAILS when the generated source drifts from the IR', () => {
    const ir: ComponentIR = { name: 'x-badge', shadow: 'none', template: '<strong>New</strong>' };
    const tampered = generateComponentSource({ ...ir, template: '<em>Different</em>' });
    const v = verifyUpgrade(ir, tampered); // verify against the ORIGINAL ir
    expect(v.ok).toBe(false);
    expect(v.diagnostics.join(' ')).toMatch(/drift/);
  });

  it('FAILS when an unparseable definition is offered', () => {
    const ir: ComponentIR = { name: 'x-badge', shadow: 'none', template: '<strong>New</strong>' };
    const v = verifyUpgrade(ir, '<component>missing a name</component>');
    expect(v.ok).toBe(false);
    expect(v.checks.find((c) => c.id === 'parses')!.ok).toBe(false);
  });

  it('FAILS when a referenced intent is not in the standard (conformance check)', () => {
    const ir: ComponentIR = { name: 'x-badge', shadow: 'none', template: '<i></i>', intents: ['not-a-real-intent'] };
    const v = verifyUpgrade(ir, generateComponentSource(ir), { knownIntents: new Set(['disclosure', 'selection']) });
    expect(v.ok).toBe(false);
    expect(v.checks.find((c) => c.id === 'intents')!.ok).toBe(false);
  });

  it('PASSES intents that resolve in the standard', () => {
    const ir: ComponentIR = { name: 'x-badge', shadow: 'none', template: '<i></i>', intents: ['disclosure'] };
    const v = verifyUpgrade(ir, generateComponentSource(ir), { knownIntents: new Set(['disclosure', 'selection']) });
    expect(v.checks.find((c) => c.id === 'intents')!.ok).toBe(true);
  });
});

describe('orchestrator — never throws, gates on verify', () => {
  it('returns a diagnostic (not an exception) when no analyzer matches the input', async () => {
    const registry = freshRegistry();
    const r = await upgrade({ code: 'function add(a,b){return a+b}' }, { registry });
    expect(r.offered).toBe(false);
    expect(r.ir).toBeNull();
    expect(r.diagnostics.length).toBeGreaterThan(0);
  });

  it('returns a diagnostic when the analyzer rejects out-of-subset input (dynamic template)', async () => {
    const registry = freshRegistry();
    const src = upgraderCases.find((c) => c.id === 'dynamic-template-rejected')!.source;
    const r = await upgrade({ code: src }, { registry });
    expect(r.offered).toBe(false);
    expect(r.diagnostics.join(' ')).toMatch(/interpolation|dynamic/);
  });

  it('flags an empty registry rather than faking output', async () => {
    const r = await upgrade({ code: "customElements.define('x-y', class extends HTMLElement {})" }, { registry: new CustomAnalyzerRegistry() });
    expect(r.offered).toBe(false);
    expect(r.analyzerId).toBeNull();
    expect(r.diagnostics.join(' ')).toMatch(/no analyzer registered/);
  });
});

describe('shared fixtures — demo + suite exercise the same engine', () => {
  for (const c of upgraderCases) {
    it(`${c.id}: offered === ${c.expectOffered}`, async () => {
      const registry = freshRegistry();
      const r = await upgrade({ code: c.source }, { registry });
      expect(r.offered).toBe(c.expectOffered);
      if (c.expectOffered) {
        expect(r.ir!.name).toBe(c.expectName);
        expect(r.ir!.shadow).toBe(c.expectShadow);
        expect(r.generated).not.toBeNull();
        if (c.expectIntents) expect(r.ir!.intents).toEqual(c.expectIntents);
      }
    });
  }
});
