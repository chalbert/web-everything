/** Per-diff execution floor (#2876), independent of Vitest's scoped-planes average.
 * Consumes Istanbul JSON produced by Vitest's v8 provider, NOT raw V8 ranges.
 */
import { execFileSync } from 'node:child_process';
import { readFileSync, statSync } from 'node:fs';
import { resolve } from 'node:path';
import { isTrustChainTier } from './trust-chain-tier.mjs';

export const DIFF_BRANCH_COVERAGE_FLOOR = 80;

/** Parse one file's --unified=0 patch. New-side hunk coordinates include additions
 * and replacements, never deleted lines. Per-file patches avoid Git path quoting.
 */
export function changedLines(patch) {
  const lines = new Set();
  for (const match of patch.matchAll(/^@@ -\d+(?:,\d+)? \+(\d+)(?:,(\d+))? @@/gm)) {
    const start = Number(match[1]);
    const count = match[2] === undefined ? 1 : Number(match[2]);
    for (let i = 0; i < count; i++) lines.add(start + i);
  }
  return lines;
}

/** Aggregate outcomes, not branch IDs: b[id] can contain several counters.
 * A touched parent loc selects every outcome (editing a condition affects both
 * arms); otherwise an overlapping arm selects that outcome. V8 also emits broad
 * function ranges: these count conservatively when their bodies are edited.
 * End columns are exclusive, so an end at column zero excludes that final line.
 */
export function attributeBranches(changes, coverage, root) {
  let total = 0;
  let exercised = 0;
  const uncovered = [];
  const overlaps = (loc, lines) => {
    if (!loc?.start || !loc?.end || !Number.isInteger(loc.start.line)
      || !Number.isInteger(loc.end.line) || loc.start.line < 1 || loc.end.line < loc.start.line) {
      throw new Error('Invalid branch location in coverage JSON');
    }
    const end = loc.end.line - (loc.end.column === 0 && loc.end.line > loc.start.line ? 1 : 0);
    return [...lines].some((line) => line >= loc.start.line && line <= end);
  };
  for (const [file, lines] of changes) {
    if (!isTrustChainTier(file) || !lines.size) continue;
    const entry = coverage[resolve(root, file)] ?? coverage[file];
    if (!entry?.branchMap || !entry?.b || typeof entry.branchMap !== 'object'
      || typeof entry.b !== 'object' || Array.isArray(entry.branchMap) || Array.isArray(entry.b)) {
      throw new Error(`Missing branch coverage for ${file}`);
    }
    for (const [id, branch] of Object.entries(entry.branchMap)) {
      const hits = entry.b[id];
      if (!branch || typeof branch !== 'object') throw new Error(`Invalid branch map for ${file}:${id}`);
      if (!Array.isArray(hits) || !hits.length || !Array.isArray(branch.locations)
        || hits.length !== branch.locations.length || hits.some((n) => !Number.isFinite(n) || n < 0)) {
        throw new Error(`Invalid branch counters for ${file}:${id}`);
      }
      const parentTouched = overlaps(branch.loc, lines);
      branch.locations.forEach((loc, index) => {
        const armTouched = overlaps(loc, lines);
        if (!parentTouched && !armTouched) return;
        total++;
        if (hits[index] > 0) exercised++;
        else uncovered.push({ file, branch: id, outcome: index, line: loc.start.line });
      });
    }
    if (Object.keys(entry.b).some((id) => !Object.hasOwn(entry.branchMap, id))) {
      throw new Error(`Unmapped branch counters for ${file}`);
    }
  }
  return { total, exercised, uncovered };
}

export function checkFloor({ total, exercised }, floor = DIFF_BRANCH_COVERAGE_FLOOR) {
  const percent = total ? exercised / total * 100 : null;
  return { percent, ok: total === 0 || exercised * 100 >= total * floor };
}

/** Default HEAD means staged + unstaged work. CI/branch review must supply the
 * intended base SHA through DIFF_COVERAGE_BASE (e.g. the PR merge-base).
 * --no-renames treats a new tier destination as added source; deleted-only
 * files/hunks have no new-side branches. Untracked tier members count as additions.
 * Never launch tests here: no-scope stays cheap; callers generate coverage first.
 */
export function scanDiffBranchCoverage(root, { base = process.env.DIFF_COVERAGE_BASE ?? 'HEAD' } = {}) {
  const errors = [];
  const failure = (message) => errors.push({ message: `Diff branch coverage: ${message}`,
    descriptor: { kind: 'diff-branch-coverage', fix: 'model' } });
  try {
    const git = (args) => execFileSync('git', args, { cwd: root, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'], maxBuffer: 32 * 1024 * 1024 });
    // Resolve first: invalid bases must fail even if the tree happens to be clean.
    const sha = git(['rev-parse', '--verify', '--end-of-options', `${base}^{commit}`]).trim();
    const tracked = git(['diff', '--no-ext-diff', '--no-textconv', '--name-only', '-z', '--no-renames', sha, '--']).split('\0').filter(isTrustChainTier);
    const untracked = git(['ls-files', '--others', '--exclude-standard', '-z']).split('\0').filter(isTrustChainTier);
    const changes = new Map();
    for (const file of tracked) {
      const lines = changedLines(git(['diff', '--no-ext-diff', '--no-textconv', '--no-renames', '--no-color', '--text', '--unified=0', sha, '--', file]));
      if (lines.size) changes.set(file, lines);
    }
    for (const file of untracked) {
      const source = readFileSync(resolve(root, file), 'utf8');
      const count = source ? source.split('\n').length - Number(source.endsWith('\n')) : 0;
      if (count) changes.set(file, new Set(Array.from({ length: count }, (_, i) => i + 1)));
    }
    if (!changes.size) return { errors, base, status: 'no-scope', message: `Diff branch coverage (base ${base}): no changed tier lines; nothing to attribute.` };
    const report = resolve(root, 'coverage/coverage-final.json');
    const reportTime = statSync(report).mtimeMs;
    for (const file of changes.keys()) {
      if (statSync(resolve(root, file)).mtimeMs > reportTime) throw new Error(`Coverage predates ${file}; regenerate it`);
    }
    const counts = attributeBranches(changes, JSON.parse(readFileSync(report, 'utf8')), root);
    const result = checkFloor(counts);
    const message = counts.total
      ? `Diff branch coverage (base ${base}): ${counts.exercised}/${counts.total} branches introduced or touched by this diff were exercised (${result.percent.toFixed(2)}%; floor ${DIFF_BRANCH_COVERAGE_FLOOR}%).`
      : `Diff branch coverage (base ${base}): changed tier lines contain no attributable branches.`;
    if (!result.ok) failure(message);
    return { errors, base, status: result.ok ? 'pass' : 'fail', ...counts, ...result, message };
  } catch (error) {
    failure(`${error.message}. Generate current coverage with npx vitest run --coverage (JSON: coverage/coverage-final.json); base ${base}.`);
    return { errors, base, status: 'fail', message: errors[0].message };
  }
}
