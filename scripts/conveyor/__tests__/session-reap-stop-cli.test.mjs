/**
 * @file scripts/conveyor/__tests__/session-reap-stop-cli.test.mjs
 * @description The STOP mechanics through the REAL reaper CLI (split out of `session-reaper-cli.test.mjs`): the transient
 *   `claude stop` retry (WE #3479, found live 2026-09-04) and the #77683 `clear-stuck-session` repair driven by the tick itself.
 *   Only `claude` / `gh` / `ps` are stubbed (see `helpers/session-reaper-cli-harness.mjs`).
 */

import { chmodSync, existsSync, mkdirSync, mkdtempSync, readdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, it, expect } from 'vitest';
import { EXEC_TIMEOUT_MS, argvFile, binDir, installReaperCliHarness, makeBacklogDir, runReaperCli } from './helpers/session-reaper-cli-harness.mjs';

installReaperCliHarness();

describe('the stop loop retries a transient `claude stop` failure — WE #3479, found live 2026-09-04', () => {
  it('recovers within the retry budget: 2 transient failures then success ⇒ clean pass, 3 real `stop` calls', () => {
    const agents = JSON.stringify([{ id: 'flaky01', sessionId: 'flaky-01-full-uuid', kind: 'background', state: 'done', name: 'conveyor-1' }]);
    const out = runReaperCli(['--json'], { agents, env: { STUB_STOP_FAIL_TIMES: '2' } });
    const report = JSON.parse(out);
    // Recovered — counts as a real stop, no failure at all, despite two underlying `claude stop` errors.
    expect(report.stopped).toBe(1);
    expect(report.failures).toBe(0);
    const calls = readFileSync(argvFile, 'utf8').trim().split('\n');
    expect(calls).toEqual(['agents --json --all', 'stop flaky01', 'stop flaky01', 'stop flaky01']);
  }, EXEC_TIMEOUT_MS);

  it('a failure that never clears is still a real failure after exhausting the retry budget — bounded, not silent', () => {
    const agents = JSON.stringify([{ id: 'stuck01', sessionId: 'stuck-01-full-uuid', kind: 'background', state: 'done', name: 'conveyor-2' }]);
    let stderr = '';
    let status = 0;
    try {
      // `--no-clear-stuck`: this case is about the RETRY budget alone (WE #3479) — the #77683 repair path is
      // its own, separate behaviour (see the "clear-stuck-session repair" describe block below), and this
      // fixture's stubbed `claude` answers every `agents --json --all` call identically regardless of which
      // caller asked, so leaving the repair enabled here would just add a second, unrelated listing call to
      // assert around without changing what THIS test is about.
      runReaperCli(['--json', '--no-clear-stuck'], { agents, env: { STUB_STOP_FAIL_TIMES: '99' } });
    } catch (e) {
      stderr = String(e.stderr || '');
      status = e.status;
    }
    expect(status).toBe(1);
    expect(stderr).toMatch(/stop failed after 3 attempts/);
    // Exactly 3 attempts — the retry budget bounds it, it never spins forever on a truly stuck candidate.
    const calls = readFileSync(argvFile, 'utf8').trim().split('\n');
    expect(calls).toEqual(['agents --json --all', 'stop stuck01', 'stop stuck01', 'stop stuck01']);
  }, EXEC_TIMEOUT_MS);
});

describe('the #77683 repair — clear-stuck-session driven BY THE TICK ITSELF, no human in the loop', () => {
  // A stub `ps`, ON TOP OF the outer `beforeEach`'s `claude`/`gh` — `clear-stuck-session-io.mjs`'s reader falls
  // back to a real `ps aux` scan for liveness whenever the listing row carries no `pid` (the known-stuck shape
  // never does — see that file's own header), and this describe block's PATH holds nothing else a real `ps`
  // could resolve to. Prints one harmless, unrelated line, so the scan reports `pidAlive: false` — never a real
  // system `ps`, never containing the fixture's own full session id.
  beforeEach(() => {
    const psStub = join(binDir, 'ps');
    writeFileSync(psStub, '#!/bin/sh\nprintf \'USER 1 0.0 0.0 0 0 ?? S 12:00 0:00 not-a-real-session\\n\'\n');
    chmodSync(psStub, 0o755);
  });

  let backlogDir;
  let configDir;
  let runsDir;
  afterEach(() => {
    if (backlogDir) rmSync(backlogDir, { recursive: true, force: true });
    if (configDir) rmSync(configDir, { recursive: true, force: true });
    if (runsDir) rmSync(runsDir, { recursive: true, force: true });
    backlogDir = configDir = runsDir = undefined;
  });

  /** The #77683 fixture shape: listed, `state: "blocked"`, no live process, no run-store record, `claude
   *  stop`/`rm` genuinely failing (never "No job matching") — matching the operation's own header exactly. */
  function setUpStuckSession({ shortId, itemId }) {
    backlogDir = makeBacklogDir({ [itemId]: 'resolved' }); // session-reaper's OWN ground-truth axis reaps this
    configDir = mkdtempSync(join(tmpdir(), 'we-session-reaper-cli-config-'));
    runsDir = mkdtempSync(join(tmpdir(), 'we-session-reaper-cli-runs-'));

    const jobDir = join(configDir, 'jobs', shortId);
    mkdirSync(jobDir, { recursive: true });
    writeFileSync(join(jobDir, 'state.json'), JSON.stringify({ state: 'blocked' }));

    const agents = JSON.stringify([
      { id: shortId, sessionId: `${shortId}-0000-0000-0000-000000000000`, kind: 'background', state: 'blocked', name: `conveyor-${itemId}` },
    ]);

    return {
      agents,
      env: {
        WE_BACKLOG_DIR: backlogDir,
        CLAUDE_CONFIG_DIR: configDir,
        OPERATION_RUNS_DIR: runsDir,
        // `claude stop` genuinely fails EVERY attempt — the #77683 shape, not the "transient hiccup that
        // eventually clears" shape WE #3479's own tests already cover.
        STUB_STOP_FAIL_TIMES: '99',
      },
      jobDir,
    };
  }

  it('a blocked, ground-truth-reaped session whose `claude stop` genuinely fails is CLEARED end to end', () => {
    const shortId = 'ab7683aa';
    const { agents, env, jobDir } = setUpStuckSession({ shortId, itemId: '9999' });

    const out = runReaperCli(['--json'], { agents, env });
    const report = JSON.parse(out);

    // Reaped via session-reaper's OWN ground-truth axis — unrelated to, and unchanged by, the repair below.
    expect(report.kept).toBe(0);
    // NOT counted as a failure — `clear-stuck-session` actually cleared it once `claude stop` exhausted its
    // own retry budget.
    expect(report.failures).toBe(0);
    expect(report.cleared).toBe(1);
    expect(report.collected).toHaveLength(1);
    expect(report.collected[0]).toMatchObject({ id: shortId, alreadyGone: false, clearedViaClearStuckSession: true });
    expect(typeof report.collected[0].clearStuckRunId).toBe('string');

    // THE ACTUAL FILESYSTEM EFFECT, not merely a reported verdict: the job directory is gone from its original
    // location — quarantined, never deleted (`clear-stuck-session.mjs`'s own header).
    expect(existsSync(jobDir)).toBe(false);
    const quarantineDir = join(configDir, 'jobs', '.cleared');
    const quarantined = readdirSync(quarantineDir).find((n) => n.startsWith(`${shortId}-`));
    expect(quarantined).toBeTruthy();
    expect(existsSync(join(quarantineDir, quarantined, 'state.json'))).toBe(true);

    // THE ORDINARY PATH RAN FIRST AND GENUINELY FAILED — the repair is a FALLBACK, never a substitute for
    // `claude stop`, and only fires once that path is exhausted. Then clear-stuck-session's own reader lists
    // once (`read`), and the move sink verifies once more post-move (`clear-stuck-session-io.mjs#moveJobDirAside`).
    const calls = readFileSync(argvFile, 'utf8').trim().split('\n');
    expect(calls).toEqual([
      'agents --json --all', // session-reaper's own tick listing
      `stop ${shortId}`, `stop ${shortId}`, `stop ${shortId}`, // the retry budget, exhausted
      'agents --json --all', // clear-stuck-session's own `read` step
      'agents --json --all', // moveJobDirAside's post-move verification
    ]);
  }, EXEC_TIMEOUT_MS);

  it('`--no-clear-stuck` disables the repair — the exact prior behaviour, a plain reported failure', () => {
    const shortId = 'ab7683bb';
    const { agents, env, jobDir } = setUpStuckSession({ shortId, itemId: '8888' });

    let stderr = '';
    let status = 0;
    let out = '';
    try {
      out = runReaperCli(['--json', '--no-clear-stuck'], { agents, env });
    } catch (e) {
      stderr = String(e.stderr || '');
      status = e.status;
      out = String(e.stdout || '');
    }
    expect(status).toBe(1);
    expect(stderr).toMatch(/stop failed after 3 attempts/);
    const report = JSON.parse(out);
    expect(report.failures).toBe(1);
    expect(report.cleared).toBe(0);

    // Nothing on disk was touched — the repair never ran at all.
    expect(existsSync(jobDir)).toBe(true);

    // No extra `agents --json --all` beyond the tick's own listing — clear-stuck-session's reader never ran.
    const calls = readFileSync(argvFile, 'utf8').trim().split('\n');
    expect(calls).toEqual(['agents --json --all', `stop ${shortId}`, `stop ${shortId}`, `stop ${shortId}`]);
  }, EXEC_TIMEOUT_MS);

  it('a genuinely-live session (a live pid) is NEVER cleared, even though `claude stop` also fails on it', () => {
    // A DIFFERENT reason `claude stop` can fail: nothing to do with #77683 at all — this session is simply
    // still running. `clear-stuck-session`'s own `assessStuck` must refuse it independently; this reaper's
    // trusted `proceed` must never turn that refusal into a clear.
    const shortId = 'ab7683cc';
    const { agents, env, jobDir } = setUpStuckSession({ shortId, itemId: '7777' });
    // Overwrite the `ps` stub (installed in this describe's own `beforeEach`) so THIS test's scan reports the
    // session as LIVE — its full session id appears in the fake `ps aux` output.
    writeFileSync(
      join(binDir, 'ps'),
      `#!/bin/sh\nprintf 'USER 1 0.0 0.0 0 0 ?? S 12:00 0:00 claude --resume=${shortId}-0000-0000-0000-000000000000\\n'\n`,
    );
    chmodSync(join(binDir, 'ps'), 0o755);

    let stderr = '';
    let status = 0;
    let out = '';
    try {
      out = runReaperCli(['--json'], { agents, env });
    } catch (e) {
      stderr = String(e.stderr || '');
      status = e.status;
      out = String(e.stdout || '');
    }
    expect(status).toBe(1);
    expect(stderr).toMatch(/clear-stuck-session did not confirm it stuck/);
    const report = JSON.parse(out);
    expect(report.failures).toBe(1);
    expect(report.cleared).toBe(0);
    // The job directory is untouched — assessStuck refused, so `planMove` never declared the move effect.
    expect(existsSync(jobDir)).toBe(true);
  }, EXEC_TIMEOUT_MS);
});
