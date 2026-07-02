/**
 * Tests for the Web Directives SSR wire-format golden-vector suite (#2063, ratified #2030).
 *
 * WE ships NO SSR renderer (#6) — the FUI Node reference renderer (#2064) is the oracle, and the vectors
 * are the language-agnostic contract every renderer conforms to. So — unlike the webdocs suite, whose
 * expected outputs are re-derived by a test-local reference of a pure mapping — these goldens are the
 * hand-authored expected *bytes* a renderer is graded against. This suite therefore gates (1) the suite
 * passes the structural + grammar validator, (2) it covers every axis #2063 codifies, and (3) the
 * validator rejects malformed / grammar-violating corpora (so a renderer's oracle can trust the corpus).
 *
 * The byte-exact space-padding of the markers is the load-bearing invariant: every `expectedHtml` open and
 * close marker has exactly one ASCII space inside each delimiter, asserted directly below.
 */
import { describe, it, expect } from 'vitest';
import {
  assertSsrWireSuite,
  SsrWireSchemaError,
  webdirectivesSsrSuite,
} from '../index.js';

describe('Web Directives SSR wire-format golden vectors (#2063)', () => {
  it('the suite is well-formed', () => {
    expect(() => assertSsrWireSuite(webdirectivesSsrSuite)).not.toThrow();
    expect(webdirectivesSsrSuite.standard).toBe('webdirectives');
    expect(webdirectivesSsrSuite.contract).toBe('@webeverything/contracts/webdirectives');
    expect(webdirectivesSsrSuite.vectors.length).toBeGreaterThanOrEqual(5);
  });

  it('covers the codified directive axes (for-each keyed, if both branches, switch, resource, defer)', () => {
    const ids = webdirectivesSsrSuite.vectors.map((v) => v.id);
    for (const frag of [
      'webdirectives-ssr/for-each/',
      'webdirectives-ssr/if/',
      'webdirectives-ssr/switch/',
      'webdirectives-ssr/resource-loader/',
      'webdirectives-ssr/defer/',
    ]) {
      expect(ids.some((id) => id.startsWith(frag)), frag).toBe(true);
    }
  });

  it('every marker in every golden has exactly one ASCII space inside each delimiter (normative padding)', () => {
    for (const v of webdirectivesSsrSuite.vectors) {
      for (const m of v.expectedHtml.matchAll(/<!--([\s\S]*?)-->/g)) {
        const body = m[1];
        expect(body.startsWith(' '), `${v.id}: leading space in "${m[0]}"`).toBe(true);
        expect(body.endsWith(' '), `${v.id}: trailing space in "${m[0]}"`).toBe(true);
        // Single-line markers: no double-space padding, no tabs/newlines inside the delimiter.
        expect(/^ [^\n\t]* $/.test(body), `${v.id}: single-line, single-space padding in "${m[0]}"`).toBe(true);
      }
    }
  });

  it('every keyed for-each item carries a data-key attribute (the only key channel)', () => {
    const feKeyed = webdirectivesSsrSuite.vectors.find(
      (v) => v.id === 'webdirectives-ssr/for-each/keyed-items-expanded',
    );
    expect(feKeyed).toBeDefined();
    // Two item rows, each with a data-key; keys are never in the comment text.
    expect((feKeyed!.expectedHtml.match(/data-key="/g) ?? []).length).toBe(2);
    expect(feKeyed!.expectedHtml).not.toMatch(/<!--[^>]*data-key/);
  });

  it('a false `if` and an empty `for-each` emit paired markers with no body content (zero-JS baseline)', () => {
    const falseIf = webdirectivesSsrSuite.vectors.find((v) => v.id === 'webdirectives-ssr/if/false-branch-empty-markers');
    expect(falseIf!.expectedHtml).toBe('<!-- control:if condition="isAdmin" -->\n<!-- /control:if -->');
  });

  it('the validator rejects a marker with wrong space-padding (byte-exactness is enforced)', () => {
    const bad = {
      standard: 'webdirectives' as const,
      contract: '@webeverything/contracts/webdirectives',
      vectors: [
        {
          id: 'webdirectives-ssr/bad/padding',
          description: 'no space padding',
          input: '<template is="if" condition="x"><b>y</b></template>',
          data: {},
          // Missing the normative inner spaces.
          expectedHtml: '<!--control:if condition="x"-->\n<b>y</b>\n<!--/control:if-->',
        },
      ],
    };
    expect(() => assertSsrWireSuite(bad)).toThrow(SsrWireSchemaError);
  });

  it('the validator rejects a `--` breakout sequence inside a comment marker (injection guard)', () => {
    const bad = {
      standard: 'webdirectives' as const,
      contract: '@webeverything/contracts/webdirectives',
      vectors: [
        {
          id: 'webdirectives-ssr/bad/breakout',
          description: 'raw data with -- in comment',
          input: '<template is="if" condition="x"><b>y</b></template>',
          data: {},
          expectedHtml: '<!-- control:if note="a--b" -->\n<b>y</b>\n<!-- /control:if -->',
        },
      ],
    };
    expect(() => assertSsrWireSuite(bad)).toThrow(SsrWireSchemaError);
  });

  it('the validator rejects `input` that is already-expanded output rather than authoring source', () => {
    const bad = {
      standard: 'webdirectives' as const,
      contract: '@webeverything/contracts/webdirectives',
      vectors: [
        {
          id: 'webdirectives-ssr/bad/output-as-input',
          description: 'input is expanded output',
          input: '<!-- control:if condition="x" -->\n<b>y</b>\n<!-- /control:if -->',
          data: {},
          expectedHtml: '<!-- control:if condition="x" -->\n<b>y</b>\n<!-- /control:if -->',
        },
      ],
    };
    expect(() => assertSsrWireSuite(bad)).toThrow(SsrWireSchemaError);
  });
});
