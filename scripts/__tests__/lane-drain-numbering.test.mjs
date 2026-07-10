/**
 * @file scripts/__tests__/lane-drain-numbering.test.mjs
 * @description Integration proof of the drain's JIT numbering wire (#2288) — `numberPendingHashes`. Sets up
 * a throwaway git repo mimicking the post-WE-land main state (a PROVISIONAL hash item + a referrer that
 * blockedBy's it, and the queued token), then drives the numberer and asserts it: mints the next NNN from
 * `max+1`, renames the file, rewrites cross-refs via the ledger, and commits — the sole-writer id
 * assignment the whole scheme hinges on. The pure decider (`applyLedger`) is unit-tested in
 * scripts/backlog/__tests__/id.test.mjs; this proves the FS/git boundary.
 */
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { execFileSync } from 'node:child_process';
import { mkdtempSync, rmSync, mkdirSync, writeFileSync, readdirSync, readFileSync, existsSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { numberPendingHashes } from '../lane-drain.mjs';

const QUEUED_REL = '.claude/skills/batch-backlog-items/queued.json';
const LEDGER_REL = '.claude/skills/batch-backlog-items/id-ledger.json';

let repo;
const git = (...a) => execFileSync('git', a, { cwd: repo, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] });
const write = (rel, txt) => { mkdirSync(join(repo, rel, '..'), { recursive: true }); writeFileSync(join(repo, rel), txt); };
const backlogNames = () => readdirSync(join(repo, 'backlog')).filter((f) => f.endsWith('.md')).sort();

beforeEach(() => {
  repo = mkdtempSync(join(tmpdir(), 'drain-num-'));
  git('init', '-q');
  git('config', 'user.email', 'test@test'); git('config', 'user.name', 'Test');
  git('config', 'commit.gpgsign', 'false');
  // The id-ledger is LOCAL-ONLY drain bookkeeping (gitignored in the real repo) — mirror that so the
  // whole-tree-clean assertion proves the numbering COMMIT landed without the untracked ledger dirtying it.
  write('.gitignore', '.claude/skills/batch-backlog-items/id-ledger.json\n');
});
afterEach(() => { try { rmSync(repo, { recursive: true, force: true }); } catch { /* best-effort */ } });

describe('numberPendingHashes — drain JIT numbering wire (#2288)', () => {
  it('assigns max+1, renames the hash file, rewrites a referrer, and commits', () => {
    write('backlog/2200-legacy.md', '---\nkind: story\nstatus: resolved\n---\n# Legacy\n');
    write('backlog/xhash01-alpha.md', '---\nkind: story\nstatus: resolved\n---\n# Alpha\n\nBody mentions xhash01.\n');
    write('backlog/2201-referrer.md', '---\nkind: story\nblockedBy: ["xhash01"]\n---\n# Referrer\n');
    write(QUEUED_REL, JSON.stringify({ queued: [] })); // queue already empty (this was the last couple) → ledger resets
    git('add', 'backlog', '.claude', '.gitignore'); git('commit', '-qm', 'seed');

    const res = numberPendingHashes(repo);

    // max+1 over {2200, 2201} → 2202.
    expect(res.assigned).toEqual([{ hash: 'xhash01', nnn: '2202' }]);
    expect(res.committed).toBe(true);
    // The hash file is renamed; no hash file remains.
    const names = backlogNames();
    expect(names).toContain('2202-alpha.md');
    expect(names.some((n) => n.startsWith('xhash01'))).toBe(false);
    // Its own body ref is rewritten.
    expect(readFileSync(join(repo, 'backlog/2202-alpha.md'), 'utf8')).toContain('Body mentions 2202.');
    // The referrer's blockedBy is repaired.
    expect(readFileSync(join(repo, 'backlog/2201-referrer.md'), 'utf8')).toContain('blockedBy: ["2202"]');
    // A real commit landed the rename+rewrites (working tree clean afterwards).
    expect(git('status', '--porcelain').trim()).toBe('');
    // APPEND-ONLY ledger: retained even though the queue is empty (a still-in-flight lane may reference it).
    expect(JSON.parse(readFileSync(join(repo, LEDGER_REL), 'utf8'))).toEqual({ xhash01: '2202' });
  });

  it('--dry-run (#2319 number-stranded) reports the plan but leaves the tree + ledger untouched', () => {
    write('backlog/2200-legacy.md', '---\nkind: story\nstatus: resolved\n---\n# Legacy\n');
    write('backlog/xhash01-alpha.md', '---\nkind: story\nstatus: resolved\n---\n# Alpha\n\nBody mentions xhash01.\n');
    write('backlog/2201-referrer.md', '---\nkind: story\nblockedBy: ["xhash01"]\n---\n# Referrer\n');
    write(QUEUED_REL, JSON.stringify({ queued: [] }));
    git('add', 'backlog', '.claude', '.gitignore'); git('commit', '-qm', 'seed');

    const res = numberPendingHashes(repo, { dryRun: true });

    expect(res.dryRun).toBe(true);
    expect(res.committed).toBe(false);
    expect(res.assigned).toEqual([{ hash: 'xhash01', nnn: '2202' }]);
    expect(res.wouldRename).toEqual([{ from: 'xhash01-alpha', to: '2202-alpha' }]);
    // Nothing on disk changed: the hash file is still there, no rename, no commit, no ledger written.
    const names = backlogNames();
    expect(names).toContain('xhash01-alpha.md');
    expect(names).not.toContain('2202-alpha.md');
    expect(git('status', '--porcelain').trim()).toBe(''); // no working-tree churn
    expect(() => readFileSync(join(repo, LEDGER_REL), 'utf8')).toThrow(); // ledger not written
  });

  it('does NOT drop a ledger entry on queue-empty — a later dependent still resolves the blocker (PR #194)', () => {
    // Blocker A lands and EMPTIES the queue while dependent B is still in-flight (unqueued, not on main).
    write('backlog/2200-legacy.md', '---\nkind: story\n---\n# Legacy\n');
    write('backlog/xblkr01-a.md', '---\nkind: story\nstatus: resolved\n---\n# Blocker A\n');
    write(QUEUED_REL, JSON.stringify({ queued: [] })); // queue empty at A's land — B not queued yet
    git('add', 'backlog', '.claude', '.gitignore'); git('commit', '-qm', 'seed');
    const a = numberPendingHashes(repo);
    expect(a.assigned).toEqual([{ hash: 'xblkr01', nnn: '2201' }]);
    // Ledger must STILL carry xblkr01 (pre-fix it reset to {} here and stranded B's edge).
    expect(JSON.parse(readFileSync(join(repo, LEDGER_REL), 'utf8'))).toEqual({ xblkr01: '2201' });

    // Later: B lands referencing A by its OLD hash → its edge is repaired from the retained ledger.
    write('backlog/xdepb02-b.md', '---\nkind: story\nblockedBy: ["xblkr01"]\n---\n# Dependent B\n');
    git('add', 'backlog'); git('commit', '-qm', 'B lands');
    numberPendingHashes(repo);
    expect(readFileSync(join(repo, 'backlog/2202-b.md'), 'utf8')).toContain('blockedBy: ["2201"]');
  });

  it('keeps the ledger entry when other couples are still queued (cross-lane repair later)', () => {
    write('backlog/2200-legacy.md', '---\nkind: story\n---\n# Legacy\n');
    write('backlog/xhash01-alpha.md', '---\nkind: story\nstatus: resolved\n---\n# Alpha\n');
    // Another couple still in flight → the ledger must retain xhash01→NNN so that couple's later land can
    // repair any edge that points at xhash01.
    write(QUEUED_REL, JSON.stringify({ queued: [{ num: 'xother2', at: null }] }));
    git('add', 'backlog', '.claude', '.gitignore'); git('commit', '-qm', 'seed');

    const res = numberPendingHashes(repo);
    expect(res.assigned).toEqual([{ hash: 'xhash01', nnn: '2201' }]);
    expect(JSON.parse(readFileSync(join(repo, LEDGER_REL), 'utf8'))).toEqual({ xhash01: '2201' });
  });

  it('resolves a dependent that references an already-numbered blocker via a pre-seeded ledger', () => {
    // Blocker already landed (its file is 2201-alpha, hash gone); its hash→NNN still sits in the ledger.
    write('backlog/2201-alpha.md', '---\nkind: story\nstatus: resolved\n---\n# Alpha\n');
    write('backlog/xdep002-beta.md', '---\nkind: story\nblockedBy: ["xblk001"]\n---\n# Beta\n');
    write(LEDGER_REL, JSON.stringify({ xblk001: '2201' }));
    write(QUEUED_REL, JSON.stringify({ queued: [] }));
    git('add', 'backlog', '.claude', '.gitignore'); git('commit', '-qm', 'seed');

    numberPendingHashes(repo); // beta lands → 2202, and its stale xblk001 edge → 2201
    const beta = readFileSync(join(repo, 'backlog/2202-beta.md'), 'utf8');
    expect(beta).toContain('blockedBy: ["2201"]');
    expect(backlogNames()).toContain('2202-beta.md');
  });

  it('numbers a couple PLUS a leftover scaffolded in its lane, in topological order (#2288)', () => {
    // A landed lane carries the couple's own item AND a leftover it scaffolded during close-out — both are
    // hash-keyed on main and both must be numbered; the leftover blockedBy the couple → numbered AFTER it.
    write('backlog/2200-legacy.md', '---\nkind: story\n---\n# Legacy\n');
    write('backlog/xcoupl1-main.md', '---\nkind: story\nstatus: resolved\n---\n# Main item\n');
    write('backlog/xleft02-followup.md', '---\nkind: task\nblockedBy: ["xcoupl1"]\n---\n# Leftover follow-up\n');
    write(QUEUED_REL, JSON.stringify({ queued: [] }));
    git('add', 'backlog', '.claude', '.gitignore'); git('commit', '-qm', 'seed');

    const res = numberPendingHashes(repo);
    // Blocker (xcoupl1) numbered first → 2201; dependent (xleft02) after → 2202.
    expect(res.assigned).toEqual([{ hash: 'xcoupl1', nnn: '2201' }, { hash: 'xleft02', nnn: '2202' }]);
    const names = backlogNames();
    expect(names).toContain('2201-main.md');
    expect(names).toContain('2202-followup.md');
    // The leftover's blockedBy edge to the couple is repaired to the couple's assigned number.
    expect(readFileSync(join(repo, 'backlog/2202-followup.md'), 'utf8')).toContain('blockedBy: ["2201"]');
    expect(git('status', '--porcelain').trim()).toBe('');
  });

  it('renames a relatedReport file whose stem embeds the hash + rewrites its internal refs (#2400, the #2387 regression)', () => {
    write('backlog/2200-legacy.md', '---\nkind: story\n---\n# Legacy\n');
    write('backlog/xepic01-overlap.md',
      '---\nkind: epic\nstatus: resolved\nrelatedReport: reports/2026-07-10-split-analysis-xepic01.md\n---\n# Overlap epic\n');
    write('reports/2026-07-10-split-analysis-xepic01.md', '# Split analysis\n\nFocused run: `/slice xepic01`. Candidate #xepic01.\n');
    write(QUEUED_REL, JSON.stringify({ queued: [] }));
    git('add', 'backlog', 'reports', '.claude', '.gitignore'); git('commit', '-qm', 'seed');

    const res = numberPendingHashes(repo);
    expect(res.assigned).toEqual([{ hash: 'xepic01', nnn: '2201' }]);
    expect(res.committed).toBe(true);
    // The item's relatedReport ref is rewritten to the number…
    expect(readFileSync(join(repo, 'backlog/2201-overlap.md'), 'utf8'))
      .toContain('relatedReport: reports/2026-07-10-split-analysis-2201.md');
    // …and the report FILE is renamed to match (no dangle, not hidden)…
    expect(() => readFileSync(join(repo, 'reports/2026-07-10-split-analysis-xepic01.md'), 'utf8')).toThrow();
    const report = readFileSync(join(repo, 'reports/2026-07-10-split-analysis-2201.md'), 'utf8');
    // …with its own internal hash refs rewritten too.
    expect(report).toContain('/slice 2201');
    expect(report).toContain('#2201');
    expect(report).not.toContain('xepic01');
    // Everything landed in the one numbering commit — working tree clean.
    expect(git('status', '--porcelain').trim()).toBe('');
  });

  it('rewrites a body /backlog/<hash>/ URL to the number with no report file to rename (#2400)', () => {
    write('backlog/2200-legacy.md', '---\nkind: story\n---\n# Legacy\n');
    write('backlog/xitem01-alpha.md', '---\nkind: story\nstatus: resolved\n---\n# Alpha\n\nSee /backlog/xitem01/ for context.\n');
    write(QUEUED_REL, JSON.stringify({ queued: [] }));
    git('add', 'backlog', '.claude', '.gitignore'); git('commit', '-qm', 'seed');

    numberPendingHashes(repo);
    expect(readFileSync(join(repo, 'backlog/2201-alpha.md'), 'utf8')).toContain('/backlog/2201/');
    expect(git('status', '--porcelain').trim()).toBe('');
  });

  it('REFUSES a traversal path-value ref — never writes/deletes outside the repo (#2400 containment)', () => {
    // A crafted relatedReport with `..` escapes would otherwise make the drain writeFileSync the rewritten
    // NEW path + `git rm` the OLD one, both OUTSIDE the tree — writing an arbitrary file and deleting a real
    // one. The victim below sits ABOVE the repo root and embeds the hash so the ref resolves to a real file
    // (existsSync true) — the exact condition the confinement check must veto. The item still numbers fine.
    const victimName = `pr385-victim-${Date.now()}-xevil01.md`;
    const victimPath = join(repo, '..', victimName);        // outside the repo root
    const numberedSibling = join(repo, '..', victimName.replace('xevil01', '2201'));
    writeFileSync(victimPath, '# I live outside the repo and must not be touched\n');
    try {
      write('backlog/2200-legacy.md', '---\nkind: story\n---\n# Legacy\n');
      write('backlog/xevil01-attack.md',
        `---\nkind: story\nstatus: resolved\nrelatedReport: ../${victimName}\n---\n# Attack\n`);
      write(QUEUED_REL, JSON.stringify({ queued: [] }));
      git('add', 'backlog', '.claude', '.gitignore'); git('commit', '-qm', 'seed');

      const res = numberPendingHashes(repo);
      // The item itself is still numbered — the malicious ref is simply not acted on as a file rename.
      expect(res.assigned).toEqual([{ hash: 'xevil01', nnn: '2201' }]);
      expect(backlogNames()).toContain('2201-attack.md');
      // The out-of-repo victim is untouched: original content intact, NOT deleted, no numbered sibling written.
      expect(existsSync(victimPath)).toBe(true);
      expect(readFileSync(victimPath, 'utf8')).toContain('must not be touched');
      expect(existsSync(numberedSibling)).toBe(false);
    } finally {
      try { rmSync(victimPath, { force: true }); } catch { /* best-effort */ }
      try { rmSync(numberedSibling, { force: true }); } catch { /* best-effort */ }
    }
  });

  it('skips an UNTRACKED hash file (local cruft) instead of aborting the tracked couple (PR #194)', () => {
    write('backlog/2200-legacy.md', '---\nkind: story\n---\n# Legacy\n');
    write('backlog/xland01-item.md', '---\nkind: story\nstatus: resolved\n---\n# Landed item\n');
    write(QUEUED_REL, JSON.stringify({ queued: [] }));
    git('add', 'backlog', '.claude', '.gitignore'); git('commit', '-qm', 'seed');
    // An uncommitted scaffold sits in the checkout — NOT a landed item; a git rm on it would abort the pass.
    write('backlog/xcruft1-wip.md', '---\nkind: task\n---\n# Uncommitted work-in-progress\n');

    const res = numberPendingHashes(repo);
    // Only the tracked hash is numbered; the untracked one is left untouched, not aborted.
    expect(res.assigned).toEqual([{ hash: 'xland01', nnn: '2201' }]);
    expect(backlogNames()).toContain('2201-item.md');
    expect(backlogNames()).toContain('xcruft1-wip.md'); // untracked cruft left as-is
  });
});
