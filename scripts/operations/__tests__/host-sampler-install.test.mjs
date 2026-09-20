import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { spawnSync } from 'node:child_process';
import { existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { LABEL, buildPlist, installPlist, launchctlCommands, plistPathFor, uninstallPlist } from '../host-sampler-install.mjs';

const OPTS = { nodePath: '/Users/u/.nvm/versions/node/v22.1.0/bin/node', repoRoot: '/Users/u/workspace/webeverything', home: '/Users/u', intervalSec: 30 };
let d;
beforeEach(() => { d = mkdtempSync(join(tmpdir(), 'host-sampler-plist-')); });
afterEach(() => { rmSync(d, { recursive: true, force: true }); });

describe('buildPlist', () => {
  it('is deterministic and carries a KeepAlive `loop` invocation, explicit PATH, and log paths', () => {
    const p = buildPlist(OPTS);
    expect(buildPlist(OPTS)).toBe(p);
    expect(p).toContain(`<string>${LABEL}</string>`);
    expect(p).toContain('<string>loop</string>');
    expect(p).toContain('<string>--interval=30</string>');
    expect(p).toContain('<key>KeepAlive</key>\n  <true/>');
    expect(p).toContain('<key>ThrottleInterval</key>');
    expect(p).not.toContain('StartInterval');
    expect(p).toContain('/Users/u/workspace/webeverything/scripts/operations/host-sampler.mjs');
    expect(p).toContain('<key>PATH</key>');
    expect(p).toContain('/Users/u/.nvm/versions/node/v22.1.0/bin:');
    expect(p).toContain('/Users/u/Library/Logs/webeverything/host-sampler.out.log');
    expect(p).toContain('/Users/u/Library/Logs/webeverything/host-sampler.err.log');
    expect(p).not.toContain('<key>Nice</key>');
  });

  it('escapes XML metacharacters in paths', () => {
    expect(buildPlist({ ...OPTS, repoRoot: '/Users/u/a&b<c>' })).toContain('/Users/u/a&amp;b&lt;c&gt;/scripts');
  });

  it('clamps a silly interval to a floor', () => {
    expect(buildPlist({ ...OPTS, intervalSec: 1 })).toContain('<string>--interval=5</string>');
  });

  it('passes plutil -lint', () => {
    const probe = spawnSync('plutil', ['-help'], { encoding: 'utf8' });
    if (probe.error) return; // not macOS — nothing to lint with
    const f = join(d, 'x.plist');
    writeFileSync(f, buildPlist(OPTS));
    const r = spawnSync('plutil', ['-lint', f], { encoding: 'utf8' });
    expect(r.stdout + r.stderr).toMatch(/OK/);
    expect(r.status).toBe(0);
  });
});

describe('install / uninstall are data-only', () => {
  it('writes the plist to --out and never loads it; dry-run writes nothing', () => {
    const plist = buildPlist(OPTS);
    const dry = installPlist({ outDir: d, plist, dryRun: true });
    expect(dry).toMatchObject({ wrote: false, changed: true });
    expect(existsSync(plistPathFor(d))).toBe(false);
    const real = installPlist({ outDir: d, plist });
    expect(real.wrote).toBe(true);
    expect(readFileSync(plistPathFor(d), 'utf8')).toBe(plist);
    expect(installPlist({ outDir: d, plist, dryRun: true }).changed).toBe(false);
  });

  it('uninstall removes only the plist file', () => {
    installPlist({ outDir: d, plist: buildPlist(OPTS) });
    expect(uninstallPlist({ outDir: d, dryRun: true })).toMatchObject({ existed: true, removed: false });
    expect(uninstallPlist({ outDir: d })).toMatchObject({ existed: true, removed: true });
    expect(existsSync(plistPathFor(d))).toBe(false);
    expect(uninstallPlist({ outDir: d })).toMatchObject({ existed: false });
  });

  it('prints the exact launchctl commands for the operator', () => {
    const c = launchctlCommands('/Users/u/Library/LaunchAgents/com.webeverything.host-sampler.plist');
    expect(c.load).toBe('launchctl bootstrap gui/$(id -u) /Users/u/Library/LaunchAgents/com.webeverything.host-sampler.plist');
    expect(c.unload).toBe('launchctl bootout gui/$(id -u)/com.webeverything.host-sampler');
  });
});
