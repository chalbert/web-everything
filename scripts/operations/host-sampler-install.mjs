#!/usr/bin/env node
/**
 * @file scripts/operations/host-sampler-install.mjs
 * @description Installs the host sampler as DATA ONLY: generates the launchd plist and writes it to
 * `~/Library/LaunchAgents/com.webeverything.host-sampler.plist`. It NEVER runs `launchctl`; the operator loads
 * it (`print-plist`/`install` print the exact commands). Safe beside a live runner: the job is ONE long-lived
 * `host-sampler.mjs loop` (KeepAlive; the adaptive 30 s / 5 s cadence needs a resident process). It takes its own
 * file locks (`loop.lock` so a second loop exits at once, `sample.lock` per sample), appends only, and shares no
 * mutable state with the runner. A crash is restarted by launchd no faster than `ThrottleInterval`.
 *
 *   host-sampler-install.mjs print-plist [--repo=<checkout>] [--interval=30]
 *   host-sampler-install.mjs install     [--dry-run] [--out=<dir>] [--repo=<checkout>] [--interval=30]
 *   host-sampler-install.mjs uninstall   [--dry-run] [--out=<dir>]     (removes the plist file only)
 *   host-sampler-install.mjs status      [--out=<dir>]                 (read-only; asks launchctl if it is loaded)
 *
 * `--repo` MUST be a checkout that outlives this command (the plist embeds its absolute path): install from the
 * checkout you keep, never a throwaway clone. The job is deliberately NOT niced: the spin probe measures how
 * promptly a normal-priority process is scheduled, and a niced sampler would over-report contention.
 */
import { spawnSync } from 'node:child_process';
import { existsSync, mkdirSync, readFileSync, renameSync, unlinkSync, writeFileSync } from 'node:fs';
import { homedir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

export const LABEL = 'com.webeverything.host-sampler';
export const DEFAULT_INTERVAL = 30;
const HERE_REPO = resolve(dirname(fileURLToPath(import.meta.url)), '..', '..');

const esc = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

/**
 * PURE. Build the plist XML. All inputs explicit so the output is byte-deterministic.
 * @param {{nodePath:string, repoRoot:string, home:string, intervalSec?:number, logDir?:string, pathEnv?:string}} o
 */
export function buildPlist({ nodePath, repoRoot, home, intervalSec = DEFAULT_INTERVAL, logDir = join(home, 'Library', 'Logs', 'webeverything'), pathEnv }) {
  const pathValue = pathEnv ?? [dirname(nodePath), '/opt/homebrew/bin', '/usr/local/bin', '/usr/bin', '/bin', '/usr/sbin', '/sbin'].filter((p, i, a) => a.indexOf(p) === i).join(':');
  const args = [nodePath, join(repoRoot, 'scripts', 'operations', 'host-sampler.mjs'), 'loop', `--interval=${Math.max(5, Math.floor(intervalSec))}`];
  const argXml = args.map((a) => `    <string>${esc(a)}</string>`).join('\n');
  return `<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
  <key>Label</key>
  <string>${LABEL}</string>
  <key>ProgramArguments</key>
  <array>
${argXml}
  </array>
  <key>WorkingDirectory</key>
  <string>${esc(repoRoot)}</string>
  <key>RunAtLoad</key>
  <true/>
  <key>KeepAlive</key>
  <true/>
  <key>ThrottleInterval</key>
  <integer>30</integer>
  <key>EnvironmentVariables</key>
  <dict>
    <key>PATH</key>
    <string>${esc(pathValue)}</string>
    <key>HOME</key>
    <string>${esc(home)}</string>
  </dict>
  <key>StandardOutPath</key>
  <string>${esc(join(logDir, 'host-sampler.out.log'))}</string>
  <key>StandardErrorPath</key>
  <string>${esc(join(logDir, 'host-sampler.err.log'))}</string>
</dict>
</plist>
`;
}

/** The exact commands the operator runs. PURE. */
export function launchctlCommands(plistPath) {
  return {
    load: `launchctl bootstrap gui/$(id -u) ${plistPath}`,
    unload: `launchctl bootout gui/$(id -u)/${LABEL}`,
    check: `launchctl print gui/$(id -u)/${LABEL}`,
  };
}

export function plistPathFor(outDir) { return join(outDir, `${LABEL}.plist`); }

/** Write the plist atomically. Returns what it did; `dryRun` writes nothing. */
export function installPlist({ outDir, plist, dryRun = false }) {
  const file = plistPathFor(outDir);
  if (dryRun) return { file, wrote: false, changed: !existsSync(file) || readFileSync(file, 'utf8') !== plist };
  mkdirSync(outDir, { recursive: true });
  const tmp = `${file}.${process.pid}.tmp`;
  writeFileSync(tmp, plist);
  renameSync(tmp, file);
  return { file, wrote: true, changed: true };
}

export function uninstallPlist({ outDir, dryRun = false }) {
  const file = plistPathFor(outDir);
  const existed = existsSync(file);
  if (existed && !dryRun) unlinkSync(file);
  return { file, existed, removed: existed && !dryRun };
}

export function main(argv = process.argv.slice(2), env = process.env) {
  const cmd = argv.find((a) => !a.startsWith('--')) || 'status';
  const val = (n, d) => { const a = argv.find((x) => x.startsWith(`--${n}=`)); return a ? a.slice(n.length + 3) : d; };
  const home = env.HOME || homedir();
  const outDir = resolve(val('out', join(home, 'Library', 'LaunchAgents')));
  const repoRoot = resolve(val('repo', HERE_REPO));
  const intervalSec = Number(val('interval', DEFAULT_INTERVAL)) || DEFAULT_INTERVAL;
  const dryRun = argv.includes('--dry-run');
  const plist = buildPlist({ nodePath: process.execPath, repoRoot, home, intervalSec });
  const cmds = launchctlCommands(plistPathFor(outDir));
  const w = (s) => process.stdout.write(`${s}\n`);

  if (cmd === 'print-plist') { process.stdout.write(plist); return 0; }
  if (cmd === 'install') {
    const r = installPlist({ outDir, plist, dryRun });
    w(dryRun ? `dry-run: would write ${r.file} (${r.changed ? 'new or changed' : 'identical'})` : `wrote ${r.file}`);
    w('NOT loaded. The operator loads it:');
    w(`  ${cmds.load}`);
    w(`  ${cmds.check}     # confirm`);
    w(`  unload: ${cmds.unload}`);
    return 0;
  }
  if (cmd === 'uninstall') {
    const r = uninstallPlist({ outDir, dryRun });
    w(r.existed ? (dryRun ? `dry-run: would remove ${r.file}` : `removed ${r.file}`) : `nothing to remove at ${r.file}`);
    w(`If it is loaded, unload it first: ${cmds.unload}`);
    return 0;
  }
  if (cmd === 'status') {
    const file = plistPathFor(outDir);
    const present = existsSync(file);
    w(`plist: ${present ? file : `absent (${file})`}`);
    if (present) w(`plist matches this checkout's expected content: ${readFileSync(file, 'utf8') === plist ? 'yes' : 'no (different repo/interval/node path)'}`);
    const uid = typeof process.getuid === 'function' ? process.getuid() : null;
    const r = uid == null ? null : spawnSync('launchctl', ['print', `gui/${uid}/${LABEL}`], { encoding: 'utf8' });
    w(`launchd: ${r && r.status === 0 ? 'loaded' : 'not loaded'}`);
    return 0;
  }
  process.stderr.write('usage: host-sampler-install.mjs print-plist|install|uninstall|status [--dry-run] [--out=<dir>] [--repo=<checkout>] [--interval=30]\n');
  return 2;
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) process.exitCode = main();
