/**
 * @file scripts/conveyor/health-smells/index.mjs
 * @description #4077 — the smell registry: one file per smell, listed here. A smell is data plus one pure
 * `evaluate(probes, ctx)` returning `[{subject, breach, measure, summary, recommendation}]`:
 *   id, scope (host|repo), cadence (every-tick|gh), probes (the named IO reads the shell must supply — a smell
 *   whose probe did not run this tick is skipped, so its episodes do not move), openAfter/closeAfter
 *   (hysteresis), severity, action (alert|investigate|file), optional `diagnose` (a read-only command the shell
 *   runs with a hard timeout when an episode opens).
 */
import daemonSilent from './daemon-silent.mjs';
import daemonOwedNoDispatch from './daemon-owed-no-dispatch.mjs';
import cloneStale from './clone-stale.mjs';
import redPrUnattended from './red-pr-unattended.mjs';
import badCredentials from './bad-credentials.mjs';
import laneStarvation from './lane-starvation.mjs';
import healthTickOverrun from './health-tick-overrun.mjs';
import heavyQueueWait from './heavy-queue-wait.mjs';
import staleClaim from './stale-claim.mjs';
import claudeAuthExpired from './claude-auth-expired.mjs';
import machineOverload from './machine-overload.mjs';
import dispatchPermissionStall from './dispatch-permission-stall.mjs';

export const SMELLS = Object.freeze([
  daemonSilent, daemonOwedNoDispatch, cloneStale, redPrUnattended, badCredentials, laneStarvation, healthTickOverrun, heavyQueueWait, staleClaim,
  claudeAuthExpired, machineOverload, dispatchPermissionStall,
]);
