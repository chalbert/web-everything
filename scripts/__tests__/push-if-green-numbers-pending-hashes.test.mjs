/**
 * @file scripts/__tests__/push-if-green-numbers-pending-hashes.test.mjs
 * @description Root-cause preventive fix for the 2026-09-08 incident where #3623/#3624 sat STRANDED
 * (hash-keyed, un-numbered) on `origin/main` for 44-92 minutes: both landed via a DIRECT commit+push that
 * never went through a lane/PR/drain at all, so neither of the two places JIT numbering (#2288) was
 * previously wired to fire — `we:scripts/lane-drain.mjs`'s `finalizeLand` and `we:scripts/merge-ai-prs.mjs`'s
 * land path, both PR-merge-triggered — ever ran for them. `push-if-green.mjs` is the ONE shared choke point
 * every write path already uses to publish `main` (#2073), including that direct push, so
 * `numberPendingHashesBeforePush` (`../lib/number-pending-hashes-before-push.mjs`, imported by
 * `push-if-green.mjs`) hooks the numbering step there instead: unconditionally, right before every push, so
 * a hash-keyed item can no longer reach `origin/main` un-numbered regardless of which path pushed it.
 *
 * Every fs/git/import touch is INJECTED (`checkExists`/`exec`/`importer`) so most of this proves the decision
 * logic — skip when not the WE repo, skip when nothing is pending, run the real numbering routine inside the
 * numbering-critical-section mutex when something is, refuse (fail closed) on a numbering error — without a
 * throwaway git repo or a copied `scripts/` tree. One test below goes further and drives the REAL
 * `numberPendingHashes` (statically imported from `../lane-drain.mjs`, exactly like
 * `lane-drain-numbering.test.mjs` does) against a real throwaway git fixture, with only the process-wide
 * numbering MUTEX faked out (a pass-through) — real numbering behavior, isolated from the machine's actual
 * shared `~/.claude/drain-locks/` the live resident drain daemon also uses. The end-to-end wire (this
 * function is actually CALLED before every push, and a numbering failure actually ABORTS the push) is pinned
 * separately below by a source-string contract check, mirroring `gated-push-wiring.test.mjs`'s own
 * established idiom for pinning a cross-process wiring point that is expensive to exercise live.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { execFileSync } from 'node:child_process';
import { mkdtempSync, mkdirSync, readdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { numberPendingHashesBeforePush } from '../lib/number-pending-hashes-before-push.mjs';
import { numberPendingHashes } from '../lane-drain.mjs';

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = join(HERE, '..', '..');

describe('numberPendingHashesBeforePush — JIT-number pending hashes before every push (root-cause fix)', () => {
  it('is a silent no-op when the target repo has no lane-drain.mjs (a non-WE constellation repo)', async () => {
    const checkExists = vi.fn(() => false);
    const exec = vi.fn();
    const importer = vi.fn();
    const res = await numberPendingHashesBeforePush('/some/frontierui/checkout', { checkExists, exec, importer });
    expect(res).toEqual({ attempted: false });
    expect(exec).not.toHaveBeenCalled(); // bails before even checking for pending hashes
    expect(importer).not.toHaveBeenCalled(); // and never loads the numbering module
  });

  it('is a no-op when the WE repo has nothing pending — never touches the numbering mutex/module', async () => {
    const checkExists = vi.fn(() => true);
    const exec = vi.fn(() => 'backlog/2200-legacy.md\nbacklog/2201-other.md\n'); // numeric ids only
    const importer = vi.fn();
    const res = await numberPendingHashesBeforePush('/repo', { checkExists, exec, importer });
    expect(res).toEqual({ attempted: false });
    expect(importer).not.toHaveBeenCalled();
  });

  it('cannot tell (git ls-files threw) — falls through to the real numbering module rather than assuming clean', async () => {
    const checkExists = vi.fn(() => true);
    const exec = vi.fn(() => { throw new Error('no backlog/ tracked yet'); });
    const numberPendingHashes = vi.fn(() => ({ assigned: [], committed: false }));
    const withNumberingLock = vi.fn((fn) => ({ result: fn() }));
    const importer = vi.fn(async () => ({ numberPendingHashes, withNumberingLock }));
    const res = await numberPendingHashesBeforePush('/repo', { checkExists, exec, importer });
    expect(importer).toHaveBeenCalled();
    expect(res.attempted).toBe(true);
  });

  it('numbers a pending hash inside the numbering-critical-section mutex and reports what it assigned', async () => {
    const checkExists = vi.fn(() => true);
    const exec = vi.fn(() => 'backlog/2200-legacy.md\nbacklog/xkyisxe-cross-platform.md\n');
    const numberPendingHashes = vi.fn((repo) => {
      expect(repo).toBe('/repo'); // the SAME repo the caller passed, not this test's own cwd
      return { assigned: [{ hash: 'xkyisxe', nnn: '3623' }], committed: true };
    });
    const withNumberingLock = vi.fn((fn) => ({ result: fn(), held: true, contended: false }));
    const importer = vi.fn(async () => ({ numberPendingHashes, withNumberingLock }));
    const res = await numberPendingHashesBeforePush('/repo', { checkExists, exec, importer });
    expect(withNumberingLock).toHaveBeenCalledTimes(1); // the SAME mutex every other land path uses (#2391)
    expect(numberPendingHashes).toHaveBeenCalledTimes(1);
    expect(res).toEqual({ attempted: true, committed: true, assigned: [{ hash: 'xkyisxe', nnn: '3623' }] });
  });

  it('surfaces a numbering failure as an error rather than silently letting the push proceed un-numbered', async () => {
    const checkExists = vi.fn(() => true);
    const exec = vi.fn(() => 'backlog/xbadhas-broken.md\n');
    const numberPendingHashes = vi.fn(() => ({ assigned: [], committed: false, error: 'git rm badhas failed' }));
    const withNumberingLock = vi.fn((fn) => ({ result: fn() }));
    const importer = vi.fn(async () => ({ numberPendingHashes, withNumberingLock }));
    const res = await numberPendingHashesBeforePush('/repo', { checkExists, exec, importer });
    expect(res).toEqual({ attempted: true, error: 'git rm badhas failed' });
  });

  it('surfaces a module-load failure as an error too (never silently skips numbering it meant to do)', async () => {
    const checkExists = vi.fn(() => true);
    const exec = vi.fn(() => 'backlog/xkyisxe-cross-platform.md\n');
    const importer = vi.fn(async () => { throw new Error('boom'); });
    const res = await numberPendingHashesBeforePush('/repo', { checkExists, exec, importer });
    expect(res.attempted).toBe(true);
    expect(res.error).toMatch(/boom/);
  });

  describe('against a real git fixture, with the REAL numberPendingHashes (only the shared mutex faked)', () => {
    let repo;
    const git = (...a) => execFileSync('git', a, { cwd: repo, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] });
    const write = (rel, txt) => { mkdirSync(join(repo, rel, '..'), { recursive: true }); writeFileSync(join(repo, rel), txt); };

    beforeEach(() => {
      repo = mkdtempSync(join(tmpdir(), 'push-if-green-num-'));
      git('init', '-q');
      git('config', 'user.email', 'test@test'); git('config', 'user.name', 'Test');
      git('config', 'commit.gpgsign', 'false');
      mkdirSync(join(repo, '.claude', 'skills', 'batch-backlog-items'), { recursive: true }); // numberPendingHashes writes its local ledger here
      write('.gitignore', '.claude/skills/batch-backlog-items/id-ledger.json\n');
    });
    afterEach(() => { try { rmSync(repo, { recursive: true, force: true }); } catch { /* best-effort */ } });

    it('renames the hash-keyed file to a real NNN and commits — the exact miss that stranded #3623/#3624', async () => {
      write('backlog/2200-legacy.md', '---\nkind: story\nstatus: resolved\n---\n# Legacy\n');
      write('backlog/xkyisxe-e2e-testing-capacity.md', '---\nkind: epic\nstatus: open\n---\n# E2E testing capacity\n');
      git('add', 'backlog', '.gitignore'); git('commit', '-qm', 'seed: direct commit carrying a hash-keyed item');

      // Fake ONLY the process-wide mutex (a pass-through) to avoid touching the machine's real
      // ~/.claude/drain-locks/ (the live resident drain daemon's own shared lock) from a test — the numbering
      // BEHAVIOR itself (`numberPendingHashes`) is the real production function, unmocked.
      const importer = vi.fn(async (p) => (p.endsWith('drain-lock.mjs') ? { withNumberingLock: (fn) => ({ result: fn(), held: true }) } : { numberPendingHashes }));
      const res = await numberPendingHashesBeforePush(repo, { checkExists: () => true, importer });

      expect(res.attempted).toBe(true);
      expect(res.committed).toBe(true);
      expect(res.assigned).toEqual([{ hash: 'xkyisxe', nnn: '2201' }]);
      const names = readdirSync(join(repo, 'backlog')).filter((f) => f.endsWith('.md')).sort();
      expect(names).toContain('2201-e2e-testing-capacity.md'); // numbered
      expect(names.some((n) => n.startsWith('xkyisxe'))).toBe(false); // the hash name is gone
      expect(git('status', '--porcelain').trim()).toBe(''); // the rename landed in a real commit, tree is clean
    });
  });
});

describe('push-if-green.mjs wiring (#2073 + this fix) — the numbering step actually gates every push', () => {
  const src = readFileSync(join(ROOT, 'scripts', 'push-if-green.mjs'), 'utf8');

  it('calls numberPendingHashesBeforePush before the fast-forward push, and refuses to push on a numbering error', () => {
    const numberingCallIdx = src.indexOf('numberPendingHashesBeforePush(REPO)');
    const pushCallIdx = src.indexOf("git(['push', REMOTE,");
    expect(numberingCallIdx).toBeGreaterThan(-1);
    expect(pushCallIdx).toBeGreaterThan(-1);
    expect(numberingCallIdx).toBeLessThan(pushCallIdx); // numbering is decided BEFORE the push, not after
    expect(src).toContain("reason: 'numbering-failed'");
    // the numbering-failed branch exits non-zero (fail closed) exactly like every other refusal in this file
    const failIdx = src.indexOf("reason: 'numbering-failed'");
    const closeIdx = src.indexOf(');', failIdx);
    expect(src.slice(failIdx, closeIdx)).toMatch(/\},\s*\n\s*3,\s*\n\s*$/);
  });

  it('skips numbering in --dry-run (no mutation) and only runs it for the main-line branch being published', () => {
    expect(src).toMatch(/if\s*\(!DRY_RUN\s*&&\s*BRANCH === 'main'\)\s*\{\s*\n\s*const numbering = await numberPendingHashesBeforePush/);
  });

  it('documents the incident this closes, for the next reader', () => {
    expect(src).toContain('#3623');
    expect(src).toContain('#3624');
    expect(src).toContain('#2288');
  });
});
