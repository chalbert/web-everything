import { describe, it, expect } from 'vitest';
import { execFileSync } from 'node:child_process';
import { mkdtempSync, mkdirSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const CLI = join(dirname(dirname(fileURLToPath(import.meta.url))), 'backlog.mjs');

/**
 * #1961 correctness round 2 — the WIRING, not the predicate.
 *
 * Round 1 extracted `isLaneLocus` and tested it, which left the juror's original finding half-fixed: a
 * tested predicate that `numberStranded()` failed to call would still ship a guard that never fires. This
 * spawns the real CLI with a lane-shaped cwd and asserts the refusal, so mutating the call site — not just
 * the predicate — reddens a test.
 *
 * The cwd is a synthesised `<tmp>/.lanes/<pool>/lane-1`, not the lane this suite happens to run in: the
 * assertion must hold in CI, where the checkout is not a lane at all.
 */
describe('number-stranded refuses in a lane clone (#1961)', () => {
  const run = (cwd) => {
    try {
      const stdout = execFileSync(process.execPath, [CLI, 'number-stranded', '--dry-run'],
        { cwd, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] });
      return { code: 0, out: stdout };
    } catch (e) {
      return { code: e.status ?? 1, out: `${e.stdout ?? ''}${e.stderr ?? ''}` };
    }
  };

  it('refuses, naming the reason and both places it DOES belong', () => {
    const base = mkdtempSync(join(tmpdir(), 'ns-locus-'));
    const lane = join(base, '.lanes', 'web-everything', 'lane-1');
    mkdirSync(lane, { recursive: true });
    try {
      const { code, out } = run(lane);
      expect(code).not.toBe(0);
      expect(out).toMatch(/refusing to run in a LANE clone/);
      // The remedy must be in the message — a refusal that does not say where to go is a dead end.
      expect(out).toMatch(/PRIMARY checkout/);
      expect(out).toMatch(/drain/);
    } finally {
      rmSync(base, { recursive: true, force: true });
    }
  });

  it('does NOT refuse on locus grounds outside a lane — the guard must not fire everywhere', () => {
    const base = mkdtempSync(join(tmpdir(), 'ns-primary-'));
    try {
      const { out } = run(base);
      // It may still fail for unrelated reasons (no git repo there); what must NOT appear is the locus
      // refusal, which would mean the guard fires on a primary checkout too.
      expect(out).not.toMatch(/refusing to run in a LANE clone/);
    } finally {
      rmSync(base, { recursive: true, force: true });
    }
  });
});
