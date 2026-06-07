/**
 * Unit tests for htmlToJsx — the build-time HTML → JSX mirror-dialect transform.
 *
 * The mapping example pairs come from the SHARED fixture module (the same source the playground
 * demo and the conformance suite use), so this suite can never drift from the demo's badges.
 * The trailing block covers htmlToJsx-specific lowering (comment directives, comment dropping)
 * that has no playground fixture.
 */
import { describe, it, expect } from 'vitest';
import { htmlToJsx } from '../../../renderers/jsx/htmlToJsx';
import { mappingCases, jsxEquivalent } from '../../../renderers/jsx/__fixtures__/mapping-cases';

// Compare ignoring insignificant whitespace (for the exact-string edge cases below).
const norm = (s: string) => s.replace(/>\s+</g, '><').replace(/\s+/g, ' ').trim();

describe('htmlToJsx — shared mapping fixtures', () => {
  for (const c of mappingCases) {
    it(`${c.title}${c.lossy ? ' — lossy: cannot reproduce authored JSX' : ''}`, () => {
      // htmlToJsx(canonical HTML) reproduces the authored JSX — except for lossy cases (a function
      // handler has no HTML form), which by definition cannot round-trip.
      expect(jsxEquivalent(htmlToJsx(c.html), c.jsx)).toBe(!c.lossy);
    });
  }
});

describe('htmlToJsx — comment-directive lowering (no playground fixture)', () => {
  it('comment directive → customized built-in (inner <template> collapses)', () => {
    expect(
      norm(
        htmlToJsx(
          `<!-- control:for-each items="users" key="id" --><template><div class="user-row"><span data-bind="name"></span></div></template><!-- /control:for-each -->`
        )
      )
    ).toBe(
      norm(`<template is="for-each" items="users" key="id"><div class="user-row"><span data-bind="name" /></div></template>`)
    );
  });

  it('drops non-directive comments', () => {
    expect(norm(htmlToJsx(`<div><!-- a note -->text</div>`))).toBe(norm(`<div>text</div>`));
  });
});

describe('htmlToJsx — attribute value escaping (backlog 073)', () => {
  it('escapes double-quotes inside an attribute value so the JSX attr cannot close early', () => {
    // A JSON-valued attribute: the inner " must become &quot;, not break out of name="…".
    expect(htmlToJsx(`<broadcast-channel broadcast-detail='{"theme":"dark"}'></broadcast-channel>`))
      .toBe(`<broadcast-channel broadcast-detail="{&quot;theme&quot;:&quot;dark&quot;}" />`);
  });

  it('escapes ampersands the same way HTML serialization does', () => {
    expect(htmlToJsx(`<a href="/x?a=1&b=2">go</a>`)).toBe(`<a href="/x?a=1&amp;b=2">go</a>`);
  });
});
