/**
 * @file land-advance-tools.test.mjs — pins the per-kind tool grants a dispatched session gets (#3853).
 *
 * `land-advance-tools.mjs` is a pure leaf: `ALLOWED_TOOLS_BY_KIND` is the table, `allowedToolsArg` renders one
 * kind as a single `--allowedTools=a,b,c` argv atom (the variadic `--allowedTools a b` form would swallow the
 * prompt that follows it). The tests pin the grants that matter for safety: review is read-only and can only
 * GET the API, build/fix can edit and push but the two repair rows cannot `gh pr edit`.
 */

import { describe, expect, it } from 'vitest';

import { ALLOWED_TOOLS_BY_KIND, allowedToolsArg } from '../land-advance-tools.mjs';

const toolsOf = (kind) => allowedToolsArg(kind).slice('--allowedTools='.length).split(',');

describe('ALLOWED_TOOLS_BY_KIND', () => {
  it('defines exactly the five dispatch kinds', () => {
    expect(Object.keys(ALLOWED_TOOLS_BY_KIND).sort()).toEqual(['build', 'ci-heal', 'conflict-fix', 'fix', 'review']);
  });

  it('is deeply frozen: the table and every per-kind list', () => {
    expect(Object.isFrozen(ALLOWED_TOOLS_BY_KIND)).toBe(true);
    for (const list of Object.values(ALLOWED_TOOLS_BY_KIND)) expect(Object.isFrozen(list)).toBe(true);
  });

  it('review is read-only: no Edit, no Write, no git mutation, API access limited to GET', () => {
    const review = ALLOWED_TOOLS_BY_KIND.review;
    expect(review).toEqual(expect.arrayContaining(['Read', 'Grep', 'Glob', 'Bash(gh pr view:*)', 'Bash(gh pr diff:*)', 'Bash(gh pr list:*)']));
    expect(review).toContain('Bash(gh api --method GET:*)');
    expect(review).not.toContain('Edit');
    expect(review).not.toContain('Write');
    expect(review.filter((t) => t.startsWith('Bash(git '))).toEqual([]);
    expect(review.filter((t) => t.startsWith('Bash(gh api'))).toEqual(['Bash(gh api --method GET:*)']);
  });

  it('review names its operation and lifecycle tools and nothing wider under node', () => {
    const nodeGrants = ALLOWED_TOOLS_BY_KIND.review.filter((t) => t.startsWith('Bash(node '));
    expect(nodeGrants).toEqual([
      'Bash(node scripts/operations/wip-agents-cli.mjs)',
      'Bash(node scripts/operations/review-loop-cli.mjs:*)',
      'Bash(node scripts/operations/completion-cli.mjs report:*)',
      'Bash(node scripts/lane-pool.mjs acquire:*)',
      'Bash(node scripts/lane-pool.mjs release:*)',
    ]);
  });

  it('build can edit, write, run scripts, commit and push, and open or edit a PR', () => {
    expect(ALLOWED_TOOLS_BY_KIND.build).toEqual(
      expect.arrayContaining([
        'Read', 'Edit', 'Write', 'Bash(node scripts/*)',
        'Bash(git add:*)', 'Bash(git commit:*)', 'Bash(git push:*)', 'Bash(git status:*)', 'Bash(git diff:*)',
        'Bash(git log:*)', 'Bash(git fetch:*)', 'Bash(git rev-parse:*)',
        'Bash(gh pr create:*)', 'Bash(gh pr view:*)', 'Bash(gh pr edit:*)',
      ]),
    );
  });

  it('build never gets a force push, a reset, or a rebase', () => {
    for (const t of ALLOWED_TOOLS_BY_KIND.build) {
      expect(t).not.toMatch(/reset|rebase|--force|checkout|merge/);
    }
  });

  it('fix has the same grants as build, as its own copy', () => {
    expect(ALLOWED_TOOLS_BY_KIND.fix).toEqual(ALLOWED_TOOLS_BY_KIND.build);
    expect(ALLOWED_TOOLS_BY_KIND.fix).not.toBe(ALLOWED_TOOLS_BY_KIND.build);
  });

  it('ci-heal and conflict-fix are build minus `gh pr edit` (no direct label edit)', () => {
    const expected = ALLOWED_TOOLS_BY_KIND.build.filter((t) => t !== 'Bash(gh pr edit:*)');
    expect(ALLOWED_TOOLS_BY_KIND['ci-heal']).toEqual(expected);
    expect(ALLOWED_TOOLS_BY_KIND['conflict-fix']).toEqual(expected);
    expect(ALLOWED_TOOLS_BY_KIND['ci-heal']).not.toContain('Bash(gh pr edit:*)');
    expect(ALLOWED_TOOLS_BY_KIND['conflict-fix']).not.toContain('Bash(gh pr edit:*)');
  });
});

describe('allowedToolsArg', () => {
  it('renders a kind as ONE `--allowedTools=` atom with comma-joined grants', () => {
    for (const kind of Object.keys(ALLOWED_TOOLS_BY_KIND)) {
      const arg = allowedToolsArg(kind);
      expect(arg.startsWith('--allowedTools=')).toBe(true);
      expect(arg).toBe(`--allowedTools=${ALLOWED_TOOLS_BY_KIND[kind].join(',')}`);
      expect(arg).not.toMatch(/\s--allowedTools/);
    }
  });

  it('review renders as the exact read-only string', () => {
    expect(allowedToolsArg('review')).toBe(
      '--allowedTools=Read,Grep,Glob,Bash(gh pr view:*),Bash(gh pr diff:*),Bash(gh pr list:*),' +
        'Bash(gh api --method GET:*),Bash(node scripts/operations/wip-agents-cli.mjs),' +
        'Bash(node scripts/operations/review-loop-cli.mjs:*),Bash(node scripts/operations/completion-cli.mjs report:*),' +
        'Bash(node scripts/lane-pool.mjs acquire:*),Bash(node scripts/lane-pool.mjs release:*)',
    );
  });

  it('fix and build render identically; the round trip preserves order', () => {
    expect(allowedToolsArg('fix')).toBe(allowedToolsArg('build'));
    expect(toolsOf('build')).toEqual([...ALLOWED_TOOLS_BY_KIND.build]);
  });

  it('throws a TypeError naming an unknown kind', () => {
    expect(() => allowedToolsArg('deploy')).toThrow(TypeError);
    expect(() => allowedToolsArg('deploy')).toThrow('Unknown dispatch kind: deploy');
  });

  it('does not treat inherited Object.prototype keys as kinds', () => {
    for (const bad of ['toString', 'constructor', '__proto__', 'hasOwnProperty']) {
      expect(() => allowedToolsArg(bad)).toThrow(TypeError);
    }
  });
});
