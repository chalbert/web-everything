/**
 * @file scripts/__tests__/check-standards-rules-backlog-integrity.test.mjs
 * @description Split from check-standards-rules.test.mjs (#3383 test-speedup): the untracked-derived-
 * artifact guard, the duplicate-bornAs/duplicate-NNN/stranded-hash backlog detectors, the Playwright
 * container-pin lockstep check, and the declared-module-contract drift check. Pure file-move — same
 * tests, smaller file.
 */
import { describe, it, expect } from 'vitest';
import { readFileSync, existsSync, readdirSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { join } from 'node:path';
import {
  validateUntrackedDerivedArtifacts, DERIVED_ARTIFACT_DIRS,
  duplicateBornAs,
  duplicateBacklogNums,
  strandedHashesOnMain,
  extractPlaywrightContainerTags,
  validatePlaywrightContainerPin, PLAYWRIGHT_CONTAINER_PIN_REQUIRED_FILES,
  validateDeclaredModuleContract,
} from '../check-standards-rules.mjs';
import { ROOT } from './fixtures/check-standards-rules-fixtures.mjs';

// ── validateUntrackedDerivedArtifacts (#2180) ──────────────────────────────────────────────────────
describe('validateUntrackedDerivedArtifacts — local-vs-CI divergence guard (#2180)', () => {
  it('PASSES when no untracked paths are provided (clean tree / CI)', () => {
    const { errors } = validateUntrackedDerivedArtifacts([]);
    expect(errors).toEqual([]);
  });

  it('PASSES when untracked paths are outside the derived dirs', () => {
    const { errors } = validateUntrackedDerivedArtifacts([
      'backlog/9999-some-draft.md',
      'src/_data/blocks/my-block.json',
      'scripts/scratch.mjs',
    ]);
    expect(errors).toEqual([]);
  });

  it('FAILS when there is an untracked file in reports/', () => {
    const { errors } = validateUntrackedDerivedArtifacts(['reports/2026-01-01-orphan.md']);
    expect(errors).toHaveLength(1);
    expect(errors[0].message).toMatch(/untracked/i);
    expect(errors[0].message).toMatch(/reports\//);
    expect(errors[0].message).toMatch(/#2180/);
    expect(errors[0].descriptor.kind).toBe('untracked-derived');
  });

  it('FAILS when there is an untracked file in src/_data/researchTopics/', () => {
    const { errors } = validateUntrackedDerivedArtifacts(['src/_data/researchTopics/my-topic.json']);
    expect(errors).toHaveLength(1);
    expect(errors[0].message).toMatch(/researchTopics/);
    expect(errors[0].descriptor.kind).toBe('untracked-derived');
  });

  it('FAILS when there is an untracked file in src/_includes/research-descriptions/', () => {
    const { errors } = validateUntrackedDerivedArtifacts(['src/_includes/research-descriptions/my-topic.njk']);
    expect(errors).toHaveLength(1);
    expect(errors[0].message).toMatch(/research-descriptions/);
  });

  it('groups multiple untracked files in the same dir into ONE error', () => {
    const { errors } = validateUntrackedDerivedArtifacts([
      'reports/2026-01-01-a.md',
      'reports/2026-01-02-b.md',
      'reports/2026-01-03-c.md',
    ]);
    expect(errors).toHaveLength(1);
    expect(errors[0].message).toMatch(/3 untracked/);
  });

  it('emits ONE error per affected dir when multiple dirs have untracked files', () => {
    const { errors } = validateUntrackedDerivedArtifacts([
      'reports/2026-01-01-a.md',
      'src/_data/researchTopics/foo.json',
    ]);
    expect(errors).toHaveLength(2);
    const dirs = errors.map((e) => e.descriptor.file);
    expect(dirs).toContain('reports');
    expect(dirs).toContain('src/_data/researchTopics');
  });

  it('includes a sample of affected file names in the error message', () => {
    const { errors } = validateUntrackedDerivedArtifacts([
      'reports/2026-01-01-a.md',
      'reports/2026-01-02-b.md',
    ]);
    expect(errors[0].message).toMatch(/2026-01-01-a\.md/);
  });

  it('truncates the sample list when more than 3 files are untracked', () => {
    const paths = Array.from({ length: 5 }, (_, i) => `reports/2026-01-0${i + 1}-r.md`);
    const { errors } = validateUntrackedDerivedArtifacts(paths);
    expect(errors[0].message).toMatch(/\+2 more/);
  });

  it('descriptor.global is false — this is a local-tree concern, not a cross-lane invariant', () => {
    const { errors } = validateUntrackedDerivedArtifacts(['reports/2026-01-01-a.md']);
    expect(errors[0].descriptor.global).toBe(false);
  });

  it('DERIVED_ARTIFACT_DIRS covers the three known divergence sources', () => {
    expect(DERIVED_ARTIFACT_DIRS).toContain('reports/');
    expect(DERIVED_ARTIFACT_DIRS).toContain('src/_data/researchTopics/');
    expect(DERIVED_ARTIFACT_DIRS).toContain('src/_includes/research-descriptions/');
  });

  it('live tree is clean — no untracked files in derived dirs on this checkout', () => {
    // This guard verifies the lane itself has no untracked derived artifacts that would
    // make the check pass here but fail on CI (the exact divergence #2180 closes).
    const raw = execFileSync(
      'git',
      ['ls-files', '--others', '--exclude-standard', '--',
        'reports/', 'src/_data/researchTopics/', 'src/_includes/research-descriptions/'],
      { cwd: ROOT, encoding: 'utf8' },
    );
    const untracked = raw.split('\n').filter(Boolean);
    const { errors } = validateUntrackedDerivedArtifacts(untracked);
    expect(errors).toEqual([]);
  });
});

describe('duplicateBornAs — one item minted twice, which every other check misses', () => {
  const card = (num, bornAs, status = 'open') => ({ num, id: `${num}-slug`, bornAs, status });

  it('ERRORS when a twin is unresolved — a done card back in the ready pool', () => {
    // The live case: #3201 resolved, #3244 open, same bornAs, identical bodies. Selection would hand the
    // open one to someone to redo work that is already finished.
    const r = duplicateBornAs([card('3201', 'x2t6cr5', 'resolved'), card('3244', 'x2t6cr5', 'open')]);
    expect(r.errors).toHaveLength(1);
    expect(r.errors[0]).toContain('x2t6cr5');
    expect(r.errors[0]).toMatch(/#3201 \(resolved\) and #3244 \(open\)/);
    expect(r.warnings).toEqual([]);
  });

  it('WARNS when both twins are resolved — a smudge, not live work', () => {
    // The tree carries #3111/#3112 from before this rule. Erroring on a pair nothing selects would redden
    // main over a defect with no consequence, which is how a gate gets ignored.
    const r = duplicateBornAs([card('3111', 'xzdi27a', 'resolved'), card('3112', 'xzdi27a', 'resolved')]);
    expect(r.errors).toEqual([]);
    expect(r.warnings).toHaveLength(1);
  });

  it('says NOTHING about a corpus with no twins — the common case', () => {
    // Without this, "always fire" passes both tests above.
    const r = duplicateBornAs([card('1', 'aaa'), card('2', 'bbb', 'resolved'), card('3', 'ccc')]);
    expect(r).toEqual({ errors: [], warnings: [] });
  });

  it('ignores items with no bornAs, and never groups them together', () => {
    // Pre-JIT items carry no bornAs at all. Treating absent as a shared key would report every one of the
    // ~2,400 of them as twins of each other — the scan would be pure noise on its first run.
    const r = duplicateBornAs([{ num: '1', id: '1-a' }, { num: '2', id: '2-b' }, card('3', '', 'open'), card('4', '   ')]);
    expect(r).toEqual({ errors: [], warnings: [] });
  });

  it('reports three-way and higher duplication once, with the count', () => {
    const r = duplicateBornAs([card('1', 'dup', 'resolved'), card('2', 'dup', 'resolved'), card('3', 'dup', 'open')]);
    expect(r.errors).toHaveLength(1);
    expect(r.errors[0]).toContain('bornAs` of 3 cards');
  });

  it('catches what neither sibling check can see', () => {
    // The reason this is its own rule: the twins have DIFFERENT numbers, so the NNN-collision detector is
    // silent by design, and both filenames are numeric, so nothing is stranded either.
    const twins = [card('3201', 'x2t6cr5', 'resolved'), card('3244', 'x2t6cr5', 'open')];
    expect(duplicateBacklogNums(twins)).toEqual([]);
    expect(duplicateBornAs(twins).errors).toHaveLength(1);
  });
});

describe('duplicateBacklogNums — the #2248 NNN-collision tripwire (pure detector)', () => {
  it('two files sharing an NNN → one error naming both', () => {
    const errs = duplicateBacklogNums([
      { num: '2316', id: '2316-frontierui-ci' },
      { num: '2316', id: '2316-renumber-fix' },
    ]);
    expect(errs).toHaveLength(1);
    expect(errs[0]).toMatch(/#2316 is used by both/);
    expect(errs[0]).toMatch(/2316-frontierui-ci/);
    expect(errs[0]).toMatch(/2316-renumber-fix/);
  });
  it('distinct NNNs → clean (no errors)', () => {
    expect(duplicateBacklogNums([{ num: '001', id: 'a' }, { num: '002', id: 'b' }, { num: '003', id: 'c' }])).toEqual([]);
  });
  it('one error per colliding NNN (multiple distinct collisions)', () => {
    const errs = duplicateBacklogNums([
      { num: '010', id: 'a' }, { num: '010', id: 'b' },
      { num: '020', id: 'c' }, { num: '020', id: 'd' },
    ]);
    expect(errs).toHaveLength(2);
  });
  it('items missing a num are skipped (a separate missing-prefix check owns those)', () => {
    expect(duplicateBacklogNums([{ id: 'no-num' }, { num: '005', id: 'e' }])).toEqual([]);
  });
});

describe('strandedHashesOnMain — the #2319 hash-on-main invariant (pure detector)', () => {
  it('all-numeric ids on main → clean', () => {
    expect(strandedHashesOnMain(['backlog/001-a.md', 'backlog/2322-b-slug.md', 'backlog/12345-c.md'])).toEqual([]);
  });
  it('a hash id on main → one error naming the file + the fix', () => {
    const errs = strandedHashesOnMain(['backlog/001-a.md', 'backlog/xbvktb4-should-force-eat.md']);
    expect(errs).toHaveLength(1);
    expect(errs[0]).toMatch(/xbvktb4-should-force-eat\.md/);
    expect(errs[0]).toMatch(/NON-NUMERIC leading id "xbvktb4"/);
    expect(errs[0]).toMatch(/number-stranded/);
  });
  it('one error per stranded hash (multiple)', () => {
    expect(strandedHashesOnMain(['backlog/x111111-a.md', 'backlog/x222222-b.md', 'backlog/003-ok.md'])).toHaveLength(2);
  });
  it('ignores non-backlog paths and non-.md files', () => {
    expect(strandedHashesOnMain(['scripts/xabcdef-thing.mjs', 'backlog/README', 'reports/xabcdef-r.md'])).toEqual([]);
  });
});

describe('extractPlaywrightContainerTags — parse container image tags out of workflow YAML (#2234)', () => {
  it('finds a single tag', () => {
    expect(extractPlaywrightContainerTags('image: mcr.microsoft.com/playwright:v1.58.1-jammy')).toEqual(['v1.58.1-jammy']);
  });
  it('finds multiple tags across a longer document', () => {
    const text = [
      'container:\n  image: mcr.microsoft.com/playwright:v1.58.1-jammy',
      'container:\n  image: mcr.microsoft.com/playwright:v1.58.1-jammy',
    ].join('\n');
    expect(extractPlaywrightContainerTags(text)).toEqual(['v1.58.1-jammy', 'v1.58.1-jammy']);
  });
  it('empty when no reference present', () => {
    expect(extractPlaywrightContainerTags('runs-on: ubuntu-latest')).toEqual([]);
  });
});

describe('validatePlaywrightContainerPin — container image tag ↔ installed version lockstep (#2234)', () => {
  it('clean when every reference matches the installed version', () => {
    const res = validatePlaywrightContainerPin({
      installedVersion: '1.58.1',
      filesReferences: [
        { file: '.github/workflows/ci.yml', tags: ['v1.58.1-jammy'] },
        { file: '.github/workflows/update-visual-baselines.yml', tags: ['v1.58.1-jammy'] },
      ],
    });
    expect(res.errors).toEqual([]);
  });
  it('errors when a file has no container reference at all', () => {
    const res = validatePlaywrightContainerPin({
      installedVersion: '1.58.1',
      filesReferences: [{ file: '.github/workflows/ci.yml', tags: [] }],
    });
    expect(res.errors).toHaveLength(1);
    expect(res.errors[0].message).toMatch(/no "mcr\.microsoft\.com\/playwright:v1\.58\.1-jammy"/);
  });
  it('errors on a drifted tag, naming both the found and expected tag', () => {
    const res = validatePlaywrightContainerPin({
      installedVersion: '1.58.1',
      filesReferences: [{ file: '.github/workflows/ci.yml', tags: ['v1.40.0-jammy'] }],
    });
    expect(res.errors).toHaveLength(1);
    expect(res.errors[0].message).toMatch(/pins "mcr\.microsoft\.com\/playwright:v1\.40\.0-jammy"/);
    expect(res.errors[0].message).toMatch(/expects "v1\.58\.1-jammy"/);
  });
  it('one error per file when multiple files drift', () => {
    const res = validatePlaywrightContainerPin({
      installedVersion: '1.58.1',
      filesReferences: [
        { file: 'a.yml', tags: ['v1.40.0-jammy'] },
        { file: 'b.yml', tags: ['v1.41.0-jammy'] },
      ],
    });
    expect(res.errors).toHaveLength(2);
  });
  it('errors loudly when the installed version cannot be resolved', () => {
    const res = validatePlaywrightContainerPin({ installedVersion: null, filesReferences: [] });
    expect(res.errors).toHaveLength(1);
    expect(res.errors[0].message).toMatch(/could not resolve the installed @playwright\/test version/);
  });
  it('real repo files stay in lockstep (standing guard, mirrors the check-standards.mjs wiring)', () => {
    const lock = JSON.parse(readFileSync(join(ROOT, 'package-lock.json'), 'utf8'));
    const installedVersion = lock.packages?.['node_modules/@playwright/test']?.version ?? null;
    const filesReferences = PLAYWRIGHT_CONTAINER_PIN_REQUIRED_FILES.map((rel) => {
      const p = join(ROOT, rel);
      const text = existsSync(p) ? readFileSync(p, 'utf8') : '';
      return { file: rel, tags: extractPlaywrightContainerTags(text) };
    });
    const res = validatePlaywrightContainerPin({ installedVersion, filesReferences });
    expect(res.errors).toEqual([]);
  });
});

// ── Declared module contract vs. actual imports (PR #1064 review, cosmetic 1) ────────────────────
describe('validateDeclaredModuleContract', () => {
  const mod = (declared, imported) => ({
    file: 'scripts/lib/x.mjs',
    content: `/**\n * A module.\n *\n *   from we:scripts/lib/jury-core.mjs — ${declared}\n *   from we:scripts/lib/review-core.mjs — \`growOnlyRoster\`.\n */\n`
      + `import { ${imported} } from './jury-core.mjs';\n`
      + `import { growOnlyRoster } from './review-core.mjs';\n`,
  });

  it('passes when every imported specifier is declared', () => {
    expect(validateDeclaredModuleContract([mod('`deriveVerdict`, `VERDICTS`.', 'deriveVerdict, VERDICTS')]).errors).toEqual([]);
  });

  it('FAILS on an imported specifier the declared block does not name — the drift that shipped', () => {
    const res = validateDeclaredModuleContract([mod('`deriveVerdict`.', 'deriveVerdict, normalizeFindings')]);
    expect(res.errors).toHaveLength(1);
    expect(res.errors[0].message).toMatch(/normalizeFindings/);
    expect(res.errors[0].descriptor).toMatchObject({ kind: 'declared-contract-drift', undeclared: ['normalizeFindings'] });
  });

  it('is one-directional — a declared name that is not imported is fine', () => {
    expect(validateDeclaredModuleContract([mod('`deriveVerdict`, `VERDICTS`, `NEVER_IMPORTED`.', 'deriveVerdict, VERDICTS')]).errors).toEqual([]);
  });

  it('FAILS on an undeclared import under the LAST declaration even with trailing prose after it (#2976)', () => {
    // The header's last declaration only names `growOnlyRoster`. Trailing prose AFTER it mentions
    // `normalizeFindings` in backticks merely to describe a past bug — that mention must not be folded
    // into the declared set just because it sits after the final `from we:` line. Before the #2976 fix,
    // the last declaration's slice ran to header.length, so this prose was (wrongly) counted as declared
    // and the drift below went unreported.
    const res = validateDeclaredModuleContract([{
      file: 'scripts/lib/x.mjs',
      content: '/**\n'
        + ' *   from we:scripts/lib/jury-core.mjs — `a`.\n'
        + ' *   from we:scripts/lib/review-core.mjs — `growOnlyRoster`.\n'
        + ' *\n'
        + ' * Trailing prose after the last declaration mentions `normalizeFindings` while describing a past\n'
        + ' * bug — this mention is not a declaration.\n'
        + ' */\n'
        + "import { a } from './jury-core.mjs';\n"
        + "import { growOnlyRoster, normalizeFindings } from './review-core.mjs';\n",
    }]);
    expect(res.errors).toHaveLength(1);
    expect(res.errors[0].message).toMatch(/normalizeFindings/);
    expect(res.errors[0].descriptor).toMatchObject({
      kind: 'declared-contract-drift',
      target: 'scripts/lib/review-core.mjs',
      undeclared: ['normalizeFindings'],
    });
  });

  it('FAILS on an undeclared import under the LAST declaration with NO blank-line separator before trailing prose (#2976 review r2)', () => {
    // Same false negative as the test above, but WITHOUT a blank `*` line between the last declaration
    // and the trailing prose — prose starts on the very next comment line. Before the r2 fix, the last
    // declaration's boundary search only stopped at a blank comment line; with none present it fell
    // back to header.length again, so `normalizeFindings` in the prose below was (wrongly) folded into
    // the declared set and this exact drift went unreported a second time.
    const res = validateDeclaredModuleContract([{
      file: 'scripts/lib/x.mjs',
      content: '/**\n'
        + ' *   from we:scripts/lib/jury-core.mjs — `a`.\n'
        + ' *   from we:scripts/lib/review-core.mjs — `growOnlyRoster`.\n'
        + ' * Trailing prose immediately follows the last declaration (no blank line) and mentions\n'
        + ' * `normalizeFindings` while describing a past bug — this mention is not a declaration.\n'
        + ' */\n'
        + "import { a } from './jury-core.mjs';\n"
        + "import { growOnlyRoster, normalizeFindings } from './review-core.mjs';\n",
    }]);
    expect(res.errors).toHaveLength(1);
    expect(res.errors[0].message).toMatch(/normalizeFindings/);
    expect(res.errors[0].descriptor).toMatchObject({
      kind: 'declared-contract-drift',
      target: 'scripts/lib/review-core.mjs',
      undeclared: ['normalizeFindings'],
    });
  });

  it('attributes each undeclared name to the RIGHT declared block', () => {
    const res = validateDeclaredModuleContract([{
      file: 'scripts/lib/x.mjs',
      content: '/**\n *   from we:scripts/lib/jury-core.mjs — `a`.\n *   from we:scripts/lib/review-core.mjs — `b`.\n */\n'
        + "import { a } from './jury-core.mjs';\nimport { b, c } from './review-core.mjs';\n",
    }]);
    expect(res.errors).toHaveLength(1);
    expect(res.errors[0].descriptor.target).toBe('scripts/lib/review-core.mjs');
    expect(res.errors[0].descriptor.undeclared).toEqual(['c']);
  });

  it('ignores a module with no header or no declared contract', () => {
    expect(validateDeclaredModuleContract([{ file: 'a.mjs', content: "import { x } from './y.mjs';\n" }]).errors).toEqual([]);
    expect(validateDeclaredModuleContract([{ file: 'a.mjs', content: "/** plain header */\nimport { x } from './y.mjs';\n" }]).errors).toEqual([]);
  });

  it('the real scripts/lib modules stay clean (standing guard, mirrors the check-standards.mjs wiring)', () => {
    const dir = join(ROOT, 'scripts', 'lib');
    const mods = readdirSync(dir).filter((f) => f.endsWith('.mjs'))
      .map((f) => ({ file: `scripts/lib/${f}`, content: readFileSync(join(dir, f), 'utf8') }));
    expect(validateDeclaredModuleContract(mods).errors).toEqual([]);
  });
});
