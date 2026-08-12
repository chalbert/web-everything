/**
 * @file guard-lane-install.test.mjs — the lane guard is registered ONCE, at user level, with an absolute path
 *   to the primary checkout's copy (#3074). Pure over injected settings objects; no io.
 */
import { describe, it, expect } from 'vitest';
import { withGuardHook, withoutGuardHook, guardStatus, hookEntry, primaryGuardPath, MATCHER } from '../guard-lane-install.mjs';

describe('primaryGuardPath', () => {
  // The first cut resolved relative to the SCRIPT, reproducing in the installer the exact bug the guard had:
  // run from a lane it registered the LANE's path. A lane is reset and recycled, and guard-lane fails OPEN, so
  // that installs a hook which silently stops guarding.
  it('always names the primary checkout, whatever directory it runs from', () => {
    const want = '/ws/webeverything/scripts/guard-lane.mjs';
    expect(primaryGuardPath('/ws/webeverything/scripts')).toBe(want);
    expect(primaryGuardPath('/ws/.lanes/web-everything/lane-9/scripts')).toBe(want);
    expect(primaryGuardPath('/ws/.lanes/plateau-app/lane-3/scripts')).toBe(want);
  });
});

describe('withGuardHook', () => {
  it('adds the entry under the Edit|Write matcher', () => {
    const out = withGuardHook({}, '/ws/webeverything/scripts/guard-lane.mjs');
    const block = out.hooks.PreToolUse.find((b) => b.matcher === MATCHER);
    expect(block.hooks).toContainEqual(hookEntry('/ws/webeverything/scripts/guard-lane.mjs'));
  });

  it('preserves hooks it does not own', () => {
    const before = { hooks: { PreToolUse: [{ matcher: 'Bash', hooks: [{ type: 'command', command: 'node other.mjs' }] }] } };
    const out = withGuardHook(before, '/ws/webeverything/scripts/guard-lane.mjs');
    expect(out.hooks.PreToolUse.find((b) => b.matcher === 'Bash').hooks).toHaveLength(1);
  });

  // REPAIR, not append. Re-running after the checkout moves must replace the stale path — a second, stale
  // guard would fail open on every write while looking installed.
  it('replaces an existing guard entry rather than adding a second', () => {
    let s = withGuardHook({}, '/old/webeverything/scripts/guard-lane.mjs');
    s = withGuardHook(s, '/ws/webeverything/scripts/guard-lane.mjs');
    const found = guardStatus(s, () => true);
    expect(found).toHaveLength(1);
    expect(found[0].path).toBe('/ws/webeverything/scripts/guard-lane.mjs');
  });

  it('does not mutate the settings it was given', () => {
    const before = { hooks: { PreToolUse: [] } };
    withGuardHook(before, '/ws/webeverything/scripts/guard-lane.mjs');
    expect(before.hooks.PreToolUse).toHaveLength(0);
  });
});

describe('guardStatus', () => {
  it('reports a path that does not resolve, because that means NO guard', () => {
    const s = withGuardHook({}, '/gone/webeverything/scripts/guard-lane.mjs');
    expect(guardStatus(s, () => false)[0].resolves).toBe(false);
  });

  it('flags a RELATIVE registration — the shape that only guarded one directory', () => {
    const s = { hooks: { PreToolUse: [{ matcher: MATCHER, hooks: [{ type: 'command', command: 'node scripts/guard-lane.mjs' }] }] } };
    expect(guardStatus(s, () => true)[0].absolute).toBe(false);
  });

  it('finds nothing in empty or hookless settings', () => {
    expect(guardStatus({})).toEqual([]);
    expect(guardStatus({ hooks: {} })).toEqual([]);
    expect(guardStatus(undefined)).toEqual([]);
  });
});

describe('withoutGuardHook', () => {
  it('removes the guard wherever it sits and leaves the rest', () => {
    const before = withGuardHook(
      { hooks: { PreToolUse: [{ matcher: 'Bash', hooks: [{ type: 'command', command: 'node other.mjs' }] }] } },
      '/ws/webeverything/scripts/guard-lane.mjs',
    );
    const out = withoutGuardHook(before);
    expect(guardStatus(out, () => true)).toEqual([]);
    expect(out.hooks.PreToolUse.find((b) => b.matcher === 'Bash').hooks).toHaveLength(1);
  });
});
