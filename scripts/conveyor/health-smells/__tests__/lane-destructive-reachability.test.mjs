import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { execFileSync } from 'node:child_process';
import { laneStateSnapshot, laneJournalEntry, laneJournalPath, isUnsalvagedDestructiveUnpushed as lost } from '../../../lib/lane-history.mjs';
import { probeLaneJournal } from '../../health-watch.mjs';
import { emptyHealthState, stepEpisodes } from '../../health-watch-core.mjs';
import smell from '../lane-destructive-unpushed.mjs';

let root, pool, lane, base, sha;
const now = Date.parse('2026-09-30T23:50:00Z');
const git = (...args) => execFileSync('git', args, { cwd: lane, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] }).trim();
beforeEach(() => {
  root = mkdtempSync(join(tmpdir(), 'lane-reachability-'));
  pool = join(root, 'web-everything'); lane = join(pool, 'lane-2');
  mkdirSync(lane, { recursive: true });
  git('init', '-b', 'main'); git('config', 'user.name', 'Test'); git('config', 'user.email', 'test@example.com');
  git('commit', '--allow-empty', '-m', 'base'); base = git('rev-parse', 'HEAD');
  git('update-ref', 'refs/remotes/origin/main', base);
  git('commit', '--allow-empty', '-m', 'job'); sha = git('rev-parse', 'HEAD');
});
afterEach(() => rmSync(root, { recursive: true, force: true }));
const entry = (extra = {}) => ({
  lane: 2, ts: new Date(now).toISOString(), action: 'acquire-reset',
  actor: { name: 'lane-pool' }, reason: 'acquire → origin/lane/slow-rounds2',
  headBefore: sha, headAfter: base, dirtyBefore: 0, aheadBefore: 1, unpushed: true, ...extra,
});

describe('remote reachability and actual destruction', () => {
  it('records a job on local main pushed under a different remote ref as pushed at reset time', () => {
    git('update-ref', 'refs/remotes/origin/lane/job', sha);
    const before = laneStateSnapshot(lane);
    expect(before).toMatchObject({ ahead: 1, unpushedCommits: 0, unpushed: false });
    expect(lost(laneJournalEntry({ action: 'acquire-reset', before, headAfter: base }))).toBe(false);
  });
  it('keeps at-time pushed evidence after remote refs are pruned', () => {
    expect(lost(entry({ unpushedCommitsBefore: 0 }))).toBe(false);
    expect(lost(entry({ headAfter: sha, unpushedCommitsBefore: 1 }))).toBe(false);
  });
  it('still fires for an unreferenced commit and for discarded tracked changes, even at unchanged HEAD', () => {
    expect(lost(laneJournalEntry({ action: 'acquire-reset', before: laneStateSnapshot(lane), headAfter: base }))).toBe(true);
    writeFileSync(join(lane, '.pr-body.md'), 'tracked'); git('add', '.'); git('commit', '-m', 'tracked');
    git('update-ref', 'refs/remotes/origin/lane/job', git('rev-parse', 'HEAD'));
    writeFileSync(join(lane, '.pr-body.md'), 'dirty tracked');
    const before = laneStateSnapshot(lane);
    expect(before.workDirty).toBe(1);
    expect(lost(laneJournalEntry({ action: 'acquire-reset', before, headAfter: before.head }))).toBe(true);
  });
  it('excludes only known untracked litter from reset loss, preserving other untracked work', () => {
    git('update-ref', 'refs/remotes/origin/lane/job', sha);
    writeFileSync(join(lane, '.pr-body.md'), 'scratch');
    expect(lost(laneJournalEntry({ action: 'acquire-reset', before: laneStateSnapshot(lane), headAfter: base }))).toBe(false);
    writeFileSync(join(lane, 'valuable.txt'), 'work');
    expect(lost(laneJournalEntry({ action: 'acquire-reset', before: laneStateSnapshot(lane), headAfter: base }))).toBe(true);
  });
  it('replays litter-only deletion with ahead > 0 and unchanged HEAD without reporting commit loss', () => {
    expect(lost(entry({ action: 'litter-delete', headAfter: sha, dirtyBefore: 2,
      removed: ['.pr-body.md', '.delivery-commit-msg-build.txt'], unpushedCommitsBefore: 1 }))).toBe(false);
  });
  it('honors an explicit unpushed:false (preserved reclaim/salvage) despite dirty files or unpushed commits', () => {
    for (const action of ['reclaim-reset', 'salvage-reset']) {
      expect(lost(entry({ action, unpushed: false, dirtyBefore: 2 }))).toBe(false);
      expect(lost(entry({ action, unpushed: false, workDirtyBefore: 2 }))).toBe(false);
      expect(lost(entry({ action, unpushed: false, unpushedCommitsBefore: 1 }))).toBe(false);
      expect(lost(entry({ action, unpushed: true, dirtyBefore: 2 }))).toBe(true);
      expect(lost(entry({ action, unpushed: true, unpushedCommitsBefore: 1 }))).toBe(true);
    }
  });
  it('closes old pushed episodes through the normal clean path; retains lost commits and unknown dirty work', () => {
    const entries = [entry(), entry({ lane: 39, headBefore: 'f'.repeat(40) }),
      entry({ lane: 33, dirtyBefore: 2, unpushedCommitsBefore: 0 }),
      entry({ lane: 38, action: 'litter-delete', headAfter: sha, dirtyBefore: 1 })];
    const oldResults = entries.map(e => ({ subject: `lane:web-everything/lane-${e.lane}`, breach: true }));
    const old = stepEpisodes(emptyHealthState(), [{ smell, results: oldResults }], now).state;
    git('update-ref', 'refs/remotes/origin/lane/job', sha);
    git('reset', '--hard', base);
    writeFileSync(laneJournalPath(pool), entries.map(e => JSON.stringify(e)).join('\n'));
    const results = smell.evaluate({ laneJournal: probeLaneJournal({ poolRoot: root, now }) });
    const next = stepEpisodes(old, [{ smell, results }], now + 1);
    expect(next.transitions.filter(t => t.type === 'closed').map(t => t.episode.subject).sort())
      .toEqual(['lane:web-everything/lane-2', 'lane:web-everything/lane-38']);
    expect(Object.values(next.state.episodes).map(e => e.subject).sort())
      .toEqual(['lane:web-everything/lane-33', 'lane:web-everything/lane-39']);
  });
});
