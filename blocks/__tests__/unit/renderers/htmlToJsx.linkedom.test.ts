/**
 * Build-path unit test for htmlToJsx — runs the SAME transform over a linkedom document, the way
 * the 11ty `htmlToJsx` filter does (.eleventy.js), rather than happy-dom (which the other unit
 * suites use). This guards the actual build path: linkedom and happy-dom differ in how they parse
 * <template>.content and serialize attributes, and the source-toggle's JSX pane is generated this
 * way at build time. See reports/2026-06-06-jsx-adapter-demo-testing-plan.md §#C.
 */
import { describe, it, expect } from 'vitest';
import { parseHTML } from 'linkedom';
import { htmlToJsx } from '../../../renderers/jsx/htmlToJsx';
import { mappingCases, jsxEquivalent } from '../../../renderers/jsx/__fixtures__/mapping-cases';

const norm = (s: string) => s.replace(/>\s+</g, '><').replace(/\s+/g, ' ').trim();

// A fresh linkedom document per call, mirroring the 11ty filter exactly.
function linkedomDoc() {
  const { document } = parseHTML('<!DOCTYPE html><html><body></body></html>');
  return document as unknown as Parameters<typeof htmlToJsx>[1];
}

describe('htmlToJsx — linkedom build path', () => {
  for (const c of mappingCases) {
    it(`${c.title}${c.lossy ? ' — lossy: cannot reproduce authored JSX' : ''}`, () => {
      const got = htmlToJsx(c.html, linkedomDoc());
      expect(jsxEquivalent(got, c.jsx)).toBe(!c.lossy);
    });
  }

  it('comment directive → <template is="for-each"> (the generated source-toggle pane)', () => {
    const got = htmlToJsx(
      `<!-- control:for-each items="users" key="id" --><template><div class="user-row"><span data-bind="name"></span></div></template><!-- /control:for-each -->`,
      linkedomDoc()
    );
    expect(norm(got)).toBe(
      norm(`<template is="for-each" items="users" key="id"><div class="user-row"><span data-bind="name" /></div></template>`)
    );
  });
});
