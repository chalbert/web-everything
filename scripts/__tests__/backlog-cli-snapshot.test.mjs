/**
 * @file backlog-cli-snapshot.test.mjs — #2273 Tier-A CLI-level integration-smoke layer, on the #2274
 * ephemeral-throwaway-clone substrate: `mkdtempSync` + a copy of the real `scripts/` tree (so the CLI's
 * own `ROOT`, derived from its copied `import.meta.url`, resolves INSIDE the throwaway clone — never the
 * real repo), run the REAL `node scripts/backlog.mjs <verb>` subprocess, assert its actual exit code +
 * the resulting file content on disk, `rmSync` in teardown.
 *
 * This complements `golden-corpus-snapshot.test.mjs` (which replays the full 92-fixture historical
 * corpus, but only at the pure-function layer — `applyTransition`/`applySettle` take an injected `today`,
 * so a byte-for-byte replay of a historically-DATED fixture is only possible there). The real CLI stamps
 * `dateStarted`/`dateResolved` from the wall clock (`scripts/backlog.mjs`'s `today()`), so it cannot
 * reproduce a fixture's historical date — this file instead proves the CLI WIRING around that pure core
 * (arg parsing → file resolution by NNN → the CLI-only guards `applyTransition` doesn't own, like the
 * #658 no-open-slice epic guard → the write → the real process exit code), using freshly-authored cases
 * where "today" is naturally correct. A handful of representative cases, not the full corpus — the corpus
 * itself is exhaustively covered at the pure layer.
 */
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { execFileSync } from 'node:child_process';
import { mkdtempSync, rmSync, mkdirSync, writeFileSync, readFileSync, cpSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const WE_SCRIPTS_DIR = dirname(dirname(fileURLToPath(import.meta.url))); // .../scripts (this file is scripts/__tests__/*)
const TODAY = new Date().toISOString().slice(0, 10);

let clone;
beforeAll(() => {
  clone = mkdtempSync(join(tmpdir(), 'we-backlog-cli-snapshot-'));
  // Copy the real scripts/ tree wholesale so backlog.mjs's own ROOT (derived from ITS OWN copied
  // import.meta.url) resolves inside the throwaway clone, not the real repo — the mutation genuinely
  // lands only in `clone/backlog/*`, never touches this lane's real `backlog/`.
  cpSync(WE_SCRIPTS_DIR, join(clone, 'scripts'), { recursive: true });
  // `claim`/`resolve`/etc unconditionally re-save reservations/claims state alongside the frontmatter
  // write (best-effort convenience bookkeeping, not gated on it existing) — seed empty state so that
  // save doesn't ENOENT on a directory this throwaway clone never had a reason to create otherwise.
  mkdirSync(join(clone, '.claude', 'skills', 'batch-backlog-items'), { recursive: true });
});
afterAll(() => {
  try { rmSync(clone, { recursive: true, force: true }); } catch { /* best-effort teardown */ }
});

const BACKLOG_MJS = () => join(clone, 'scripts', 'backlog.mjs');
const backlogPath = (rel) => join(clone, 'backlog', rel);
const write = (rel, content) => { mkdirSync(join(clone, 'backlog'), { recursive: true }); writeFileSync(backlogPath(rel), content); };
const read = (rel) => readFileSync(backlogPath(rel), 'utf8');

/** Run the real CLI subprocess against the throwaway clone; never throws — captures exit code + output. */
function run(args) {
  try {
    const stdout = execFileSync('node', [BACKLOG_MJS(), ...args, '--json'], { cwd: clone, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] });
    return { code: 0, json: JSON.parse(stdout) };
  } catch (e) {
    let json;
    try { json = JSON.parse(e.stdout); } catch { /* not JSON (a die() before JSON_MODE parsed, or a crash) */ }
    return { code: typeof e.status === 'number' ? e.status : 1, json, stdout: e.stdout, stderr: e.stderr };
  }
}

const item = (fields, body = '# Title\n\nBody.\n') =>
  `---\n${Object.entries(fields).map(([k, v]) => `${k}: ${v}`).join('\n')}\n---\n\n${body}`;

describe('backlog.mjs CLI — ephemeral-clone integration smoke (#2273/#2274)', () => {
  it('claim: open → active, exit 0, stamps dateStarted=today', () => {
    write('9001-a.md', item({ kind: 'story', size: 2, status: 'open', dateOpened: '"2026-07-01"' }));
    const res = run(['claim', '9001']);
    expect(res.code).toBe(0);
    expect(res.json.ok).toBe(true);
    const after = read('9001-a.md');
    expect(after).toContain('status: active');
    expect(after).toContain(`dateStarted: "${TODAY}"`);
    expect(after).toContain('# Title'); // body untouched
  });

  it('claim: refused on a non-open item, exit 1, file left untouched', () => {
    write('9002-b.md', item({ kind: 'task', status: 'active', dateOpened: '"2026-07-01"', dateStarted: '"2026-07-01"' }));
    const before = read('9002-b.md');
    const res = run(['claim', '9002']);
    expect(res.code).toBe(1);
    expect(res.json.ok).toBe(false);
    expect(res.json.error).toMatch(/expected "open"/);
    expect(read('9002-b.md')).toBe(before); // refused write never lands
  });

  it('resolve: active → resolved, exit 0, stamps dateResolved=today + graduatedTo', () => {
    write('9003-c.md', item({ kind: 'story', size: 3, status: 'active', dateOpened: '"2026-07-01"', dateStarted: '"2026-07-01"' }));
    const res = run(['resolve', '9003', '--graduated-to=we:scripts/example.mjs']);
    expect(res.code).toBe(0);
    const after = read('9003-c.md');
    expect(after).toContain('status: resolved');
    expect(after).toContain(`dateResolved: "${TODAY}"`);
    expect(after).toContain('graduatedTo: "we:scripts/example.mjs"');
  });

  it('resolve: a kind:decision refuses without codifiedIn (#911), exit 1', () => {
    write('9004-d.md', item({ kind: 'decision', status: 'open', dateOpened: '"2026-07-01"' }));
    const before = read('9004-d.md');
    const res = run(['resolve', '9004']);
    expect(res.code).toBe(1);
    expect(res.json.error).toMatch(/codifiedIn|codified/i);
    expect(read('9004-d.md')).toBe(before);
  });

  it('resolve: an epic with an open child is refused (#658 no-open-slice guard), exit 1', () => {
    write('9005-e.md', item({ kind: 'epic', status: 'active', dateOpened: '"2026-07-01"', dateStarted: '"2026-07-01"' }));
    write('9006-e-child.md', item({ kind: 'task', parent: '"9005"', status: 'open', dateOpened: '"2026-07-01"' }));
    const before = read('9005-e.md');
    const res = run(['resolve', '9005']);
    expect(res.code).toBe(1);
    expect(res.json.error).toMatch(/open child/i);
    expect(read('9005-e.md')).toBe(before); // the CLI-only guard refuses BEFORE any write
  });

  it('release: active → open, stamps left untouched, exit 0', () => {
    write('9007-f.md', item({ kind: 'story', size: 1, status: 'active', dateOpened: '"2026-07-01"', dateStarted: '"2026-07-05"' }));
    const res = run(['release', '9007']);
    expect(res.code).toBe(0);
    const after = read('9007-f.md');
    expect(after).toContain('status: open');
    expect(after).toContain('dateStarted: "2026-07-05"'); // release does NOT clear the stamp
  });

  it('settle: a born-active scaffold → open, drops scaffoldedBy/dateScaffolded, exit 0', () => {
    write('9008-g.md', item({ kind: 'task', status: 'active', scaffoldedBy: '"batch-x"', dateScaffolded: '"2026-07-01"', dateOpened: '"2026-07-01"' }));
    const res = run(['settle', '9008']);
    expect(res.code).toBe(0);
    const after = read('9008-g.md');
    expect(after).toContain('status: open');
    expect(after).not.toMatch(/^scaffoldedBy:/m);
    expect(after).not.toMatch(/^dateScaffolded:/m);
  });

  it('settle: refuses a normally-claimed (non-scaffold) item, exit 1, file untouched', () => {
    write('9009-h.md', item({ kind: 'task', status: 'active', dateOpened: '"2026-07-01"', dateStarted: '"2026-07-01"' }));
    const before = read('9009-h.md');
    const res = run(['settle', '9009']);
    expect(res.code).toBe(1);
    expect(res.json.error).toMatch(/scaffoldedBy|scaffold/i);
    // Pin the actual redirect: a normally-claimed item is closed by `resolve`, not `release` — the two
    // verbs mean very different things (finish vs. abandon-back-to-open), so this wording is load-bearing.
    expect(res.json.error).toMatch(/closed by resolve/);
    expect(read('9009-h.md')).toBe(before);
  });

  it('an unknown item reference exits 1 without touching the tree', () => {
    const res = run(['claim', '9999']);
    expect(res.code).toBe(1);
  });
});
