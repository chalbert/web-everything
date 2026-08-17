/**
 * @file scripts/__tests__/gen-inventory-staged.test.mjs
 * @description Reproduces the PR #1414 review bounce EXACTLY: a developer stages an unrelated
 *   inventory-affecting registry file, has a SEPARATE unstaged edit sitting in AGENTS.md (mid-edit,
 *   or left over from a partial `git add -p`), and commits. The old `regenerate()` read/wrote the
 *   whole working-tree AGENTS.md and blindly `git add`ed it, silently sweeping the unstaged content
 *   into the commit — breaking git's "only staged content lands in the commit" guarantee. The
 *   reviewer reproduced this directly (staged throwaway registry file + unstaged marker line +
 *   commit → marker line landed in the commit despite never being staged).
 *
 *   `regenerateStaged()` (scripts/gen-inventory.mjs) fixes this by operating on the git INDEX only
 *   (`git show :path` as the splice baseline, `hash-object` + `update-index --cacheinfo` to write the
 *   result back) — the working-tree file is never read as a baseline and never blindly overwritten.
 *   These tests run against a REAL ephemeral `git init` scratch repo (mkdtemp, never the shared lane
 *   pool — same substrate convention as verify-lane.test.mjs) and make REAL `git commit`s, then
 *   inspect the actual committed blob, so this is a real reproduction, not a simulation.
 */
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { execFileSync } from 'node:child_process';
import { mkdtempSync, rmSync, writeFileSync, readFileSync, mkdirSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { regenerateStaged, START, END } from '../gen-inventory.mjs';

const OLD_BODY = '- **Plugs** 1 — 1 stable';
const NEW_BODY = '- **Plugs** 2 — 2 stable';
const AGENTS_TEMPLATE = (body) => `# AGENTS\n\nsome preamble\n\n${START}\n${body}\n${END}\n\nsome trailer\n`;
const UNSTAGED_MARKER = 'UNSTAGED_MARKER_LINE_NEVER_COMMITTED';

let dir;
function git(...args) {
  return execFileSync('git', args, { cwd: dir, encoding: 'utf8' });
}
function commit(msg) {
  return git('-c', 'user.email=t@t', '-c', 'user.name=t', 'commit', '-qm', msg);
}

beforeEach(() => {
  dir = mkdtempSync(join(tmpdir(), 'gen-inventory-staged-'));
  git('init', '-q');
  writeFileSync(join(dir, 'AGENTS.md'), AGENTS_TEMPLATE(OLD_BODY));
  git('add', 'AGENTS.md');
  commit('initial AGENTS.md');
});
afterEach(() => {
  rmSync(dir, { recursive: true, force: true });
});

describe('regenerateStaged — #1414 review bounce reproduction (unstaged AGENTS.md edit must never be swept into a commit)', () => {
  it('stages a throwaway registry file + leaves AGENTS.md with an UNSTAGED marker line, commits — the marker line does NOT appear in the commit', () => {
    // Stage an unrelated throwaway "registry file" — the thing that actually triggers the hook.
    mkdirSync(join(dir, 'src/_data/blocks'), { recursive: true });
    writeFileSync(join(dir, 'src/_data/blocks/throwaway.json'), '{"id":"throwaway","status":"stable"}\n');
    git('add', 'src/_data/blocks/throwaway.json');

    // Separately, an UNSTAGED edit sitting in AGENTS.md — never `git add`ed.
    const withMarker = AGENTS_TEMPLATE(OLD_BODY).replace('some trailer', `some trailer\n${UNSTAGED_MARKER}`);
    writeFileSync(join(dir, 'AGENTS.md'), withMarker);

    // This is what the pre-commit hook runs before `git commit` executes.
    const wrote = regenerateStaged({ root: dir, body: NEW_BODY });
    expect(wrote).toBe(true);

    commit('stage a registry file');

    const committedAgents = git('show', 'HEAD:AGENTS.md');
    expect(committedAgents).not.toContain(UNSTAGED_MARKER); // the reviewer's exact assertion
    expect(committedAgents).toContain(NEW_BODY); // but the regen DID land

    // The developer's edit is untouched in the working tree — not lost, just correctly still unstaged.
    const workingTree = readFileSync(join(dir, 'AGENTS.md'), 'utf8');
    expect(workingTree).toContain(UNSTAGED_MARKER);

    // And git agrees it's still unstaged (a real diff against the new HEAD), never silently absorbed.
    const diff = git('diff', '--name-only');
    expect(diff).toContain('AGENTS.md');
  });

  it('with NO unstaged edit, the working tree is synced too (no spurious post-commit diff)', () => {
    mkdirSync(join(dir, 'src/_data/blocks'), { recursive: true });
    writeFileSync(join(dir, 'src/_data/blocks/throwaway.json'), '{"id":"throwaway","status":"stable"}\n');
    git('add', 'src/_data/blocks/throwaway.json');

    const wrote = regenerateStaged({ root: dir, body: NEW_BODY });
    expect(wrote).toBe(true);

    commit('stage a registry file, no unstaged AGENTS.md edit');

    expect(git('show', 'HEAD:AGENTS.md')).toContain(NEW_BODY);
    expect(readFileSync(join(dir, 'AGENTS.md'), 'utf8')).toContain(NEW_BODY); // working tree synced
    expect(git('diff', '--name-only')).not.toContain('AGENTS.md'); // no leftover diff
  });

  it('no-ops (returns false, touches nothing) when the staged inventory body already matches', () => {
    const wrote = regenerateStaged({ root: dir, body: OLD_BODY }); // same body as the initial commit
    expect(wrote).toBe(false);
    expect(git('diff', '--cached', '--name-only')).toBe('');
  });
});

describe('regenerateStaged — #1414 review round 2 (real default body must count the git INDEX, not the working tree)', () => {
  // Every test above passes an explicit `body`, which never exercises regenerateStaged()'s REAL
  // default (`body = renderInventory(loadIndexRegistries(root))`). This suite calls it with NO body
  // override, so the real renderInventory()-sourced count runs end-to-end — reproducing the
  // reviewer's exact repro: a staged registry file plus an UNTRACKED sibling file in the SAME
  // registry dir. The old default called renderInventory() with no args, which reads the six
  // registry dirs via readdirSync over the working tree — so the untracked sibling inflated the
  // committed count even though `git ls-tree` shows it never landed.
  it('staged registry file + untracked sibling in the same dir: committed count matches only tracked/staged files', () => {
    mkdirSync(join(dir, 'src/_data/researchTopics'), { recursive: true });
    // One file already committed in the initial commit's tree (so the baseline research count is 1).
    writeFileSync(join(dir, 'src/_data/researchTopics/a.json'), '{"id":"a","status":"open"}\n');
    git('add', 'src/_data/researchTopics/a.json');
    commit('seed one research topic');

    // Stage a SECOND, real research topic — this is what should move the count to 2.
    writeFileSync(join(dir, 'src/_data/researchTopics/b.json'), '{"id":"b","status":"open"}\n');
    git('add', 'src/_data/researchTopics/b.json');

    // An UNTRACKED sibling sitting in the exact same dir — never `git add`ed. Must NOT count.
    writeFileSync(join(dir, 'src/_data/researchTopics/wip.json'), '{"id":"wip","status":"open"}\n');

    // No `body` override — exercises the REAL default (renderInventory() over the git INDEX).
    const wrote = regenerateStaged({ root: dir });
    expect(wrote).toBe(true);

    commit('stage a second research topic, leave an untracked sibling');

    const committedAgents = git('show', 'HEAD:AGENTS.md');
    expect(committedAgents).toContain('**Research topics** 2'); // tracked+staged count only
    expect(committedAgents).not.toContain('**Research topics** 3'); // NOT the untracked sibling's inflated count

    // Ground truth: what actually landed in the commit.
    const landed = git('ls-tree', '-r', '--name-only', 'HEAD', '--', 'src/_data/researchTopics')
      .trim().split('\n').filter(Boolean);
    expect(landed.sort()).toEqual(['src/_data/researchTopics/a.json', 'src/_data/researchTopics/b.json']);
    expect(landed).not.toContain('src/_data/researchTopics/wip.json');

    // And the untracked file is still sitting there, untouched, still not part of git's state.
    const status = git('status', '--porcelain', 'src/_data/researchTopics/wip.json');
    expect(status.trim()).toBe('?? src/_data/researchTopics/wip.json');
  });
});
