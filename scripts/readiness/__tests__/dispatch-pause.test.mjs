/**
 * @file scripts/readiness/__tests__/dispatch-pause.test.mjs
 * @description Unit proof of the manual/emergency dispatch-pause lever (#3609, epic #3383). Pins the pure
 *   state transitions (set / clear / parse) and the durable marker round-trip (write / read / status) that
 *   `dispatch-plan.mjs` and `tick-core.mjs` both consult before computing any launch/spawn list.
 */
import { describe, it, expect, afterEach } from 'vitest';
import { mkdtempSync, rmSync, writeFileSync, existsSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import {
  emptyPauseState,
  parsePauseState,
  setPause,
  clearPause,
  serializePauseState,
  readPauseState,
  writePauseState,
  isDispatchPaused,
} from '../dispatch-pause.mjs';

const tmpDirs = [];
function tmpMarker() {
  const dir = mkdtempSync(join(tmpdir(), 'dispatch-pause-'));
  tmpDirs.push(dir);
  return join(dir, 'dispatch-pause.json');
}
afterEach(() => { for (const d of tmpDirs.splice(0)) rmSync(d, { recursive: true, force: true }); });

describe('dispatch-pause — emptyPauseState / parsePauseState (pure, fail-open)', () => {
  it('empty state is not paused', () => {
    expect(emptyPauseState()).toEqual({ paused: false, reason: null, by: null, at: null });
  });
  it('parses a well-formed pause', () => {
    const s = parsePauseState(JSON.stringify({ paused: true, reason: 'high load', by: 'nic', at: '2026-09-08T00:00:00.000Z' }));
    expect(s).toEqual({ paused: true, reason: 'high load', by: 'nic', at: '2026-09-08T00:00:00.000Z' });
  });
  it('blank/whitespace text reads as empty', () => {
    expect(parsePauseState('')).toEqual(emptyPauseState());
    expect(parsePauseState('   ')).toEqual(emptyPauseState());
    expect(parsePauseState(null)).toEqual(emptyPauseState());
    expect(parsePauseState(undefined)).toEqual(emptyPauseState());
  });
  it('unparseable JSON fails open to empty, never throws', () => {
    expect(() => parsePauseState('{not json')).not.toThrow();
    expect(parsePauseState('{not json')).toEqual(emptyPauseState());
  });
  it('a non-object JSON value fails open to empty', () => {
    expect(parsePauseState('42')).toEqual(emptyPauseState());
    expect(parsePauseState('"paused"')).toEqual(emptyPauseState());
    expect(parsePauseState('[1,2,3]')).toEqual(emptyPauseState());
  });
  it('a missing paused:true (e.g. paused:"yes") reads as false — only the boolean literal counts', () => {
    expect(parsePauseState(JSON.stringify({ paused: 'yes' }))).toEqual(emptyPauseState());
  });
});

describe('dispatch-pause — setPause / clearPause (pure transitions)', () => {
  it('setPause stamps a default reason when none given', () => {
    const s = setPause({}, 1_000);
    expect(s.paused).toBe(true);
    expect(s.reason).toBe('operator emergency pause');
    expect(s.by).toBeNull();
    expect(s.at).toBe(new Date(1_000).toISOString());
  });
  it('setPause carries a given reason + by, trimmed', () => {
    const s = setPause({ reason: '  machine already loaded  ', by: 'nic' }, 2_000);
    expect(s.reason).toBe('machine already loaded');
    expect(s.by).toBe('nic');
  });
  it('clearPause returns the empty (not-paused) state', () => {
    expect(clearPause()).toEqual(emptyPauseState());
  });
  it('serializePauseState round-trips through parsePauseState', () => {
    const s = setPause({ reason: 'x', by: 'y' }, 3_000);
    expect(parsePauseState(serializePauseState(s))).toEqual(s);
  });
});

describe('dispatch-pause — the durable marker (write / read / status, fail-open on a missing or corrupt file)', () => {
  it('absent marker ⇒ not paused', () => {
    const p = tmpMarker();
    expect(isDispatchPaused(p)).toBe(false);
    expect(readPauseState(p)).toEqual(emptyPauseState());
  });
  it('writePauseState → readPauseState round-trips, and isDispatchPaused reads true', () => {
    const p = tmpMarker();
    const s = setPause({ reason: 'incident', by: 'operator' }, 4_000);
    writePauseState(s, p);
    expect(readPauseState(p)).toEqual(s);
    expect(isDispatchPaused(p)).toBe(true);
  });
  it('clearing (writing the empty state) resumes dispatch', () => {
    const p = tmpMarker();
    writePauseState(setPause({}, 5_000), p);
    expect(isDispatchPaused(p)).toBe(true);
    writePauseState(clearPause(), p);
    expect(isDispatchPaused(p)).toBe(false);
  });
  it('re-setting is idempotent — overwrites with the latest reason/by', () => {
    const p = tmpMarker();
    writePauseState(setPause({ reason: 'first' }, 1), p);
    writePauseState(setPause({ reason: 'second' }, 2), p);
    expect(readPauseState(p).reason).toBe('second');
  });
  it('a corrupt marker fails OPEN — reads as not paused, never throws', () => {
    const p = tmpMarker();
    writeFileSync(p, '{ this is not valid json');
    expect(() => readPauseState(p)).not.toThrow();
    expect(readPauseState(p)).toEqual(emptyPauseState());
    expect(isDispatchPaused(p)).toBe(false);
  });
  it('the write is atomic — no stray .tmp file left behind after a write', () => {
    const p = tmpMarker();
    writePauseState(setPause({ reason: 'x' }, 1), p);
    expect(existsSync(p)).toBe(true);
    expect(readFileSync(p, 'utf8')).toContain('"paused": true');
  });
});
