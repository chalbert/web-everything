/**
 * Seed smell 2 / #4077 — repeated 401 / "Bad credentials" in the daemon logs, or the GitHub App status file
 * recording a failed apply. 2026-09-24: dispatched bots got 401s while the live smoke gate passed. Diagnosed by
 * `we:scripts/conveyor/github-app-status.mjs` (read-only).
 */
import { MINUTE } from '../health-watch-core.mjs';

export default {
  id: 'bad-credentials',
  scope: 'host',
  cadence: 'every-tick',
  probes: ['daemonLogs'],
  openAfter: 1,
  closeAfter: 3,
  severity: 'high',
  action: 'alert',
  windowMs: 15 * MINUTE,
  minErrors: 3,
  diagnose: { command: 'node', args: ['scripts/conveyor/github-app-status.mjs'], timeoutMs: 15_000 },
  recommendationHint: 'GitHub auth is failing for the daemons — check the App token status and the gh shim.',
  evaluate({ appStatus }, { now, daemons }) {
    const per = {};
    let total = 0;
    for (const [name, mem] of Object.entries(daemons)) {
      const c = (mem.authErrorTimes || []).filter((t) => now - t <= this.windowMs).length;
      if (c) { per[name] = c; total += c; }
    }
    const appBad = appStatus && appStatus.applied === false && !/not-configured|unconfigured/.test(appStatus.reason || '');
    return [{
      subject: 'github-auth',
      breach: total >= this.minErrors || !!appBad,
      measure: { authErrors15m: total, perDaemon: per, appStatus: appStatus ? { applied: appStatus.applied, reason: appStatus.reason, checkedAt: appStatus.checkedAt } : null },
      summary: `${total} 401/Bad-credentials line(s) in 15m${appBad ? `; GitHub App status: not applied (${appStatus.reason})` : ''}.`,
      recommendation: appBad
        ? `The GitHub App token is not being applied (${appStatus.reason}) — run \`node scripts/conveyor/github-app-status.mjs\` for the exact missing permission/repo.`
        : 'Daemons are getting 401s — the token they use is expired or revoked; check the gh shim and App token refresh.',
    }];
  },
};
