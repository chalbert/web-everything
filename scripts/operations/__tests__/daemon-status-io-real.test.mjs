/**
 * @file scripts/operations/__tests__/daemon-status-io-real.test.mjs
 * @description #4067 — the #2949 fidelity qualifier: real subprocess/disk proof, separate from the
 *   filesystem-free injected-fakes suite in `daemon-status-io.test.mjs`. `countCommitsBehindOrigin` is the
 *   module's one real git shell-out, and it is exercised here against a REAL `--single-branch` narrow clone —
 *   the exact geometry `we:scripts/operations/__tests__/helpers/real-repo.mjs`'s header says reproduced #3264
 *   (a stub with no clone geometry cannot fail the way a real narrow clone can). The overlay/rebuild/alert
 *   reads are exercised against real files on real disk in the same fixture, keyed by the clone's own real
 *   `cloneOverlayKey`.
 */
import { it, expect } from 'vitest';
import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { withRealRepo, withNarrowClone } from './helpers/real-repo.mjs';
import {
  countCommitsBehindOrigin, readOverlaysForClone, readRebuildStateForClone, readRecentAlertsForClone,
  cloneOverlayKey, WE_DAEMON_OVERLAY_DIR_ENV, WE_DAEMON_STATE_DIR_ENV,
} from '../daemon-status-io.mjs';

it('countCommitsBehindOrigin walks a REAL --single-branch narrow clone — the exact geometry #3264 broke', async () => {
  await withNarrowClone(async (ctx) => {
    // Sanity on the fixture's own geometry, per real-repo.mjs's own header advice: assert narrow, never trust
    // the flag's name alone.
    expect(ctx.fetchRefspecs().some((r) => r.includes('*'))).toBe(false);

    // Freshly cloned at origin/main: zero behind, via the REAL `git rev-parse --verify -q` + `rev-list` calls.
    expect(countCommitsBehindOrigin(ctx.clone)).toEqual({ behind: 0 });

    // Advance origin/main by one real commit, then fetch it by name — the narrow clone's only refspec covers
    // exactly `main`, so this (unlike a wildcard fetch) really does update `refs/remotes/origin/main`.
    ctx.seedOriginBranch('main', { 'new-file.txt': 'hello\n' });
    ctx.git(['fetch', '--quiet', 'origin', 'main']);
    expect(countCommitsBehindOrigin(ctx.clone)).toEqual({ behind: 1 });
  });
});

it('countCommitsBehindOrigin on a real repo with no origin at all reports the real reason, not a crash', async () => {
  await withRealRepo(async ({ root }) => {
    expect(countCommitsBehindOrigin(root)).toEqual({ behind: null, reason: 'no local origin/main ref' });
  });
});

it('overlay/rebuild/alert reads hit REAL files on REAL disk, keyed by the clone\'s real path', async () => {
  await withNarrowClone(async (ctx) => {
    const stateDir = join(ctx.tmp, 'daemon-state');
    mkdirSync(stateDir, { recursive: true });
    const key = cloneOverlayKey(ctx.clone);
    writeFileSync(join(stateDir, `${key}.json`), JSON.stringify({ clone: ctx.clone, overlays: [{ ref: 'lane/real-fixture', pr: 999 }] }));
    writeFileSync(join(stateDir, `${key}.rebuild.json`), JSON.stringify({
      adopted: { head: 'deadbeef' }, rejected: null, inProgress: null, quarantine: null, unverified: null,
    }));
    writeFileSync(join(stateDir, `${key}.alerts.jsonl`),
      `${JSON.stringify({ at: '2026-09-25T00:00:00.000Z', kind: 'smoke-rejected', detail: null })}\n`);
    const env = { [WE_DAEMON_OVERLAY_DIR_ENV]: stateDir, [WE_DAEMON_STATE_DIR_ENV]: stateDir };

    // No `readText`/`tailFs` override below — these are the module's REAL `readFileSync`/real tail, reading
    // files this test put on real disk, not an injected double answering from memory.
    expect(readOverlaysForClone(ctx.clone, { env })).toEqual({ available: true, overlays: [{ ref: 'lane/real-fixture', pr: 999 }], corrupt: false });
    expect(readRebuildStateForClone(ctx.clone, { env })).toEqual({
      available: true, corrupt: false,
      state: { adopted: { head: 'deadbeef' }, rejected: null, inProgress: null, quarantine: null, unverified: null },
    });
    expect(readRecentAlertsForClone(ctx.clone, { env })).toEqual({
      available: true, alerts: [{ at: '2026-09-25T00:00:00.000Z', kind: 'smoke-rejected', detail: null }],
    });
  });
});
