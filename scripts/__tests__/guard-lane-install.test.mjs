/**
 * @file guard-lane-install.test.mjs — the lane guard is registered ONCE, at user level, with an absolute path
 *   to the primary checkout's copy (#3074). Pure over injected settings objects; no io.
 */
import { describe, it, expect } from 'vitest';
import {
  withGuardHook, withoutGuardHook, guardStatus, hookEntry, primaryGuardPath, isGuardHook, guardHookPath,
  HOOK_MARKER, MATCHER,
} from '../guard-lane-install.mjs';

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

/**
 * #3198 — IDENTITY, not filename. The entry used to be recognised by "the command contains `guard-lane.mjs`",
 * and a filename is not an identity. It broke in both directions, neither of them exotic:
 *
 *   · rename or move the guard, and every hook already installed becomes invisible to the installer — a
 *     second entry is appended beside the stale one, uninstall leaves it, and status reports a clean slate.
 *     The guard fails OPEN, so a stale entry is not a noisy guard, it is NO guard on every write.
 *   · an unrelated hook that merely MENTIONS the name is deleted by a re-install.
 *
 * These are the pinning tests for both, plus the legacy shape, which must keep being recognised — machines
 * already carry it, and that is the entire reason the fallback exists.
 */
describe('#3198 — the entry is identified by its own marker', () => {
  const OLD = '/ws/webeverything/scripts/guard-lane.mjs';
  const RENAMED = '/ws/webeverything/scripts/lane-guard.mjs';
  const legacyEntry = (path) => ({ type: 'command', command: `node ${path}` });

  it('carries a marker that is inert to the shell that runs the command', () => {
    const cmd = hookEntry(OLD).command;
    expect(cmd).toContain(HOOK_MARKER);
    // Everything from `#` on is a comment, so the command still runs exactly the guard and nothing else.
    expect(cmd.slice(0, cmd.indexOf('#')).trim()).toBe(`node ${OLD}`);
    expect(guardHookPath(cmd)).toBe(OLD);
  });

  // THE REGRESSION. Rename the guard and re-install: one entry, pointing at the new path. Before the marker
  // this produced TWO — the stale one still registered, still failing open.
  it('replaces the entry across a RENAME of the guard script', () => {
    let s = withGuardHook({}, OLD);
    s = withGuardHook(s, RENAMED);
    const found = guardStatus(s, () => true);
    expect(found).toHaveLength(1);
    expect(found[0].path).toBe(RENAMED);
  });

  // Counted from the RAW settings, not through `guardStatus`: an orphaned entry the identity check can no
  // longer see is invisible to `guardStatus` too, so asserting through it would pass on exactly the state
  // this is meant to catch.
  it('removes a renamed guard on uninstall rather than orphaning it', () => {
    const s = withGuardHook(withGuardHook({}, OLD), RENAMED);
    const out = withoutGuardHook(s);
    expect(out.hooks.PreToolUse.flatMap((b) => b.hooks)).toEqual([]);
  });

  // THE CONVERSE, and just as bad: somebody else's hook that happens to name the file is not ours to delete.
  it('leaves an unrelated hook that merely MENTIONS the guard filename untouched', () => {
    const mention = { type: 'command', command: 'echo "about to run guard-lane.mjs" >> ~/hooks.log' };
    const before = { hooks: { PreToolUse: [{ matcher: MATCHER, hooks: [mention] }] } };
    expect(isGuardHook(mention)).toBe(false);
    expect(withGuardHook(before, OLD).hooks.PreToolUse[0].hooks).toContainEqual(mention);
    expect(withoutGuardHook(before).hooks.PreToolUse[0].hooks).toContainEqual(mention);
  });

  // The fallback is the whole reason this is a widening rather than a swap: every machine with the guard
  // installed today carries the pre-marker shape, and the FIRST thing the new code must do is recognise it.
  it('still recognises the pre-marker shape, absolute or relative', () => {
    for (const path of [OLD, 'scripts/guard-lane.mjs']) expect(isGuardHook(legacyEntry(path))).toBe(true);
  });

  it('repairs a legacy entry in place instead of adding a marked one beside it', () => {
    const before = { hooks: { PreToolUse: [{ matcher: MATCHER, hooks: [legacyEntry(OLD)] }] } };
    const found = guardStatus(withGuardHook(before, RENAMED), () => true);
    expect(found).toHaveLength(1);
    expect(found[0].path).toBe(RENAMED);
  });

  // An entry installed under a different matcher (an earlier version's, or a hand edit) is still OURS, and
  // leaving it behind while adding a new one is the duplicate-guard state this exists to prevent.
  it('sweeps a guard entry sitting under some OTHER matcher', () => {
    const before = { hooks: { PreToolUse: [{ matcher: 'Write', hooks: [legacyEntry(OLD)] }] } };
    const found = guardStatus(withGuardHook(before, OLD), () => true);
    expect(found).toHaveLength(1);
    expect(found[0].matcher).toBe(MATCHER);
  });

  it('is not fooled by a non-string or absent command', () => {
    for (const h of [undefined, null, {}, { command: 42 }, { command: '' }]) expect(isGuardHook(h)).toBe(false);
  });
});
