/** Run a filled repair brief in its assigned lane, under the existing Codex task sandbox. */
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { execFileSync } from 'node:child_process';
import { runCodexDirectExec } from '../codex-direct-task.mjs';
import { REPO_ROOT } from './detached-dispatch.mjs';
import { repoProfile } from '../lib/repo-profile.mjs';
import { admissionLockRoot } from '../readiness/heavy-admission.mjs';
import { fixDispatchClaimRoot } from '../conveyor/fix-claim-store.mjs';
import { resolveCompletionsDir } from './completion-store.mjs';

export async function runCodexBrief(request, { exec = execFileSync, run = runCodexDirectExec, write = writeFileSync, ensureDir = mkdirSync } = {}) {
  const record = { provider: 'codex', model: request.policyRoute.model, effort: request.policyRoute.effort, sessionSlug: request.sessionSlug, pr: request.pr, lane: request.lane, state: 'running' };
  const recordPath = join(request.cwd, 'run.json');
  write(recordPath, JSON.stringify(record));
  try {
    const profile = repoProfile(request.repo ?? 'we');
    if (!profile) throw new Error('Codex repair: unknown repo');
    const cli = join(REPO_ROOT, 'scripts/lane-pool.mjs');
    const base = request.laneRef ?? String(exec('gh', ['pr', 'view', String(request.pr), '--repo', profile.slug, '--json', 'headRefName', '--jq', '.headRefName'], { encoding: 'utf8' })).trim();
    if (!base) throw new Error('Codex repair: missing PR head ref');
    const dir = String(exec(process.execPath, [cli, 'acquire', `--repo=${profile.lanePoolRepo}`, `--lane=${request.lane}`, `--session=${request.sessionSlug}`, `--purpose=conveyor-${request.launchKind}`, `--scope=${(request.scope ?? []).join(',')}`, `--base=${base}`], { encoding: 'utf8', cwd: request.cwd })).trim();
    if (!dir.startsWith('/')) throw new Error('Codex repair: acquire did not return an absolute lane path');
    const tempRoot = join(dir, '.git', 'codex-repair-tmp');
    ensureDir(tempRoot, { recursive: true });
    const task = `The launcher has already acquired your assigned lane at ${dir} from ${base}. Skip ONLY the lane acquire/reset step in the brief; execute every claim, fix-begin/fix-end, verification and hand-back step. Work in this lane. Never edit the dispatching checkout.\n\n${request.systemPromptFile ? readFileSync(request.systemPromptFile, 'utf8') : ''}\n\n${request.prompt}`;
    const result = await run({ dir, task, model: record.model, effort: record.effort, tempRoot,
      writableRoots: [join(dir, '.git'), tempRoot, admissionLockRoot(dir), fixDispatchClaimRoot(), resolveCompletionsDir()],
      env: { ...process.env, LANE_SESSION: request.sessionSlug }, logFile: join(request.cwd, 'codex.jsonl') });
    write(recordPath, JSON.stringify({ ...record, state: result.code === 0 && !result.timedOut ? 'finished' : 'failed', result }));
    return result;
  } catch (error) {
    write(recordPath, JSON.stringify({ ...record, state: 'failed', error: error.message }));
    throw error;
  }
}
if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const path = process.argv.slice(2).find(arg => arg.startsWith('--request='))?.slice(10);
  runCodexBrief(JSON.parse(readFileSync(path, 'utf8')))
    .then(result => { process.exitCode = result.code === 0 && !result.timedOut ? 0 : (result.code || 1); })
    .catch(error => { console.error(error); process.exitCode = 1; });
}
