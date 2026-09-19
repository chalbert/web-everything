/**
 * @file scripts/__tests__/design-knowledge-distillation.test.mjs
 * @description Pins the #1589 distillation state of the design-knowledge ledger (#1586).
 *
 * The single-source rubric axes (1/2/4/5) are distilled into `docs/agent/vision-tiers.md` v3; their three
 * sources (`w3c-apg`, `apple-hig`, `nielsen-heuristics`) flip `distilledInto`, while `uicrit-uist24` stays
 * pending under the multi-source follow-on #3116. Also the first real-ledger exercise of
 * `computeCredibilityWeight` (#1591): every committed weight must recompute from its row's `kind`.
 */
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { createRequire } from 'node:module';
import { computeDesignKnowledgeConformance } from '../check-standards-rules.mjs';

const require = createRequire(import.meta.url);
const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..', '..');
const watch = require('../../src/_data/designKnowledgeWatch.json');
const { computeCredibilityWeight } = require('../../src/_data/credibilityWeighting.js');
const rubricDoc = readFileSync(join(ROOT, 'docs/agent/vision-tiers.md'), 'utf8');

const row = (id) => watch.entries.find((e) => e.id === id);
const DISTILLED = ['w3c-apg', 'apple-hig', 'nielsen-heuristics'];

describe('design-knowledge distillation (#1589)', () => {
  it.each(DISTILLED)('%s has a non-empty distilledInto array', (id) => {
    const { distilledInto } = row(id);
    expect(Array.isArray(distilledInto)).toBe(true);
    expect(distilledInto.length).toBeGreaterThan(0);
  });

  it('uicrit-uist24 stays undistilled, tracked by the multi-source follow-on #3116', () => {
    expect(row('uicrit-uist24').distilledInto).toBeNull();
    expect(row('uicrit-uist24').trackingItem).toBe('3116');
  });

  it.each(watch.entries.map((e) => [e.id, e]))('%s credibilityWeight recomputes from its kind', (_id, e) => {
    expect(e.credibilityWeight).toBe(computeCredibilityWeight({ kind: e.kind }).weight);
  });

  it('conformance metric reads 3/4 distilled, uicrit-uist24 pending', () => {
    expect(computeDesignKnowledgeConformance(watch)).toEqual({
      total: 4,
      distilled: 3,
      pending: 1,
      pendingList: ['uicrit-uist24 (#3116)'],
    });
  });

  // A distilledInto ref must point at guidance that actually exists — otherwise the flip is the
  // citation-only no-op #1589 rejected.
  it('every distilledInto ref resolves to a v3 distilled-guidance paragraph in the rubric doc', () => {
    expect(rubricDoc).toContain('**Rubric version: `v3`**');
    expect(rubricDoc).toContain('### Distilled guidance (v3)');
    for (const id of DISTILLED) {
      for (const ref of row(id).distilledInto) {
        const m = ref.match(/^we:docs\/agent\/vision-tiers\.md#design-critique-rubric-ratified-1034 v3 axis (\d) \(/);
        expect(m, ref).not.toBeNull();
        expect(rubricDoc).toMatch(new RegExp(`^> \\*\\*${m[1]} — .+\\*\\* Codified from `, 'm'));
      }
    }
  });

  it.each(['3', '6', '7', '8'])('multi-source axis %s carries the #3116 pending placeholder', (n) => {
    expect(rubricDoc).toMatch(new RegExp(`^- \\*\\*${n} — .+\\*\\* — pending — multi-source, tracked by \`#3116\``, 'm'));
  });
});
