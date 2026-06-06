/**
 * Unit tests for jsxToHtml — the reverse (JSX mirror-dialect → canonical HTML) transform.
 *
 * Driven by the SHARED fixture module so the reverse direction is checked against the exact same
 * mapping the forward transform, the conformance suite, and the playground demo use. jsxToHtml is
 * exact (lossy props are dropped, leaving the canonical HTML), so this asserts a strict match.
 */
import { describe, it, expect } from 'vitest';
import { jsxToHtml } from '../../../renderers/jsx/jsxToHtml';
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
