import { describe, it, expect, vi } from 'vitest';
import { landPrepareStamp } from '../prepare-stamp-land.mjs';
import { prepareCardStatus } from '../../conveyor/prepare-result.mjs';

const sections = '## Design\nMechanism.\n\n## MVP\nScope.\n\n## Test plan\nRegression.\n\n## Proof plan\nProbe.\n';
const raw = `---\nstatus: open\n---\n${sections}`;
function fixture({ source = false, missing = false, failStamp = false } = {}) {
  let card = missing ? '---\nstatus: open\n---\n' : raw;
  const calls = [];
  const deps = {
    acquire: vi.fn(() => ({ path: '/tmp/stamp-lane', lane: 3, holder: 'test' })),
    release: vi.fn(), read: () => card, write: vi.fn(),
    readStatus: async () => ({ path: 'backlog/4544-card.md', ...prepareCardStatus(card),
      pr: source ? { state: 'OPEN', hasSections: true, headRefOid: 'abc', headRefName: 'lane/4544-prepare-test' } : null }),
    run: (cmd, args, cwd) => {
      calls.push({ cmd, args, cwd });
      if (args.includes('prepare-stamp') && !failStamp) card = card.replace('status: open', 'status: open\npreparedDate: "2026-09-30"');
      if (args[0] === 'rev-parse') return 'abc\n';
      if (args[0] === 'show') return card;
      if (args.includes('open-pr')) return JSON.stringify({ findings: { submit: { effects: [
        { type: 'open-pr.submit', status: 'applied', result: { pr: 99 } },
      ] } } });
      return '';
    },
  };
  return { deps, calls };
}

describe('daemon prepare stamp landing', () => {
  it.each([false, true])('runs the sanctioned stamp and verified PR path in the acquired lane (open PR: %s)', async (source) => {
    const { deps, calls } = fixture({ source });
    expect(await landPrepareStamp({ num: '4544' }, deps)).toMatchObject({ status: 'submitted', pr: 99 });
    expect(calls.every((c) => c.cwd === '/tmp/stamp-lane')).toBe(true);
    expect(calls).toContainEqual({ cmd: 'node', args: ['/tmp/stamp-lane/scripts/backlog.mjs', 'prepare-stamp', '4544'], cwd: '/tmp/stamp-lane' });
    expect(calls.find((c) => c.args.includes('open-pr')).args).toContain(source ? '--ref=lane/4544-prepare-test' : '--ref=lane/4544-prepare-stamp');
    expect(calls.findIndex((c) => c.args.includes('verify'))).toBeLessThan(calls.findIndex((c) => c.args.includes('open-pr')));
    expect(deps.release).toHaveBeenCalledOnce();
  });
  it('does not acquire a lane for a result missing sections', async () => {
    const { deps } = fixture({ missing: true });
    await expect(landPrepareStamp({ num: '4544' }, deps)).rejects.toThrow('missing sections');
    expect(deps.acquire).not.toHaveBeenCalled();
  });
  it('refuses to publish when the sanctioned stamp did not take', async () => {
    const { deps, calls } = fixture({ failStamp: true });
    await expect(landPrepareStamp({ num: '4544' }, deps)).rejects.toThrow('did not stamp');
    expect(calls.some((c) => c.args.includes('open-pr'))).toBe(false);
    expect(deps.release).toHaveBeenCalledOnce();
  });
  it('rechecks the sections in the lane and refuses an obsolete observation', async () => {
    const { deps, calls } = fixture();
    deps.read = () => '---\nstatus: open\n---\n';
    await expect(landPrepareStamp({ num: '4544' }, deps)).rejects.toThrow('required sections');
    expect(calls.some((c) => c.args.includes('prepare-stamp'))).toBe(false);
  });
  it('does not reopen a resolved card', async () => {
    const { deps } = fixture();
    deps.read = () => raw.replace('status: open', 'status: resolved');
    await expect(landPrepareStamp({ num: '4544' }, deps)).rejects.toThrow('not open');
  });
});

describe('prepare result shape', () => {
  it('requires content under all four real sections', () => {
    expect(prepareCardStatus(raw).hasSections).toBe(true);
    expect(prepareCardStatus(raw.replace('Probe.', '')).hasSections).toBe(false);
    expect(prepareCardStatus(`---\nstatus: open\n---\n\x60\x60\x60md\n${sections}\x60\x60\x60\n`).hasSections).toBe(false);
    expect(prepareCardStatus(`<!--\n${sections}-->`).hasSections).toBe(false);
  });
});
