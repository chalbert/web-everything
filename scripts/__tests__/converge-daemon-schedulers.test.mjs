/**
 * @file converge-daemon-schedulers.test.mjs — the scheduler half renders the same config for either host init,
 *   and refuses honestly where neither applies. Pure over injected cfg / platform / probes; no io.
 */
import { describe, it, expect } from 'vitest';
import { renderSystemdUnits, systemdUnitNames, detectScheduler } from '../lib/converge-daemon-schedulers.mjs';

const cfg = {
  label: 'com.webeverything.converge-daemon',
  node: '/usr/bin/node',
  script: '/srv/we-daemon/scripts/converge-daemon-pass.mjs',
  clone: '/srv/we-daemon',
  primary: '/home/n/workspace/webeverything',
  stateRoot: '/home/n/.we-converge',
  juryDir: '/home/n/workspace/webeverything/.conveyor/jury',
  stdoutPath: '/home/n/.we-converge/daemon.log',
  intervalSec: 900,
  repo: 'chalbert/web-everything',
};

describe('systemdUnitNames', () => {
  it('derives both unit names from the one label', () => {
    expect(systemdUnitNames(cfg.label)).toEqual({
      service: 'com.webeverything.converge-daemon.service',
      timer: 'com.webeverything.converge-daemon.timer',
    });
  });
});

describe('renderSystemdUnits', () => {
  it('runs the pass from the daemon clone, never the primary checkout', () => {
    const { service } = renderSystemdUnits(cfg);
    expect(service).toContain(`WorkingDirectory=${cfg.clone}`);
    expect(service).toContain(`ExecStart=${cfg.node} ${cfg.script}`);
    expect(service).not.toContain(cfg.primary.concat('\n'));
  });

  // Without this the daemon folds against its own clone's empty ledger and records keep-parked for every PR —
  // a soak that looks like it worked and means nothing. Same wire the plist carries.
  it('carries the jury ledger wire', () => {
    expect(renderSystemdUnits(cfg).service).toContain(`Environment="CONVERGE_DAEMON_JURY_DIR=${cfg.juryDir}"`);
  });

  it('omits the repo variable when the config has no repo', () => {
    const { service } = renderSystemdUnits({ ...cfg, repo: null });
    expect(service).not.toContain('CONVERGE_DAEMON_REPO');
  });

  // systemd splits an unquoted Environment= value on whitespace, so a path with a space would silently
  // truncate — and a truncated clone path is a daemon that resets the wrong directory.
  it('quotes and escapes environment values so a path with a space survives', () => {
    const { service } = renderSystemdUnits({ ...cfg, clone: '/srv/we daemon' });
    expect(service).toContain('Environment="CONVERGE_DAEMON_CLONE=/srv/we daemon"');
  });

  it('escapes a quote inside a path rather than ending the value early', () => {
    const { service } = renderSystemdUnits({ ...cfg, stateRoot: '/home/n/we"state' });
    expect(service).toContain('Environment="CONVERGE_DAEMON_STATE_ROOT=/home/n/we\\"state"');
  });

  // Measured from the END of the last run, so a pass slower than the interval cannot stack on itself.
  it('paces from the previous run rather than the wall clock', () => {
    const { timer } = renderSystemdUnits(cfg);
    expect(timer).toContain(`OnUnitInactiveSec=${cfg.intervalSec}s`);
    expect(timer).not.toContain('OnCalendar');
  });

  it('fires the service the label names, and installs into timers.target', () => {
    const { timer } = renderSystemdUnits(cfg);
    expect(timer).toContain(`Unit=${cfg.label}.service`);
    expect(timer).toContain('WantedBy=timers.target');
  });

  // A oneshot mirrors launchd's StartInterval; a Restart=always service would buy resident supervision the
  // shadow era has no use for.
  it('is a oneshot, not a resident service', () => {
    expect(renderSystemdUnits(cfg).service).toContain('Type=oneshot');
  });
});

describe('detectScheduler', () => {
  it('keeps macOS on launchd', () => {
    expect(detectScheduler('darwin')).toEqual({ scheduler: 'launchd', reason: null });
  });

  it('uses systemd on a Linux host that has it', () => {
    expect(detectScheduler('linux', (p) => p === '/run/systemd/system').scheduler).toBe('systemd');
  });

  // An init-less container should get a refusal naming what it found — not a unit file nothing will read.
  it('refuses on Linux without systemd, and names the fallback', () => {
    const { scheduler, reason } = detectScheduler('linux', () => false);
    expect(scheduler).toBeNull();
    expect(reason).toMatch(/cron|supervisor/);
  });

  it('refuses an unsupported platform by name', () => {
    expect(detectScheduler('win32', () => true).reason).toMatch(/win32/);
  });
});
