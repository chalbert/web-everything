#!/usr/bin/env node
/**
 * @file scripts/mine-golden-corpus.mjs
 * @description #2270 — an idempotent miner that turns Web Everything's own git history into
 * replayable fixtures for the skill/memory validation suite (#2268). Each historical backlog
 * claim/resolve/release/settle, each memory add/change, and each hook-relevant content fix (locus
 * prefix) becomes an input+expected-output case; guard-bash/guard-lane add a small hand-curated,
 * spec-derived set (their hook fires on an ephemeral Bash command / Edit path, never a git commit,
 * so there is no historical "denied" commit to mine — see the category notes in the written index).
 *
 * v1 scope (this story): mine a CURATED HIGH-SIGNAL SEED SET, not a full-history sweep (a follow-on,
 * per the story digest). Every category is capped (`--limit`) and every backlog/locus fixture is
 * SELF-VALIDATED at mine time (replay the current pure logic against the mined `before`; only keep
 * the pair if it reproduces the real historical `after` byte-for-byte) — so the corpus never asserts
 * a case the current code already contradicts, and a rerun of this same miner against the same repo
 * state is idempotent: identical output, because the selection is a deterministic function of git
 * history + this file's own logic, with no wall-clock or random input.
 *
 * Usage:
 *   node scripts/mine-golden-corpus.mjs [--limit=12] [--locus-scan=800] [--out=scripts/golden-corpus]
 *
 * Output: `<out>/<category>/<id>.json` fixture files + `<out>/index.json` manifest (counts, schema
 * version, category provenance notes, and the newest mined commit's date as a deterministic
 * "corpus as-of" marker — never a wall-clock timestamp, so the manifest stays byte-stable on rerun).
 */
import { execFileSync } from 'node:child_process';
import { mkdirSync, writeFileSync, readdirSync, rmSync, existsSync } from 'node:fs';
import { join, dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { applyTransition, readField } from './backlog/frontmatter.mjs';
import { scanRepoLocusPrefixes } from './check-standards-rules.mjs';
import { decide } from './guard-bash.mjs';
import { classifyBacklogTransition, isMemoryPath, isMemoryIndexPath, shortSha } from './golden-corpus-lib.mjs';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const SCHEMA_VERSION = 1;

// ── CLI flags ────────────────────────────────────────────────────────────────────────────────────
const argv = process.argv.slice(2);
const flag = (name, fallback) => {
  const hit = argv.find((a) => a.startsWith(`--${name}=`));
  return hit ? hit.slice(name.length + 3) : fallback;
};
const LIMIT = Number(flag('limit', '12'));
const LOCUS_SCAN = Number(flag('locus-scan', '800'));
const BACKLOG_SCAN_CAP = Number(flag('backlog-scan', '600'));
// `resolve` (not `join`) so an ABSOLUTE `--out` is honored as-is; a relative one stays repo-relative.
const OUT = resolve(ROOT, flag('out', 'scripts/golden-corpus'));

// ── git plumbing (impure — isolated here; all classification logic above this line, or imported, is pure) ──
function git(args) {
  return execFileSync('git', args, { cwd: ROOT, encoding: 'utf8' }).trim();
}
/** Content of `path` at `sha`, or `null` if it doesn't exist there (added/deleted at this revision). */
function showAt(sha, path) {
  try {
    return execFileSync('git', ['show', `${sha}:${path}`], { cwd: ROOT, encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] });
  } catch {
    return null;
  }
}
function commitDateShort(sha) {
  try { return git(['show', '-s', '--format=%ad', '--date=short', sha]); } catch { return null; }
}
function changedFiles(sha, pathspecs) {
  try {
    return git(['diff-tree', '--no-commit-id', '--name-only', '-r', sha, '--', ...pathspecs])
      .split('\n').filter(Boolean);
  } catch { return []; }
}
function commitList(pathspecs, { grep, limit } = {}) {
  const args = ['log', '--no-merges', '--pretty=format:%H'];
  if (limit) args.push('-n', String(limit));
  if (grep) args.push(`-G${grep}`);
  args.push('--', ...pathspecs);
  try { return git(args).split('\n').filter(Boolean); } catch { return []; }
}
/** Commits whose MESSAGE matches `pattern` (case-insensitive) — a cheap, high-precision way to find
 *  commits self-labeled as a fix for a given hook (e.g. "backlog: fix locus-prefix …"). */
function commitsByMessage(pattern) {
  try { return git(['log', '--no-merges', '--pretty=format:%H', `--grep=${pattern}`, '-i']).split('\n').filter(Boolean); }
  catch { return []; }
}

// ── settle() self-validation — mirrors the inline transform in scripts/backlog.mjs#settle (not
// exported there as a pure function; replicated here so a mined settle fixture is verified the same
// way claim/resolve/release are, via applyTransition). Kept local + tiny so drift is easy to spot. ──
function replaySettle(before) {
  if (!/^scaffoldedBy:/m.test(before)) return null;
  return before.replace(/^status: active$/m, 'status: open')
    .replace(/^scaffoldedBy: .*\n/m, '')
    .replace(/^dateScaffolded: .*\n/m, '');
}

// ── category 1: backlog transitions (claim/resolve/release/settle) + creation ──────────────────────
function mineBacklogFixtures() {
  const shas = commitList(['backlog/*.md'], { grep: '^status:', limit: BACKLOG_SCAN_CAP });
  const buckets = { claim: [], resolve: [], release: [], settle: [], created: [] };
  const full = (b) => Object.values(b).every((arr) => arr.length >= LIMIT);
  for (const sha of shas) {
    if (full(buckets)) break;
    for (const file of changedFiles(sha, ['backlog/*.md'])) {
      const after = showAt(sha, file);
      if (after == null) continue; // deleted at this rev — backlog items are resolved, never rm'd (#guard-bash)
      const before = showAt(`${sha}^`, file);
      if (before == null) {
        if (buckets.created.length >= LIMIT) continue;
        buckets.created.push({ sha, date: commitDateShort(sha), file, verb: 'created', before: null, after });
        continue;
      }
      const t = classifyBacklogTransition(before, after);
      if (!t) continue;
      if (buckets[t.verb].length >= LIMIT) continue;
      const date = commitDateShort(sha);
      if (t.verb === 'settle') {
        const replayed = replaySettle(before);
        if (replayed !== after) continue; // doesn't reproduce — not a clean settle fixture, skip
        buckets.settle.push({ sha, date, file, verb: 'settle', before, after });
        continue;
      }
      // claim/resolve/release: replay the real pure `applyTransition` and keep only if it reproduces
      // the historical `after` byte-for-byte (self-validating golden fixture).
      const today = t.verb === 'claim' ? readField(after, 'dateStarted') || date
        : t.verb === 'resolve' ? readField(after, 'dateResolved') || date
        : date;
      const opts = { today, ...t.opts };
      const replayed = applyTransition(before, t.verb, opts);
      if (replayed.error || replayed.content !== after) continue;
      buckets[t.verb].push({ sha, date, file, verb: t.verb, opts, before, after });
    }
  }
  return buckets;
}

// ── category 2: memory add/change (the always-loaded index + per-entry rule files) ─────────────────
function mineMemoryFixtures() {
  const shas = commitList(['agent-memory-src/*.md', '.claude/agent-memory/*.md'], { limit: LIMIT * 4 });
  const seen = new Set();
  const out = [];
  for (const sha of shas) {
    if (out.length >= LIMIT) break;
    for (const file of changedFiles(sha, ['agent-memory-src/*.md', '.claude/agent-memory/*.md'])) {
      if (!isMemoryPath(file)) continue;
      const key = file.replace(/^\.claude\/agent-memory\//, 'agent-memory-src/'); // legacy/current alias
      if (seen.has(`${sha}:${key}`)) continue;
      seen.add(`${sha}:${key}`);
      const after = showAt(sha, file);
      if (after == null) continue;
      const before = showAt(`${sha}^`, file);
      out.push({
        sha, date: commitDateShort(sha), file,
        isIndex: isMemoryIndexPath(file),
        changeType: before == null ? 'created' : 'modified',
        before, after,
      });
      if (out.length >= LIMIT) break;
    }
  }
  return out;
}

// ── category 3: locus-prefix hook (mined) — a backlog/reports edit that FIXES a bare code-path ref,
// i.e. `scanRepoLocusPrefixes` flags `before` and is clean on `after` for the same file. ────────────
function mineLocusFixtures() {
  // Prefer commits SELF-LABELED as a locus-prefix fix (cheap, high-precision — "backlog: fix
  // locus-prefix …" is this repo's own commit-message convention, #883/#885/#1389), then top up with
  // a blind recent-history scan for unlabeled fixes.
  const labeled = commitsByMessage('locus.prefix');
  const blind = commitList(['backlog/*.md', 'reports/*.md'], { limit: LOCUS_SCAN });
  const shas = [...new Set([...labeled, ...blind])];
  const out = [];
  for (const sha of shas) {
    if (out.length >= LIMIT) break;
    for (const file of changedFiles(sha, ['backlog/*.md', 'reports/*.md'])) {
      const after = showAt(sha, file);
      const before = showAt(`${sha}^`, file);
      if (after == null || before == null) continue; // need both revisions to see a FIX
      const findingsBefore = scanRepoLocusPrefixes([{ file, content: before }]);
      if (!findingsBefore.length) continue;
      const findingsAfter = scanRepoLocusPrefixes([{ file, content: after }]);
      if (findingsAfter.length) continue; // still dirty after — not the fix commit
      out.push({
        sha, date: commitDateShort(sha), file,
        before, after,
        expect: { findingsBefore: findingsBefore.length, findingsAfter: 0 },
      });
      if (out.length >= LIMIT) break;
    }
  }
  return out;
}

// ── category 4: guard-bash — spec-derived (no git trace exists for a DENIED command: the hook fires
// pre-write, so a blocked attempt never becomes a commit). Each scenario below is grounded in one of
// the documented incidents in guard-bash.mjs's own header comment. `decide()` is the real pure
// function the hook runs; we call it here at mine time and record its ACTUAL output as the expected
// value — a true snapshot fixture (reruns are byte-identical unless `decide()`'s behavior changes,
// which is exactly the regression this fixture exists to catch). ────────────────────────────────────
function buildGuardBashFixtures() {
  const scenarios = [
    { id: 'backlog-mutation-primary-cwd', cmd: 'node scripts/backlog.mjs claim 2270', ctx: { primaryCwd: true }, basis: '#2302' },
    { id: 'backlog-mutation-primary-cwd-override', cmd: 'BACKLOG_MUTATE_OK=1 node scripts/backlog.mjs claim 2270', ctx: { primaryCwd: true }, basis: '#2302 escape hatch' },
    { id: 'backlog-mutation-stale-lane', cmd: 'node scripts/backlog.mjs resolve 2270', ctx: { primaryCwd: false, staleBehind: 5 }, basis: '#2323' },
    { id: 'backlog-mutation-stale-lane-override', cmd: 'STALE_LANE_OK=1 node scripts/backlog.mjs resolve 2270', ctx: { primaryCwd: false, staleBehind: 5 }, basis: '#2323 escape hatch' },
    { id: 'backlog-mutation-fresh-lane', cmd: 'node scripts/backlog.mjs resolve 2270', ctx: { primaryCwd: false, staleBehind: 0 }, basis: 'allowed baseline' },
    { id: 'build-plugs-npm', cmd: 'npm run build:plugs', ctx: {}, basis: 'shadow .js/.d.ts footgun' },
    { id: 'build-plugs-tsc-no-noEmit', cmd: 'tsc -p tsconfig.plugs.json', ctx: {}, basis: 'shadow .js/.d.ts footgun' },
    { id: 'build-plugs-tsc-with-noEmit', cmd: 'tsc -p tsconfig.plugs.json --noEmit', ctx: {}, basis: 'allowed typecheck form' },
    { id: 'pkill-vite', cmd: 'pkill -f vite', ctx: {}, basis: "never kill the user's dev server" },
    { id: 'rm-backlog-md', cmd: 'rm backlog/2270-harvest-a-golden-corpus-of-skill-memory-fixtures-from-git-hi.md', ctx: {}, basis: 'resolve, never rm' },
    { id: 'git-mv-renumber', cmd: 'git mv backlog/100-foo.md backlog/200-foo.md', ctx: {}, basis: 'NNN immutable' },
    { id: 'git-mv-rename-slug-same-nnn', cmd: 'git mv backlog/100-foo.md backlog/100-bar.md', ctx: {}, basis: 'allowed: slug-only rename' },
    { id: 'append-backlog-shell', cmd: 'echo "x" >> backlog/100-foo.md', ctx: {}, basis: 'locus-prefix write-hook bypass' },
    { id: 'git-push-main', cmd: 'git push origin main', ctx: {}, basis: '#2203 strict lane-only' },
    { id: 'git-push-lane-ref', cmd: 'git push origin HEAD:refs/heads/lane/batch-example-1', ctx: {}, basis: 'allowed: lane ref' },
    { id: 'benign-test-run', cmd: 'npm test -- run', ctx: {}, basis: 'allowed baseline' },
  ];
  return scenarios.map((s) => ({
    id: s.id, cmd: s.cmd, ctx: s.ctx, basis: s.basis,
    expect: { reason: decide(s.cmd, s.ctx) },
  }));
}

// ── category 5: guard-lane — spec-derived + TEMPLATED (no git trace either: same "fires before a
// commit exists" reason as guard-bash). Unlike guard-bash's command-string input, guard-lane's input
// is a FILE PATH classified by which git-workspace root it resolves under — a judgment that only
// makes sense against a REAL `~/workspace/<repo>` layout, not a portable literal path a corpus fixture
// could hardcode (this miner may itself run from inside a `.lanes/` clone, which would misclassify
// its own tree). So these fixtures carry a `{{PRIMARY_ROOT}}` / `{{LANE_ROOT}}` placeholder for the
// replaying harness to substitute with its actual workspace roots, rather than a literal absolute
// path — see `source` on each fixture. ──────────────────────────────────────────────────────────────
function buildGuardLaneFixtures() {
  return [
    { id: 'primary-checkout-edit', filePathTemplate: '{{PRIMARY_ROOT}}/webeverything/scripts/example.mjs', expect: { decision: 'deny' }, basis: '#2123 lane isolation' },
    { id: 'lane-clone-edit', filePathTemplate: '{{LANE_ROOT}}/.lanes/web-everything/lane-1/scripts/example.mjs', expect: { decision: 'allow' }, basis: 'allowed: already in a lane' },
    { id: 'agent-memory-edit-in-primary', filePathTemplate: '{{PRIMARY_ROOT}}/webeverything/.claude/agent-memory/example.md', expect: { decision: 'allow' }, basis: 'agent-memory carve-out (#2266)' },
    { id: 'scratchpad-edit', filePathTemplate: '{{SCRATCHPAD_ROOT}}/example.md', expect: { decision: 'allow' }, basis: 'untracked scratch is exempt' },
  ];
}

// ── write ────────────────────────────────────────────────────────────────────────────────────────
function writeCategory(name, items) {
  const dir = join(OUT, name);
  mkdirSync(dir, { recursive: true });
  for (const f of existsSync(dir) ? readdirSync(dir) : []) rmSync(join(dir, f), { recursive: true, force: true }); // idempotent: clear stale ids (or any stray subdir) from a prior mine before rewriting
  for (const item of items) {
    const id = item.sha ? `${shortSha(item.sha)}-${item.file.split('/').pop().replace(/\.md$/, '')}` : item.id;
    writeFileSync(join(dir, `${id}.json`), JSON.stringify(item, null, 2) + '\n');
  }
  return items.length;
}

function main() {
  const backlog = mineBacklogFixtures();
  const memory = mineMemoryFixtures();
  const locus = mineLocusFixtures();
  const guardBash = buildGuardBashFixtures();
  const guardLane = buildGuardLaneFixtures();

  mkdirSync(OUT, { recursive: true });
  const counts = {};
  for (const verb of Object.keys(backlog)) counts[`backlog-${verb}`] = writeCategory(`backlog-${verb}`, backlog[verb]);
  counts.memory = writeCategory('memory', memory);
  counts['hook-locus-prefix'] = writeCategory('hook-locus-prefix', locus);
  counts['hook-guard-bash'] = writeCategory('hook-guard-bash', guardBash);
  counts['hook-guard-lane'] = writeCategory('hook-guard-lane', guardLane);

  // Deterministic "as-of" marker: the newest date among every mined (git-sourced) fixture — NOT
  // wall-clock `now` — so the manifest is byte-stable across reruns against the same repo state.
  const allDates = [
    ...Object.values(backlog).flat().map((f) => f.date),
    ...memory.map((f) => f.date),
    ...locus.map((f) => f.date),
  ].filter(Boolean).sort();
  const corpusAsOf = allDates.length ? allDates[allDates.length - 1] : null;

  const index = {
    schemaVersion: SCHEMA_VERSION,
    corpusAsOf,
    counts,
    total: Object.values(counts).reduce((a, b) => a + b, 0),
    categories: {
      'backlog-claim': { source: 'git-mined', selfValidated: true, note: 'open→active via the real applyTransition(before, "claim", opts); kept only if replay reproduces the historical after byte-for-byte.' },
      'backlog-resolve': { source: 'git-mined', selfValidated: true, note: 'active|open→resolved via applyTransition(before, "resolve", opts), including graduatedTo/codifiedIn where the historical commit set them.' },
      'backlog-release': { source: 'git-mined', selfValidated: true, note: 'active|preparing→open via applyTransition(before, "release", {}).' },
      'backlog-settle': { source: 'git-mined', selfValidated: true, note: 'born-active scaffold→open; replays the inline transform scripts/backlog.mjs#settle uses (not exported there as a pure function).' },
      'backlog-created': { source: 'git-mined', selfValidated: false, note: "a backlog item's first-appearance revision (before === null) — structural fixtures for scaffold-shape regressions." },
      memory: { source: 'git-mined', selfValidated: false, note: 'MEMORY.md index + agent-memory-src/*.md per-entry rule adds/changes (current and pre-#2266 legacy .claude/agent-memory/ homes aliased together).' },
      'hook-locus-prefix': { source: 'git-mined', selfValidated: true, note: 'a backlog/reports edit that FIXES a bare code-path ref; scanRepoLocusPrefixes flags `before` and is clean on `after` for the same file.' },
      'hook-guard-bash': { source: 'spec-derived', selfValidated: false, note: 'guard-bash denies BEFORE a commit exists, so no historical "denied" commit is mineable; each case is grounded in an incident documented in guard-bash.mjs\'s own header comment, run through the real exported decide() at mine time.' },
      'hook-guard-lane': { source: 'spec-derived-template', selfValidated: false, note: 'same "fires pre-commit" gap as guard-bash, PLUS its input is a filesystem path classified against the real ~/workspace layout — not portable as a literal path. Fixtures carry {{PRIMARY_ROOT}}/{{LANE_ROOT}}/{{SCRATCHPAD_ROOT}} placeholders for the replaying harness to substitute.' },
    },
  };
  writeFileSync(join(OUT, 'index.json'), JSON.stringify(index, null, 2) + '\n');

  console.log(`mined ${index.total} fixture(s) → ${flag('out', 'scripts/golden-corpus')}/ (corpusAsOf ${corpusAsOf})`);
  for (const [k, v] of Object.entries(counts)) console.log(`  ${k}: ${v}`);
}

main();
