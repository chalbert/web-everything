/**
 * @file scripts/conveyor/health-smells/__tests__/stale-claim.test.mjs
 * @description #4077 extension (x4axhga) — the PURE `evaluate()` of the `stale-claim` smell: class A (abandoned
 *   claim) and class B (landed, not resolved — both the `matched` and lower-confidence `mentioned` tiers), plus
 *   the exclusions each class depends on (an open PR, a live claim pid). No fs/network — every probe is a plain
 *   fixture object.
 */
import { describe, it, expect } from 'vitest';
import staleClaim, { normId, bodyMentionsToken } from '../stale-claim.mjs';

const DAY = 24 * 60 * 60 * 1000;
const NOW = Date.parse('2026-09-25T22:00:00Z');

const claim = (over = {}) => ({
  kind: 'claim', id: '4169', status: 'active', ownerPidAlive: null, ageMs: 5 * DAY, path: 'backlog/4169-x.md', ...over,
});

const card = (stem, body) => ({ stem, body });

describe('normId', () => {
  it('drops leading zeros off a numeric id', () => { expect(normId('045')).toBe('45'); });
  it('leaves a bornAs hash untouched', () => { expect(normId('x0zg44l')).toBe('x0zg44l'); });
});

describe('bodyMentionsToken', () => {
  it('matches a bulleted "**#NNNN (hash)**" line', () => {
    expect(bodyMentionsToken('- **#4127 (xn6n5gp)** — applyLedger …', '4127')).toBe(true);
    expect(bodyMentionsToken('- **#4127 (xn6n5gp)** — applyLedger …', 'xn6n5gp')).toBe(true);
  });
  it('does not match a bare mid-sentence mention (citation, not a delivery claim)', () => {
    expect(bodyMentionsToken('see #4127 for background', '4127')).toBe(false);
  });
});

describe('stale-claim — class A (abandoned)', () => {
  it('breaches: no open PR, no live pid, older than staleAfterDays', () => {
    const probes = { staleState: { records: [claim()] }, prs: [], mergedPrs: { cards: [], prs: [] } };
    const out = staleClaim.evaluate(probes, { now: NOW });
    const a = out.find((r) => r.subject === 'abandoned:4169');
    expect(a).toBeTruthy();
    expect(a.breach).toBe(true);
    expect(a.measure.ageDays).toBeCloseTo(5, 0);
  });

  it('does not breach yet when younger than staleAfterDays', () => {
    const probes = { staleState: { records: [claim({ ageMs: 1 * DAY })] }, prs: [], mergedPrs: { cards: [], prs: [] } };
    const out = staleClaim.evaluate(probes, { now: NOW });
    const a = out.find((r) => r.subject === 'abandoned:4169');
    expect(a.breach).toBe(false);
  });

  it('is excluded entirely when an open PR already names the card', () => {
    const prs = [{ repo: 'we', number: 1, title: 'x', headRefName: 'lane/4169-soak-harness' }];
    const probes = { staleState: { records: [claim()] }, prs, mergedPrs: { cards: [], prs: [] } };
    const out = staleClaim.evaluate(probes, { now: NOW });
    expect(out.find((r) => r.subject === 'abandoned:4169')).toBeUndefined();
  });

  it('is excluded when the claim carries a live same-host pid', () => {
    const probes = { staleState: { records: [claim({ ownerPidAlive: true })] }, prs: [], mergedPrs: { cards: [], prs: [] } };
    const out = staleClaim.evaluate(probes, { now: NOW });
    expect(out.find((r) => r.subject === 'abandoned:4169')).toBeUndefined();
  });

  it('never flags a resolved/parked/open card (only active/preparing claims are scanned)', () => {
    const probes = { staleState: { records: [claim({ status: 'resolved' })] }, prs: [], mergedPrs: { cards: [], prs: [] } };
    const out = staleClaim.evaluate(probes, { now: NOW });
    expect(out.length).toBe(0);
  });
});

describe('stale-claim — class B (landed, not resolved)', () => {
  it('"matched" tier: sweepStrandings\' own lane-ref match on an active card', () => {
    const cards = [card('4169-daemon-soak-harness', '---\nbornAs: x0zg44l\nstatus: active\n---\n\n# soak')];
    const mergedPrs = [{ number: 2689, title: 'x0zg44l: daemon soak harness (#4075)', headRefName: 'lane/x0zg44l-daemon-soak-harness', body: '' }];
    const probes = { staleState: { records: [claim({ ageMs: 1 * DAY })] }, prs: [], mergedPrs: { cards, prs: mergedPrs } };
    const out = staleClaim.evaluate(probes, { now: NOW });
    const b = out.find((r) => r.subject === 'landed:4169');
    expect(b).toBeTruthy();
    expect(b.measure.confidence).toBe('matched');
    expect(b.measure.mergedPrs[0].pr).toBe(2689);
  });

  it('"mentioned" tier: a coordinated PR whose ref/title name only a SIBLING card, this card only in a body bullet', () => {
    const cards = [card('4134-numbering-lock-reclaim', '---\nbornAs: xuqk1vp\nstatus: active\n---\n\n# lock reclaim')];
    const mergedPrs = [{
      number: 2668,
      title: 'drain numbering: linear applyLedger (xn6n5gp), pid-aware lock reclaim (xuqk1vp)',
      headRefName: 'lane/xn6n5gp-numbering-linear-lock-safety',
      body: '- **#4127 (xn6n5gp)** — applyLedger …\n- **#4134 (xuqk1vp)** — the numbering-critical-section mutex …',
    }];
    const probes = { staleState: { records: [claim({ id: '4134', ageMs: 1 * DAY })] }, prs: [], mergedPrs: { cards, prs: mergedPrs } };
    const out = staleClaim.evaluate(probes, { now: NOW });
    const b = out.find((r) => r.subject === 'landed:4134');
    expect(b).toBeTruthy();
    expect(b.measure.confidence).toBe('mentioned');
    expect(b.measure.mergedPrs[0].pr).toBe(2668);
    // sweepStrandings' own ref/title match must NOT have claimed this one (that would be the 'matched' tier).
    expect(out.filter((r) => r.subject === 'landed:4134').length).toBe(1);
  });

  it('reports nothing for an active card no merged PR mentions at all', () => {
    const cards = [card('4169-daemon-soak-harness', '---\nbornAs: x0zg44l\nstatus: active\n---\n\n# soak')];
    const probes = { staleState: { records: [claim({ ageMs: 1 * DAY })] }, prs: [], mergedPrs: { cards, prs: [] } };
    const out = staleClaim.evaluate(probes, { now: NOW });
    expect(out.find((r) => r.subject === 'landed:4169')).toBeUndefined();
  });
});
