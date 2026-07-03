/**
 * @file scripts/backlog/__tests__/cost.test.mjs
 * Tests `accrueCost` — the close-time cost-on-card accumulator. It folds a session's usage-equivalent $
 * into a card's cumulative `costUsd` + `costSessions` frontmatter as a pure splice: the body is never
 * touched, repeated calls accumulate (a decision worked across /prepare then /decide sums into one
 * total; a workflow even-split lands a share on each item), cents are rounded, and a doc with no
 * frontmatter yields null (never a half-write).
 */
import { describe, it, expect } from 'vitest';
import { accrueCost, readField } from '../frontmatter.mjs';

const CARD = [
  '---',
  'kind: decision',
  'status: open',
  'dateOpened: "2026-07-01"',
  'tags: [cost, accounting]',
  '---',
  '',
  '# A decision whose body mentions costUsd: and must never change.',
  '',
].join('\n');

describe('accrueCost — cumulative cost-on-card accounting', () => {
  it('sets costUsd + costSessions=1 on a card with no prior cost', () => {
    const out = accrueCost(CARD, 4.32);
    expect(readField(out, 'costUsd')).toBe('4.32');
    expect(readField(out, 'costSessions')).toBe('1');
  });

  it('accumulates across sessions (prepare + decide sum into one running total)', () => {
    const afterPrepare = accrueCost(CARD, 4.32);
    const afterDecide = accrueCost(afterPrepare, 2.5);
    expect(readField(afterDecide, 'costUsd')).toBe('6.82');
    expect(readField(afterDecide, 'costSessions')).toBe('2');
  });

  it('rounds to whole cents (diff-quiet, no float dust)', () => {
    const out = accrueCost(accrueCost(CARD, 0.1), 0.2);
    expect(readField(out, 'costUsd')).toBe('0.3');
  });

  it('honours a --sessions override (e.g. a workflow even-split share)', () => {
    const out = accrueCost(CARD, 1.5, { sessions: 1 });
    expect(readField(out, 'costSessions')).toBe('1');
  });

  it('never touches the body', () => {
    const out = accrueCost(CARD, 9.99);
    expect(out).toContain('# A decision whose body mentions costUsd: and must never change.');
  });

  it('returns null for a document with no frontmatter (never a half-write)', () => {
    expect(accrueCost('# just a body, no frontmatter\n', 5)).toBeNull();
  });
});
