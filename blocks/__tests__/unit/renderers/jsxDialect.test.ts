/**
 * Conformance suite for the JSX authoring dialect (#235) — the first soft dev-preference.
 *
 * The dialect governs CODEGEN only (which attribute spelling `htmlToJsx` emits); BOTH spellings are
 * accepted on INPUT (`jsxToHtml` normalizes either back to canonical HTML). The native-first default
 * is `html`. Tied to the SAME shared `mappingCases` the playground renders, so the demo's dialect
 * toggle can't drift from CI. Spec: /adapters/jsx-adapter/
 */
import { describe, it, expect } from 'vitest';
import { htmlToJsx } from '../../../renderers/jsx/htmlToJsx';
import { jsxToHtml } from '../../../renderers/jsx/jsxToHtml';
import {
  DEFAULT_DIALECT,
  toReactPropName,
  toHtmlAttrName,
  applyDialect,
} from '../../../renderers/jsx/dialect';
import { mappingCases } from '../../../renderers/jsx/__fixtures__/mapping-cases';

describe('dialect mapping — the three families #235 names', () => {
  it('native-first default is html', () => {
    expect(DEFAULT_DIALECT).toBe('html');
  });

  it('HTML attr → React prop', () => {
    expect(toReactPropName('class')).toBe('className');
    expect(toReactPropName('for')).toBe('htmlFor');
    expect(toReactPropName('onclick')).toBe('onClick');
    expect(toReactPropName('oninput')).toBe('onInput');
    expect(toReactPropName('id')).toBe('id'); // identity for everything else
    expect(toReactPropName('data-x')).toBe('data-x');
  });

  it('React prop → HTML attr (the reverse, for ingest)', () => {
    expect(toHtmlAttrName('className')).toBe('class');
    expect(toHtmlAttrName('htmlFor')).toBe('for');
    expect(toHtmlAttrName('onClick')).toBe('onclick');
    expect(toHtmlAttrName('id')).toBe('id');
  });

  it('applyDialect: html is identity, react renames', () => {
    expect(applyDialect('class', 'html')).toBe('class');
    expect(applyDialect('class', 'react')).toBe('className');
  });
});

describe('multi-word event names map to real React handler names (#245)', () => {
  // A *production* react dialect must emit React's camelCase, not just a first-letter cap.
  const cases: Array<[string, string]> = [
    ['onmouseover', 'onMouseOver'],
    ['onmousedown', 'onMouseDown'],
    ['onmouseenter', 'onMouseEnter'],
    ['onmouseleave', 'onMouseLeave'],
    ['onkeydown', 'onKeyDown'],
    ['onkeyup', 'onKeyUp'],
    ['onkeypress', 'onKeyPress'],
    ['ondblclick', 'onDoubleClick'], // the one true rename — React spells it out
    ['oncontextmenu', 'onContextMenu'],
    ['onpointerdown', 'onPointerDown'],
    ['ontouchstart', 'onTouchStart'],
    ['ondragstart', 'onDragStart'],
    ['onfocusin', 'onFocusIn'],
    ['onanimationend', 'onAnimationEnd'],
    ['ontransitionend', 'onTransitionEnd'],
    ['oncompositionupdate', 'onCompositionUpdate'],
  ];

  it.each(cases)('HTML %s → React %s', (html, react) => {
    expect(toReactPropName(html)).toBe(react);
  });

  it('single-word events still use the first-letter cap', () => {
    expect(toReactPropName('onclick')).toBe('onClick');
    expect(toReactPropName('oninput')).toBe('onInput');
    expect(toReactPropName('onfocus')).toBe('onFocus');
    expect(toReactPropName('oncopy')).toBe('onCopy');
  });

  it('round-trips exactly: React name → HTML event recovers the DOM name', () => {
    for (const [html, react] of cases) {
      expect(toHtmlAttrName(react)).toBe(html);
      expect(toHtmlAttrName(toReactPropName(html))).toBe(html);
    }
  });
});

describe('htmlToJsx — dialect governs the emitted spelling', () => {
  it('default (html) emits class/for/onclick verbatim', () => {
    const src = htmlToJsx('<label class="f" for="x" onclick="g()">hi</label>');
    expect(src).toContain('class="f"');
    expect(src).toContain('for="x"');
    expect(src).toContain('onclick="g()"');
    expect(src).not.toContain('className');
  });

  it('react dialect emits className/htmlFor/onClick', () => {
    const src = htmlToJsx('<label class="f" for="x" onclick="g()">hi</label>', undefined, {
      dialect: 'react',
    });
    expect(src).toContain('className="f"');
    expect(src).toContain('htmlFor="x"');
    expect(src).toContain('onClick="g()"');
    expect(src).not.toMatch(/\bclass=/);
  });

  it('react dialect leaves data-/aria-/other attrs untouched', () => {
    const src = htmlToJsx('<div class="c" data-class="keep" aria-label="a"></div>', undefined, {
      dialect: 'react',
    });
    expect(src).toContain('className="c"');
    expect(src).toContain('data-class="keep"'); // NOT data-className
    expect(src).toContain('aria-label="a"');
  });
});

describe('both dialects are accepted on input (tolerant ingest)', () => {
  it('jsxToHtml normalizes the react dialect back to canonical HTML', () => {
    expect(jsxToHtml('<label className="f" htmlFor="x">hi</label>')).toBe(
      '<label class="f" for="x">hi</label>'
    );
  });

  it('round-trip via either dialect yields the SAME canonical HTML (shared fixtures)', () => {
    for (const c of mappingCases.filter((m) => !m.lossy)) {
      const viaHtml = jsxToHtml(htmlToJsx(c.html));
      const viaReact = jsxToHtml(htmlToJsx(c.html, undefined, { dialect: 'react' }));
      // Both dialects ingest back to the same canonical HTML — the preference is cosmetic.
      expect(viaReact).toBe(viaHtml);
    }
  });
});
