/**
 * @file scripts/readiness/scope-consumers.mjs
 * @description WHO ELSE IMPORTS THE FILES THIS ITEM SAYS IT WILL TOUCH (#x6cdlmu, under epic #xl2q1zt).
 *
 * THE HIGHEST-FREQUENCY PREDICTOR OF A LONG REVIEW IN THIS REPO, measured rather than guessed. Four items
 * were surveyed against what their PRs actually had to change, and three of the four had one shape in
 * common: the card named the file being CHANGED and said nothing about the modules that IMPORT it.
 *
 *   • #3090 declared `we:scripts/lib/gate-health.mjs`. Its one consumer, `we:scripts/operations/gate-health.mjs`,
 *     was not in scope — and that consumer's blocker sentence, not the library function, was what three
 *     review rounds were actually about.
 *   • #3091 declared four files and the discipline they share. Four separate call sites each had to honour it
 *     independently, and reviewers found them one at a time across six rounds.
 *   • #3084 declared three files and touched about twenty, because a new status vocabulary had to reach every
 *     hand-back in the run lifecycle. Those hand-backs are importers.
 *
 * #3071 is the counter-example and is kept in the item deliberately: its scope was EXACTLY right and the work
 * still failed, for a reason nothing here can see (nobody had measured whether the fix would unblock
 * anything — it would not). A check that only records its own hits is how a green board hides a broken loop.
 *
 * ── WHAT THIS IS NOT ────────────────────────────────────────────────────────────────────────────────────────
 *
 * **Not a gate.** An uncovered importer is a QUESTION, not an error. Plenty of consumers legitimately need no
 * change. `scope:` is load-bearing for the dispatcher's lane-contention arithmetic
 * ({@link ./scope-lease.mjs}, {@link ./dispatch-plan.mjs}), so a check that hard-failed here would train
 * authors to pad `scope:` until it went quiet — and a padded scope makes every overlap decision worse for
 * everyone. The output is a prompt to think, and the CLI exits 0 on findings.
 *
 * **Not exhaustive, and the OUTPUT says so rather than only this docblock.** The scan is static and
 * literal-only, so it inherits the blind spots
 * {@link ../operations/__tests__/import-graph.mjs} documents for the forward direction: a non-literal
 * specifier (`import(someVar)`, `createRequire`, `eval`) is invisible; a module that imports nothing can
 * still be HANDED a value at call time, so injection is invisible; and a consumer that reaches the code
 * through a package specifier rather than a relative path is not followed. Under-reporting is the failure
 * mode — telling a reader the list is complete when it is not would be the exact defect class the epic
 * exists to reduce.
 *
 * PURE. Every function here takes already-read data; {@link ./scope-consumers-cli.mjs}'s reader does the io.
 */

import { normScope, coversFile } from './scope-lease.mjs';

/** The repo prefix every path in this module is qualified with. Scope entries carry it; raw file paths do not. */
export const REPO = 'we';

/**
 * Blank comments and string BODIES so a specifier scan sees code only, preserving length so offsets survive.
 *
 * DUPLICATED FROM `we:scripts/operations/__tests__/import-graph.mjs`, KNOWINGLY, and it should not stay that
 * way. Importing it directly would make `scripts/readiness/` (production) depend on a module living under
 * `scripts/operations/__tests__/` — a dependency pointing the wrong way across layers — and moving it to a
 * shared home means editing a file inside another in-flight lane's declared scope while #3037 is building
 * there. Unifying the two scanners once that lands is filed on the item rather than done here, because a
 * cross-lane edit to dodge thirty lines of duplication is precisely the coupling this epic is about.
 *
 * Template literals are blanked wholesale: an `import()` inside `${…}` is a non-literal specifier and is
 * invisible to this scanner either way.
 *
 * @param {string} src
 * @returns {string} same length as `src`
 */
export function scanSource(src) {
  const s = String(src);
  const out = [...s];
  const ranges = [];
  let i = 0;
  const blankTo = (end) => { for (let j = i; j < end && j < out.length; j += 1) if (out[j] !== '\n') out[j] = ' '; };
  while (i < s.length) {
    const two = s.slice(i, i + 2);
    if (two === '//') {
      const end = s.indexOf('\n', i);
      blankTo(end === -1 ? s.length : end);
      i = end === -1 ? s.length : end;
    } else if (two === '/*') {
      const end = s.indexOf('*/', i + 2);
      const stop = end === -1 ? s.length : end + 2;
      blankTo(stop);
      i = stop;
    } else if (s[i] === '\'' || s[i] === '"' || s[i] === '`') {
      const quote = s[i];
      const start = i;
      let j = i + 1;
      while (j < s.length && s[j] !== quote) {
        if (s[j] === '\\') j += 1;
        j += 1;
      }
      // The literal's OWN extent, quotes included. A specifier's quotes must survive for the regex to
      // bracket it, so string bodies are NOT blanked — which is why the extent has to be recorded instead.
      ranges.push([start, Math.min(j + 1, s.length)]);
      if (quote === '`') { i += 1; blankTo(j); i = Math.min(j + 1, s.length); } else { i = Math.min(j + 1, s.length); }
    } else {
      i += 1;
    }
  }
  return { code: out.join(''), ranges };
}

/** Comments and template bodies blanked, length preserved. Thin wrapper over {@link scanSource}. */
export function blankCommentsAndStrings(src) {
  return scanSource(src).code;
}

const SPECIFIER_RE = /\bfrom\s+['"]([^'"]+)['"]|\bimport\s*\(\s*['"]([^'"]+)['"]\s*\)|^\s*import\s+['"]([^'"]+)['"]/gm;

/**
 * Every RELATIVE specifier in a module's source. Package and `node:` specifiers are dropped: they never name
 * a file in this repo, so they can never be an in-repo consumer edge.
 *
 * A MATCH WHOSE KEYWORD SITS INSIDE ANOTHER STRING IS NOT AN IMPORT. Blanking comments is not enough: a file
 * that contains import-shaped TEXT inside a quoted string — a test fixture, a generator template, an error
 * message quoting a line of code — otherwise reports an edge that does not exist. This module's own test file
 * is full of such fixtures and was the first thing it wrongly flagged. The specifier's own quotes must stay
 * readable for the regex to bracket them, so the fix is positional: {@link scanSource} records each string
 * literal's extent, and a `from` / `import` keyword landing inside one is discarded.
 *
 * This trims OVER-reporting. It does nothing for under-reporting, which is the direction that matters and
 * which {@link BLIND_SPOTS} names.
 *
 * @param {string} source
 * @returns {string[]} deduped, in first-seen order
 */
export function relativeImportsIn(source) {
  const { code, ranges } = scanSource(source);
  const inString = (idx) => ranges.some(([a, b]) => idx > a && idx < b - 1);
  const out = [];
  for (const m of code.matchAll(SPECIFIER_RE)) {
    if (inString(m.index)) continue;
    const spec = m[1] || m[2] || m[3];
    if (spec && spec.startsWith('.') && !out.includes(spec)) out.push(spec);
  }
  return out;
}

/**
 * Resolve a relative specifier against the importing file's directory → a repo-relative path.
 *
 * Pure path arithmetic, no `node:path` and no filesystem: a resolver that touched disk could not be unit
 * tested against a stub index, and this has to run over a stub in the tests that matter (the ones replaying
 * #3090 / #3091 / #3084). Returns `null` when the specifier climbs above the repo root, which a real import
 * cannot do.
 *
 * @param {string} fromFile - repo-relative path of the importing module, e.g. `scripts/readiness/x.mjs`
 * @param {string} specifier - a relative specifier, e.g. `../lib/gate-health.mjs`
 * @returns {string|null} repo-relative path, or null if it escapes the root
 */
export function resolveSpecifier(fromFile, specifier) {
  const segs = String(fromFile).split('/').slice(0, -1);
  for (const part of String(specifier).split('/')) {
    if (part === '' || part === '.') continue;
    if (part === '..') {
      if (segs.length === 0) return null; // climbed above the root
      segs.pop();
      continue;
    }
    segs.push(part);
  }
  return segs.length ? segs.join('/') : null;
}

/**
 * Reverse the import graph: target file → the files that import it.
 *
 * @param {Array<{file: string, source: string}>} sources - repo-relative paths and their text.
 * @returns {Map<string, string[]>} target → importers, both repo-relative, importers sorted.
 */
export function consumerIndex(sources) {
  const index = new Map();
  for (const { file, source } of Array.isArray(sources) ? sources : []) {
    if (!file) continue;
    for (const spec of relativeImportsIn(source ?? '')) {
      const target = resolveSpecifier(file, spec);
      if (!target || target === file) continue; // a self-import is not a consumer edge
      if (!index.has(target)) index.set(target, new Set());
      index.get(target).add(file);
    }
  }
  return new Map([...index].map(([k, v]) => [k, [...v].sort()]));
}

/** Is this repo-relative path a test file? Its own suite importing it is not a finding. */
export function isTestFile(file) {
  return /(^|\/)__tests__\//.test(file) || /\.test\.[cm]?[jt]sx?$/.test(file);
}

/**
 * For each file an item's `scope:` names, the importers that scope does NOT already cover.
 *
 * `coversFile` and `normScope` are IMPORTED from {@link ./scope-lease.mjs}, never reimplemented — they are
 * granularity-aware (a subtree or glob entry covers by prefix; a FILE entry covers only its exact path) and a
 * second matcher here would drift from the one the dispatcher decides lane contention with.
 *
 * @param {string[]} scope - the item's `scope:` entries, repo-qualified (`we:scripts/x.mjs`).
 * @param {Map<string, string[]>} index - from {@link consumerIndex}.
 * @param {{includeTests?: boolean}} [opts] - `includeTests` reports test importers too. Default false: a
 *   suite importing the module it tests is noise, UNLESS the scope names no test file at all, which the
 *   caller detects with {@link scopeNamesNoTest}.
 * @returns {Array<{file: string, importers: string[], uncovered: string[]}>} one row per scope entry that
 *   names a concrete file and has at least one importer. Sorted by scope entry.
 */
export function scopeConsumerGaps(scope, index, { includeTests = false } = {}) {
  const entries = normScope(scope);
  const rows = [];
  for (const entry of entries) {
    const colon = entry.indexOf(':');
    const path = colon < 0 ? entry : entry.slice(colon + 1);
    const importers = index.get(path) || [];
    if (!importers.length) continue;
    const considered = includeTests ? importers : importers.filter((f) => !isTestFile(f));
    const uncovered = considered.filter((f) => !entries.some((e) => coversFile(e, `${REPO}:${f}`)));
    // ONLY GAPS GET A ROW. A scope entry whose every importer is already named is the answer "yes, you
    // thought of them" — printing it would bury the finding in the thing the author already did right, and
    // the count below is the signal a caller acts on.
    if (!uncovered.length) continue;
    rows.push({ file: entry, importers: considered, uncovered });
  }
  return rows.sort((a, b) => a.file.localeCompare(b.file));
}

/** True when an item's scope names no test file — then a test importer IS worth reporting. */
export function scopeNamesNoTest(scope) {
  return !normScope(scope).some((e) => isTestFile(e.slice(e.indexOf(':') + 1)));
}

/**
 * The whole verdict for one item. Never throws on a shapeless scope — an item with no `scope:` is already
 * `unshaped-no-scope` to the dispatcher and this has nothing to add.
 *
 * @returns {{scope: string[], rows: Array<object>, uncoveredCount: number, testsOmitted: boolean}}
 */
export function assessScope(scope, index) {
  const testsOmitted = scopeNamesNoTest(scope);
  const rows = scopeConsumerGaps(scope, index, { includeTests: testsOmitted });
  return {
    scope: normScope(scope),
    rows,
    uncoveredCount: rows.reduce((n, r) => n + r.uncovered.length, 0),
    testsOmitted,
  };
}

/** The blind spots, as data, so a REPORT can print them and no reader infers completeness from silence. */
export const BLIND_SPOTS = Object.freeze([
  'a non-literal specifier — import(someVariable), createRequire, eval — is invisible to a static scan',
  'a module that imports nothing can still be HANDED a value at call time; injection is invisible',
  'a consumer reaching this code through a package specifier rather than a relative path is not followed',
  'dynamic registration (a table keyed by string, a sink registry) is a real consumer edge and is not an import',
]);

/**
 * Render one item's verdict as operator lines. Pure — the caller prints.
 *
 * THE CAVEATS RIDE WITH THE FINDING, not in a docblock only. A reader who sees a short list and no warning
 * concludes the list is complete, and it is not; that inference is the defect class this whole epic exists to
 * reduce, so it would be a poor look to reproduce it in the check's own output.
 */
export function renderVerdict(num, assessment) {
  if (!assessment.scope.length) return [`#${num} — no \`scope:\`; the dispatcher already calls that unshaped. Nothing to check.`];
  if (!assessment.uncoveredCount) return [`#${num} — every importer of the ${assessment.scope.length} scoped file(s) is already in scope.`];
  const lines = [
    `#${num} — ${assessment.uncoveredCount} importer(s) of this item's own scope are NOT in it:`,
    '',
  ];
  for (const row of assessment.rows) {
    lines.push(`  ${row.file}`);
    for (const f of row.uncovered) lines.push(`    ← we:${f}`);
  }
  lines.push('');
  lines.push('  A missing importer is a QUESTION, not an error: plenty of consumers need no change. But three');
  lines.push('  of the four items surveyed for #xl2q1zt burned review rounds on exactly these edges, so decide');
  lines.push('  deliberately rather than by omission — then either add it to `scope:` or say why not on the card.');
  if (assessment.testsOmitted) {
    lines.push('');
    lines.push('  (This scope names no test file, so test importers are listed too.)');
  }
  lines.push('');
  lines.push('  NOT EXHAUSTIVE — this is a static, literal-only scan:');
  for (const b of BLIND_SPOTS) lines.push(`    · ${b}`);
  return lines;
}

// ── THE IO SHELL ────────────────────────────────────────────────────────────────────────────────────────────
// Lazily imported inside `main` so importing the pure core above pulls in NO node built-ins beyond
// `scope-lease.mjs` — the same discipline `dispatch-plan.mjs` keeps, and what lets the tests above run the
// whole verdict over a stub index with no filesystem in sight.

async function main(argv) {
  const { readFileSync, readdirSync, statSync } = await import('node:fs');
  const { fileURLToPath } = await import('node:url');
  const { dirname, join, relative, sep } = await import('node:path');

  const HERE = dirname(fileURLToPath(import.meta.url));
  const ROOT = join(HERE, '..', '..');
  const flags = {};
  for (const a of argv) {
    if (!a.startsWith('--')) continue;
    const eq = a.indexOf('=');
    if (eq === -1) flags[a.slice(2)] = true;
    else flags[a.slice(2, eq)] = a.slice(eq + 1);
  }

  const SKIP = new Set(['node_modules', '.git', '_site', '.lanes', 'dist', 'coverage', '.operations']);
  const sources = [];
  (function walk(dir) {
    for (const name of readdirSync(dir)) {
      if (SKIP.has(name)) continue;
      const full = join(dir, name);
      const st = statSync(full);
      if (st.isDirectory()) { walk(full); continue; }
      if (!/\.[cm]?[jt]sx?$/.test(name)) continue;
      sources.push({ file: relative(ROOT, full).split(sep).join('/'), source: readFileSync(full, 'utf8') });
    }
  }(ROOT));
  const index = consumerIndex(sources);

  // The cards, read straight off disk — `scope:` is a flat YAML list of `- we:path` lines, which is all this
  // needs. A full frontmatter parse would buy nothing and would couple this to the loader.
  const backlogDir = join(ROOT, 'backlog');
  const cards = readdirSync(backlogDir).filter((f) => f.endsWith('.md'));
  const scopeOf = (text) => {
    const m = text.match(/\nscope:\n((?:[ \t]*-[ \t]*\S+\n)+)/);
    return m ? m[1].split('\n').map((l) => l.replace(/^[ \t]*-[ \t]*/, '').trim()).filter(Boolean) : [];
  };
  const statusOf = (text) => (text.match(/\nstatus:[ \t]*(\S+)/) || [])[1] || '';

  const want = flags.item ? String(flags.item) : null;
  const rows = [];
  for (const card of cards) {
    const num = card.split('-')[0];
    if (want && num !== want) continue;
    const text = readFileSync(join(backlogDir, card), 'utf8');
    if (!want && !['open', 'active'].includes(statusOf(text))) continue;
    const assessment = assessScope(scopeOf(text), index);
    if (assessment.uncoveredCount) rows.push({ num, card, assessment });
  }
  rows.sort((a, b) => b.assessment.uncoveredCount - a.assessment.uncoveredCount);

  // RETURN, NEVER `process.exit`, after writing to stdout — remedy (a) of #3061. A stdout write to a PIPE is
  // asynchronous once the payload passes the buffer, and `process.exit` tears the process down mid-drain, so
  // a parent CAPTURING this output silently gets the first 8 KB and a zero status. Invisible in a terminal,
  // which is the whole reason it is a gate rather than a convention. The `--json` mode here is unbounded and
  // would have been the first to lose its tail. Caught by `scripts/__tests__/stdout-flush.test.mjs` on this
  // very file, which is a fair advertisement for the rule.
  if (flags.json) {
    process.stdout.write(`${JSON.stringify({ scanned: sources.length, items: rows.map((r) => ({ num: r.num, uncoveredCount: r.assessment.uncoveredCount, rows: r.assessment.rows })), blindSpots: BLIND_SPOTS }, null, 2)}\n`);
    return;
  }
  if (!rows.length) {
    process.stdout.write(want ? `#${want} — no uncovered importers.\n` : 'No open item has an uncovered importer of its own scope.\n');
    return;
  }
  for (const r of rows) process.stdout.write(`${renderVerdict(r.num, r.assessment).join('\n')}\n\n`);
  // EXIT 0 ON FINDINGS, deliberately — and `exitCode` is left untouched, which IS zero. This warns; it never
  // blocks. A gate that failed here would teach authors to pad `scope:` until it went quiet, and a padded
  // scope makes every lane-overlap decision in `dispatch-plan.mjs` worse for everybody.
}

import { pathToFileURL } from 'node:url';
if (import.meta.url === pathToFileURL(process.argv[1] || '').href) {
  main(process.argv.slice(2));
}
