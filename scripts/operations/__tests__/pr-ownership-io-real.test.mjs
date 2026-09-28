/**
 * @file scripts/operations/__tests__/pr-ownership-io-real.test.mjs
 * @description backlog #4056 — the fidelity qualifier (#2949, motivated by #3264): `pr-ownership-io.mjs`'s lane
 * read is a real shell-out (`node <root>/scripts/lane-pool.mjs status --json --repo=<checkout>`) gated on a real
 * `existsSync` of the checkout. Proved here against a REAL child process and a REAL directory tree, not the
 * injected `run`/`pathExists` doubles `pr-ownership.test.mjs` uses to pin the ownership decisions.
 */
import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { it, expect } from 'vitest';
import { withRealRepo } from './helpers/real-repo.mjs';
import { createPrOwnershipReader } from '../pr-ownership-io.mjs';

const NOW = Date.parse('2026-09-24T20:00:00.000Z');

function readerAt(root, lanePoolSource) {
  mkdirSync(join(root, 'scripts'), { recursive: true });
  writeFileSync(join(root, 'scripts', 'lane-pool.mjs'), lanePoolSource);
  return createPrOwnershipReader({
    root, repoKeys: ['we'], now: () => NOW,
    // Only the reconcile pass and runner-activity are doubled; the lane read and the checkout probe are real.
    reconcile: (o) => { o.enrichFixClaims([{ number: 7, headRefName: 'lane/4056-x', headRefOid: 'abc', baseRefName: 'main', labels: [] }], {}); o.enrich([]); o.readRequiredChecks({}); return { dispatch: [], refusals: [], notes: [] }; },
    enrichFixClaims: (prs) => prs, readRequiredChecks: () => ({ checks: ['test'] }),
    readAgents: () => [], enrich: (a) => a, hungInfoFor: () => null,
    readTimeline: () => [], readActivity: () => { throw new Error('no daemons in fixture'); },
  });
}

it('spawns a REAL `<root>/scripts/lane-pool.mjs status --json --repo=<checkout>` child and joins its lane to the PR', async () => {
  await withRealRepo(async ({ root }) => {
    const read = readerAt(root, [
      "const argv = process.argv.slice(2);",
      "if (argv[0] !== 'status' || argv[1] !== '--json' || !argv[2].startsWith('--repo=')) process.exit(3);",
      "process.stdout.write(JSON.stringify({ lanes: [{ lane: 4, path: argv[2].slice(7) + '-lane-4', branch: 'lane/4056-x', lease: { holder: 'h4', workerSession: 'conveyor-4056' } }] }));",
    ].join('\n'));
    const out = read();
    expect(out.gaps.some((g) => /lane/.test(g) && /failed|no checkout/.test(g))).toBe(false);
    expect(out.repos[0].lanes).toEqual([{ lane: 4, path: `${root}-lane-4`, branch: 'lane/4056-x', lease: { holder: 'h4', workerSession: 'conveyor-4056' } }]);
    expect(out.repos[0].prs[0]).toMatchObject({ number: 7, card: '4056' });
  });
});

it('a REAL child that exits non-zero becomes a lane gap, never a failed read', async () => {
  await withRealRepo(async ({ root }) => {
    const out = readerAt(root, 'process.exit(1);\n')();
    expect(out.repos[0].lanes).toEqual([]);
    expect(out.gaps.join('\n')).toMatch(/we: lane enumeration failed/);
  });
});

it('a checkout that does not exist on disk is reported, and no child is spawned for it', async () => {
  await withRealRepo(async ({ root }) => {
    const read = createPrOwnershipReader({
      root: join(root, 'absent'), repoKeys: ['we'], now: () => NOW,
      reconcile: () => ({ dispatch: [], refusals: [], notes: [] }),
      readAgents: () => [], enrich: (a) => a, hungInfoFor: () => null,
      readActivity: () => { throw new Error('none'); },
    });
    expect(read().gaps.join('\n')).toMatch(/we: no checkout on this host/);
  });
});
