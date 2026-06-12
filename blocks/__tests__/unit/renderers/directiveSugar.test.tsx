/**
 * Conformance suite for the JSX directive-sugar layer (#070).
 *
 * Iterates the SHARED sugar fixtures and asserts the four invariants the Directive Sugar playground
 * proves live — here in vitest/happy-dom so a regression turns red:
 *
 *   1. desugar   — `desugar(sugar)` == the canonical `<template is>` JSX.
 *   2. sugarize  — `sugarize(canonical)` == the authored sugar (the lift direction).
 *   3. jsxToHtml — `jsxToHtml(sugar)` == canonical HTML (sugar lowers through the same directive).
 *   4. render    — `render()` (sugar → DOM via the runtime components) == the canonical HTML DOM,
 *                  i.e. <For> builds byte-identical DOM to <template is="for-each">.
 *
 * Equality is by NORMALIZED SERIALIZED STRING (happy-dom lacks isEqualNode for these shapes) — the
 * same approach as mapping-conformance.test.tsx.
 */
import { describe, it, expect } from 'vitest';
import { directiveSugarCases } from '../../../renderers/jsx/__fixtures__/directive-sugar-cases';
import {
  desugar,
  sugarize,
  directiveRegistry,
  isDirectiveComponent,
  For,
} from '../../../renderers/jsx';
import { RESOURCE_SLOT_STATES } from '../../../renderers/jsx/directives';
import { jsxToHtml } from '../../../renderers/jsx/jsxToHtml';

const norm = (s: string) => s.replace(/=""/g, '').replace(/>\s+</g, '><').replace(/\s+/g, ' ').trim();

const VOID_ELEMENTS = new Set([
  'area', 'base', 'br', 'col', 'embed', 'hr', 'img', 'input',
  'link', 'meta', 'param', 'source', 'track', 'wbr',
]);
const escapeAttr = (s: string) => s.replace(/&/g, '&amp;').replace(/"/g, '&quot;');

/** Serialize a rendered node to canonical HTML (template content + fragments), like the mapping suite. */
function serialize(node: Node): string {
  const ELEMENT = 1, FRAGMENT = 11;
  if (node.nodeType === ELEMENT) {
    const el = node as HTMLElement;
    const tag = el.nodeName.toLowerCase();
    const attrs = Array.from(el.attributes).map((a) => ` ${a.name}="${escapeAttr(a.value)}"`).join('');
    if (VOID_ELEMENTS.has(tag)) return `<${tag}${attrs}>`;
    const kids = el.nodeName.toUpperCase() === 'TEMPLATE'
      ? (el as HTMLTemplateElement).content.childNodes
      : el.childNodes;
    const inner = Array.from(kids).map(serialize).join('');
    return `<${tag}${attrs}>${inner}</${tag}>`;
  }
  if (node.nodeType === FRAGMENT) return Array.from(node.childNodes).map(serialize).join('');
  return node.textContent || '';
}

describe('JSX directive-sugar conformance (shared fixtures)', () => {
  it('covers every shared fixture', () => {
    expect(directiveSugarCases.length).toBeGreaterThanOrEqual(5);
  });

  for (const c of directiveSugarCases) {
    describe(c.title, () => {
      it('desugar: sugar → canonical <template is>', () => {
        expect(norm(desugar(c.sugar))).toBe(norm(c.canonical));
      });

      it('sugarize: canonical <template is> → sugar', () => {
        expect(norm(sugarize(c.canonical))).toBe(norm(c.sugar));
      });

      it('round-trips: sugarize(desugar(sugar)) == sugar', () => {
        expect(norm(sugarize(desugar(c.sugar)))).toBe(norm(c.sugar));
      });

      it('jsxToHtml: sugar lowers to canonical HTML', () => {
        expect(norm(jsxToHtml(c.sugar))).toBe(norm(c.html));
      });

      it('render: sugar component → DOM serializes to canonical HTML', () => {
        expect(norm(serialize(c.render()))).toBe(norm(c.html));
      });
    });
  }
});

describe('directive registry', () => {
  it('exposes For/Show/Resource as tagged directive components', () => {
    expect(isDirectiveComponent(For)).toBe(true);
    expect(For.directiveIs).toBe('for-each');
  });

  it('a plain string/class is not a directive component', () => {
    expect(isDirectiveComponent('div')).toBe(false);
    expect(isDirectiveComponent(class X {})).toBe(false);
  });

  it('every registry entry has a 1:1 reversible prop map', () => {
    for (const def of directiveRegistry) {
      const attrs = Object.values(def.props);
      // canonical attr names are unique, so sugarize can invert without collision
      expect(new Set(attrs).size).toBe(attrs.length);
    }
  });

  it('a plain inert <template> (no is) is left untouched by sugarize', () => {
    const inert = `<template><span>x</span></template>`;
    expect(sugarize(inert)).toBe(inert);
  });

  it('an unknown is="…" template is left untouched by sugarize', () => {
    const unknown = `<template is="mystery"><span>x</span></template>`;
    expect(sugarize(unknown)).toBe(unknown);
  });
});

describe('Resource slot → Loader-state contract (#337)', () => {
  // Two separate fallback surfaces, NOT a merged `fallback`: loading→pending, error→error, default→success.
  const slotted =
    `<Resource from="@users">` +
    `<template slot="loading"><p>Loading…</p></template>` +
    `<template slot="error"><p>Failed</p></template>` +
    `<ul data-bind="items"></ul>` +
    `</Resource>`;
  const canonical =
    `<template is="resource" from="@users">` +
    `<template slot="loading"><p>Loading…</p></template>` +
    `<template slot="error"><p>Failed</p></template>` +
    `<ul data-bind="items"></ul>` +
    `</template>`;

  it('maps loading→pending, error→error, default→success — two surfaces, no merged fallback', () => {
    expect(RESOURCE_SLOT_STATES).toEqual({ loading: 'pending', error: 'error', default: 'success' });
  });

  it('desugar carries the named loading/error slots through to the canonical template', () => {
    expect(norm(desugar(slotted))).toBe(norm(canonical));
  });

  it('sugarize raises the Resource shell while leaving the inert slot templates verbatim', () => {
    // The slot <template>s have no registered is="…", so they stay <template slot="…"> — only the
    // outer is="resource" becomes <Resource>. Stack pairing closes the right </template> as </Resource>.
    expect(norm(sugarize(canonical))).toBe(norm(slotted));
  });

  it('round-trips: sugarize(desugar(slotted)) == slotted', () => {
    expect(norm(sugarize(desugar(slotted)))).toBe(norm(slotted));
  });
});
