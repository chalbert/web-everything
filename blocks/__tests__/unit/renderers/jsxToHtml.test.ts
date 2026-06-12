/**
 * Unit tests for jsxToHtml — the reverse (JSX mirror-dialect → canonical HTML) transform.
 *
 * Driven by the SHARED fixture module so the reverse direction is checked against the exact same
 * mapping the forward transform, the conformance suite, and the playground demo use. jsxToHtml is
 * exact (lossy props are dropped, leaving the canonical HTML), so this asserts a strict match.
 */
import { describe, it, expect } from 'vitest';
import { jsxToHtml, jsxToHtmlWithDiagnostics } from '../../../renderers/jsx/jsxToHtml';
import { mappingCases } from '../../../renderers/jsx/__fixtures__/mapping-cases';

const norm = (s: string) => s.replace(/=""/g, '').replace(/>\s+</g, '><').replace(/\s+/g, ' ').trim();

describe('jsxToHtml — shared mapping fixtures', () => {
  for (const c of mappingCases) {
    it(`${c.title}${c.lossy ? ' (function prop dropped)' : ''}`, () => {
      // Authored JSX lowers to canonical HTML; for the lossy case the function handler is dropped,
      // leaving exactly the canonical HTML.
      expect(norm(jsxToHtml(c.jsx))).toBe(norm(c.html));
    });
  }
});

describe('jsxToHtml — event-handler closure handling (#325)', () => {
  it('round-trips a named handler to the canonical string behavior', () => {
    // The function name IS the string path the injector resolves, so it lowers losslessly.
    const r = jsxToHtmlWithDiagnostics('<button onclick={inc}>+</button>');
    expect(norm(r.code)).toBe(norm('<button on:click="inc($event)">+</button>'));
    expect(r.lossy).toBe(false);
    expect(r.diagnostics).toEqual([]);
  });

  it('round-trips a member-path handler (obj.method)', () => {
    const r = jsxToHtmlWithDiagnostics('<button onclick={store.save}>Save</button>');
    expect(norm(r.code)).toBe(norm('<button on:click="store.save($event)">Save</button>'));
    expect(r.lossy).toBe(false);
  });

  it('lowercases a react-dialect named handler before lowering', () => {
    const r = jsxToHtmlWithDiagnostics('<div onMouseOver={hover}>x</div>');
    expect(norm(r.code)).toBe(norm('<div on:mouseover="hover($event)">x</div>'));
    expect(r.lossy).toBe(false);
  });

  it('flags an inline closure lossy and drops it — never silent', () => {
    const r = jsxToHtmlWithDiagnostics('<button onclick={() => count++}>+</button>');
    expect(norm(r.code)).toBe(norm('<button>+</button>'));
    expect(r.lossy).toBe(true);
    expect(r.diagnostics).toHaveLength(1);
    expect(r.diagnostics[0].rule).toBe('inline-closure-handler');
    expect(r.diagnostics[0].fragment).toContain('onclick={');
  });

  it('leaves a string behavior attribute (on:select="…") verbatim — already canonical', () => {
    const r = jsxToHtmlWithDiagnostics('<button on:select="choose($event)">x</button>');
    expect(norm(r.code)).toBe(norm('<button on:select="choose($event)">x</button>'));
    expect(r.lossy).toBe(false);
  });

  it('jsxToHtml returns just the code (established string API)', () => {
    expect(norm(jsxToHtml('<button onclick={inc}>+</button>'))).toBe(
      norm('<button on:click="inc($event)">+</button>')
    );
  });
});
