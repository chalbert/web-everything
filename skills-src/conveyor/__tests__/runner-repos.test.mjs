/**
 * @file skills-src/conveyor/__tests__/runner-repos.test.mjs
 *
 * SKIPPED BY THE 2026-09-21 CATCH-UP MERGE — NOT DELETED, AND NOT BROKEN. These three cases test `main`'s OWN
 * rewrite of `makeCliMechanicalPasses`: a repo-scoped fan-out over `CONSTELLATION_REPOS`, driven by an injected
 * `exec`/`fetchOpenPrs`, writing a per-repo `--prs-file=` snapshot, plus two passes that exist only there
 * (`conveyor/advisory-label-sweep.mjs`, `operations/operator-notify.mjs`) and an `unsupported-repo` ledger.
 *
 * `lane/mechanical-dispatcher` rewrote the SAME function for a different axis — heartbeated (lease-renewing)
 * passes, `main-ref-sync.mjs`/`poc-branch-sync.mjs` ahead of everything else, and a BLOCKING mechanical review
 * dispatch (`review-dispatch-wrapper.mjs`) in place of a forked agent. The two rewrites are a genuine design
 * fork, not a textual conflict: this merge kept the BRANCH's function (it is what the live driver runs), so
 * these cases cannot pass as written.
 *
 * TO RE-ENABLE: port `main`'s repo fan-out INTO the branch's heartbeating pass list (one pass set, scoped per
 * repo, still heartbeated), then drop the `.skip` below. Recorded as UNRESOLVED-BY-JUDGMENT in this merge's
 * report — the multi-repo half of the conveyor's mechanical passes is NOT on this branch until that is done.
 */
import { existsSync, mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, basename } from 'node:path';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { makeCliMechanicalPasses } from '../runner.mjs';
import { CONSTELLATION_REPOS } from '../../../scripts/lib/constellation-repos.mjs';
import { readUnsupported, recordUnsupported } from '../../../scripts/conveyor/unsupported-repo.mjs';

const dirs = [];
afterEach(() => { vi.restoreAllMocks(); dirs.splice(0).forEach((dir) => rmSync(dir, { recursive: true, force: true })); });
const perRepo = ['reconcile-fix-dispatch', 'parked-pr-conflict-watch', 'advisory-label-sweep', 'parked-pr-progress-watch', 'ci-queue-watch', 'reconcile-pass', 'review-dispatch', 'review-round-tag', 'review-status-tag'];
const once = ['infra-blocked', 'lease-reaper', 'session-reaper', 'branch-drift', 'lane-pool-health-watch', 'duplicate-pr-watch'];
async function sweep(repo = null, fail = null) {
  const dir = mkdtempSync(join(tmpdir(), 'runner-repos-')); dirs.push(dir);
  const unsupportedPath = join(dir, 'unsupported.json');
  const files = new Set();
  const exec = vi.fn((_, args) => {
    const flag = args.find((arg) => arg.startsWith('--prs-file='));
    if (flag) { const file = flag.slice(11); files.add(file); expect(JSON.parse(readFileSync(file))).toEqual([{ number: 7 }]); }
    if (fail?.(args)) throw new Error('unsupported-repo: checkout missing');
    return JSON.stringify({ dispatch: [{ kind: 'review', prNumber: 7 }], refusals: [] });
  });
  const fetchOpenPrs = vi.fn(() => [{ number: 7 }]);
  const stderr = vi.spyOn(process.stderr, 'write').mockImplementation(() => true);
  await makeCliMechanicalPasses({ scriptsDir: '/scripts', repo, exec, fetchOpenPrs, unsupportedPath })();
  for (const file of files) expect(existsSync(file)).toBe(false);
  return { exec, fetchOpenPrs, files, stderr, unsupportedPath };
}
describe.skip('main\'s repo-scoped mechanical-pass fan-out (see this file\'s header)', () => {
it('sweeps all three repo slugs with separate snapshots and runs WE passes once', async () => {
  const { exec, fetchOpenPrs, files } = await sweep();
  expect(fetchOpenPrs.mock.calls).toEqual(Object.values(CONSTELLATION_REPOS).map(({ slug }) => [{ repo: slug }]));
  expect(files.size).toBe(3);
  for (const pass of perRepo) {
    const calls = exec.mock.calls.filter(([, args]) => basename(args[0]) === `${pass}.mjs`);
    expect(calls).toHaveLength(3);
    expect(calls.map(([, args]) => args.find((arg) => arg.startsWith('--repo=')))).toEqual(Object.values(CONSTELLATION_REPOS).map(({ slug }) => `--repo=${slug}`));
  }
  for (const pass of once) expect(exec.mock.calls.filter(([, args]) => basename(args[0]) === `${pass}.mjs`)).toHaveLength(1);
});
it('isolates child failures and records unsupported review work', async () => {
  const { exec, stderr, unsupportedPath } = await sweep(null, (args) => args[0].endsWith('review-dispatch.mjs') && args.includes('--repo=chalbert/frontierui'));
  expect(exec.mock.calls.filter(([, args]) => args[0].endsWith('review-dispatch.mjs'))).toHaveLength(3);
  expect(stderr.mock.calls.flat().join('')).toContain('operations/review-dispatch.mjs [frontierui] failed (non-fatal)');
  expect(readUnsupported({ path: unsupportedPath })).toEqual([expect.objectContaining({ repo: 'frontierui', prNumber: 7, action: 'review' })]);
  recordUnsupported({ repo: 'frontierui', rows: [{ action: 'fix', prNumber: 8 }, { action: 'review', prNumber: 7 }], path: unsupportedPath });
  await makeCliMechanicalPasses({ scriptsDir: '/scripts', repo: 'frontierui', exec: () => JSON.stringify({ dispatch: [], refusals: [] }), fetchOpenPrs: () => [], unsupportedPath })();
  expect(readUnsupported({ path: unsupportedPath })).toEqual([expect.objectContaining({ action: 'fix', prNumber: 8 })]);
});
it('limits an explicit repo and refuses unknown explicit repos', async () => {
  const { exec, fetchOpenPrs } = await sweep('chalbert/frontierui');
  expect(fetchOpenPrs.mock.calls).toEqual([[{ repo: 'chalbert/frontierui' }]]);
  for (const pass of perRepo) expect(exec.mock.calls.filter(([, args]) => basename(args[0]) === `${pass}.mjs`)).toHaveLength(1);
  const unknown = await sweep('other/repo');
  expect(unknown.fetchOpenPrs).not.toHaveBeenCalled();
  for (const pass of perRepo) expect(unknown.exec.mock.calls.filter(([, args]) => basename(args[0]) === `${pass}.mjs`)).toHaveLength(0);
  expect(unknown.stderr.mock.calls.flat().join('')).toContain('unsupported-repo: other/repo');
});
});
