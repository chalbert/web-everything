// #4070 — a dispatched agent that reported `started` may not end its turn without the `done`. Pure decision
// plus the real hook process against real on-disk stores (the two stores' own env overrides).
import { afterAll, describe, expect, it } from 'vitest';
import { mkdtempSync, mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';
import { openCompletionRecords, readCompletions, shouldBlockStop } from '../guard-stop-completion-record.mjs';
import { newCompletionRecord } from '../operations/completion-record.mjs';
import { DELIVERY_HOOKS_SETTINGS } from '../operations/deliver-item-wrapper.mjs';

const GUARD = join(dirname(fileURLToPath(import.meta.url)), '..', 'guard-stop-completion-record.mjs');
const ME = 'sess-me';
const rec = (session, status, sessionId = ME) => ({
  ...newCompletionRecord({ session, kind: 'review', pr: '12', sessionId }),
  status,
  ...(status === 'done' ? { outcome: 'verdict-recorded' } : {}),
});

const roots = [];
afterAll(() => { for (const r of roots) rmSync(r, { recursive: true, force: true }); });
function stores({ completions = [], delivery = null } = {}) {
  const root = mkdtempSync(join(tmpdir(), 'guard-stop-completion-'));
  roots.push(root);
  const cdir = join(root, 'completions');
  const ddir = join(root, 'delivery');
  mkdirSync(cdir); mkdirSync(ddir);
  for (const r of completions) writeFileSync(join(cdir, `${r.session}.json`), JSON.stringify(r));
  if (delivery) writeFileSync(join(ddir, `${delivery.session}.json`), JSON.stringify(delivery));
  return { cdir, ddir };
}
function hook(event, { cdir, ddir }, extraEnv = {}) {
  const env = { ...process.env, OPERATION_COMPLETIONS_DIR: cdir, OPERATION_DELIVERY_REPORTS_DIR: ddir, ...extraEnv };
  delete env.DELIVERY_SESSION;
  Object.assign(env, extraEnv);
  return spawnSync(process.execPath, [GUARD], { input: JSON.stringify(event), encoding: 'utf8', env });
}

describe('shouldBlockStop — pure (#4070)', () => {
  it('blocks when this session owns a record still at started, naming the done command', () => {
    const r = shouldBlockStop({ completions: [rec('review-12', 'started')], sessionId: ME });
    expect(r).toMatch(/still `started`/);
    expect(r).toContain('completion-cli.mjs report --session=review-12 --status=done');
  });

  it('allows once the record is done', () => {
    expect(shouldBlockStop({ completions: [rec('review-12', 'done')], sessionId: ME })).toBeNull();
  });

  it("ignores another session's open record, and a legacy record with no sessionId", () => {
    const completions = [rec('review-12', 'started', 'sess-other'), rec('fix-9', 'started', null)];
    expect(openCompletionRecords(completions, ME)).toEqual([]);
    expect(shouldBlockStop({ completions, sessionId: ME })).toBeNull();
  });

  it('never matches when the session id is unknown', () => {
    expect(shouldBlockStop({ completions: [rec('review-12', 'started', null)], sessionId: undefined })).toBeNull();
  });

  it('blocks on an open delivery report', () => {
    const r = shouldBlockStop({ deliveryReport: { session: 'conveyor-4070', status: 'started' }, sessionId: ME });
    expect(r).toContain('delivery-report-cli.mjs report --session=conveyor-4070 --status=done');
  });

  it('lets the harness continuation through, so a stop is blocked at most once', () => {
    expect(shouldBlockStop({ completions: [rec('review-12', 'started')], sessionId: ME, stopHookActive: true })).toBeNull();
  });
});

describe('readCompletions (#4070)', () => {
  it('skips a corrupt record instead of throwing', () => {
    const { cdir } = stores({ completions: [rec('review-12', 'started')] });
    writeFileSync(join(cdir, 'review-13.json'), '{torn');
    expect(readCompletions(cdir).map((r) => r.session)).toEqual(['review-12']);
  });
});

describe('the Stop hook process (#4070)', () => {
  const stop = { hook_event_name: 'Stop', session_id: ME, stop_hook_active: false };

  it('exits 2 with a block decision when the agent stops on an open completion record', () => {
    const run = hook(stop, stores({ completions: [rec('review-12', 'started')] }));
    expect(run.status).toBe(2);
    expect(JSON.parse(run.stdout).decision).toBe('block');
    expect(run.stderr).toContain('--session=review-12');
  });

  it('exits 0 silently once the record is done', () => {
    const run = hook(stop, stores({ completions: [rec('review-12', 'done')] }));
    expect(run.status).toBe(0);
    expect(run.stdout).toBe('');
  });

  it('blocks a v2 delivery agent whose $DELIVERY_SESSION report is still started', () => {
    const at = '2026-09-29T05:37:40.649Z';
    const s = stores({ delivery: {
      v: 1, session: 'conveyor-4070', item: '4070', status: 'started', outcome: null, reason: null,
      filesTouched: null, learning: null, startedAt: at, updatedAt: at,
    } });
    const run = hook(stop, s, { DELIVERY_SESSION: 'conveyor-4070' });
    expect(run.status).toBe(2);
    expect(run.stderr).toContain('--session=conveyor-4070');
  });

  it('fails open on a malformed event', () => {
    const run = spawnSync(process.execPath, [GUARD], { input: 'not json', encoding: 'utf8' });
    expect(run.status).toBe(0);
  });

  it('is registered as a Stop hook in the delivery wrapper hooks-only settings', () => {
    expect(DELIVERY_HOOKS_SETTINGS.hooks.Stop[0].hooks.map((h) => h.command))
      .toContain('node scripts/guard-stop-completion-record.mjs');
  });
});
