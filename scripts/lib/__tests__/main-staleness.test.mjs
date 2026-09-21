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

// #3474 — `cleanOnly`: the dispatch-safe gate (fast-forward a CLEAN, on-base, non-diverged tree; never autostash).
describe('classifyStaleness — cleanOnly (#3474)', () => {
  const base = { behind: 4, autoFf: true, cleanOnly: true };
  it('behind + clean + on base + not diverged → auto-ff', () => {
    expect(classifyStaleness({ ...base, ahead: 0, dirty: false }).action).toBe('auto-ff');
  });
  it('behind + dirty → warn (reason dirty), NOT auto-ff — the autostash carry is off in this mode', () => {
    expect(classifyStaleness({ ...base, ahead: 0, dirty: true })).toMatchObject({ action: 'warn', reason: 'dirty' });
  });
  it('behind + diverged → warn (reason diverged)', () => {
    expect(classifyStaleness({ ...base, ahead: 2, dirty: false })).toMatchObject({ action: 'warn', reason: 'diverged', ahead: 2 });
  });
  it('behind + HEAD not on base → warn (reason not-on-base)', () => {
    expect(classifyStaleness({ ...base, ahead: 0, dirty: false, onBase: false })).toMatchObject({ action: 'warn', reason: 'not-on-base' });
  });
  it('the default (cleanOnly off) is unchanged: dirty still auto-ffs', () => {
    expect(classifyStaleness({ behind: 4, ahead: 0, dirty: true, autoFf: true }).action).toBe('auto-ff');
  });
});

describe('checkMainStaleness — cleanOnly (#3474)', () => {
  const behind = (over = {}, calls = []) => scripted({
    fetch: { status: 0 },
    'rev-parse': (a) => ({ stdout: a[1] === 'main' ? 'l\n' : 'o\n' }),
    'rev-list': (a) => ({ stdout: a[2].startsWith('main..') ? '2\n' : '0\n' }),
    'symbolic-ref': { stdout: 'main\n' },
    status: { stdout: '' },
    merge: { status: 0 },
    ...over,
  }, calls);
  it('clean + on main → `merge --ff-only origin/main`, never `pull`', () => {
    const calls = [];
    expect(checkMainStaleness({ cleanOnly: true, run: behind({}, calls) })).toEqual({ synced: true, behind: 2 });
    expect(calls.find((a) => a[0] === 'merge')).toEqual(['merge', '--ff-only', 'origin/main']);
    expect(calls.some((a) => a[0] === 'pull')).toBe(false);
  });
  it('dirty → warn with reason dirty, and neither merge nor pull is run', () => {
    const calls = [];
    const r = checkMainStaleness({ cleanOnly: true, run: behind({ status: { stdout: ' M a.txt\n' } }, calls) });
    expect(r).toMatchObject({ action: 'warn', reason: 'dirty', behind: 2 });
    expect(calls.some((a) => a[0] === 'merge' || a[0] === 'pull')).toBe(false);
  });
  it('HEAD on another branch (or detached) → warn with reason not-on-base, no merge', () => {
    const calls = [];
    expect(checkMainStaleness({ cleanOnly: true, run: behind({ 'symbolic-ref': { stdout: 'lane/x\n' } }, calls) })).toMatchObject({ reason: 'not-on-base' });
    expect(checkMainStaleness({ cleanOnly: true, run: behind({ 'symbolic-ref': { status: 128 } }, calls) })).toMatchObject({ reason: 'not-on-base' });
    expect(calls.some((a) => a[0] === 'merge')).toBe(false);
  });
  it('a failing merge → warn with reason ff-failed carrying git\'s own message', () => {
    const r = checkMainStaleness({ cleanOnly: true, run: behind({ merge: { status: 128, stderr: 'fatal: Not possible to fast-forward\n' } }) });
    expect(r).toMatchObject({ action: 'warn', reason: 'ff-failed', detail: 'fatal: Not possible to fast-forward' });
  });
});
