/**
 * Unit tests for the upgrader framework input adapters (backlog #190) — React / Lit / Vue.
 *
 * Proves the #094 extensibility claim: a new source dialect is a new analyzer REGISTRATION, not a
 * pipeline change. Each dialect lifts its bounded subset to the same `ComponentIR` and rides the same
 * verify gate; out-of-subset inputs (dynamic markup, an underivable tag) are REFUSED, not faked.
 */
import { describe, it, expect } from 'vitest';
import {
  CustomAnalyzerRegistry,
  upgrade,
} from '../../../renderers/upgrader/upgraderEngine';
import { registerFrameworkAnalyzers } from '../../../renderers/upgrader/analyzers/frameworkAnalyzers';
import { registerReferenceAnalyzers } from '../../../renderers/upgrader/analyzers/legacyWebComponent';
import { frameworkCases } from '../../../renderers/upgrader/__fixtures__/framework-cases';

const freshRegistry = (): CustomAnalyzerRegistry => {
  const r = new CustomAnalyzerRegistry();
  registerReferenceAnalyzers(r); // the vanilla path stays registered alongside
  registerFrameworkAnalyzers(r);
  return r;
};

const ANALYZER_ID: Record<string, string> = {
  react: 'reference:react-function-component',
  lit: 'reference:lit-element',
  vue: 'reference:vue-sfc',
};

describe('framework input adapters — fixture-driven (#190)', () => {
  for (const c of frameworkCases) {
    it(`${c.title} → ${c.expectOffered ? 'offered' : 'refused'}`, async () => {
      const registry = freshRegistry();
      const r = await upgrade({ code: c.source, language: c.language }, { registry });
      expect(r.offered).toBe(c.expectOffered);
      if (c.expectOffered) {
        expect(r.analyzerId).toBe(ANALYZER_ID[c.language]);
        expect(r.ir).not.toBeNull();
        if (c.expectName) expect(r.ir!.name).toBe(c.expectName);
        if (c.expectShadow) expect(r.ir!.shadow).toBe(c.expectShadow);
        // The generated source round-trips (the verify gate's fidelity check passed).
        expect(r.generated).toContain(`name="${c.ir?.name ?? c.expectName}"`);
      } else {
        // A refused case still returns a structured diagnostic, never throws.
        expect(r.diagnostics.length).toBeGreaterThan(0);
      }
    });
  }
});

describe('framework input adapters — routing (#190)', () => {
  it('auto-detects each dialect with no language hint (heuristic handles())', async () => {
    const registry = freshRegistry();
    const react = frameworkCases.find((c) => c.id === 'react-static')!;
    const lit = frameworkCases.find((c) => c.id === 'lit-static')!;
    const vue = frameworkCases.find((c) => c.id === 'vue-static')!;

    expect((await upgrade({ code: react.source }, { registry })).analyzerId).toBe(ANALYZER_ID.react);
    expect((await upgrade({ code: lit.source }, { registry })).analyzerId).toBe(ANALYZER_ID.lit);
    expect((await upgrade({ code: vue.source }, { registry })).analyzerId).toBe(ANALYZER_ID.vue);
  });

  it('does not steal a legacy vanilla web component from the reference analyzer', async () => {
    const registry = freshRegistry();
    const vanilla =
      "class XBadge extends HTMLElement {\n"
      + "  connectedCallback() { this.innerHTML = '<strong>New</strong>'; }\n"
      + "}\n"
      + "customElements.define('x-badge', XBadge);";
    const r = await upgrade({ code: vanilla }, { registry });
    expect(r.analyzerId).toBe('reference:legacy-web-component');
  });
});
