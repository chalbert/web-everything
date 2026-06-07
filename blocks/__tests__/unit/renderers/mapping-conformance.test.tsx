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

const VOID_ELEMENTS = new Set([
  'area', 'base', 'br', 'col', 'embed', 'hr', 'img', 'input',
  'link', 'meta', 'param', 'source', 'track', 'wbr',
]);

// Escape an attribute value the way the HTML spec / real browsers serialize it. happy-dom's
// own `outerHTML` does NOT escape `"` inside an attribute value (emitting `a="{"k":"v"}"`), so
// we serialize structure ourselves rather than trusting it — the same class of happy-dom ≠
// browser gap this harness already exists to bridge. See backlog 073-htmltojsx-attr-quote-escaping.
const escapeAttr = (s: string) => s.replace(/&/g, '&amp;').replace(/"/g, '&quot;');

/**
 * Serialize a rendered node to canonical HTML (handles elements, void elements, <template>
 * content, and fragments). Uses nodeType/nodeName rather than `instanceof` to avoid happy-dom
 * realm mismatches (a DocumentFragment built via `document.createDocumentFragment()` failed
 * `instanceof`), and spec-correct attribute escaping rather than happy-dom's `outerHTML`.
 */
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
