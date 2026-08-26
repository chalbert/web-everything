/**
 * @file scripts/__tests__/lint-locus-prefix.test.mjs
 * @description Integration proof of the RANGE mode of `scripts/lint-locus-prefix.mjs` (#2331) and of the
 *   #3342 fix that made it usable at all from a lane clone. The sweep used to anchor every git call and
 *   every file read to `ROOT` — the directory the SCRIPT itself lives in — so `pr-land`, running out of the
 *   primary checkout against a lane clone, asked the primary checkout for a commit only the lane had. git
 *   exited 128, `pr-land` swallowed it as "could not run", and the check was skipped on essentially every
 *   lane-opened PR. These tests drive the real script against a throwaway git repo standing in for the lane:
 *   with `--root` it sweeps that repo (and CATCHES a bare ref); without it, it still reaches into its own
 *   clone and fails — the bug, pinned so it cannot come back.
 */
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { execFileSync, spawnSync } from 'node:child_process';
import { mkdtempSync, rmSync, mkdirSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const SCRIPTS = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const LINT = join(SCRIPTS, 'lint-locus-prefix.mjs');

let repo;
const git = (...a) => execFileSync('git', a, { cwd: repo, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] });
const write = (rel, txt) => { mkdirSync(dirname(join(repo, rel)), { recursive: true }); writeFileSync(join(repo, rel), txt); };
const head = () => git('rev-parse', 'HEAD').trim();
// Run the linter the way pr-land does: as a child process, from a cwd that is NOT the fixture repo — the
// whole point is that neither the script's location nor the caller's cwd may decide which clone is swept.
const runLint = (...args) => spawnSync(process.execPath, [LINT, ...args], { cwd: tmpdir(), encoding: 'utf8' });

beforeEach(() => {
  repo = mkdtempSync(join(tmpdir(), 'locus-range-'));
  git('init', '-q');
  git('config', 'user.email', 'test@test'); git('config', 'user.name', 'Test');
  git('config', 'commit.gpgsign', 'false');
  write('backlog/0001-seed.md', '---\nkind: task\nstatus: open\n---\n# Seed\n\nTouches we:scripts/seed.mjs only.\n');
  git('add', 'backlog'); git('commit', '-qm', 'seed');
});
afterEach(() => { try { rmSync(repo, { recursive: true, force: true }); } catch { /* best-effort */ } });

describe('lint-locus-prefix --range (#2331) sweeps the repo it is POINTED at (#3342)', () => {
  it('#3342 catches a bare code-path ref in a range whose commits live in ANOTHER clone', () => {
    const base = head();
    write('backlog/0001-seed.md', '---\nkind: task\nstatus: open\n---\n# Seed\n\nNow mentions scripts/leak.ts bare.\n');
    git('add', 'backlog'); git('commit', '-qm', 'leak');

    const r = runLint(`--root=${repo}`, `--range=${base}..${head()}`);

    expect(r.status).toBe(2);                                   // the finding exit code, not an infra crash
    expect(r.stderr).toMatch(/backlog\/0001-seed\.md/);
    expect(r.stderr).toMatch(/scripts\/leak\.ts/);
  });

  it('#3342 exits 0 on a clean range in that same other clone (no false block)', () => {
    const base = head();
    write('backlog/0001-seed.md', '---\nkind: task\nstatus: open\n---\n# Seed\n\nStill only we:scripts/seed.mjs.\n');
    git('add', 'backlog'); git('commit', '-qm', 'clean');

    const r = runLint(`--root=${repo}`, `--range=${base}..${head()}`);

    expect(r.status).toBe(0);
    expect(r.stderr).not.toMatch(/bare code-path ref/);
  });

  it('#3342 reports the ROOT it swept when the range cannot be enumerated there', () => {
    // The old failure mode verbatim: a range naming commits the swept clone has never fetched. It must not
    // masquerade as a pass, and its message must name the clone it looked in — that is the whole diagnosis.
    const r = runLint(`--root=${repo}`, '--range=origin/main..deadbee1deadbee1deadbee1deadbee1deadbee1');

    expect(r.status).not.toBe(0);          // never a silent pass
    expect(r.status).not.toBe(2);          // and never confusable with a real finding
    expect(r.stderr).toMatch(/could not enumerate/);
    expect(r.stderr).toContain(repo);      // names the clone that was swept
  });

  it('#3342 pr-land hands the sweep the repo it is landing FROM, not the script\'s own clone', async () => {
    // Imported HERE, not at module scope, so a tree without the export fails THIS test rather than
    // collapsing the whole file into a collection error that hides the three behavioural proofs above.
    const { buildLocusLintArgs } = await import('../pr-land.mjs');
    const args = buildLocusLintArgs({ root: '/lanes/web-everything/lane-13', range: 'origin/main..abc123' });
    expect(args).toContain('--root=/lanes/web-everything/lane-13');
    expect(args).toContain('--range=origin/main..abc123');
  });
});
