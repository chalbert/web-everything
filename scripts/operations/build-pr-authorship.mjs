/** Durable builder PR receipts. Separate from transient run cursors; never age-pruned.
 * A receipt requires an actual build dispatch AND a producer-observed PR number.
 * Existing settled dispatch results can be backfilled; branch names are not evidence.
 */
import { existsSync, mkdirSync, readdirSync, readFileSync, renameSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { randomUUID } from 'node:crypto';
import { createFileRunStore, resolveRunsDir } from './run-store.mjs';
import { resolveCoordinationRoot } from './coordination-root.mjs';

export const builderRunsDir = () => join(resolveCoordinationRoot(), 'build-dispatch-runs');
export const authorshipDir = () => join(resolveCoordinationRoot(), 'build-pr-authorship');
export function prNumber(value) {
  const n = Number(String(value ?? '').match(/(?:^|\/)(\d+)$/)?.[1]);
  return Number.isSafeInteger(n) && n > 0 ? n : null;
}
export function readBuilderRuns() {
  return [...new Set([resolveRunsDir(), builderRunsDir()])].flatMap(dir => {
    const store = createFileRunStore(dir);
    return store.list().filter(id => id.startsWith('dispatch-lane')).map(id => ({ id, record: store.read(id) }));
  });
}
export function writeAuthorship(receipt, dir = authorshipDir()) {
  if (!prNumber(receipt.pr) || !receipt.repo || receipt.entry?.type !== 'conveyor.dispatch-delivery-agent' || receipt.entry?.payload?.launchKind !== 'build'
    || !receipt.entry.payload.num || !receipt.runId) throw new Error('invalid builder PR receipt');
  mkdirSync(dir, { recursive: true });
  const path = join(dir, `${encodeURIComponent(receipt.repo)}-${receipt.pr}.json`);
  if (existsSync(path)) {
    const old = JSON.parse(readFileSync(path, 'utf8'));
    if (old.runId !== receipt.runId || old.entry.key !== receipt.entry.key) throw new Error('conflicting builder PR authorship');
    return old;
  }
  const tmp = `${path}.${randomUUID()}.tmp`;
  writeFileSync(tmp, JSON.stringify(receipt, null, 2));
  renameSync(tmp, path);
  return receipt;
}
export function readAuthorship(dir = authorshipDir()) {
  return existsSync(dir) ? readdirSync(dir).filter(f => f.endsWith('.json'))
    .map(f => JSON.parse(readFileSync(join(dir, f), 'utf8'))) : [];
}
/** Called before creating a PR: refuse an invalid dispatch context before publishing. */
export function producerBuildContext(env = process.env) {
  if (!env.WE_BUILD_PR_CONTEXT) return null;
  const { runId, key, dir } = JSON.parse(env.WE_BUILD_PR_CONTEXT);
  const run = createFileRunStore(dir).read(runId);
  const entry = run?.effects?.find(e => e.key === key);
  if (entry?.type !== 'conveyor.dispatch-delivery-agent' || entry?.payload?.launchKind !== 'build' || !entry.payload.num) throw new Error('unproven builder PR context');
  return { runId, entry };
}
export function checkpointBuildPr(context, { repo, pr, ref }, dir) {
  if (!context) return;
  return writeAuthorship({ ...context, repo, pr: prNumber(pr), ref, recordedAt: new Date().toISOString(),
    entry: { ...context.entry, result: { ...context.entry.result, pr: prNumber(pr) } } }, dir);
}
/** Read-only in preview; persist only exact dispatch results for currently open PRs in live mode. */
export function backfillAuthorship({ runs, prs, repo, receipts = [], persist = false, dir }) {
  const out = [...receipts];
  for (const { id, record } of runs) for (const entry of record?.effects ?? []) {
    if (entry.type !== 'conveyor.dispatch-delivery-agent' || entry.payload?.launchKind !== 'build' || !entry.payload.num) continue;
    // Legacy numeric results have no repo field. Only WE-only dispatch scope proves their namespace.
    if ((entry.payload.scope ?? []).some(path => /^[^/:]+:/.test(path) && !path.startsWith('we:'))) continue;
    const pr = prNumber(entry.result?.pr);
    // URL results must name the expected repository; numeric legacy results belong to WE.
    if (String(entry.result?.pr).includes('/') && !String(entry.result.pr).startsWith(`https://github.com/${repo}/pull/`)) continue;
    const open = prs.find(p => p.number === pr);
    if (!open || out.some(r => r.repo === repo && r.pr === pr)) continue;
    const receipt = { runId: id, entry, repo, pr, ref: open.headRefName, source: 'dispatch-result' };
    if (persist) writeAuthorship(receipt, dir);
    out.push(receipt);
  }
  return out;
}
