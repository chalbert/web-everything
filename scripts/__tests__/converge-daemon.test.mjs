/**
 * @file converge-daemon.test.mjs — proof of the converge daemon's SCHEDULING SUBSTRATE (#2572, ruling R7):
 * `we:scripts/converge-daemon-pass.mjs` (the payload) and `we:scripts/converge-daemon-install.mjs` (the launchd
 * schedule). Both files are IO shells over pure resolvers, and it is the pure half that carries the risk, so
 * that is what this pins:
 *   • the PRIMARY-checkout refusal — a pass runs `git reset --hard`, so pointing the daemon at the operator's
 *     tree would clobber real uncommitted work (#2501 clause 1's forced invariant). Refused in BOTH the pass
 *     (`assertNotPrimary`) and the installer (`installBlockers`), because either one alone leaves a hole.
 *   • the LEDGER wire — the daemon's own clone has an empty gitignored `.conveyor/jury`, so a pass that did not
 *     repoint `CONVEYOR_JURY_DIR` would fold every PR fail-closed to keep-parked and record a soak that looks
 *     healthy and means nothing. The default must land on the PRIMARY tree's ledger, and the plist must carry it.
 *   • the runner ARGV — the wrapper must never construct a flag that could act. `--enforce` is refused by the
 *     runner itself, but the wrapper must not reach for it either (defence in depth, both halves tested).
 *   • plist rendering — a pure string build, so the escaping and the interval land where launchd reads them.
 */
import { describe, it, expect } from 'vitest';
import { join } from 'node:path';

import {
  resolvePassConfig, buildRefreshSteps, buildRunnerArgv, buildPassRecord, assertNotPrimary,
} from '../converge-daemon-pass.mjs';
import {
  LABEL, DEFAULT_INTERVAL_SEC, plistPath, resolveInstallConfig, renderPlist, installBlockers,
} from '../converge-daemon-install.mjs';

const HOME = '/home/op';
/** A config where every path is explicit — no reliance on the ambient machine. */
const ENV = {
  CONVERGE_DAEMON_CLONE: '/clones/we-converge-daemon/lane-1',
  CONVERGE_DAEMON_PRIMARY: '/work/webeverything',
  CONVERGE_DAEMON_STATE_ROOT: '/state/converge',
};

describe('resolvePassConfig', () => {
  it('defaults every path off $HOME when nothing is set', () => {
    const cfg = resolvePassConfig({}, HOME);
    expect(cfg.clone).toBe(join(HOME, 'workspace', '.lanes', 'we-converge-daemon', 'lane-1'));
    expect(cfg.primary).toBe(join(HOME, 'workspace', 'webeverything'));
    expect(cfg.stateRoot).toBe(join(HOME, '.converge-daemon'));
    expect(cfg.logPath).toBe(join(HOME, '.converge-daemon', 'shadow.jsonl'));
  });

  it('defaults the jury dir to the PRIMARY tree, not the clone — the clone\'s copy is always empty', () => {
    const cfg = resolvePassConfig(ENV, HOME);
    expect(cfg.juryDir).toBe('/work/webeverything/.conveyor/jury');
    expect(cfg.juryDir.startsWith(cfg.clone)).toBe(false);
  });

  it('lets the ledger be repointed — the one wire that changes when it becomes a shared store', () => {
    const cfg = resolvePassConfig({ ...ENV, CONVERGE_DAEMON_JURY_DIR: '/mnt/shared/jury' }, HOME);
    expect(cfg.juryDir).toBe('/mnt/shared/jury');
  });

  it('keeps the state root OUTSIDE the clone, so `git clean -fdq` cannot eat the soak record', () => {
    const cfg = resolvePassConfig(ENV, HOME);
    expect(cfg.logPath.startsWith(cfg.clone)).toBe(false);
  });

  it('treats a blank env var as unset rather than resolving it to CWD', () => {
    const cfg = resolvePassConfig({ ...ENV, CONVERGE_DAEMON_REPO: '   ' }, HOME);
    expect(cfg.repo).toBeNull();
  });
});

describe('assertNotPrimary', () => {
  it('refuses when the clone IS the primary checkout', () => {
    const msg = assertNotPrimary({ clone: '/work/webeverything', primary: '/work/webeverything' });
    expect(msg).toMatch(/refusing to run from the PRIMARY checkout/);
  });

  it('refuses through a non-normalised path, not just an identical string', () => {
    const msg = assertNotPrimary({ clone: '/work/webeverything/../webeverything', primary: '/work/webeverything' });
    expect(msg).toMatch(/refusing/);
  });

  it('passes a genuinely separate clone', () => {
    expect(assertNotPrimary({ clone: '/clones/lane-1', primary: '/work/webeverything' })).toBeNull();
  });
});

describe('buildRefreshSteps', () => {
  it('fetches, hard-resets to origin/main and cleans — all scoped to the clone via -C', () => {
    const steps = buildRefreshSteps('/clones/lane-1');
    expect(steps.map((s) => s.join(' '))).toEqual([
      'git -C /clones/lane-1 fetch --quiet origin main',
      'git -C /clones/lane-1 reset --hard --quiet origin/main',
      'git -C /clones/lane-1 clean -fdq',
    ]);
    for (const step of steps) expect(step.slice(0, 3)).toEqual(['git', '-C', '/clones/lane-1']);
  });
});

describe('buildRunnerArgv', () => {
  it('runs the shadow runner in JSON mode', () => {
    expect(buildRunnerArgv({ repo: null })).toEqual(['scripts/review-runner.mjs', '--json']);
  });

  it('passes an explicit repo through', () => {
    expect(buildRunnerArgv({ repo: 'chalbert/frontierui' })).toContain('--repo=chalbert/frontierui');
  });

  it('never constructs a flag that could ACT — no --enforce anywhere in the argv', () => {
    for (const repo of [null, 'chalbert/web-everything']) {
      expect(buildRunnerArgv({ repo }).join(' ')).not.toMatch(/enforce/);
    }
  });
});

describe('buildPassRecord', () => {
  const cfg = { clone: '/clones/lane-1', juryDir: '/work/webeverything/.conveyor/jury' };

  it('folds a real pass into the soak record', () => {
    const rec = buildPassRecord({
      startedAt: '2026-08-08T18:00:00.000Z',
      cfg,
      exitCode: 0,
      summary: { ranPass: true, discovered: 4, clearable: 3, wouldClear: 1, wouldKeepParked: 2, mutations: 0 },
      error: null,
    });
    expect(rec).toMatchObject({ ranPass: true, discovered: 4, wouldClear: 1, wouldKeepParked: 2, mutations: 0 });
    expect(rec.error).toBeNull();
  });

  it('RECORDS a pass that could not run — a gap the readiness predicate cannot see is one it cannot account for', () => {
    const rec = buildPassRecord({
      startedAt: '2026-08-08T18:15:00.000Z',
      cfg,
      exitCode: 0,
      summary: { ranPass: false, reason: 'lease-held', records: [] },
      error: null,
    });
    expect(rec.ranPass).toBe(false);
    expect(rec.reason).toBe('lease-held');
  });

  it('carries a hard failure rather than dropping it', () => {
    const rec = buildPassRecord({ startedAt: 'x', cfg, exitCode: 2, summary: null, error: 'gh exploded' });
    expect(rec.error).toBe('gh exploded');
    expect(rec.ranPass).toBe(false);
  });

  it('records which ledger the pass actually read — the soak is uninterpretable without it', () => {
    const rec = buildPassRecord({ startedAt: 'x', cfg, exitCode: 0, summary: { ranPass: true }, error: null });
    expect(rec.juryDir).toBe('/work/webeverything/.conveyor/jury');
  });
});

describe('resolveInstallConfig', () => {
  it('points the launchd job at the script INSIDE the daemon clone, so a self-update needs no reinstall', () => {
    const cfg = resolveInstallConfig(ENV, HOME, '/usr/bin/node');
    expect(cfg.script).toBe('/clones/we-converge-daemon/lane-1/scripts/converge-daemon-pass.mjs');
    expect(cfg.script.startsWith(cfg.primary)).toBe(false);
  });

  it('defaults to a 15-minute interval and honours a valid override', () => {
    expect(resolveInstallConfig(ENV, HOME, '/usr/bin/node').intervalSec).toBe(DEFAULT_INTERVAL_SEC);
    expect(resolveInstallConfig({ ...ENV, CONVERGE_DAEMON_INTERVAL_SEC: '60' }, HOME, '/usr/bin/node').intervalSec).toBe(60);
  });

  it('falls back rather than rendering a garbage or zero interval into the plist', () => {
    for (const bad of ['0', '-5', 'soon', '']) {
      const cfg = resolveInstallConfig({ ...ENV, CONVERGE_DAEMON_INTERVAL_SEC: bad }, HOME, '/usr/bin/node');
      expect(cfg.intervalSec).toBe(DEFAULT_INTERVAL_SEC);
    }
  });
});

describe('renderPlist', () => {
  const cfg = resolveInstallConfig(ENV, HOME, '/opt/node/bin/node');

  it('renders a periodic StartInterval job, NOT a resident KeepAlive one', () => {
    const xml = renderPlist(cfg);
    expect(xml).toContain(`<key>StartInterval</key><integer>${DEFAULT_INTERVAL_SEC}</integer>`);
    expect(xml).not.toContain('KeepAlive');
  });

  it('carries the ledger wire — without it the daemon reads its clone\'s empty ledger and the soak is a lie', () => {
    expect(renderPlist(cfg)).toContain('<key>CONVERGE_DAEMON_JURY_DIR</key><string>/work/webeverything/.conveyor/jury</string>');
  });

  it('runs the pass from the clone, with the clone as the working directory', () => {
    const xml = renderPlist(cfg);
    expect(xml).toContain('<string>/opt/node/bin/node</string>');
    expect(xml).toContain('<string>/clones/we-converge-daemon/lane-1/scripts/converge-daemon-pass.mjs</string>');
    expect(xml).toContain('<key>WorkingDirectory</key><string>/clones/we-converge-daemon/lane-1</string>');
  });

  it('XML-escapes path values rather than emitting a corrupt plist', () => {
    const xml = renderPlist({ ...cfg, clone: '/clones/a&b<c>' });
    expect(xml).toContain('/clones/a&amp;b&lt;c&gt;');
    expect(xml).not.toContain('/clones/a&b<c>');
  });

  it('omits the repo override entirely when none is configured', () => {
    expect(renderPlist(cfg)).not.toContain('CONVERGE_DAEMON_REPO');
    expect(renderPlist({ ...cfg, repo: 'chalbert/frontierui' })).toContain('<key>CONVERGE_DAEMON_REPO</key><string>chalbert/frontierui</string>');
  });
});

describe('installBlockers', () => {
  const all = () => true;
  const cfg = resolveInstallConfig(ENV, HOME, '/usr/bin/node');

  it('is empty when the clone, the script and the ledger all exist', () => {
    expect(installBlockers(cfg, all)).toEqual([]);
  });

  it('blocks an install pointed at the primary checkout', () => {
    const blockers = installBlockers({ ...cfg, clone: cfg.primary, script: `${cfg.primary}/scripts/converge-daemon-pass.mjs` }, all);
    expect(blockers.join('\n')).toMatch(/PRIMARY checkout/);
  });

  it('blocks a missing clone and names the provision command', () => {
    const blockers = installBlockers(cfg, (p) => p !== cfg.clone);
    expect(blockers.join('\n')).toMatch(/lane-pool\.mjs provision --pool=we-converge-daemon/);
  });

  it('blocks a clone that predates this change rather than scheduling a job that cannot run', () => {
    const blockers = installBlockers(cfg, (p) => p !== cfg.script);
    expect(blockers.join('\n')).toMatch(/no scripts\/converge-daemon-pass\.mjs/);
  });

  it('blocks a missing ledger dir — an absent ledger looks like a working daemon and is not', () => {
    const blockers = installBlockers(cfg, (p) => p !== cfg.juryDir);
    expect(blockers.join('\n')).toMatch(/jury ledger dir/);
  });
});

describe('plistPath', () => {
  it('lands in the per-user LaunchAgents dir under the WE-owned label', () => {
    expect(plistPath(LABEL, HOME)).toBe(join(HOME, 'Library', 'LaunchAgents', 'com.webeverything.converge-daemon.plist'));
  });
});
