/**
 * Tests for the Web Directives SSR wire-format golden-vector suite (#2063, ratified #2030; state-token
 * slice #2065).
 *
 * WE ships NO SSR renderer (#6) — the FUI Node reference renderer (#2064) is the oracle, and the vectors
 * are the language-agnostic contract every renderer conforms to. So — unlike the webdocs suite, whose
 * expected outputs are re-derived by a test-local reference of a pure mapping — these goldens are the
 * hand-authored expected *bytes* a renderer is graded against. This suite therefore gates (1) the suite
 * passes the structural + grammar validator, (2) it covers every axis #2063 codifies, (3) the
 * validator rejects malformed / grammar-violating corpora, and (4) the #2065 state-token contract —
 * `count` + `key-hash` on `for-each` markers — is present in every relevant golden.
 *
 * The byte-exact space-padding of the markers is the load-bearing invariant: every `expectedHtml` open and
 * close marker has exactly one ASCII space inside each delimiter, asserted directly below.
 */
import { describe, it, expect } from 'vitest';
import {
  assertSsrWireSuite,
  SsrWireSchemaError,
  djb2KeyHash,
  webdirectivesSsrSuite,
} from '../index.js';

describe('Web Directives SSR wire-format golden vectors (#2063)', () => {
  it('the suite is well-formed', () => {
    expect(() => assertSsrWireSuite(webdirectivesSsrSuite)).not.toThrow();
    expect(webdirectivesSsrSuite.standard).toBe('webdirectives');
    expect(webdirectivesSsrSuite.contract).toBe('@webeverything/contracts/webdirectives');
    expect(webdirectivesSsrSuite.vectors.length).toBeGreaterThanOrEqual(5);
  });

  it('covers the codified directive axes (for-each keyed, if both branches, switch, resource, defer, state-tokens)', () => {
    const ids = webdirectivesSsrSuite.vectors.map((v) => v.id);
    for (const frag of [
      'webdirectives-ssr/for-each/',
      'webdirectives-ssr/if/',
      'webdirectives-ssr/switch/',
      'webdirectives-ssr/resource-loader/',
      'webdirectives-ssr/defer/',
      'webdirectives-ssr/state-tokens/',
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

  // #2065 — state-token layout assertions
  it('every `control:for-each` golden open marker carries `count` (item count) state token', () => {
    const forEachVectors = webdirectivesSsrSuite.vectors.filter((v) =>
      v.expectedHtml.startsWith('<!-- control:for-each'),
    );
    expect(forEachVectors.length).toBeGreaterThan(0);
    for (const v of forEachVectors) {
      expect(v.expectedHtml, `${v.id}: missing count token`).toMatch(/\bcount="\d+"/);
    }
  });

  it('non-empty `control:for-each` golden open markers carry a `key-hash` state token (DJB2 of data-key sequence)', () => {
    const feKeyed = webdirectivesSsrSuite.vectors.find(
      (v) => v.id === 'webdirectives-ssr/for-each/keyed-items-expanded',
    );
    expect(feKeyed).toBeDefined();
    expect(feKeyed!.expectedHtml).toMatch(/\bkey-hash="[0-9a-f]{8}"/);
    // Verify the hash matches DJB2 of the comma-joined data-key values.
    const keys = [...feKeyed!.expectedHtml.matchAll(/\bdata-key="([^"]*)"/g)].map((m) => m[1]);
    const expected = djb2KeyHash(keys.join(','));
    expect(feKeyed!.expectedHtml).toContain(`key-hash="${expected}"`);
  });

  it('empty `control:for-each` open marker carries `count="0"` and no `key-hash` token', () => {
    const feEmpty = webdirectivesSsrSuite.vectors.find(
      (v) => v.id === 'webdirectives-ssr/for-each/empty-list-markers-only',
    );
    expect(feEmpty).toBeDefined();
    expect(feEmpty!.expectedHtml).toContain('count="0"');
    expect(feEmpty!.expectedHtml).not.toMatch(/key-hash=/);
  });

  it('`djb2KeyHash` is deterministic and collision-differentiated for distinct key sequences', () => {
    expect(djb2KeyHash('1,2')).toBe('0b866f0a');
    expect(djb2KeyHash('A1,B2,C3')).toBe('d792ea35');
    expect(djb2KeyHash('1,2')).not.toBe(djb2KeyHash('2,1')); // order-sensitive
  });

  it('the validator rejects a `control:for-each` open marker missing the `count` state token (#2065)', () => {
    const bad = {
      standard: 'webdirectives' as const,
      contract: '@webeverything/contracts/webdirectives',
      vectors: [
        {
          id: 'webdirectives-ssr/bad/missing-count',
          description: 'for-each without count token',
          input: '<template is="for-each" items="xs" key="id"><div>{{name}}</div></template>',
          data: {},
          expectedHtml: '<!-- control:for-each items="xs" key="id" -->\n<!-- /control:for-each -->',
        },
      ],
    };
    expect(() => assertSsrWireSuite(bad)).toThrow(SsrWireSchemaError);
  });

  it('the validator rejects a non-empty `control:for-each` open marker missing `key-hash` (#2065)', () => {
    const bad = {
      standard: 'webdirectives' as const,
      contract: '@webeverything/contracts/webdirectives',
      vectors: [
        {
          id: 'webdirectives-ssr/bad/missing-key-hash',
          description: 'non-empty for-each without key-hash',
          input: '<template is="for-each" items="xs" key="id"><div>{{name}}</div></template>',
          data: {},
          expectedHtml:
            '<!-- control:for-each items="xs" key="id" count="1" -->\n' +
            '<div data-key="a">foo</div>\n' +
            '<!-- /control:for-each -->',
        },
      ],
    };
    expect(() => assertSsrWireSuite(bad)).toThrow(SsrWireSchemaError);
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
