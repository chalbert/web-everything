/**
 * @file scripts/operations/__tests__/heavy-queue-io-real.test.mjs
 * @description Card xb0iuxq — the fidelity qualifier (mirrors `daemon-status-io-real.test.mjs`, #4067/#2949):
 *   real subprocess proof for `heavy-queue-io.mjs`'s two real reads, separate from the injected-fakes suite in
 *   `heavy-queue-io.test.mjs`. `readProcessCommand` is exercised against THIS TEST'S OWN live pid (a real `ps`
 *   call, not a stub); `gitIsAncestor` against a `withRealRepo` fixture's own real commits, DELIBERATELY NOT
 *   the ambient CI checkout — CI's `actions/checkout` is a SHALLOW clone (default `fetch-depth: 1`), so an old
 *   commit like `SELECTED_GATE_MERGE_SHA` is genuinely absent from ITS object database (a real, environment-
 *   dependent "false", not a bug) even though it is a true ancestor of the FULL history. A first pass of this
 *   file asserted `gitIsAncestor(process.cwd(), SELECTED_GATE_MERGE_SHA)` directly and it failed exactly this
 *   way in CI while passing locally (a full local clone) — the fixture below is the environment-independent
 *   replacement, mirroring `daemon-status-io-real.test.mjs`'s own `withNarrowClone` discipline for the same
 *   underlying lesson (#3264: a stub/ambient assumption has no real clone geometry to be tested against).
 */
import { it, expect } from 'vitest';
import { readProcessCommand, gitIsAncestor } from '../heavy-queue-io.mjs';
import { withRealRepo } from './helpers/real-repo.mjs';

it('readProcessCommand reads a REAL command line for this test runner\'s own live pid', () => {
  const cmd = readProcessCommand(process.pid);
  expect(typeof cmd).toBe('string');
  expect(cmd.length).toBeGreaterThan(0);
  // The vitest worker is itself a node process — its own argv reliably contains "node" somewhere in the line.
  expect(cmd.toLowerCase()).toMatch(/node/);
});

it('readProcessCommand returns null for a pid that cannot exist, never throws', () => {
  expect(readProcessCommand(999999999)).toBeNull();
});

it('readProcessCommand returns null for a non-integer/absent pid without touching the real `ps`', () => {
  expect(readProcessCommand(null)).toBeNull();
  expect(readProcessCommand(undefined)).toBeNull();
  expect(readProcessCommand(-1)).toBeNull();
});

// #2692 independent review (security/secret-exposure, CONFIRMED): a held/waiting job's argv can carry a
// credential-shaped value (--token=…, an Authorization header, a postgres:// connection string), and this
// operation's `command` field reaches an operator's terminal, --json, and any HTTP adapter this operation is
// served through. `readProcessCommand` must never let the RAW `ps` output escape this function.
it('readProcessCommand redacts a credential-shaped value in the (real, injected) ps output — never leaks the raw argv', () => {
  const raw = "node scripts/some-tool.mjs --token=sk-abc123SECRET --db=postgres://user:hunter2@host/db";
  const cmd = readProcessCommand(process.pid, { exec: () => raw });
  expect(cmd).not.toContain('sk-abc123SECRET');
  expect(cmd).not.toContain('hunter2');
  expect(cmd).toContain('[REDACTED]');
});

it('gitIsAncestor is false (never throws) for a repo path that is not a git checkout at all', () => {
  expect(gitIsAncestor('/definitely/not/a/repo/path/xyz', '14a3d0dff')).toBe(false);
});

it('gitIsAncestor is false for a null/empty repo without shelling out', () => {
  expect(gitIsAncestor(null, '14a3d0dff')).toBe(false);
  expect(gitIsAncestor('', '14a3d0dff')).toBe(false);
});

// #2949 fidelity qualifier (motivated by #3264): a stub `exec` has no clone geometry at all, so it cannot
// witness whether `git -C <repo> merge-base --is-ancestor <sha> HEAD` behaves as this module assumes against
// a REAL repo — a real `.git`, real commits, a real HEAD. This is the mechanism proof `heavy-queue-io.test.mjs`
// (injected fakes) cannot provide on its own.
it('gitIsAncestor, against a REAL repo (withRealRepo): true once HEAD descends from the commit, false before it existed and for an unrelated sha', async () => {
  await withRealRepo(async ({ root, commit, head }) => {
    const first = head(); // the fixture's own initial commit
    commit({ 'second.txt': 'more\n' }, 'fixture: second commit');
    const second = head();

    // HEAD (now `second`) genuinely descends from `first` — the real ancestry this module's classification
    // for a `verify-lane.mjs` holder depends on.
    expect(gitIsAncestor(root, first)).toBe(true);
    // A commit is trivially its own ancestor.
    expect(gitIsAncestor(root, second)).toBe(true);
    // A sha that names nothing in this repo's real object database — never an ancestor, never a throw.
    expect(gitIsAncestor(root, '0000000000000000000000000000000000000000')).toBe(false);
  });
});
