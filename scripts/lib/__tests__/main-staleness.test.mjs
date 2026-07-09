/**
 * @file main-staleness.test.mjs — proof of the #2204 fetch-first staleness guard. The git calls are the I/O
 *   boundary (injected `run`); the fresh/auto-ff/warn CLASSIFICATION and the fail-soft behaviour are decided
 *   here and unit-tested without a real repo.
 */
import { describe, it, expect } from 'vitest';
import { classifyStaleness, checkMainStaleness } from '../main-staleness.mjs';

describe('classifyStaleness', () => {
  it('behind 0 → fresh', () => {
    expect(classifyStaleness({ behind: 0, ahead: 0, dirty: false, autoFf: true }).fresh).toBe(true);
  });
  it('behind + clean + not diverged + autoFf → auto-ff', () => {
    expect(classifyStaleness({ behind: 5, ahead: 0, dirty: false, autoFf: true }).action).toBe('auto-ff');
  });
  it('behind + dirty + not diverged → auto-ff (autostash carries the dirty tree)', () => {
    const c = classifyStaleness({ behind: 5, ahead: 0, dirty: true, autoFf: true });
    expect(c.action).toBe('auto-ff');
    expect(c.dirty).toBe(true);
  });
  it('behind + dirty + diverged → warn (a diverged tree can not fast-forward)', () => {
    const c = classifyStaleness({ behind: 5, ahead: 2, dirty: true, autoFf: true });
    expect(c.action).toBe('warn');
    expect(c.warning).toMatch(/diverged/);
  });
  it('behind + diverged (ahead>0) → warn, not auto-ff', () => {
    const c = classifyStaleness({ behind: 5, ahead: 1, dirty: false, autoFf: true });
    expect(c.action).toBe('warn');
    expect(c.warning).toMatch(/diverged/);
  });
  it('behind but autoFf disabled → warn', () => {
    expect(classifyStaleness({ behind: 5, ahead: 0, dirty: false, autoFf: false }).action).toBe('warn');
  });
});

// A scripted git runner: canned result per subcommand.
function scripted(map, calls = []) {
  return (args) => { calls.push(args); const h = map[args[0]]; return { status: 0, stdout: '', stderr: '', ...((typeof h === 'function' ? h(args) : h) || {}) }; };
}

describe('checkMainStaleness (fail-soft IO)', () => {
  it('a fetch failure → offline (never hard-fails a read)', () => {
    const run = scripted({ fetch: { status: 1, stderr: 'could not resolve host' } });
    expect(checkMainStaleness({ run })).toEqual({ offline: true });
  });
  it('local === origin → fresh (no pull)', () => {
    const calls = [];
    const run = scripted({ fetch: { status: 0 }, 'rev-parse': { status: 0, stdout: 'sha1\n' } }, calls);
    expect(checkMainStaleness({ run }).fresh).toBe(true);
    expect(calls.some((a) => a[0] === 'pull')).toBe(false);
  });
  it('behind + clean → auto fast-forwards (pull --ff-only --autostash)', () => {
    const calls = [];
    const run = scripted({
      fetch: { status: 0 },
      'rev-parse': (a) => ({ stdout: a[1] === 'main' ? 'localsha\n' : 'originsha\n' }),
      'rev-list': (a) => ({ stdout: a[2].startsWith('main..') ? '7\n' : '0\n' }), // behind 7, ahead 0
      status: { stdout: '' }, // clean
      pull: { status: 0 },
    }, calls);
    const r = checkMainStaleness({ run });
    expect(r).toMatchObject({ synced: true, behind: 7 });
    expect(calls.find((a) => a[0] === 'pull')).toEqual(['pull', '--ff-only', '--autostash']);
  });
  it('behind + dirty + not diverged → autostash fast-forwards (pull --ff-only --autostash)', () => {
    const calls = [];
    const run = scripted({
      fetch: { status: 0 },
      'rev-parse': (a) => ({ stdout: a[1] === 'main' ? 'localsha\n' : 'originsha\n' }),
      'rev-list': (a) => ({ stdout: a[2].startsWith('main..') ? '3\n' : '0\n' }),
      status: { stdout: ' M claims.json\n' }, // dirty, but not diverged
      pull: { status: 0 },
    }, calls);
    const r = checkMainStaleness({ run });
    expect(r).toMatchObject({ synced: true, behind: 3 });
    expect(calls.find((a) => a[0] === 'pull')).toEqual(['pull', '--ff-only', '--autostash']);
  });
  it('behind + dirty + a failed autostash-ff → warn (fail-soft, e.g. stash-pop conflict)', () => {
    const run = scripted({
      fetch: { status: 0 },
      'rev-parse': (a) => ({ stdout: a[1] === 'main' ? 'l\n' : 'o\n' }),
      'rev-list': (a) => ({ stdout: a[2].startsWith('main..') ? '3\n' : '0\n' }),
      status: { stdout: ' M claims.json\n' },
      pull: { status: 1, stderr: 'conflict in claims.json' },
    });
    expect(checkMainStaleness({ run }).action).toBe('warn');
  });
  it('behind + auto-ff fails → warn (still fail-soft)', () => {
    const run = scripted({
      fetch: { status: 0 },
      'rev-parse': (a) => ({ stdout: a[1] === 'main' ? 'l\n' : 'o\n' }),
      'rev-list': (a) => ({ stdout: a[2].startsWith('main..') ? '2\n' : '0\n' }),
      status: { stdout: '' },
      pull: { status: 1, stderr: 'not possible to fast-forward' },
    });
    expect(checkMainStaleness({ run }).action).toBe('warn');
  });
});
