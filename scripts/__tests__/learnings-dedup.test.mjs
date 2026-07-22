/**
 * @file scripts/__tests__/learnings-dedup.test.mjs
 * @description Unit proof of the learnings dedup/clustering core (#2614): two near-duplicate drop-box entries
 *   (same kind + area, similar summary) COLLAPSE into one ranked cluster; genuinely distinct entries stay
 *   separate. Also pins the ranking (count desc) and the representative pick (longest/most-specific summary).
 */
import { describe, it, expect } from 'vitest';
import { dedup, jaccard, isNearDup, normArea, parseJsonl } from '../conveyor/learnings-dedup.mjs';

const e = (kind, area, summary, suggestion = 'fix it') => ({ kind, area, summary, suggestion });

describe('dedup — near-duplicates collapse', () => {
  it('collapses two restatements of one lesson into a single cluster of count 2', () => {
    const entries = [
      e('friction', 'lane gating', 'lane gate reruns full suite for docs only diff'),
      e('friction', 'lane gating', 'the lane gate reruns the full suite even for docs only diffs'),
    ];
    const { clusters, stats } = dedup(entries);
    expect(clusters).toHaveLength(1);
    expect(clusters[0].count).toBe(2);
    expect(stats).toMatchObject({ entries: 2, clusters: 1, collapsed: 1 });
    // representative = the longer, more specific summary
    expect(clusters[0].summary).toBe('the lane gate reruns the full suite even for docs only diffs');
    expect(clusters[0].summaries).toHaveLength(2);
  });
});

describe('dedup — distinct entries stay separate', () => {
  it('keeps different kind / different area entries apart', () => {
    const entries = [
      e('friction', 'lane gating', 'lane gate reruns full suite for docs only diff'),
      e('doc-gap', 'memory docs', 'the memory doc omits the sub-index budget rule'),
      e('skill-gap', 'closing session', 'no skill step sweeps the learnings drop-box'),
    ];
    const { clusters, stats } = dedup(entries);
    expect(clusters).toHaveLength(3);
    expect(stats.collapsed).toBe(0);
    expect(clusters.every((c) => c.count === 1)).toBe(true);
  });

  it('same area but DIFFERENT kind does not merge', () => {
    const { clusters } = dedup([
      e('friction', 'lane gating', 'lane gate is slow on tiny diffs'),
      e('improvement', 'lane gating', 'lane gate is slow on tiny diffs'),
    ]);
    expect(clusters).toHaveLength(2);
  });
});

describe('dedup — ranking', () => {
  it('ranks clusters by member count descending', () => {
    const entries = [
      e('doc-gap', 'memory docs', 'the memory doc omits the sub-index budget rule'),
      // three mutually-similar friction summaries (complete-link needs ALL pairs ≥ threshold)
      e('friction', 'lane gating', 'lane gate reruns full suite for docs only diff'),
      e('friction', 'lane gating', 'lane gate reruns full suite for docs only change'),
      e('friction', 'lane gating', 'lane gate reruns full suite for docs only edit'),
    ];
    const { clusters } = dedup(entries);
    expect(clusters[0].kind).toBe('friction');
    expect(clusters[0].count).toBe(3);
    expect(clusters[1].count).toBe(1);
  });
});

describe('dedup — complete-link stops transitive over-merge (review fix 8)', () => {
  // A~B ≥ t and B~C ≥ t but A~C < t: single-link would chain all three via the B bridge; complete-link
  // keeps {A,B} and {C} apart, so C's DISTINCT suggestion is preserved as its own candidate.
  const A = e('friction', 'gate', 'alpha beta gamma delta', 'widen the scope');
  const B = e('friction', 'gate', 'alpha beta gamma epsilon', 'widen the scope');
  const C = e('friction', 'gate', 'beta gamma epsilon omega', 'rewrite the gate');
  it('does not chain A–B–C into one cluster', () => {
    const { clusters } = dedup([A, B, C]);
    expect(clusters).toHaveLength(2);
    expect(clusters[0].count).toBe(2); // {A,B}
    expect(clusters[1].count).toBe(1); // {C}
  });
  it('carries distinct member suggestions on the merged cluster', () => {
    const { clusters } = dedup([A, B]);
    expect(clusters[0].suggestions).toEqual(['widen the scope']); // deduped identical suggestions
  });
});

describe('similarity primitives', () => {
  it('jaccard is 1 for identical token sets, 0 for disjoint', () => {
    expect(jaccard(['a', 'b'], ['b', 'a'])).toBe(1);
    expect(jaccard(['a'], ['b'])).toBe(0);
  });
  it('normArea is order- and stop-word-insensitive', () => {
    expect(normArea('lane gating / the gate')).toBe(normArea('gate lane gating'));
  });
  it('isNearDup respects the threshold', () => {
    const a = e('friction', 'x', 'alpha beta gamma delta');
    const b = e('friction', 'x', 'alpha beta gamma epsilon');
    expect(isNearDup(a, b, 0.5)).toBe(true);
    expect(isNearDup(a, b, 0.9)).toBe(false);
  });
});

describe('parseJsonl', () => {
  it('parses lines, skipping blanks and # comments', () => {
    const rows = parseJsonl('# header\n{"kind":"friction"}\n\n{"kind":"doc-gap"}\n');
    expect(rows).toHaveLength(2);
    expect(rows[0].kind).toBe('friction');
  });
});
