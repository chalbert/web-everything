/**
 * @file no-search-backed-pr-list.test.mjs — the #no-label-search regression guard (2026-09-27 live incident):
 *   `gh pr list --label ready-to-merge` failed the drain every pass with "API rate limit already exceeded"
 *   from GitHub's issue-SEARCH index (a separate, much smaller budget than the ordinary GraphQL list the same
 *   call already is), while the real GraphQL budget had 2000+ points to spare. Three call sites did this
 *   (`scripts/merge-ai-prs.mjs`'s drain listing, `scripts/review-runner.mjs`'s `discoverPending`,
 *   `scripts/lane-resume.mjs`'s `discover`) — all converted in the same change this test ships with, to list
 *   the open PRs plainly and filter by label CLIENT-SIDE. This test scans the real, tracked repo source
 *   (`git ls-files`, not a fixture) so a future regression of the same shape fails a real gate run, not just a
 *   fixture's synthetic case.
 *
 *   PROOF THIS TEST IS NOT VACUOUS: reverting any one of the three fixed call sites to its pre-fix `--label`
 *   argv reproduces a failure here (verified by hand while authoring this change — see the PR description for
 *   the before/after run). The allowlist below is deliberately narrow and named per file, so it cannot
 *   silently swallow a new, unrelated offender.
 */
import { describe, it, expect } from 'vitest';
import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { findSearchBackedGhListCalls } from '../no-search-backed-pr-list.mjs';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..', '..', '..');

/**
 * Sanctioned exceptions — a genuinely different pattern from the incident (see the module header for why):
 * `--search '<title> in:title' --state merged`, a duplicate-title check against UNBOUNDED merged-PR history,
 * where "list everything, then filter client-side" is not a safe substitute. Keyed by repo-relative path;
 * each entry names the flag it allows so an unrelated new flag on the SAME file still fails loudly.
 */
const ALLOWLIST = {
  'scripts/operations/dispatch-lane-io.mjs': ['--search'],
  'scripts/readiness/conveyor-instrument.mjs': ['--search'],
};

function trackedSourceFiles() {
  const out = execFileSync('git', ['ls-files', 'scripts', 'skills-src'], { cwd: ROOT, encoding: 'utf8' });
  return out.split('\n').filter((f) => /\.(mjs|js)$/.test(f) && !/\/__tests__\/|\/__fixtures__\//.test(f));
}

describe('no-search-backed-pr-list (#no-label-search)', () => {
  it('flags a synthetic --label on a pr list argv (the exact pre-fix shape)', () => {
    const src = `
      const listArgs = ['pr', 'list', '--repo', repo, '--state', 'open', '--limit', '100'];
      if (label) listArgs.push('--label', label);
    `;
    const findings = findSearchBackedGhListCalls(src);
    expect(findings.map((f) => f.flag)).toEqual(['--label']);
  });

  it('does not flag an ordinary --label on gh pr edit/create (a real write, not a list)', () => {
    const src = `execFileSync('gh', ['pr', 'edit', String(n), '--add-label', label]);`;
    expect(findSearchBackedGhListCalls(src)).toEqual([]);
  });

  it('does not flag a plain, unfiltered gh pr list', () => {
    const src = `const prs = shJSON('gh', ['pr', 'list', ...repoFlag, '--state', 'open', '--json', 'number,labels'], []);`;
    expect(findSearchBackedGhListCalls(src)).toEqual([]);
  });

  it('every tracked scripts/ + skills-src/ source file is free of an unallowlisted --label/--search/--author on a pr|issue list call', () => {
    const offenders = [];
    for (const file of trackedSourceFiles()) {
      let content;
      try { content = readFileSync(join(ROOT, file), 'utf8'); } catch { continue; }
      const findings = findSearchBackedGhListCalls(content);
      const allowed = ALLOWLIST[file] || [];
      for (const f of findings) {
        if (!allowed.includes(`--${f.flag.replace(/^--/, '')}`) && !allowed.includes(f.flag)) {
          offenders.push(`${file}:${f.line} — ${f.flag} on a pr/issue list call (search-backed; rate-limits separately from the GraphQL budget — #no-label-search)`);
        }
      }
    }
    expect(offenders).toEqual([]);
  });
});
