#!/usr/bin/env node
/**
 * converge-daemon-install.mjs — the SCHEDULE half of the converge daemon substrate (#2572, ruling R7).
 *
 * WHERE THE DAEMON RUNS (the R7 ruling, operator 2026-08-08): a launchd job on the operator's Mac, sibling to
 * the already-resident drain daemon (`com.plateau.drain-daemon`), running from its OWN dedicated clone. The
 * binding reason is AUTH, not convenience: the enforce-era pass spawns the `claude` CLI on the operator's
 * SUBSCRIPTION, and #2444 ([#agent-runner-cli-backend]) settled that SDK-on-subscription is broken rather than
 * merely worse — so the daemon runs where that credential lives. The cost is honest and accepted: it only runs
 * while the Mac is awake.
 *
 * WHAT THIS IS NOT: a claim that local is the end state. The two things pinning it to this Mac are the
 * subscription credential (not fixable now) and the jury ledger living on a working tree's disk (fixable, and
 * filed separately). When the ledger becomes a shared store, `CONVERGE_DAEMON_JURY_DIR` is the only wire that
 * changes and the shadow half could run anywhere — including as a scheduled CI job, since it spends no model
 * context at all. This installer is deliberately small so that migration is cheap, not so that it is permanent.
 *
 * WHY `StartInterval` AND NOT `KeepAlive`: the shadow pass is a one-shot that exits, and it holds its own TTL
 * singleton lease, so a periodic fire is the entire daemon. The drain daemon's resident `KeepAlive` shape
 * (#2501 Fork B) becomes necessary only at the enforce flip, when a pass spawns a panel and an editor subagent
 * and wants to survive across them. Buying that supervision now would be paying for a phase we have not
 * reached.
 *
 * Usage:
 *   node scripts/converge-daemon-install.mjs print      # render the plist to stdout, touch nothing
 *   node scripts/converge-daemon-install.mjs install    # write ~/Library/LaunchAgents/<label>.plist + bootstrap
 *   node scripts/converge-daemon-install.mjs status     # is it loaded? where does it log?
 *   node scripts/converge-daemon-install.mjs uninstall  # bootout + remove the plist
 */
import { spawnSync } from 'node:child_process';
import { existsSync, mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { homedir } from 'node:os';
import { join, resolve } from 'node:path';

import { resolvePassConfig } from './converge-daemon-pass.mjs';

/** Labelled by the repo that OWNS the source (WE), not by the drain daemon's plateau-app prefix. */
export const LABEL = 'com.webeverything.converge-daemon';
/** 15 minutes. The pass is read-only `gh` traffic against a handful of parked PRs — a tighter interval buys no
 *  freshness that matters and just burns API budget. The drain daemon's 60 s is a LANDING loop; this is not. */
export const DEFAULT_INTERVAL_SEC = 900;

/** XML-escape a plist string value. Paths with `&` are rare but a silently-corrupt plist is worse than rare. */
function esc(s) {
  return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

/**
 * The plist path for a label. PURE.
 * @param {string} [label]
 * @param {string} [home]
 * @returns {string}
 */
export function plistPath(label = LABEL, home = homedir()) {
  return join(home, 'Library', 'LaunchAgents', `${label}.plist`);
}

/**
 * Resolve the install config — the pass config plus the launchd-only bits. PURE.
 * @param {Record<string,string|undefined>} [env]
 * @param {string} [home]
 * @param {string} [nodePath]
 * @returns {object}
 */
export function resolveInstallConfig(env = process.env, home = homedir(), nodePath = process.execPath) {
  const pass = resolvePassConfig(env, home);
  const rawInterval = Number(env.CONVERGE_DAEMON_INTERVAL_SEC);
  return {
    ...pass,
    label: LABEL,
    node: nodePath,
    // The daemon runs the script FROM ITS OWN CLONE — so a self-update (the pass's `reset --hard origin/main`)
    // takes effect on the next fire with no reinstall. Pointing this at the primary checkout would make the
    // operator's working tree the daemon's source, which is exactly what #2501 clause 1 forbids.
    script: join(pass.clone, 'scripts', 'converge-daemon-pass.mjs'),
    intervalSec: Number.isFinite(rawInterval) && rawInterval > 0 ? Math.floor(rawInterval) : DEFAULT_INTERVAL_SEC,
    stdoutPath: join(pass.stateRoot, 'daemon.log'),
  };
}

/**
 * Render the launchd plist. PURE — every input is in `cfg`, so the rendering is testable without touching
 * `~/Library/LaunchAgents`.
 * @param {object} cfg
 * @returns {string}
 */
export function renderPlist(cfg) {
  const envPairs = [
    ['PATH', `${resolve(cfg.node, '..')}:/opt/homebrew/bin:/usr/local/bin:/usr/bin:/bin:/usr/sbin:/sbin`],
    ['CONVERGE_DAEMON_CLONE', cfg.clone],
    ['CONVERGE_DAEMON_PRIMARY', cfg.primary],
    ['CONVERGE_DAEMON_STATE_ROOT', cfg.stateRoot],
    // The ledger wire (see converge-daemon-pass.mjs) — WITHOUT this the daemon reads its own clone's empty
    // `.conveyor/jury` and every PR folds fail-closed, so the soak would record a wall of keep-parked and mean
    // nothing. Read-only: the daemon never writes into the primary tree.
    ['CONVERGE_DAEMON_JURY_DIR', cfg.juryDir],
  ];
  if (cfg.repo) envPairs.push(['CONVERGE_DAEMON_REPO', cfg.repo]);

  const envXml = envPairs
    .map(([k, v]) => `    <key>${esc(k)}</key><string>${esc(v)}</string>`)
    .join('\n');

  return `<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
  <key>Label</key><string>${esc(cfg.label)}</string>
  <key>ProgramArguments</key>
  <array>
    <string>${esc(cfg.node)}</string>
    <string>${esc(cfg.script)}</string>
  </array>
  <key>WorkingDirectory</key><string>${esc(cfg.clone)}</string>
  <key>RunAtLoad</key><true/>
  <key>StartInterval</key><integer>${cfg.intervalSec}</integer>
  <key>StandardOutPath</key><string>${esc(cfg.stdoutPath)}</string>
  <key>StandardErrorPath</key><string>${esc(cfg.stdoutPath)}</string>
  <key>EnvironmentVariables</key>
  <dict>
${envXml}
  </dict>
</dict>
</plist>
`;
}

/**
 * The preflight failures that must block an install, as messages. PURE (the caller supplies the existence
 * checks) so the whole refusal set is testable.
 * @param {object} cfg
 * @param {(p:string)=>boolean} exists
 * @returns {string[]}
 */
export function installBlockers(cfg, exists) {
  const out = [];
  if (resolve(cfg.clone) === resolve(cfg.primary)) {
    out.push(`the daemon clone resolves to the PRIMARY checkout (${cfg.primary}) — a pass runs git reset --hard there. Set CONVERGE_DAEMON_CLONE.`);
  }
  if (!exists(cfg.clone)) {
    out.push(`no clone at ${cfg.clone} — provision it: node scripts/lane-pool.mjs provision --pool=we-converge-daemon --count=1`);
  } else if (!exists(cfg.script)) {
    out.push(`the clone at ${cfg.clone} has no scripts/converge-daemon-pass.mjs — refresh it to a main that contains this change.`);
  }
  if (!exists(cfg.juryDir)) {
    // NOT fatal on its own, but silence here is how a soak ends up recording nothing: an absent ledger dir
    // folds every PR to keep-parked, which looks like a working daemon and is not.
    out.push(`no jury ledger dir at ${cfg.juryDir} — the shadow fold would keep every PR parked. Run a convergence pass first, or set CONVERGE_DAEMON_JURY_DIR.`);
  }
  return out;
}

// ── the CLI (gated on direct invocation) ──────────────────────────────────────────────────────────────────────
const IS_CLI = process.argv[1] && resolve(process.argv[1]) === resolve(new URL(import.meta.url).pathname);
if (IS_CLI) process.exit(main(process.argv.slice(2)));

function launchctl(...args) {
  return spawnSync('launchctl', args, { encoding: 'utf8' });
}

function main(argv) {
  const cmd = argv.find((a) => !a.startsWith('-')) || 'status';
  const cfg = resolveInstallConfig();
  const target = `gui/${process.getuid()}`;
  const path = plistPath(cfg.label);

  if (cmd === 'print') {
    process.stdout.write(renderPlist(cfg));
    return 0;
  }

  if (cmd === 'status') {
    const listed = launchctl('list', cfg.label);
    process.stdout.write(`${JSON.stringify({
      label: cfg.label,
      loaded: listed.status === 0,
      plist: path,
      plistPresent: existsSync(path),
      clone: cfg.clone,
      juryDir: cfg.juryDir,
      intervalSec: cfg.intervalSec,
      log: cfg.stdoutPath,
      shadowLog: cfg.logPath,
    }, null, 2)}\n`);
    return 0;
  }

  if (cmd === 'uninstall') {
    launchctl('bootout', `${target}/${cfg.label}`);
    try { rmSync(path, { force: true }); } catch { /* already gone */ }
    process.stdout.write(`converge-daemon: booted out and removed ${path}\n`);
    return 0;
  }

  if (cmd !== 'install') {
    process.stderr.write(`usage: converge-daemon-install.mjs <install|uninstall|status|print> [--force]\n`);
    return 2;
  }

  const blockers = installBlockers(cfg, existsSync);
  if (blockers.length && !argv.includes('--force')) {
    process.stderr.write(`converge-daemon: refusing to install —\n${blockers.map((b) => `  · ${b}`).join('\n')}\n`
      + '  (--force installs anyway)\n');
    return 2;
  }

  mkdirSync(cfg.stateRoot, { recursive: true });
  mkdirSync(join(homedir(), 'Library', 'LaunchAgents'), { recursive: true });
  writeFileSync(path, renderPlist(cfg));

  // bootout first so a re-install picks up the new plist; a missing job makes this a no-op, which is fine.
  launchctl('bootout', `${target}/${cfg.label}`);
  const boot = launchctl('bootstrap', target, path);
  if (boot.status !== 0) {
    process.stderr.write(`converge-daemon: wrote ${path} but launchctl bootstrap failed — ${(boot.stderr || '').trim()}\n`);
    return 1;
  }
  process.stdout.write(`converge-daemon: installed ${cfg.label} (every ${cfg.intervalSec}s, from ${cfg.clone})\n`
    + `  shadow log: ${cfg.logPath}\n  stdout/err: ${cfg.stdoutPath}\n`);
  return 0;
}
