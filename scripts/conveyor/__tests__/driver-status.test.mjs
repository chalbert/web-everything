/**
 * @file scripts/conveyor/__tests__/driver-status.test.mjs
 * @description Unit proof of {@link formatStatus} — the pure render half of the "is the driver stuck?" status
 *   command (2026-09-14, #3521/lane-2 incident). No fs/clock; `now` is injected.
 */
import { describe, it, expect } from 'vitest';
import { formatStatus } from '../driver-status.mjs';

describe('formatStatus — no status file yet', () => {
  it('reports plainly when no driver-status.json exists', () => {
    expect(formatStatus(null)).toMatch(/no driver-status\.json found/);
  });
});

describe('formatStatus — a healthy, non-stalled tick', () => {
  it('shows tick, age, status line, and "no stall" when stalled is empty', () => {
    const now = Date.parse('2026-09-14T01:00:00.000Z');
    const status = { tick: 12, at: '2026-09-14T00:59:00.000Z', statusLine: 'conveyor · 3 building', stalled: [] };
    const text = formatStatus(status, [], now);
    expect(text).toContain('tick 12');
    expect(text).toContain('60s ago');
    expect(text).toContain('conveyor · 3 building');
    expect(text).toContain('no self-diagnosed stall');
  });
});

describe('formatStatus — a self-diagnosed stall (reproduces #3521/lane-2)', () => {
  it('surfaces the exact stuck item, reason, and tick count', () => {
    const status = {
      tick: 40, at: '2026-09-14T00:40:00.000Z', statusLine: 'conveyor · 1 queued',
      stalled: [{ num: 3521, reason: 'overlaps lane-2', ticks: 5 }],
    };
    const text = formatStatus(status, [], Date.parse('2026-09-14T00:40:10.000Z'));
    expect(text).toContain('🛑 1 self-diagnosed stall');
    expect(text).toContain('#3521 stuck 5 ticks on: overlaps lane-2');
  });

  it('pluralizes correctly for more than one stall', () => {
    const status = { tick: 1, at: '2026-09-14T00:00:00.000Z', statusLine: '', stalled: [
      { num: 1, reason: 'no free lane', ticks: 3 },
      { num: 2, reason: 'overlaps lane-4', ticks: 4 },
    ] };
    const text = formatStatus(status, [], Date.parse('2026-09-14T00:00:00.000Z'));
    expect(text).toContain('🛑 2 self-diagnosed stalls');
  });
});

describe('formatStatus — recent decision-trace lines', () => {
  it('renders each trace entry with its tick', () => {
    const status = { tick: 5, at: '2026-09-14T00:00:00.000Z', statusLine: 'ok', stalled: [] };
    const trace = [
      { tick: 4, text: 'dispatched #10 to lane-4: build' },
      { tick: 5, text: 'skipped #3521: overlaps lane-2' },
    ];
    const text = formatStatus(status, trace, Date.parse('2026-09-14T00:00:05.000Z'));
    expect(text).toContain('recent decision trace (2)');
    expect(text).toContain('[tick 4] dispatched #10 to lane-4: build');
    expect(text).toContain('[tick 5] skipped #3521: overlaps lane-2');
  });

  it('omits the trace section entirely when there are no lines', () => {
    const status = { tick: 5, at: '2026-09-14T00:00:00.000Z', statusLine: 'ok', stalled: [] };
    const text = formatStatus(status, [], Date.parse('2026-09-14T00:00:00.000Z'));
    expect(text).not.toContain('recent decision trace');
  });
});

describe('formatStatus — tolerates a missing/unparseable `at` (unknown age, never throws)', () => {
  it('reports unknown age rather than NaN', () => {
    const status = { tick: 1, statusLine: 'ok', stalled: [] };
    expect(() => formatStatus(status)).not.toThrow();
    expect(formatStatus(status)).toContain('(unknown age)');
  });
});
