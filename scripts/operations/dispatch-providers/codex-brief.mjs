/** Detached Codex sessions consume the same filled repair brief as native Claude. */
import { writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { defaultSpawnDetached, deliveryDispatchLogPath, REPO_ROOT } from '../detached-dispatch.mjs';
import { notApplied } from '../effect-executor.mjs';

export const CODEX_BRIEF_RUN_SCRIPT = join(REPO_ROOT, 'scripts/operations/codex-brief-run.mjs');
export function codexBriefDetachedProvider(request, { spawnDetached = defaultSpawnDetached, write = writeFileSync, logPathFor = deliveryDispatchLogPath } = {}) {
  if (!request.prompt?.trim() || !request.lane || !request.pr || !request.cwd) throw notApplied('Codex repair requires a brief, lane, PR and scratch cwd');
  const route = request.policyRoute;
  if (route?.provider !== 'codex' || !route.model || !route.effort) throw notApplied('Codex repair requires a resolved model and effort');
  const path = join(request.cwd, 'codex-brief.json');
  try { write(path, JSON.stringify({ ...request, policyRoute: route }), { mode: 0o600 }); }
  catch (error) { throw notApplied(`Codex repair request could not be written: ${error.message}`); }
  const argv = [CODEX_BRIEF_RUN_SCRIPT, `--request=${path}`, `--model=${route.model}`, `--effort=${route.effort}`];
  const child = spawnDetached(argv, { cwd: request.cwd, logPath: logPathFor(request.sessionSlug), settingsEnv: request.settingsEnv });
  if (!Number.isInteger(child?.pid) || child.pid <= 0) throw new Error('Codex repair started without a pid; launch is indeterminate');
  request.reportExecutor?.('codex');
  request.reportModel?.(route.model);
  request.reportEffort?.(route.effort);
  return `pid:${child.pid}`;
}
