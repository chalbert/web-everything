/**
 * @file pr-watch-epic-resolve.test.mjs — unit proof of the #2752 on-land epic-resolve pass in the conveyor
 * merge watcher: the pure {@link deriveChildRefFromSession} slug parse, and {@link resolveEpicOnLand} driven
 * with an INJECTED execFileSync (no git, no CLI subprocess). Pins that on a `resolved` verdict it syncs main,
 * runs resolve-parent, then commits the epic card via an EXPLICIT pathspec and publishes via the gated
 * push-if-green transport — and that on `escalate` / `skip` / any failure it writes NOTHING and never throws
 * (best-effort: the merge exit code is untouched, the operator /resolve is the backstop).
 */
import { describe, it, expect } from 'vitest';
import { deriveChildRefFromSession, resolveEpicOnLand } from '../pr-watch.mjs';

describe('deriveChildRefFromSession — ride the existing --release-session wire', () => {
  it('conveyor-<NNN> → the numeric ref', () => {
    expect(deriveChildRefFromSession('conveyor-2752')).toBe('2752');
  });
  it('conveyor-<hash> → the provisional hash ref (resolve-parent maps it to the landed NNN)', () => {
    expect(deriveChildRefFromSession('conveyor-xfwy6v3')).toBe('xfwy6v3');
  });
  it('a non-conveyor slug / undefined → null (pass runs only with explicit --resolve-epic-of)', () => {
    expect(deriveChildRefFromSession('workflow-lane-7')).toBeNull();
    expect(deriveChildRefFromSession(undefined)).toBeNull();
    expect(deriveChildRefFromSession('conveyor-')).toBeNull();
  });
});

/** Build a fake execFileSync that records calls and returns a canned resolve-parent verdict. `fail` names a
 *  command substring to throw on (to drive the best-effort failure paths). */
function fakeExec(verdict, { fail = null } = {}) {
  const calls = [];
  const exec = (cmd, args) => {
    const key = `${cmd} ${args.join(' ')}`;
    calls.push({ cmd, args, key });
    if (fail && key.includes(fail)) throw new Error(`simulated failure: ${fail}`);
    if (args.includes('resolve-parent')) return JSON.stringify(verdict);
    return '';
  };
  return { exec, calls };
}
const ran = (calls, needle) => calls.some((c) => c.key.includes(needle));
const logs = () => { const out = []; return { log: (m) => out.push(m), out }; };
// Inject dummy paths so the pass never evaluates fileURLToPath(import.meta.url) under vitest's module transform.
const PATHS = { weRoot: '/repo', backlogCli: '/repo/scripts/backlog.mjs', pushCli: '/repo/scripts/push-if-green.mjs' };

describe('resolveEpicOnLand — the resolved verdict lands the epic close', () => {
  it('syncs main, runs resolve-parent, commits the epic card by pathspec, publishes via push-if-green', () => {
    const { exec, calls } = fakeExec({ ok: true, action: 'resolved', epic: '8100-epic', file: 'backlog/8100-epic.md', child: '8101-child' });
    const { log, out } = logs();
    resolveEpicOnLand(exec, '8101', log, PATHS);
    expect(ran(calls, 'git pull --ff-only')).toBe(true);
    expect(ran(calls, 'resolve-parent 8101 --json')).toBe(true);
    // explicit pathspec commit — never a bare `git add -A`
    expect(ran(calls, 'git add -- backlog/8100-epic.md')).toBe(true);
    expect(ran(calls, 'git commit')).toBe(true);
    expect(calls.some((c) => c.args.join(' ').includes('-A'))).toBe(false);
    // sanctioned gated publish
    expect(ran(calls, 'push-if-green.mjs --assume-green')).toBe(true);
    expect(out.join('\n')).toMatch(/resolved epic 8100-epic/);
  });
});

describe('resolveEpicOnLand — escalate / skip write NOTHING', () => {
  it('escalate → logs the operator notice, no commit, no publish', () => {
    const { exec, calls } = fakeExec({ ok: true, action: 'escalate', epic: '8300-epic', child: '8301-child', reason: 'blocked-by' });
    const { log, out } = logs();
    resolveEpicOnLand(exec, '8301', log, PATHS);
    expect(ran(calls, 'git commit')).toBe(false);
    expect(ran(calls, 'push-if-green')).toBe(false);
    expect(out.join('\n')).toMatch(/needs a human \/resolve/);
  });
  it('skip → nothing committed or published', () => {
    const { exec, calls } = fakeExec({ ok: true, action: 'skip', reason: 'open-children' });
    resolveEpicOnLand(exec, '8201', () => {}, PATHS);
    expect(ran(calls, 'git commit')).toBe(false);
    expect(ran(calls, 'push-if-green')).toBe(false);
  });
});

describe('resolveEpicOnLand — best-effort: a failure never throws and never over-writes', () => {
  it('a failed main sync ABORTS before resolve-parent — never writes on an un-synced tree', () => {
    const { exec, calls } = fakeExec({ ok: true, action: 'resolved', epic: 'e', file: 'backlog/e.md', child: 'c' }, { fail: 'git pull' });
    const { log, out } = logs();
    expect(() => resolveEpicOnLand(exec, '1', log, PATHS)).not.toThrow();
    expect(ran(calls, 'resolve-parent')).toBe(false); // bailed before touching the backlog
    expect(ran(calls, 'git commit')).toBe(false);
    expect(out.join('\n')).toMatch(/main sync failed — skipping/);
  });

  it('resolve-parent throwing is swallowed (no commit, no throw)', () => {
    const { exec, calls } = fakeExec({ ok: true, action: 'resolved', file: 'backlog/x.md' }, { fail: 'resolve-parent' });
    expect(() => resolveEpicOnLand(exec, '1', () => {}, PATHS)).not.toThrow();
    expect(ran(calls, 'git commit')).toBe(false);
  });
  it('a non-ok verdict is surfaced, not acted on', () => {
    const { exec, calls } = fakeExec({ ok: false, error: 'no backlog item #999 on disk' });
    const { log, out } = logs();
    resolveEpicOnLand(exec, '999', log, PATHS);
    expect(ran(calls, 'git commit')).toBe(false);
    expect(out.join('\n')).toMatch(/no backlog item/);
  });
  it('a failed publish does not throw (the commit is local; a re-drain publishes it)', () => {
    const { exec } = fakeExec({ ok: true, action: 'resolved', epic: 'e', file: 'backlog/e.md', child: 'c' }, { fail: 'push-if-green' });
    const { log, out } = logs();
    expect(() => resolveEpicOnLand(exec, '1', log, PATHS)).not.toThrow();
    expect(out.join('\n')).toMatch(/publish failed/);
  });
  it('a failed commit skips the publish and does not throw', () => {
    const { exec, calls } = fakeExec({ ok: true, action: 'resolved', epic: 'e', file: 'backlog/e.md', child: 'c' }, { fail: 'git commit' });
    expect(() => resolveEpicOnLand(exec, '1', () => {}, PATHS)).not.toThrow();
    expect(ran(calls, 'push-if-green')).toBe(false);
  });
});
