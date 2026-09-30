/**
 * @file scripts/conveyor/__tests__/guard-1c-mutation-check.test.mjs
 * @description #4331 — proof of the Guard 1(c) mutation gate's own judgment, with an injected `runVitest`
 *   (no nested vitest).
 */
import { describe, it, expect } from 'vitest';
import { run, DEFAULT_MUTATIONS, NAMED_PREFIX } from '../guard-1c-mutation-check.mjs';

const SOURCE = 'a recStartedMs > lastActivityMs b resolveLastActivityMs(session) c';
const t = (name, status) => ({ fullName: `${NAMED_PREFIX}: ${name}`, status, failureMessages: status === 'failed' ? ['AssertionError'] : [] });
const report = (...tests) => ({ testResults: [{ assertionResults: tests }] });
const unit = 'unit';
const pass = 'pass-level wiring';
const allPass = report(t(unit, 'passed'), t('unit 2', 'passed'), t(pass, 'passed'), t(`${pass} 2`, 'passed'));

const fakeVitest = (mutantReports) => (src) => {
  if (src === null) return allPass;
  if (src.includes('false b')) return mutantReports.comparison;
  return mutantReports.wiring;
};

describe('guard-1c-mutation-check run()', () => {
  it('is ok when both mutants are killed by the expected named tests', () => {
    const result = run({
      readSource: () => SOURCE,
      runVitest: fakeVitest({
        comparison: report(t(unit, 'failed'), t('unit 2', 'failed'), t(pass, 'failed'), t(`${pass} 2`, 'failed')),
        wiring: report(t(unit, 'passed'), t('unit 2', 'passed'), t(pass, 'failed'), t(`${pass} 2`, 'failed')),
      }),
    });
    expect(result).toEqual({ ok: true, problems: [] });
  });

  it('fails when a mutant survives (its expected tests still pass)', () => {
    const result = run({
      readSource: () => SOURCE,
      runVitest: fakeVitest({ comparison: allPass, wiring: report(t(pass, 'failed'), t(`${pass} 2`, 'failed')) }),
    });
    expect(result.ok).toBe(false);
    expect(result.problems.join('\n')).toMatch(/comparison.*SURVIVED/);
  });

  it('fails when an injected no-op mutation survives', () => {
    const noop = [{ name: 'noop', find: 'resolveLastActivityMs(session)', replace: 'resolveLastActivityMs(session)', mustKill: () => true }];
    const result = run({ readSource: () => SOURCE, runVitest: () => allPass, mutations: noop });
    expect(result.ok).toBe(false);
    expect(result.problems.join('\n')).toMatch(/noop.*SURVIVED/);
  });

  it('refuses when a search string is absent or ambiguous', () => {
    const absent = run({ readSource: () => 'nothing to mutate', runVitest: () => allPass });
    expect(absent.ok).toBe(false);
    expect(absent.problems.join('\n')).toMatch(/exactly once in the source, found 0/);
    const twice = run({ readSource: () => `${SOURCE} ${SOURCE}`, runVitest: () => allPass });
    expect(twice.ok).toBe(false);
    expect(twice.problems.join('\n')).toMatch(/found 2/);
  });

  it('refuses when fewer than 3 named tests pass unmutated (isolated tests absent)', () => {
    const result = run({ readSource: () => SOURCE, runVitest: () => report(t(unit, 'passed')) });
    expect(result.ok).toBe(false);
    expect(result.problems.join('\n')).toMatch(/unmutated run/);
  });

  it('does not count a mutant whose suite failed to load as killed', () => {
    const result = run({
      readSource: () => SOURCE,
      runVitest: (src) => (src === null ? allPass : { testResults: [{ status: 'failed', assertionResults: [] }] }),
    });
    expect(result.ok).toBe(false);
    expect(result.problems.join('\n')).toMatch(/failed to load/);
  });

  it('default mutations target the two documented source strings', () => {
    expect(DEFAULT_MUTATIONS.map((m) => m.find)).toEqual(['recStartedMs > lastActivityMs', 'resolveLastActivityMs(session)']);
  });
});
