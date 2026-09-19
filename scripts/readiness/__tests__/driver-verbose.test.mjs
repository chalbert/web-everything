/**
 * @file scripts/readiness/__tests__/driver-verbose.test.mjs
 * @description Unit proof of the driver-verbose marker's PURE core (2026-09-14, #3521 decision-trace v1
 *   follow-up) — the live on/off/bounded-ticks toggle a human or another agent flips against a currently-running
 *   conveyor driver, no restart needed.
 */
import { describe, it, expect } from 'vitest';
import {
  emptyVerboseState, parseVerboseState, setVerboseState, clearVerboseState, serializeVerboseState,
  advanceVerboseTicks,
} from '../driver-verbose.mjs';

describe('parseVerboseState — tolerant parse, fails OPEN', () => {
  it('empty/missing text reads as not-verbose', () => {
    expect(parseVerboseState('')).toEqual(emptyVerboseState());
    expect(parseVerboseState(null)).toEqual(emptyVerboseState());
  });
  it('unparseable JSON fails open (never throws)', () => {
    expect(parseVerboseState('{not json')).toEqual(emptyVerboseState());
  });
  it('an array marker fails open (Array.isArray guard, mirrors dispatch-pause.mjs)', () => {
    expect(parseVerboseState('[1,2,3]')).toEqual(emptyVerboseState());
  });
  it('parses a real marker, defaulting a bad ticksRemaining to null', () => {
    expect(parseVerboseState(JSON.stringify({ verbose: true, ticksRemaining: 5, reason: 'debug', by: 'nic', at: 't' })))
      .toEqual({ verbose: true, ticksRemaining: 5, reason: 'debug', by: 'nic', at: 't' });
    expect(parseVerboseState(JSON.stringify({ verbose: true, ticksRemaining: 'oops' })).ticksRemaining).toBeNull();
    expect(parseVerboseState(JSON.stringify({ verbose: true, ticksRemaining: -1 })).ticksRemaining).toBeNull();
  });
});

describe('setVerboseState / clearVerboseState', () => {
  it('sets verbose ON with a bounded tick window', () => {
    const s = setVerboseState({ ticks: 5, by: 'nic' }, Date.parse('2026-09-14T01:00:00Z'));
    expect(s).toMatchObject({ verbose: true, ticksRemaining: 5, by: 'nic' });
  });
  it('a non-positive/absent ticks is indefinite (null)', () => {
    expect(setVerboseState({}).ticksRemaining).toBeNull();
    expect(setVerboseState({ ticks: 0 }).ticksRemaining).toBeNull();
    expect(setVerboseState({ ticks: -3 }).ticksRemaining).toBeNull();
  });
  it('clear resets to the empty (not-verbose) state', () => {
    expect(clearVerboseState()).toEqual(emptyVerboseState());
  });
});

describe('serializeVerboseState — round-trips through parseVerboseState', () => {
  it('round-trips a real state', () => {
    const s = setVerboseState({ ticks: 3, reason: 'r', by: 'b' }, 0);
    expect(parseVerboseState(serializeVerboseState(s))).toEqual(s);
  });
});

describe('advanceVerboseTicks — the tick-to-tick countdown (2026-09-14, live-toggle follow-up)', () => {
  it('leaves an OFF state unchanged and reports not-verbose-this-tick', () => {
    const { next, usedThisTick } = advanceVerboseTicks(emptyVerboseState());
    expect(usedThisTick).toBe(false);
    expect(next).toEqual(emptyVerboseState());
  });
  it('leaves an INDEFINITE verbose state unchanged (no countdown) and reports verbose-this-tick', () => {
    const state = setVerboseState({});
    const { next, usedThisTick } = advanceVerboseTicks(state);
    expect(usedThisTick).toBe(true);
    expect(next).toEqual(state);
  });
  it('decrements a bounded window by one per tick and reports verbose-this-tick', () => {
    let state = setVerboseState({ ticks: 3 });
    let out = advanceVerboseTicks(state);
    expect(out.usedThisTick).toBe(true);
    expect(out.next.ticksRemaining).toBe(2);
    out = advanceVerboseTicks(out.next);
    expect(out.next.ticksRemaining).toBe(1);
  });
  it('the LAST tick of the window still runs verbose, then auto-clears for the tick after', () => {
    const state = setVerboseState({ ticks: 1 });
    const last = advanceVerboseTicks(state);
    expect(last.usedThisTick).toBe(true); // this tick still gets verbose output
    expect(last.next).toEqual(emptyVerboseState()); // but the window is now spent
    const after = advanceVerboseTicks(last.next);
    expect(after.usedThisTick).toBe(false);
  });
});
