/**
 * @file check-backlog-item.test.mjs — the per-item checker's WIRING (#3201).
 *
 * The rules it composes are unit-tested where they live (`lintBacklogItemRendering`,
 * `scanRepoLocusPrefixes` in `we:scripts/__tests__/check-standards-rules.test.mjs`). What had no test — and
 * what actually cost four review cycles on 2026-08-19 — is which of them this CLI RUNS. The locus-prefix scan
 * was in the write path and in CI and in neither of the places an author reaches while writing, so
 * `check-backlog-item` reported clean and `check:standards` rejected minutes later, every time with the same
 * signature. A missing wire is invisible to every rule-level test in the repo.
 *
 * So this drives the real CLI as a subprocess. It writes a card into `backlog/` because that is the only
 * directory the CLI reads — resolved from its own location, with no override — and removes it in a `finally`
 * AND an `afterEach`, because a stray card would redden the whole-repo gate for everyone.
 */
import { describe, it, expect, afterEach } from 'vitest';
import { spawnSync } from 'node:child_process';
import { existsSync, rmSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..', '..');
const CLI = join(ROOT, 'scripts', 'check-backlog-item.mjs');
/** A hash id shaped like a real provisional one (#2288) but reserved for this file. */
const ID = 'x0zzzz9';
const CARD = join(ROOT, 'backlog', `${ID}-per-item-checker-wiring-fixture.md`);

const card = (body) => `---
kind: task
status: open
dateOpened: "2026-08-19"
tags: []
---

# per-item checker wiring fixture

A digest with no code paths in it at all, so the only thing under test is the body below.

${body}
`;

const run = () => {
  const r = spawnSync(process.execPath, [CLI, ID], { encoding: 'utf8', cwd: ROOT });
  return { code: r.status, out: `${r.stdout}${r.stderr}` };
};

const write = (body) => writeFileSync(CARD, card(body));
const clean = () => { if (existsSync(CARD)) rmSync(CARD, { force: true }); };
afterEach(clean);

describe('check-backlog-item runs the #883 locus-prefix scan (#3201)', () => {
  // THE REGRESSION. The scaffold validates the DIGEST at creation, so the digest is always right; the body is
  // appended afterwards and carries all the file references. This is that body.
  it('rejects a bare code-path reference in the BODY, which it used to pass', () => {
    try {
      write('The fix belongs in `scripts/merge-ai-prs.mjs`, near the rebase loop.');
      const { code, out } = run();
      expect(code).toBe(1);
      expect(out).toMatch(/bare code-path ref/);
      // Names the fix, not just the rule — the message an author acts on without looking anything up.
      expect(out).toContain('we:scripts/merge-ai-prs.mjs');
    } finally { clean(); }
  });

  it('passes a body whose references carry their prefix, so the check is not a wall', () => {
    try {
      write('The fix belongs in `we:scripts/merge-ai-prs.mjs`, near the rebase loop.');
      const { code } = run();
      expect(code).toBe(0);
    } finally { clean(); }
  });

  // A clean run must not read as a clean bill of health for checks this pass cannot see. Silence about the
  // difference is what let a green per-item run be mistaken for a green gate.
  it('states which gates it did NOT run, even when everything it did run passed', () => {
    try {
      write('Nothing to see here.');
      const { code, out } = run();
      expect(code).toBe(0);
      expect(out).toMatch(/single-file pass/);
      expect(out).toMatch(/check:standards/);
    } finally { clean(); }
  });
});
