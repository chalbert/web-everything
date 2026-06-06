/**
 * Permanent conformance suite for the JSX Adapter mapping (the demo's badges, in CI).
 *
 * Iterates the SHARED mapping fixtures and, per case, asserts the three invariants the JSX
 * Adapter Playground proves live in the browser — but here in vitest/happy-dom so a mapping or
 * renderer regression turns this red:
 *
 *   1. render        — `render()` (JSX → DOM through the realigned renderer) serializes to `html`.
 *   2. htmlToJsx     — `htmlToJsx(html)` round-trips to the authored `jsx` (lenient), UNLESS lossy.
 *   3. jsxToHtml     — `jsxToHtml(jsx)` == `html` (the lossy fn-prop is dropped, leaving canonical).
 *
 * NOTE: happy-dom lacks `isEqualNode` for our shapes, so equality is by NORMALIZED SERIALIZED
 * STRING — not `isEqualNode` (which the browser-only demo uses). See the coverage plan §7.
 */
import { describe, it, expect } from 'vitest';
import { mappingCases, jsxEquivalent } from '../../../renderers/jsx/__fixtures__/mapping-cases';
import { htmlToJsx } from '../../../renderers/jsx/htmlToJsx';
import { jsxToHtml } from '../../../renderers/jsx/jsxToHtml';

// Collapse insignificant whitespace AND canonicalize boolean attrs (happy-dom serializes
// `required` as `required=""`) so formatting/serialization differences don't fail equality.
const norm = (s: string) =>
  s.replace(/=""/g, '').replace(/>\s+</g, '><').replace(/\s+/g, ' ').trim();

/**
 * Serialize a rendered node to HTML (handles elements, <template> content, and fragments).
 * Uses nodeType/nodeName rather than `instanceof` to avoid happy-dom realm mismatches
 * (a DocumentFragment built via `document.createDocumentFragment()` failed `instanceof`).
 */
function serialize(node: Node): string {
  const ELEMENT = 1, FRAGMENT = 11;
  if (node.nodeType === ELEMENT) {
    const el = node as HTMLElement;
    if (el.nodeName.toUpperCase() === 'TEMPLATE') {
      const attrs = Array.from(el.attributes).map((a) => ` ${a.name}="${a.value}"`).join('');
      const inner = Array.from((el as HTMLTemplateElement).content.childNodes).map(serialize).join('');
      return `<template${attrs}>${inner}</template>`;
    }
    return el.outerHTML;
  }
  if (node.nodeType === FRAGMENT) return Array.from(node.childNodes).map(serialize).join('');
  return node.textContent || '';
}

describe('JSX Adapter mapping conformance (shared fixtures)', () => {
  it('covers every shared fixture', () => {
    // Guards against an accidentally emptied fixture module silently passing the suite.
    expect(mappingCases.length).toBeGreaterThanOrEqual(8);
  });

  for (const c of mappingCases) {
    describe(c.title, () => {
      it('render: JSX → DOM serializes to canonical HTML', () => {
        expect(norm(serialize(c.render()))).toBe(norm(c.html));
      });

      it(`htmlToJsx: canonical HTML round-trips to authored JSX${c.lossy ? ' (lossy — skipped)' : ''}`, () => {
        if (c.lossy) {
          // A function handler has no HTML form, so htmlToJsx cannot reproduce it — documented loss.
          expect(jsxEquivalent(htmlToJsx(c.html), c.jsx)).toBe(false);
          return;
        }
        expect(jsxEquivalent(htmlToJsx(c.html), c.jsx)).toBe(true);
      });

      it('jsxToHtml: authored JSX lowers to canonical HTML (lossy props dropped)', () => {
        expect(norm(jsxToHtml(c.jsx))).toBe(norm(c.html));
      });
    });
  }
});
