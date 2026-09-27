/**
 * @file scripts/conveyor/health-smells/__tests__/notify-list.test.mjs
 * @description The ONE declared place for "which signs notify even in shadow mode" (the Sun 2026-09-27
 *   ~7:40 AM ET operator decision). Pins the exact approved set, that every id in it names a real registered
 *   smell (no typo drift), and that `planActions` actually reads THIS list by default (not a stale copy).
 */
import { describe, it, expect } from 'vitest';
import { NOTIFY_EVEN_IN_SHADOW } from '../notify-list.mjs';
import { SMELLS } from '../index.mjs';
import {
  emptyHealthState, stepEpisodes, planActions,
} from '../../health-watch-core.mjs';

const APPROVED = [
  'drain-failing-repeatedly',
  'dispatch-refused-stale-clone',
  'lane-starvation',
  'gh-call-failures',
  'gh-graphql-budget',
  'duplicate-live-sessions',
  'pr-no-owner',
  'daemon-silent',
];

describe('NOTIFY_EVEN_IN_SHADOW', () => {
  it('is exactly the eight operator-approved signs — no more, no fewer', () => {
    expect([...NOTIFY_EVEN_IN_SHADOW].sort()).toEqual([...APPROVED].sort());
  });

  it('every listed id names a real, currently-registered smell (no typo/stale drift)', () => {
    const registered = new Set(SMELLS.map((s) => s.id));
    for (const id of NOTIFY_EVEN_IN_SHADOW) expect(registered.has(id)).toBe(true);
  });

  it('every other registered smell is NOT in the list (record-only by default)', () => {
    const others = SMELLS.map((s) => s.id).filter((id) => !NOTIFY_EVEN_IN_SHADOW.has(id));
    expect(others.length).toBe(SMELLS.length - APPROVED.length);
    for (const id of others) expect(NOTIFY_EVEN_IN_SHADOW.has(id)).toBe(false);
  });

  it('`planActions` defaults to reading THIS Set — an approved id is never suppressed in shadow mode', () => {
    for (const id of NOTIFY_EVEN_IN_SHADOW) {
      const smell = { id, openAfter: 1, closeAfter: 1, severity: 'high', action: 'alert' };
      const r = stepEpisodes(emptyHealthState(), [{ smell, results: [{ subject: 'x', breach: true }] }], 0);
      const plan = planActions(r.transitions, { [id]: smell }, { mode: 'shadow' });
      const notify = plan.find((p) => p.kind === 'notify' && p.key === `${id}::x`);
      expect(notify.suppressed).toBeNull();
    }
  });

  it('a smell NOT in the list stays suppressed in shadow mode by default', () => {
    const smell = { id: 'not-on-the-list', openAfter: 1, closeAfter: 1, severity: 'high', action: 'alert' };
    const r = stepEpisodes(emptyHealthState(), [{ smell, results: [{ subject: 'x', breach: true }] }], 0);
    const plan = planActions(r.transitions, { 'not-on-the-list': smell }, { mode: 'shadow' });
    expect(plan.find((p) => p.kind === 'notify' && p.key === 'not-on-the-list::x').suppressed).toBe('shadow mode');
  });
});
