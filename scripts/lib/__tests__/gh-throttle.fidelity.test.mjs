/**
 * @file scripts/lib/__tests__/gh-throttle.fidelity.test.mjs
 * @description REAL, side-by-side pass-through fidelity proof for #3621's `gh`-throttle wrapper — against the
 *   ACTUAL `gh` binary, not a mock. Two things get proven for real, both directions the wrapper is offered in:
 *
 *   1. The IMPORTABLE `runGhSync` seam: its return value on success is byte-identical to a raw
 *      `execFileSync('gh', args, opts)` call, for several safe, read-only commands.
 *   2. The STANDALONE CLI passthrough (`node scripts/lib/gh-throttle.mjs <args>`): its stdout, stderr, and
 *      exit code are byte-identical to running the real `gh <args>` directly.
 *
 * SKIPS CLEANLY (never fails red) when `gh` is not on PATH or not authenticated — this proves fidelity when the
 * real tool is available; it is not a substitute for the mocked semaphore/backoff unit proof in
 * `gh-throttle.test.mjs`, which needs neither.
 */
import { describe, it, expect, beforeAll } from 'vitest';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { runGhSync } from '../gh-throttle.mjs';

const HERE = dirname(fileURLToPath(import.meta.url));
const WRAPPER = join(HERE, '..', 'gh-throttle.mjs');

function ghAvailable() {
  try {
    execFileSync('gh', ['auth', 'status'], { stdio: 'ignore' });
    return true;
  } catch {
    return false;
  }
}

const available = ghAvailable();
const d = available ? describe : describe.skip;

d('real side-by-side pass-through fidelity against the actual gh binary', () => {
  let repoSlug;
  let realPrNum;

  beforeAll(() => {
    repoSlug = execFileSync('gh', ['repo', 'view', '--json', 'nameWithOwner', '-q', '.nameWithOwner'], { encoding: 'utf8' }).trim();
    // A real, already-merged PR on this repo — safe, read-only, and stable (won't change again).
    const merged = JSON.parse(execFileSync('gh', ['pr', 'list', '--repo', repoSlug, '--state', 'merged', '--limit', '1', '--json', 'number'], { encoding: 'utf8' }));
    realPrNum = merged[0].number;
  });

  it('runGhSync: `gh api rate_limit` — identical stdout to a raw execFileSync call', () => {
    const raw = execFileSync('gh', ['api', 'rate_limit'], { encoding: 'utf8' });
    const throttled = runGhSync(['api', 'rate_limit'], { encoding: 'utf8' });
    // The two calls happen microseconds apart; `resources.core.used` can legitimately tick between them, so
    // compare STRUCTURE (parses, same top-level shape) rather than asserting byte-identical JSON text — the
    // CLI-passthrough test below is the one that proves true byte-for-byte identity, on a command with no
    // between-call-mutable field.
    const rawParsed = JSON.parse(raw);
    const throttledParsed = JSON.parse(throttled);
    expect(Object.keys(throttledParsed).sort()).toEqual(Object.keys(rawParsed).sort());
    expect(throttledParsed.resources.core.limit).toBe(rawParsed.resources.core.limit);
  });

  it('runGhSync: `gh pr view <n> --json number,state,title` — byte-identical stdout (immutable, merged PR)', () => {
    const args = ['pr', 'view', String(realPrNum), '--repo', repoSlug, '--json', 'number,state,title'];
    const raw = execFileSync('gh', args, { encoding: 'utf8' });
    const throttled = runGhSync(args, { encoding: 'utf8' });
    expect(throttled).toBe(raw); // an already-merged PR's number/state/title cannot change between the two calls
  });

  it('runGhSync: a real failure (unknown PR number) throws the SAME shape as a raw execFileSync throw', () => {
    const args = ['pr', 'view', '999999999', '--repo', repoSlug, '--json', 'number'];
    let rawErr = null, throttledErr = null;
    try { execFileSync('gh', args, { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] }); } catch (e) { rawErr = e; }
    try { runGhSync(args, { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] }); } catch (e) { throttledErr = e; }
    expect(rawErr).not.toBeNull();
    expect(throttledErr).not.toBeNull();
    expect(throttledErr.status).toBe(rawErr.status);
    expect(String(throttledErr.stderr)).toBe(String(rawErr.stderr));
  });

  it('CLI passthrough: `node gh-throttle.mjs api rate_limit` — same shape as raw gh, exit 0', () => {
    const raw = execFileSync('gh', ['api', 'rate_limit'], { encoding: 'utf8' });
    const viaWrapper = execFileSync('node', [WRAPPER, 'api', 'rate_limit'], { encoding: 'utf8' });
    expect(JSON.parse(viaWrapper).resources.core.limit).toBe(JSON.parse(raw).resources.core.limit);
  });

  it('CLI passthrough: byte-identical stdout on an immutable read (merged PR), matching exit code', () => {
    const args = ['pr', 'view', String(realPrNum), '--repo', repoSlug, '--json', 'number,state,title'];
    const raw = execFileSync('gh', args, { encoding: 'utf8' });
    const viaWrapper = execFileSync('node', [WRAPPER, ...args], { encoding: 'utf8' });
    expect(viaWrapper).toBe(raw);
  });

  it('CLI passthrough: relays a real failure’s stderr text and NON-ZERO exit code identically', () => {
    const args = ['pr', 'view', '999999999', '--repo', repoSlug, '--json', 'number'];
    let rawErr = null, wrapperErr = null;
    try { execFileSync('gh', args, { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] }); } catch (e) { rawErr = e; }
    try { execFileSync('node', [WRAPPER, ...args], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] }); } catch (e) { wrapperErr = e; }
    expect(rawErr).not.toBeNull();
    expect(wrapperErr).not.toBeNull();
    expect(wrapperErr.status).toBe(rawErr.status);
    expect(String(wrapperErr.stderr).trim()).toBe(String(rawErr.stderr).trim());
  });
});
