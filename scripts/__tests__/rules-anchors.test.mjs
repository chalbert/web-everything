/**
 * @file scripts/__tests__/rules-anchors.test.mjs
 * @description Pins the /rules/ read-path anchor machinery (#1828, #1792 Fork 1 → (c)): the loader's
 * anchor extraction (the three anchor forms the docs use) and the cross-doc codifiedIn-resolution gate.
 * Fixture-tested so the pure rules don't depend on the live docs tree.
 */
import { describe, it, expect } from 'vitest';
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const { extractAnchors, githubSlug } = require('../lib/rules-loader.cjs');
const { validateRulesAnchors } = require('../lib/validate-rules-anchors.cjs');

describe('extractAnchors — the three anchor forms the governance docs use', () => {
  it('lifts explicit kramdown `### Title {#id}` headings', () => {
    const { anchors, headings } = extractAnchors('### Constellation placement {#constellation-placement}\n');
    expect(anchors.has('constellation-placement')).toBe(true);
    expect(headings[0]).toEqual({ level: 3, text: 'Constellation placement', anchor: 'constellation-placement' });
  });

  it('slugs plain `## Heading (#1321)` to its GitHub anchor', () => {
    const { anchors } = extractAnchors('## Packaging governance (#1321)\n');
    expect(anchors.has('packaging-governance-1321')).toBe(true);
  });

  it('collapses an em-dash heading to a double-dash slug', () => {
    const { anchors } = extractAnchors('### Principle-conformance pre-flight — readiness is conformance, not just mechanics (#608)\n');
    expect(anchors.has('principle-conformance-pre-flight--readiness-is-conformance-not-just-mechanics-608')).toBe(true);
  });

  it('recognizes standalone inline `{#id}` markers and raw-HTML `id="…"`', () => {
    const { anchors } = extractAnchors(
      '8. **Rule.** {#relocation-granularity} body text\n' +
      'prose <span id="canonical-build-kind-predicate"></span> more\n'
    );
    expect(anchors.has('relocation-granularity')).toBe(true);
    expect(anchors.has('canonical-build-kind-predicate')).toBe(true);
  });

  it('does NOT treat a heading-line `#id`-looking token as an anchor twice', () => {
    expect(githubSlug('Just a heading')).toBe('just-a-heading');
    expect(githubSlug('Is it a Project / Protocol — or just an intent?')).toBe('is-it-a-project--protocol--or-just-an-intent');
  });
});

describe('validateRulesAnchors — codifiedIn cite resolution gate', () => {
  const index = {
    'docs/agent/platform-decisions.md': new Set(['constellation-placement', 'monetization']),
    'docs/agent/backlog-workflow.md': new Set(['program-definition']),
    'docs/agent/block-standard.md': new Set([]),
    'docs/agent/vision-tiers.md': new Set([]),
  };

  it('passes when every cite resolves', () => {
    const cites = [
      { file: '1.md', value: 'docs/agent/platform-decisions.md#constellation-placement' },
      { file: '2.md', value: 'docs/agent/backlog-workflow.md#program-definition' },
    ];
    expect(validateRulesAnchors(index, cites).errors).toHaveLength(0);
  });

  it('flags an anchor that does not resolve in its doc', () => {
    const cites = [{ file: '3.md', value: 'docs/agent/platform-decisions.md#renamed-heading' }];
    const { errors } = validateRulesAnchors(index, cites);
    expect(errors).toHaveLength(1);
    expect(errors[0].message).toMatch(/does not resolve/);
  });

  it('flags a cite into a doc outside the rendered four', () => {
    const cites = [{ file: '4.md', value: 'docs/agent/conventions.md#whatever' }];
    const { errors } = validateRulesAnchors(index, cites);
    expect(errors).toHaveLength(1);
    expect(errors[0].message).toMatch(/not one of the four/);
  });
});
